import { sortCards } from './sorting.js';

const CSV_HEADER =
  '"Count","Tradelist Count","Name","Edition","Condition","Language","Foil","Tags","Last Modified","Collector Number","Alter","Proxy","Purchase Price"';

/**
 * Formats a single Moxfield CSV row for one card entry.
 * @param {number} count - Quantity owned.
 * @param {string} name - Card name.
 * @param {string} edition - Set code, e.g. "KTK".
 * @param {string} foil - Empty string for nonfoil, "foil" for foil.
 * @returns {string} CSV row string.
 */
function csvRow(count, name, edition, foil) {
  return `"${count}","${count}","${name}","${edition.toLowerCase()}","Near Mint","English","${foil}","","","","False","False",""`;
}

/**
 * Builds a Moxfield-compatible CSV from owned cards across multiple sets.
 * @param {Array<{ cards: Object[], collection: Object }>} allSetsData
 * @returns {string} CSV text ready to save or download.
 */
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

/**
 * Builds a Moxfield import list (one card per line) for a single set.
 * @param {Object[]} cards - Normalized card objects.
 * @param {Object} collection - Map of cardId → { qty, foil }.
 * @returns {string} Plaintext list ready to paste into Moxfield.
 */
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
