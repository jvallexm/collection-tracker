import { makeCard } from '../test/fixtures.js';
import { buildMoxfieldList } from './moxfield.js';

const CARDS = [
  makeCard({ id: 'a', name: 'Zurgo', number: '12' }),
  makeCard({ id: 'b', name: 'Arrow', number: '3' }),
  makeCard({ id: 'c', name: 'Bolt', number: '7' }),
];

describe('buildMoxfieldList', () => {
  test('lists owned cards alphabetically in Moxfield format', () => {
    const list = buildMoxfieldList(CARDS, { a: 1, b: 4 });
    expect(list).toBe('4 Arrow (KTK) 3\n1 Zurgo (KTK) 12');
  });

  test('is empty when no cards are owned', () => {
    expect(buildMoxfieldList(CARDS, {})).toBe('');
  });
});
