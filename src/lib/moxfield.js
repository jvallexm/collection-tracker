import { sortCards } from './sorting.js';

// Moxfield import format: "<quantity> <name> (<SET>) <collector number>"
const formatLine = (card, quantity) => `${quantity} ${card.name} (${card.set}) ${card.number}`;

/**
 * Builds a Moxfield-compatible import list from the user's collection.
 * Only cards the user owns at least one copy of are included.
 * Cards are sorted alphabetically by name before being formatted.
 * @param {Object[]} cards - Full list of cards in the set.
 * @param {Object} collection - Collection map of cardId → quantity.
 * @returns {string} Multi-line string ready to paste into Moxfield's import box.
 */
export function buildMoxfieldList(cards, collection) {
  const ownedCards = cards.filter((card) => collection[card.id] > 0);
  return sortCards(ownedCards, 'name', 1)
    .map((card) => formatLine(card, collection[card.id]))
    .join('\n');
}
