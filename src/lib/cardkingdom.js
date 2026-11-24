const PRICELIST_URL = 'https://api.cardkingdom.com/api/v2/pricelist';

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
