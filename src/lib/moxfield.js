import { sortCards } from './sorting.js';

const CSV_HEADER = '"Count","Tradelist Count","Name","Edition","Condition","Language","Foil","Tags","Last Modified","Collector Number","Alter","Proxy","Purchase Price"';

function csvRow(count, name, edition, foil) {
  return `"${count}","${count}","${name}","${edition.toLowerCase()}","Near Mint","English","${foil}","","","","False","False",""`;
}

export function buildMoxfieldCsv(allSetsData) {
  const rows = [CSV_HEADER];
  for (const { cards, collection } of allSetsData) {
    for (const card of sortCards(cards, 'name', 1)) {
      const entry = collection[card.id];
      if (!entry) continue;
      if (entry.qty > 0) rows.push(csvRow(entry.qty, card.name, card.set, ''));
      if (entry.foil > 0) rows.push(csvRow(entry.foil, card.name, card.set, 'foil'));
    }
  }
  return rows.join('\n');
}

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
