import { makeCard } from '../test/fixtures.js';
import { buildMoxfieldList } from './moxfield.js';

const CARDS = [
  makeCard({ id: 'a', name: 'Zurgo', number: '12' }),
  makeCard({ id: 'b', name: 'Arrow', number: '3' }),
  makeCard({ id: 'c', name: 'Bolt', number: '7' }),
];

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
