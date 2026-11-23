import { matchesSearch, normalizeSearchText } from './search.js';

describe('normalizeSearchText', () => {
  test('lowercases', () => {
    expect(normalizeSearchText('Lightning Bolt')).toBe('lightning bolt');
  });

  test('strips accents', () => {
    expect(normalizeSearchText('Lórien')).toBe('lorien');
  });

  test('strips hyphens', () => {
    expect(normalizeSearchText("Man-o'-War")).toBe('manowar');
  });

  test('strips apostrophes', () => {
    expect(normalizeSearchText("Urza's Tower")).toBe('urzas tower');
  });

  test('strips commas', () => {
    expect(normalizeSearchText('Goblin, Ringleader')).toBe('goblin ringleader');
  });

  test('strips double quotes', () => {
    expect(normalizeSearchText('"Foo"')).toBe('foo');
  });
});

describe('matchesSearch', () => {
  test('returns true when normalized name contains normalized query', () => {
    expect(matchesSearch("Man-o'-War", 'mano')).toBe(true);
  });

  test('returns false when query does not match', () => {
    expect(matchesSearch('Lightning Bolt', 'goblin')).toBe(false);
  });

  test('matches accented name with unaccented query', () => {
    expect(matchesSearch('Lorien Revealed', 'lorien')).toBe(true);
  });
});
