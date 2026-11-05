import { loadCards, loadCollection, saveCards, saveCollection } from './storage.js';

vi.mock('./db.js', () => ({ openDatabase: vi.fn() }));
import { openDatabase } from './db.js';

const makeDb = (store = {}) => ({
  get: vi.fn((_, key) => Promise.resolve(store[key])),
  put: vi.fn(() => Promise.resolve()),
});

describe('loadCollection', () => {
  test('returns an empty collection when nothing is saved', async () => {
    openDatabase.mockResolvedValue(makeDb());
    expect(await loadCollection('ktk')).toEqual({});
  });

  test('returns the saved collection', async () => {
    openDatabase.mockResolvedValue(makeDb({ ktk: { a: 2 } }));
    expect(await loadCollection('ktk')).toEqual({ a: 2 });
  });

  test('returns an empty collection when the database errors', async () => {
    openDatabase.mockRejectedValue(new Error('db error'));
    expect(await loadCollection('ktk')).toEqual({});
  });
});

describe('saveCollection', () => {
  test('writes the collection to the collections store', async () => {
    const db = makeDb();
    openDatabase.mockResolvedValue(db);
    await saveCollection('ktk', { a: 2 });
    expect(db.put).toHaveBeenCalledWith('collections', { a: 2 }, 'ktk');
  });

  test('does not throw when the database errors', async () => {
    openDatabase.mockRejectedValue(new Error('db error'));
    await expect(saveCollection('ktk', {})).resolves.toBeUndefined();
  });
});

describe('loadCards', () => {
  test('returns null when no cards are cached for the set', async () => {
    openDatabase.mockResolvedValue(makeDb());
    expect(await loadCards('ktk')).toBeNull();
  });

  test('returns the cached cards for the set', async () => {
    const cards = [{ id: '1', name: 'Arrow' }];
    openDatabase.mockResolvedValue(makeDb({ ktk: cards }));
    expect(await loadCards('ktk')).toEqual(cards);
  });

  test('returns null when the database errors', async () => {
    openDatabase.mockRejectedValue(new Error('db error'));
    expect(await loadCards('ktk')).toBeNull();
  });
});

describe('saveCards', () => {
  test('writes the card list to the cards store', async () => {
    const db = makeDb();
    openDatabase.mockResolvedValue(db);
    const cards = [{ id: '1', name: 'Arrow' }];
    await saveCards('ktk', cards);
    expect(db.put).toHaveBeenCalledWith('cards', cards, 'ktk');
  });

  test('does not throw when the database errors', async () => {
    openDatabase.mockRejectedValue(new Error('db error'));
    await expect(saveCards('ktk', [])).resolves.toBeUndefined();
  });
});
