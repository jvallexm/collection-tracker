/**
 * Strips diacritics, punctuation, and lowercases a string for fuzzy comparison.
 * @param {string} s
 * @returns {string}
 */
export function normalizeSearchText(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-,'"]/g, '')
    .toLowerCase();
}

/**
 * Returns true if the card name contains the query string (diacritic- and punctuation-insensitive).
 * @param {string} name - Card name.
 * @param {string} query - Search string typed by the user.
 * @returns {boolean}
 */
export function matchesSearch(name, query) {
  return normalizeSearchText(name).includes(normalizeSearchText(query));
}
