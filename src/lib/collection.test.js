import { sanitizeQuantityText, summarize, withFoilQuantity, withQuantity } from './collection.js';

describe('sanitizeQuantityText', () => {
  test('removes anything that is not a digit', () => {
    expect(sanitizeQuantityText('a1b2')).toBe('12');
  });

  test('limits the length to four digits', () => {
    expect(sanitizeQuantityText('123456')).toBe('1234');
  });
});

describe('withQuantity', () => {
  test('adds a card entry with a qty field', () => {
    expect(withQuantity({}, 'a', 3)).toEqual({ a: { qty: 3 } });
  });

  test('updates qty without touching a foil value already on the entry', () => {
    expect(withQuantity({ a: { foil: 2 } }, 'a', 5)).toEqual({ a: { qty: 5, foil: 2 } });
  });

  test('removes qty from the entry when quantity is zero', () => {
    expect(withQuantity({ a: { qty: 3, foil: 1 } }, 'a', 0)).toEqual({ a: { foil: 1 } });
  });

  test('removes the card entirely when qty drops to zero and there are no foils', () => {
    expect(withQuantity({ a: { qty: 3 }, b: { qty: 1 } }, 'a', 0)).toEqual({ b: { qty: 1 } });
  });

  test('removes the card when quantity is NaN', () => {
    expect(withQuantity({ a: { qty: 1 } }, 'a', NaN)).toEqual({});
  });

  test('does not change the original collection', () => {
    const original = { a: { qty: 1 } };
    withQuantity(original, 'b', 3);
    expect(original).toEqual({ a: { qty: 1 } });
  });
});

describe('withFoilQuantity', () => {
  test('adds a card entry with a foil field', () => {
    expect(withFoilQuantity({}, 'a', 2)).toEqual({ a: { foil: 2 } });
  });

  test('updates foil without touching a qty value already on the entry', () => {
    expect(withFoilQuantity({ a: { qty: 3 } }, 'a', 1)).toEqual({ a: { qty: 3, foil: 1 } });
  });

  test('removes foil from the entry when quantity is zero', () => {
    expect(withFoilQuantity({ a: { qty: 3, foil: 1 } }, 'a', 0)).toEqual({ a: { qty: 3 } });
  });

  test('removes the card entirely when foil drops to zero and there are no regular copies', () => {
    expect(withFoilQuantity({ a: { foil: 2 }, b: { qty: 1 } }, 'a', 0)).toEqual({ b: { qty: 1 } });
  });

  test('removes the card when quantity is NaN', () => {
    expect(withFoilQuantity({ a: { foil: 1 } }, 'a', NaN)).toEqual({});
  });
});

describe('summarize', () => {
  test('counts unique cards and total copies across qty and foil', () => {
    expect(summarize({ a: { qty: 2, foil: 1 }, b: { qty: 3 } })).toEqual({ unique: 2, copies: 6 });
  });

  test('handles entries with only foil copies', () => {
    expect(summarize({ a: { foil: 2 } })).toEqual({ unique: 1, copies: 2 });
  });

  test('handles an empty collection', () => {
    expect(summarize({})).toEqual({ unique: 0, copies: 0 });
  });
});
