// A collection is a plain object: { [cardId]: { qty?: number, foil?: number } }.
const MAX_QUANTITY_DIGITS = 4;

export function sanitizeQuantityText(text) {
  return text.replace(/\D/g, '').slice(0, MAX_QUANTITY_DIGITS);
}

export function withQuantity(collection, cardId, quantity) {
  const entry = collection[cardId] ?? {};
  if (quantity > 0) {
    return { ...collection, [cardId]: { ...entry, qty: quantity } };
  }
  const { qty: _q, ...rest } = entry;
  if (!rest.foil) {
    const { [cardId]: _, ...remaining } = collection;
    return remaining;
  }
  return { ...collection, [cardId]: rest };
}

export function withFoilQuantity(collection, cardId, quantity) {
  const entry = collection[cardId] ?? {};
  if (quantity > 0) {
    return { ...collection, [cardId]: { ...entry, foil: quantity } };
  }
  const { foil: _f, ...rest } = entry;
  if (!rest.qty) {
    const { [cardId]: _, ...remaining } = collection;
    return remaining;
  }
  return { ...collection, [cardId]: rest };
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
