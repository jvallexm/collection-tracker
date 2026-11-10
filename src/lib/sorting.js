const RARITY_ORDER = ['common', 'uncommon', 'rare', 'mythic'];

const rarityRank = (card) => RARITY_ORDER.indexOf(card.rarity);
const compareByName = (a, b) => a.name.localeCompare(b.name);

// Each comparator returns a negative, zero or positive number (ascending order).
const COMPARATORS = {
  name: compareByName,
  rarity: (a, b) => rarityRank(a) - rarityRank(b),
  cost: (a, b) => a.cost.localeCompare(b.cost),
  number: (a, b) => {
    const na = parseInt(a.number, 10);
    const nb = parseInt(b.number, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.number.localeCompare(b.number);
  },
  price: (a, b) => {
    const na = a.price != null ? parseFloat(a.price) : Infinity;
    const nb = b.price != null ? parseFloat(b.price) : Infinity;
    return na - nb;
  },
  priceFoil: (a, b) => {
    const na = a.priceFoil != null ? parseFloat(a.priceFoil) : Infinity;
    const nb = b.priceFoil != null ? parseFloat(b.priceFoil) : Infinity;
    return na - nb;
  },
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
