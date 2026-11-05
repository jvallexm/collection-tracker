import { sanitizeQuantityText, summarize, withQuantity } from './collection.js';

describe('sanitizeQuantityText', () => {
  test('removes anything that is not a digit', () => {
    expect(sanitizeQuantityText('a1b2')).toBe('12');
  });

  test('limits the length to four digits', () => {
    expect(sanitizeQuantityText('123456')).toBe('1234');
  });
});

describe('withQuantity', () => {
  test('adds or updates a card without changing the original', () => {
    const original = { a: 1 };
    expect(withQuantity(original, 'b', 3)).toEqual({ a: 1, b: 3 });
    expect(original).toEqual({ a: 1 });
  });

  test('removes the card when the quantity is zero or not a number', () => {
    expect(withQuantity({ a: 1, b: 2 }, 'a', 0)).toEqual({ b: 2 });
    expect(withQuantity({ a: 1, b: 2 }, 'b', NaN)).toEqual({ a: 1 });
  });
});

describe('summarize', () => {
  test('counts unique cards and total copies', () => {
    expect(summarize({ a: 2, b: 3 })).toEqual({ unique: 2, copies: 5 });
  });

  test('handles an empty collection', () => {
    expect(summarize({})).toEqual({ unique: 0, copies: 0 });
  });
});
