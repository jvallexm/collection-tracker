import {
  deleteCards,
  loadAllCollectionKeys,
  loadCards,
  loadCollection,
  loadConfig,
  saveCards,
  saveCollection,
  saveConfig,
} from './storage.js';

vi.mock('./db.js', () => ({ openDatabase: vi.fn() }));
import { openDatabase } from './db.js';

const makeDb = (store = {}) => ({
  get: vi.fn((_, key) => Promise.resolve(store[key])),
  put: vi.fn(() => Promise.resolve()),
  getAllKeys: vi.fn(() => Promise.resolve([])),
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

describe('deleteCards', () => {
  test('deletes the card cache entry for the set', async () => {
    const db = { ...makeDb(), delete: vi.fn(() => Promise.resolve()) };
    openDatabase.mockResolvedValue(db);
    await deleteCards('ktk');
    expect(db.delete).toHaveBeenCalledWith('cards', 'ktk');
  });

  test('does not throw when the database errors', async () => {
    openDatabase.mockRejectedValue(new Error('db error'));
    await expect(deleteCards('ktk')).resolves.toBeUndefined();
  });
});

describe('loadConfig', () => {
  test('returns null when no config value is saved', async () => {
    openDatabase.mockResolvedValue(makeDb());
    expect(await loadConfig('theme')).toBeNull();
  });

  test('returns the saved config value', async () => {
    openDatabase.mockResolvedValue(makeDb({ theme: 'dark' }));
    expect(await loadConfig('theme')).toBe('dark');
  });

  test('returns null when the database errors', async () => {
    openDatabase.mockRejectedValue(new Error('db error'));
    expect(await loadConfig('theme')).toBeNull();
  });
});

describe('saveConfig', () => {
  test('writes the value to the config store', async () => {
    const db = makeDb();
    openDatabase.mockResolvedValue(db);
    await saveConfig('theme', 'dark');
    expect(db.put).toHaveBeenCalledWith('config', 'dark', 'theme');
  });

  test('does not throw when the database errors', async () => {
    openDatabase.mockRejectedValue(new Error('db error'));
    await expect(saveConfig('theme', 'dark')).resolves.toBeUndefined();
  });
});

describe('loadAllCollectionKeys', () => {
  test('returns all keys from the collections store', async () => {
    const db = { ...makeDb(), getAllKeys: vi.fn().mockResolvedValue(['ktk', 'eld']) };
    openDatabase.mockResolvedValue(db);
    expect(await loadAllCollectionKeys()).toEqual(['ktk', 'eld']);
  });

  test('returns an empty array when no collections exist', async () => {
    openDatabase.mockResolvedValue(makeDb());
    expect(await loadAllCollectionKeys()).toEqual([]);
  });

  test('returns an empty array when the database errors', async () => {
    openDatabase.mockRejectedValue(new Error('db error'));
    expect(await loadAllCollectionKeys()).toEqual([]);
  });
});
