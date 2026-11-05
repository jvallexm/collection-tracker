// A collection is a plain object: { [cardId]: quantityOwned }.
const MAX_QUANTITY_DIGITS = 4;

/**
 * Strips anything that isn't a digit and limits the result to 4 characters.
 * Used to clean up raw keyboard input before parsing it as a quantity.
 * @param {string} text - Raw text typed into a quantity input field.
 * @returns {string} Digits only, at most 4 characters long.
 */
export function sanitizeQuantityText(text) {
  return text.replace(/\D/g, '').slice(0, MAX_QUANTITY_DIGITS);
}

/**
 * Returns a new collection with the given card's quantity updated.
 * If the quantity is zero or negative the card is removed from the collection entirely.
 * @param {Object} collection - Current collection map of cardId → quantity.
 * @param {string} cardId - The Scryfall card ID to update.
 * @param {number} quantity - How many copies the user owns.
 * @returns {Object} A new collection object with the change applied.
 */
export function withQuantity(collection, cardId, quantity) {
  const updated = { ...collection };
  if (quantity > 0) {
    updated[cardId] = quantity;
  } else {
    delete updated[cardId];
  }
  return updated;
}

/**
 * Counts how many distinct cards and total copies are in the collection.
 * @param {Object} collection - Collection map of cardId → quantity.
 * @returns {{ unique: number, copies: number }} Number of distinct cards owned and total copy count.
 */
export function summarize(collection) {
  const quantities = Object.values(collection);
  return {
    unique: quantities.length,
    copies: quantities.reduce((sum, quantity) => sum + quantity, 0),
  };
}
