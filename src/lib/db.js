import { openDB } from 'idb';

const DB_NAME = 'collection-tracker';
const DB_VERSION = 1;

/**
 * Opens (or creates) the application IndexedDB database.
 * The `cards` store caches card lists by set code.
 * The `collections` store saves quantity data by set code.
 * @returns {Promise<import('idb').IDBPDatabase>} Open database connection.
 */
export function openDatabase() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('cards');
      db.createObjectStore('collections');
    },
  });
}
