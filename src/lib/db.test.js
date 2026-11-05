import { openDB } from 'idb';
import { openDatabase, upgrade } from './db.js';

describe('openDatabase', () => {
  test('creates all three stores on a fresh database', async () => {
    const db = await openDatabase();
    expect(db.objectStoreNames.contains('cards')).toBe(true);
    expect(db.objectStoreNames.contains('collections')).toBe(true);
    expect(db.objectStoreNames.contains('config')).toBe(true);
    db.close();
  });

  test('does not create any stores when already at v2 or higher', () => {
    const db = { createObjectStore: vi.fn() };
    upgrade(db, 2);
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
});
