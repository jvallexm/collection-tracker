import { openDB } from 'idb';

const DB_NAME = 'collection-tracker';
const DB_VERSION = 3;

/**
 * Applies IndexedDB schema migrations incrementally from oldVersion to the current version.
 * Called automatically by idb's openDB when the database needs upgrading.
 * @param {import('idb').IDBPDatabase} db - The database instance being upgraded.
 * @param {number} oldVersion - The version the database is upgrading from (0 if new).
 */
export function upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    db.createObjectStore('cards');
    db.createObjectStore('collections');
  }
  if (oldVersion < 2) {
    // config keys: theme, showCKTools, sort:<setCode>, recentSets, openSets, sellQtys, foilSellQtys
    // deprecated: sell checkbox (sellIds per set) was removed from the UI; it was never persisted
    db.createObjectStore('config');
  }
  if (oldVersion < 3) {
    db.createObjectStore('tokens');
  }
}

/**
 * Opens (or creates) the IndexedDB database, running migrations as needed.
 * @returns {Promise<import('idb').IDBPDatabase>}
 */
export function openDatabase() {
  return openDB(DB_NAME, DB_VERSION, { upgrade });
}
