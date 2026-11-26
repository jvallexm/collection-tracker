import { loadCards, loadCollection, saveCards, loadConfig, saveConfig } from './storage.js';
import { ownedCardIds } from './collection.js';
import { EXCLUDED_SET_TYPES } from './constants.js';

const SEARCH_ENDPOINT = 'https://api.scryfall.com/cards/search';
const SETS_ENDPOINT = 'https://api.scryfall.com/sets';
const COLLECTION_ENDPOINT = 'https://api.scryfall.com/cards/collection';
const BULK_DATA_ENDPOINT = 'https://api.scryfall.com/bulk-data';
const COLLECTION_BATCH_SIZE = 75;
const DELAY_BETWEEN_PAGES_MS = 200; // Scryfall asks clients to pause between requests.
const BULK_STALE_MS = 12 * 60 * 60 * 1000; // 12 hours

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Serialize all Scryfall page fetches to avoid concurrent requests hitting the rate limit.
let _scryfallQueue = Promise.resolve();
export function _resetQueueForTesting() {
  _scryfallQueue = Promise.resolve();
}
function enqueue(fn) {
  const task = _scryfallQueue.then(fn);
  _scryfallQueue = task.catch(() => {}).then(() => delay(DELAY_BETWEEN_PAGES_MS));
  return task;
}

/**
 * Builds the Scryfall search URL for all cards in a given set.
 * Results include all prints (unique=prints) so alternate art treatments are included.
 * @param {string} setCode - Three-letter set code, e.g. "ktk".
 * @returns {string} Full URL ready to fetch from the Scryfall API.
 */
export function buildSearchUrl(setCode) {
  const query = encodeURIComponent(`set:${setCode}`);
  return `${SEARCH_ENDPOINT}?q=${query}&unique=prints&order=name`;
}

/**
 * Extracts the mana cost from a raw Scryfall card object.
 * Single-faced cards store it at the top level; double-faced cards store it per face.
 * @param {Object} rawCard - Raw card object from the Scryfall API.
 * @returns {string} Mana cost string, e.g. "{2}{W}" or "{R} // {U}" for two-faced cards.
 */
function getManaCost(rawCard) {
  if (rawCard.mana_cost !== undefined) return rawCard.mana_cost;
  if (rawCard.card_faces) {
    return rawCard.card_faces
      .map((face) => face.mana_cost)
      .filter(Boolean)
      .join(' // ');
  }
  return '';
}

/**
 * Trims a raw Scryfall card object down to only the fields this app uses.
 * @param {Object} rawCard - Raw card object from the Scryfall API.
 * @returns {{ id: string, name: string, rarity: string, cost: string, number: string, set: string }}
 */
export function normalizeCard(rawCard) {
  const finishes = rawCard.finishes ?? ['nonfoil', 'foil'];
  return {
    id: rawCard.id,
    name: rawCard.name,
    rarity: rawCard.rarity,
    cost: getManaCost(rawCard),
    number: rawCard.collector_number,
    set: rawCard.set.toUpperCase(),
    reserved: rawCard.reserved ?? false,
    price: rawCard.prices?.usd ?? null,
    priceFoil: rawCard.prices?.usd_foil ?? null,
    nonfoil: finishes.includes('nonfoil'),
    foil: finishes.includes('foil') || finishes.includes('etched'),
  };
}

/**
 * Returns every card in a set, using an IndexedDB cache to avoid re-fetching.
 * On the first call for a set it downloads all pages from Scryfall and stores the result.
 * On subsequent calls it returns the cached data immediately without hitting the network.
 * Waits 100 ms between page requests as requested by Scryfall's API guidelines.
 * @param {string} setCode - Three-letter set code, e.g. "ktk".
 * @returns {Promise<Object[]>} Resolves to a flat array of normalized card objects.
 * @throws {Error} If any Scryfall request returns a non-OK HTTP status.
 */
/**
 * Returns every Magic set known to Scryfall as a lightweight { code, name } pair.
 * @returns {Promise<{ code: string, name: string }[]>}
 * @throws {Error} If the Scryfall request fails.
 */
export async function fetchSet(code) {
  const response = await fetch(`${SETS_ENDPOINT}/${encodeURIComponent(code)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (EXCLUDED_SET_TYPES.has(data.set_type)) return null;
  return { code: data.code, name: data.name, set_type: data.set_type };
}

export async function fetchSets() {
  const response = await fetch(SETS_ENDPOINT, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Scryfall request failed (HTTP ${response.status})`);
  const json = await response.json();
  return json.data
    .filter(({ set_type }) => !EXCLUDED_SET_TYPES.has(set_type))
    .map(({ code, name, set_type }) => ({ code, name, set_type }));
}

