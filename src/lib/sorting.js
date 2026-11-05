const RARITY_ORDER = ['common', 'uncommon', 'rare', 'mythic'];

const rarityRank = (card) => RARITY_ORDER.indexOf(card.rarity);
const compareByName = (a, b) => a.name.localeCompare(b.name);

// Each comparator returns a negative, zero or positive number (ascending order).
const COMPARATORS = {
  name: compareByName,
  rarity: (a, b) => rarityRank(a) - rarityRank(b),
  cost: (a, b) => a.cost.localeCompare(b.cost),
  number: (a, b) => parseInt(a.number, 10) - parseInt(b.number, 10),
};

/**
 * Returns a sorted copy of the cards array without modifying the original.
 * Ties are always broken alphabetically by card name.
 * @param {Object[]} cards - Array of normalized card objects to sort.
 * @param {'name'|'rarity'|'cost'|'number'} key - The column to sort by.
 * @param {1|-1} direction - 1 for ascending order, -1 for descending.
 * @returns {Object[]} A new array with the cards in the requested order.
 */
export function sortCards(cards, key, direction) {
  const compare = COMPARATORS[key];
  return [...cards].sort((a, b) => compare(a, b) * direction || compareByName(a, b));
}
