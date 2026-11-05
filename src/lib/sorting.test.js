import { makeCard } from '../test/fixtures.js';
import { sortCards } from './sorting.js';

const CARDS = [
  makeCard({ id: 'a', name: 'Charm', rarity: 'rare', cost: '{R}', number: '10' }),
  makeCard({ id: 'b', name: 'Arrow', rarity: 'mythic', cost: '{2}{G}', number: '2' }),
  makeCard({ id: 'c', name: 'Bolt', rarity: 'common', cost: '{1}{U}', number: '33' }),
  makeCard({ id: 'd', name: 'Dragon', rarity: 'common', cost: '{4}{R}{R}', number: '7' }),
];

const idsAfterSorting = (key, direction) =>
  sortCards(CARDS, key, direction).map((card) => card.id);

describe('sortCards', () => {
  test('sorts by name in both directions', () => {
    expect(idsAfterSorting('name', 1)).toEqual(['b', 'c', 'a', 'd']);
    expect(idsAfterSorting('name', -1)).toEqual(['d', 'a', 'c', 'b']);
  });

  test('sorts by rarity rank, breaking ties by name', () => {
    expect(idsAfterSorting('rarity', 1)).toEqual(['c', 'd', 'a', 'b']);
    expect(idsAfterSorting('rarity', -1)).toEqual(['b', 'a', 'c', 'd']);
  });

  test('places unknown rarities before common', () => {
    const cards = [makeCard({ id: 'x', rarity: 'common' }), makeCard({ id: 'y', rarity: 'special' })];
    expect(sortCards(cards, 'rarity', 1).map((card) => card.id)).toEqual(['y', 'x']);
  });

  test('sorts by mana cost text', () => {
    expect(idsAfterSorting('cost', 1)).toEqual(['c', 'b', 'd', 'a']);
  });

  test('sorts collector numbers numerically, not alphabetically', () => {
    expect(idsAfterSorting('number', 1)).toEqual(['b', 'd', 'a', 'c']);
    expect(idsAfterSorting('number', -1)).toEqual(['c', 'a', 'd', 'b']);
  });

  test('does not modify the original list', () => {
    sortCards(CARDS, 'name', -1);
    expect(CARDS.map((card) => card.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