function fetchCardsFromScryfall(setCode, onPage) {
  return enqueue(async () => {
    const cards = [];
    let nextUrl = buildSearchUrl(setCode);

    while (nextUrl) {
      const response = await fetch(nextUrl, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Scryfall request failed (HTTP ${response.status})`);
      const page = await response.json();
      cards.push(...page.data.filter((c) => !c.digital).map(normalizeCard));
      onPage?.(cards.slice());
      nextUrl = page.has_more ? page.next_page : null;
      if (nextUrl) await delay(DELAY_BETWEEN_PAGES_MS);
    }

    await delay(DELAY_BETWEEN_PAGES_MS);
    return cards;
  });
}

export async function refreshSetCardPrices(setCode) {
  const [cached, collection, bulkTimestamp] = await Promise.all([
    loadCards(setCode),
    loadCollection(setCode),
    loadConfig('bulkTimestamp'),
  ]);
  console.log(
    `[Scryfall] refreshSetCardPrices(${setCode}): cached=${!!cached}, bulkAge=${bulkTimestamp ? Math.round((Date.now() - bulkTimestamp) / 1000) + 's' : 'none'}`,
  );
  if (!cached) return { main: [], tokens: null };

  if (bulkTimestamp && Date.now() - bulkTimestamp < BULK_STALE_MS) {
    console.log(`[Scryfall] refreshSetCardPrices(${setCode}): bulk fresh, skipping network`);
    const cachedTokens = await loadCards(`t${setCode}`);
    return { main: cached, tokens: cachedTokens ?? null };
  }

  const ownedIds = ownedCardIds(collection);
  console.log(
    `[Scryfall] refreshSetCardPrices(${setCode}): bulk stale, fetching ${ownedIds.length} owned cards`,
  );

  let updated = cached;
  if (ownedIds.length > 0) {
    const freshCards = await fetchCardsByIds(ownedIds);
    const priceMap = new Map(
      freshCards.map((c) => [c.id, { price: c.price, priceFoil: c.priceFoil }]),
    );
    updated = cached.map((card) => ({ ...card, ...(priceMap.get(card.id) ?? {}) }));
    await saveCards(setCode, updated);
  }

  const tokenCode = `t${setCode}`;
  const [cachedTokens, tokenCollection] = await Promise.all([
    loadCards(tokenCode),
    loadCollection(tokenCode),
  ]);
  let updatedTokens = null;
  if (cachedTokens) {
    const ownedTokenIds = ownedCardIds(tokenCollection);
    if (ownedTokenIds.length > 0) {
      const freshTokens = await fetchCardsByIds(ownedTokenIds).catch(() => null);
      if (freshTokens) {
        const tPriceMap = new Map(
          freshTokens.map((c) => [c.id, { price: c.price, priceFoil: c.priceFoil }]),
        );
        updatedTokens = cachedTokens.map((card) => ({
          ...card,
          ...(tPriceMap.get(card.id) ?? {}),
        }));
        await saveCards(tokenCode, updatedTokens);
      }
    } else {
      updatedTokens = cachedTokens;
    }
  }

  return { main: updated, tokens: updatedTokens };
}

export async function fetchTokenCards(setCode) {
  const tokenCode = `t${setCode}`;
  const cached = await loadCards(tokenCode);
  if (cached) return cached;
  const fresh = await fetchCardsFromScryfall(tokenCode).catch(() => null);
  if (fresh) await saveCards(tokenCode, fresh);
  return fresh ?? [];
}

export async function fetchSetCards(setCode, onPage) {
  const cached = await loadCards(setCode);
  if (cached) return cached;

  const tokenCode = `t${setCode}`;
  const [mainCards, tokenCards] = await Promise.all([
    fetchCardsFromScryfall(setCode, onPage),
    fetchCardsFromScryfall(tokenCode).catch(() => null),
  ]);

  await saveCards(setCode, mainCards);
  if (tokenCards) await saveCards(tokenCode, tokenCards);
  return mainCards;
}

export async function fetchCardsByIds(ids) {
  if (ids.length === 0) return [];
  console.log(
    `[Scryfall] fetchCardsByIds: ${ids.length} ids, ${Math.ceil(ids.length / COLLECTION_BATCH_SIZE)} batches`,
  );
  const cards = [];
  for (let i = 0; i < ids.length; i += COLLECTION_BATCH_SIZE) {
    const batch = ids.slice(i, i + COLLECTION_BATCH_SIZE);
    const batchCards = await enqueue(async () => {
      const response = await fetch(COLLECTION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ identifiers: batch.map((id) => ({ id })) }),
      });
      if (!response.ok) throw new Error(`Scryfall request failed (HTTP ${response.status})`);
      const json = await response.json();
      await delay(DELAY_BETWEEN_PAGES_MS);
      return json.data.map(normalizeCard);
    });
    cards.push(...batchCards);
  }
  return cards;
}

export async function refreshBulkDataIfStale() {
  const ts = await loadConfig('bulkTimestamp');
  if (ts && Date.now() - ts < BULK_STALE_MS) return;

  console.log('[Scryfall] refreshBulkDataIfStale: fetching bulk data metadata');
  const metaRes = await fetch(BULK_DATA_ENDPOINT, { headers: { Accept: 'application/json' } });
  if (!metaRes.ok) throw new Error(`Scryfall bulk-data request failed (HTTP ${metaRes.status})`);
  const meta = await metaRes.json();
  const bulkEntry = meta.data?.find((d) => d.type === 'default_cards');
  if (!bulkEntry?.download_uri)
    throw new Error('Scryfall bulk-data: default_cards entry not found');
  const { download_uri } = bulkEntry;
  console.log('[Scryfall] refreshBulkDataIfStale: downloading', download_uri);

  const dataRes = await fetch(download_uri, { headers: { Accept: 'application/json' } });
  if (!dataRes.ok) throw new Error(`Scryfall bulk download failed (HTTP ${dataRes.status})`);
  const cards = await dataRes.json();

  const bySet = {};
  for (const card of cards) {
    if (card.digital) continue;
    const normalized = normalizeCard(card);
    (bySet[normalized.set.toLowerCase()] ??= []).push(normalized);
  }
  for (const [code, setCards] of Object.entries(bySet)) {
    await saveCards(code, setCards);
  }
  await saveConfig('bulkTimestamp', Date.now());
  console.log(
    '[Scryfall] refreshBulkDataIfStale: done, saved',
    Object.keys(bySet).length,
    'sets to IDB',
  );
}
