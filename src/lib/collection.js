// A collection is a plain object: { [cardId]: { qty?: number, foil?: number } }.
const MAX_QUANTITY_DIGITS = 4;

export function sanitizeQuantityText(text) {
  return text.replace(/\D/g, '').slice(0, MAX_QUANTITY_DIGITS);
}

/**
 * Returns a new collection with one quantity field updated for a card.
 * If quantity is zero, removes the field; if both fields are then zero, removes the card entry.
 * @param {Object} collection - Map of cardId → { qty?, foil? }.
 * @param {string} cardId - The card to update.
 * @param {'qty'|'foil'} field - The field to update.
 * @param {'qty'|'foil'} other - The sibling field (kept if non-zero when field is removed).
 * @param {number} quantity - New quantity; 0 or NaN removes the field.
 * @returns {Object} Updated collection (new object, original unchanged).
 */
function withField(collection, cardId, field, other, quantity) {
  const entry = collection[cardId] ?? {};
  if (quantity > 0) {
    return { ...collection, [cardId]: { ...entry, [field]: quantity } };
  }
  const { [field]: _removed, ...rest } = entry;
  if (!rest[other]) {
    const { [cardId]: _, ...remaining } = collection;
    return remaining;
  }
  return { ...collection, [cardId]: rest };
}

export function withQuantity(collection, cardId, quantity) {
  return withField(collection, cardId, 'qty', 'foil', quantity);
}

export function withFoilQuantity(collection, cardId, quantity) {
  return withField(collection, cardId, 'foil', 'qty', quantity);
}

export function summarize(collection) {
  let unique = 0;
  let copies = 0;
  for (const entry of Object.values(collection)) {
    const qty = entry.qty || 0;
    const foil = entry.foil || 0;
    unique++;
    copies += qty + foil;
  }
  return { unique, copies };
}

/**
 * Merges all per-set collections into a single flat map.
 * Later sets overwrite earlier ones for the same card ID (duplicates are rare in practice).
 * @param {Object} collections - Map of setCode → collection.
 * @returns {Object} Flat map of cardId → { qty?, foil? }.
 */
export function mergeCollections(collections) {
  const merged = {};
  for (const coll of Object.values(collections)) Object.assign(merged, coll);
  return merged;
}

/**
 * Returns the IDs of all cards in a collection with at least one copy (regular or foil).
 * @param {Object} collection - Map of cardId → { qty?, foil? }.
 * @returns {string[]} Array of card IDs owned in non-zero quantity.
 */
export function ownedCardIds(collection) {
  return Object.entries(collection)
    .filter(([, e]) => (e?.qty ?? 0) > 0 || (e?.foil ?? 0) > 0)
    .map(([id]) => id);
}
