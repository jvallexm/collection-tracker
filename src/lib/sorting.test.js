import { makeCard } from '../test/fixtures.js';
import { sortCards } from './sorting.js';

const CARDS = [
  makeCard({ id: 'a', name: 'Charm', rarity: 'rare', cost: '{R}', number: '10' }),
  makeCard({ id: 'b', name: 'Arrow', rarity: 'mythic', cost: '{2}{G}', number: '2' }),
  makeCard({ id: 'c', name: 'Bolt', rarity: 'common', cost: '{1}{U}', number: '33' }),
  makeCard({ id: 'd', name: 'Dragon', rarity: 'common', cost: '{4}{R}{R}', number: '7' }),
];

const idsAfterSorting = (key, direction) => sortCards(CARDS, key, direction).map((card) => card.id);

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
    const cards = [
      makeCard({ id: 'x', rarity: 'common' }),
      makeCard({ id: 'y', rarity: 'special' }),
    ];
    expect(sortCards(cards, 'rarity', 1).map((card) => card.id)).toEqual(['y', 'x']);
  });

  test('sorts by mana cost text', () => {
    expect(idsAfterSorting('cost', 1)).toEqual(['c', 'b', 'd', 'a']);
  });

  test('sorts collector numbers numerically, not alphabetically', () => {
    expect(idsAfterSorting('number', 1)).toEqual(['b', 'd', 'a', 'c']);
    expect(idsAfterSorting('number', -1)).toEqual(['c', 'a', 'd', 'b']);
  });

  test('sorts non-numeric collector numbers (e.g. The List) lexicographically', () => {
    const cards = [
      makeCard({ id: 'x', name: 'Snap', number: 'ISD-30' }),
      makeCard({ id: 'y', name: 'Dark', number: 'ARN-5' }),
      makeCard({ id: 'z', name: 'Bolt', number: 'LEA-10' }),
    ];
    // ARN-5 < ISD-30 < LEA-10 lexicographically
    expect(sortCards(cards, 'number', 1).map((c) => c.id)).toEqual(['y', 'x', 'z']);
    expect(sortCards(cards, 'number', -1).map((c) => c.id)).toEqual(['z', 'x', 'y']);
  });

  test('sorts by priceFoil, with null prices last', () => {
    const cards = [
      makeCard({ id: 'a', name: 'A', priceFoil: '5.00' }),
      makeCard({ id: 'b', name: 'B', priceFoil: null }),
      makeCard({ id: 'c', name: 'C', priceFoil: '1.50' }),
    ];
    expect(sortCards(cards, 'priceFoil', 1).map((c) => c.id)).toEqual(['c', 'a', 'b']);
    expect(sortCards(cards, 'priceFoil', -1).map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });

  test('sorts by price (non-foil), with null prices last', () => {
    const cards = [
      makeCard({ id: 'a', name: 'A', price: '5.00' }),
      makeCard({ id: 'b', name: 'B', price: null }),
      makeCard({ id: 'c', name: 'C', price: '1.50' }),
      makeCard({ id: 'd', name: 'D', price: '10.00' }),
    ];
    expect(sortCards(cards, 'price', 1).map((c) => c.id)).toEqual(['c', 'a', 'd', 'b']);
    expect(sortCards(cards, 'price', -1).map((c) => c.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  test('does not modify the original list', () => {
    sortCards(CARDS, 'name', -1);
    expect(CARDS.map((card) => card.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
