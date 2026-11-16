const PRICELIST_URL = 'https://api.cardkingdom.com/api/v2/pricelist';

function csvField(value) {
  const s = String(value);
  return s.includes(',') ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Builds a Card Kingdom buylist CSV from sell selections across multiple sets.
 * @param {Array<{ setName: string, cards: Object[], collection: Object, sellIds: Set<string> }>} setsData
 * @returns {string} CSV text ready to save or download.
 */
export function buildCKSellCsv(setsData) {
  const rows = ['card name,edition,foil,quantity'];
  for (const { setName, cards, collection, sellIds } of setsData) {
    for (const card of cards) {
      if (!sellIds.has(card.id)) continue;
      const entry = collection[card.id];
      const qty = entry?.qty ?? 0;
      const foil = entry?.foil ?? 0;
      if (qty > 0) rows.push(`${csvField(card.name)},${csvField(setName)},false,${qty}`);
      if (foil > 0) rows.push(`${csvField(card.name)},${csvField(setName)},true,${foil}`);
    }
  }
  return rows.join('\n');
}

/**
 * Fetches Card Kingdom's price list and returns a Map keyed by Scryfall ID.
 * Each entry has nonfoilBuy and foilBuy (USD as number, or null if not buying).
 * Returns null on network failure.
 * @returns {Promise<Map<string, { nonfoilBuy: number|null, foilBuy: number|null }>|null>}
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
  const map = new Map();
  for (const item of json.data) {
    if (!item.scryfall_id) continue;
    const price = parseFloat(item.price_buy);
    const buy = price > 0 ? price : null;
    const isFoil = item.is_foil === true || item.is_foil === 'true';
    const existing = map.get(item.scryfall_id) ?? {};
    map.set(
      item.scryfall_id,
      isFoil
        ? { ...existing, foilBuy: buy }
        : { ...existing, nonfoilBuy: buy },
    );
  }
  return map;
}
