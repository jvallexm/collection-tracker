import { openDB } from 'idb';
import { openDatabase, upgrade } from './db.js';

describe('openDatabase', () => {
  test('creates all four stores on a fresh database', async () => {
    const db = await openDatabase();
    expect(db.objectStoreNames.contains('cards')).toBe(true);
    expect(db.objectStoreNames.contains('collections')).toBe(true);
    expect(db.objectStoreNames.contains('config')).toBe(true);
    expect(db.objectStoreNames.contains('tokens')).toBe(true);
    db.close();
  });

  test('does not create any stores when already at v3 or higher', () => {
    const db = { createObjectStore: vi.fn() };
    upgrade(db, 3);
    expect(db.createObjectStore).not.toHaveBeenCalled();
  });

  test('adds only the config store when upgrading from v1', async () => {
    const v1 = await openDB('collection-tracker', 1, {
      upgrade(db) {
        db.createObjectStore('cards');
        db.createObjectStore('collections');
      },
    });
    v1.close();

    const db = await openDatabase();
    expect(db.objectStoreNames.contains('config')).toBe(true);
    db.close();
  });

  test('adds only the tokens store when upgrading from v2', async () => {
    const v2 = await openDB('collection-tracker', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('cards');
          db.createObjectStore('collections');
        }
        if (oldVersion < 2) {
          db.createObjectStore('config');
        }
      },
    });
    v2.close();

    const db = await openDatabase();
    expect(db.objectStoreNames.contains('tokens')).toBe(true);
    db.close();
  });
});
