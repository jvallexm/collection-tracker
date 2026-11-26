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
