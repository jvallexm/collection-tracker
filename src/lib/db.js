import { openDB } from 'idb';

const DB_NAME = 'collection-tracker';
const DB_VERSION = 2;

/**
 * Runs incremental schema migrations when the database version increases.
 * Exported for unit testing; not intended for direct use outside this module.
 * @param {import('idb').IDBPDatabase} db
 * @param {number} oldVersion
 */
export function upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    db.createObjectStore('cards');
    db.createObjectStore('collections');
  }
  if (oldVersion < 2) {
    db.createObjectStore('config');
  }
}

/**
 * Opens (or creates) the application IndexedDB database.
 * v1: `cards` store caches card lists by set code; `collections` saves quantities by set code.
 * v2: `config` store persists user preferences by key.
 * @returns {Promise<import('idb').IDBPDatabase>} Open database connection.
 */
export function openDatabase() {
  return openDB(DB_NAME, DB_VERSION, { upgrade });
}
