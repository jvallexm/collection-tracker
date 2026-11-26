const PRICELIST_URL = 'https://api.cardkingdom.com/api/v2/pricelist';

/**
 * Escapes a value for CSV output, quoting it if it contains a comma.
 * @param {*} value - Value to format.
 * @returns {string} CSV-safe string.
 */
function csvField(value) {
  const s = String(value);
  return s.includes(',') ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Builds a Card Kingdom buylist CSV from sell quantities across multiple sets.
 * @param {Array<{ setName: string, cards: Object[], sellCollection: Object }>} setsData
 *   sellCollection maps cardId → { qty?: number, foil?: number } of quantities to sell.
 * @returns {string} CSV text ready to save or download.
 */
export function buildCKSellCsv(setsData) {
  const rows = ['card name,edition,foil,quantity'];
  for (const { setName, cards, sellCollection } of setsData) {
    for (const card of cards) {
      const sell = sellCollection[card.id];
      if (!sell) continue;
      if (sell.qty > 0) rows.push(`${csvField(card.name)},${csvField(setName)},false,${sell.qty}`);
      if (sell.foil > 0) rows.push(`${csvField(card.name)},${csvField(setName)},true,${sell.foil}`);
    }
  }
  return rows.join('\n');
}

/**
 * Fetches Card Kingdom's price list.
 * Returns { prices, tokenItems } where prices is a Map keyed by Scryfall ID and
 * tokenItems is an array of raw CK pricelist entries where item.name includes 'Token'.
 * Returns null on network failure.
 * @returns {Promise<{ prices: Map<string, { nonfoilBuy: number|null, foilBuy: number|null }>, tokenItems: Array }|null>}
 */
export async function fetchCKPrices() {
  let response;
  try {
    response = await fetch(PRICELIST_URL);
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const json = await response.json();
  const prices = new Map();
  const tokenItems = [];
  for (const item of json.data) {
    if (item.name.includes('Token')) tokenItems.push(item);
    if (!item.scryfall_id) continue;
    const price = parseFloat(item.price_buy);
    const buy = price > 0 ? price : null;
    const isFoil = item.is_foil === true || item.is_foil === 'true';
    const existing = prices.get(item.scryfall_id) ?? {};
    prices.set(
      item.scryfall_id,
      isFoil ? { ...existing, foilBuy: buy } : { ...existing, nonfoilBuy: buy },
    );
  }
  return { prices, tokenItems };
}

/**
 * Converts a raw CK pricelist item into a normalized card object.
 * @param {Object} item - Raw CK pricelist entry with scryfall_id, name, sku, variation, etc.
 * @param {string} setCode - Three-letter set code, e.g. "ktk".
 * @returns {Object} Normalized card object.
 */
function toCKCard(item, setCode) {
  return {
    id: item.scryfall_id,
    name: item.name,
    rarity: 'common',
    cost: '',
    number: item.variation || item.sku.split('-').slice(1).join('-'),
    set: setCode.toUpperCase(),
    reserved: false,
    price: item.price_retail ?? null,
    priceFoil: null,
    nonfoil: item.is_foil !== 'true' && item.is_foil !== true,
    foil: item.is_foil === 'true' || item.is_foil === true,
  };
}

/**
 * Builds normalized token card objects for a set.
 * Uses MTGJSON data as source of truth when available, with CK prices merged in by scryfall_id.
 * Falls back to CK pricelist SKU-prefix matching when no MTGJSON data exists for the set.
 * @param {Object[]} mtgjsonTokenCards - Processed MTGJSON tokens: [{ id, name, number }].
 * @param {Object[]} ckTokenItems - Raw CK pricelist entries where item.name includes 'Token'.
 * @param {string} setCode - Three-letter set code, e.g. "ktk".
 * @returns {Object[]} Array of normalized card objects ready for CardTable.
 */
export function buildTokenCards(mtgjsonTokenCards, ckTokenItems, setCode) {
  if (mtgjsonTokenCards.length > 0) {
    const priceMap = new Map();
    for (const item of ckTokenItems) {
      if (item.is_foil === 'true' || item.is_foil === true) continue;
      if (!item.scryfall_id) continue;
      if (!priceMap.has(item.scryfall_id)) {
        priceMap.set(item.scryfall_id, item.price_retail ?? null);
      }
    }
    return mtgjsonTokenCards.map((token) => ({
      id: token.id,
      name: token.name,
      rarity: 'common',
      cost: '',
      number: token.number,
      set: setCode.toUpperCase(),
      reserved: false,
      price: priceMap.get(token.id) ?? null,
      priceFoil: null,
      nonfoil: true,
      foil: false,
    }));
  }

  const prefix = 'T' + setCode.toUpperCase() + '-';
  return ckTokenItems
    .filter((item) => item.sku.toUpperCase().startsWith(prefix) && item.scryfall_id)
    .map((item) => toCKCard(item, setCode));
}
