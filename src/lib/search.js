export function normalizeSearchText(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-,'"]/g, '')
    .toLowerCase();
}

export function matchesSearch(name, query) {
  return normalizeSearchText(name).includes(normalizeSearchText(query));
}
