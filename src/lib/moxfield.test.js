import { makeCard } from '../test/fixtures.js';
import { buildMoxfieldCsv, buildMoxfieldList } from './moxfield.js';

const CARDS = [
  makeCard({ id: 'a', name: 'Zurgo', number: '12' }),
  makeCard({ id: 'b', name: 'Arrow', number: '3' }),
  makeCard({ id: 'c', name: 'Bolt', number: '7' }),
];

const HEADER = '"Count","Tradelist Count","Name","Edition","Condition","Language","Foil","Tags","Last Modified","Collector Number","Alter","Proxy","Purchase Price"';

describe('buildMoxfieldCsv', () => {
  test('returns only the header when collection is empty', () => {
    const csv = buildMoxfieldCsv([{ cards: CARDS, collection: {} }]);
    expect(csv).toBe(HEADER);
  });

  test('includes regular card rows sorted alphabetically', () => {
    const csv = buildMoxfieldCsv([{ cards: CARDS, collection: { a: { qty: 1 }, b: { qty: 2 } } }]);
    expect(csv).toBe(
      HEADER + '\n' +
      '"2","2","Arrow","ktk","Near Mint","English","","","","","False","False",""\n' +
      '"1","1","Zurgo","ktk","Near Mint","English","","","","","False","False",""',
    );
  });

  test('includes foil rows with the foil column set', () => {
    const csv = buildMoxfieldCsv([{ cards: CARDS, collection: { b: { foil: 2 } } }]);
    expect(csv).toBe(
      HEADER + '\n' +
      '"2","2","Arrow","ktk","Near Mint","English","foil","","","","False","False",""',
    );
  });

  test('emits both regular and foil rows for a card with both', () => {
    const csv = buildMoxfieldCsv([{ cards: CARDS, collection: { b: { qty: 3, foil: 1 } } }]);
    expect(csv).toBe(
      HEADER + '\n' +
      '"3","3","Arrow","ktk","Near Mint","English","","","","","False","False",""\n' +
      '"1","1","Arrow","ktk","Near Mint","English","foil","","","","False","False",""',
    );
  });

  test('merges cards from multiple sets', () => {
    const SET2 = [makeCard({ id: 'd', name: 'Mist', number: '5', set: 'ELD' })];
    const csv = buildMoxfieldCsv([
      { cards: CARDS, collection: { b: { qty: 1 } } },
      { cards: SET2, collection: { d: { qty: 2 } } },
    ]);
    expect(csv).toContain('"1","1","Arrow","ktk"');
    expect(csv).toContain('"2","2","Mist","eld"');
  });
});

describe('buildMoxfieldList', () => {
  test('lists owned cards alphabetically in Moxfield format', () => {
    const list = buildMoxfieldList(CARDS, { a: { qty: 1 }, b: { qty: 4 } });
    expect(list).toBe('4 Arrow (KTK) 3\n1 Zurgo (KTK) 12');
  });

  test('emits a foil line suffixed with f for foil copies', () => {
    const list = buildMoxfieldList(CARDS, { b: { foil: 2 } });
    expect(list).toBe('2f Arrow (KTK) 3');
  });

  test('emits both regular and foil lines when a card has both', () => {
    const list = buildMoxfieldList(CARDS, { b: { qty: 3, foil: 1 } });
    expect(list).toBe('3 Arrow (KTK) 3\n1f Arrow (KTK) 3');
  });

  test('is empty when no cards are owned', () => {
    expect(buildMoxfieldList(CARDS, {})).toBe('');
  });
});
