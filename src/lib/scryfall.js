import { loadCards, saveCards } from './storage.js';

const SEARCH_ENDPOINT = 'https://api.scryfall.com/cards/search';
const DELAY_BETWEEN_PAGES_MS = 100; // Scryfall asks clients to pause between requests.

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Builds the Scryfall search URL for all cards in a given set.
 * Results are deduplicated (unique=cards) and ordered by name.
 * @param {string} setCode - Three-letter set code, e.g. "ktk".
 * @returns {string} Full URL ready to fetch from the Scryfall API.
 */
export function buildSearchUrl(setCode) {
  const query = encodeURIComponent(`set:${setCode}`);
  return `${SEARCH_ENDPOINT}?q=${query}&unique=cards&order=name`;
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
    return rawCard.card_faces.map((face) => face.mana_cost).filter(Boolean).join(' // ');
  }
  return '';
}

/**
 * Trims a raw Scryfall card object down to only the fields this app uses.
 * @param {Object} rawCard - Raw card object from the Scryfall API.
 * @returns {{ id: string, name: string, rarity: string, cost: string, number: string, set: string }}
 */
export function normalizeCard(rawCard) {
  return {
    id: rawCard.id,
    name: rawCard.name,
    rarity: rawCard.rarity,
    cost: getManaCost(rawCard),
    number: rawCard.collector_number,
    set: rawCard.set.toUpperCase(),
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
export async function fetchSetCards(setCode) {
  const cached = await loadCards(setCode);
  if (cached) return cached;

  const cards = [];
  let nextUrl = buildSearchUrl(setCode);

  while (nextUrl) {
    const response = await fetch(nextUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`Scryfall request failed (HTTP ${response.status})`);
    }

    const page = await response.json();
    cards.push(...page.data.map(normalizeCard));

    nextUrl = page.has_more ? page.next_page : null;
    if (nextUrl) await delay(DELAY_BETWEEN_PAGES_MS);
  }

  await saveCards(setCode, cards);
  return cards;
}
