// A collection is a plain object: { [cardId]: { qty?: number, foil?: number } }.
const MAX_QUANTITY_DIGITS = 4;

export function sanitizeQuantityText(text) {
  return text.replace(/\D/g, '').slice(0, MAX_QUANTITY_DIGITS);
}

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

export function mergeCollections(collections) {
  const merged = {};
  for (const coll of Object.values(collections)) Object.assign(merged, coll);
  return merged;
}

export function ownedCardIds(collection) {
  return Object.entries(collection)
    .filter(([, e]) => (e?.qty ?? 0) > 0 || (e?.foil ?? 0) > 0)
    .map(([id]) => id);
}
