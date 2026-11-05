import { sortCards } from './sorting.js';

export function buildMoxfieldList(cards, collection) {
  const lines = [];
  for (const card of sortCards(cards, 'name', 1)) {
    const entry = collection[card.id];
    if (!entry) continue;
    if (entry.qty > 0) lines.push(`${entry.qty} ${card.name} (${card.set}) ${card.number}`);
    if (entry.foil > 0) lines.push(`${entry.foil}f ${card.name} (${card.set}) ${card.number}`);
  }
  return lines.join('\n');
}
