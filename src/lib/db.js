import { openDB } from 'idb';

const DB_NAME = 'collection-tracker';
const DB_VERSION = 3;

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

export function openDatabase() {
  return openDB(DB_NAME, DB_VERSION, { upgrade });
}
