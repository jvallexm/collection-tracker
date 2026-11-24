import { openDB } from 'idb';

const DB_NAME = 'collection-tracker';
const DB_VERSION = 3;

export function upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    db.createObjectStore('cards');
    db.createObjectStore('collections');
  }
  if (oldVersion < 2) {
    db.createObjectStore('config');
  }
  if (oldVersion < 3) {
    db.createObjectStore('tokens');
  }
}

export function openDatabase() {
  return openDB(DB_NAME, DB_VERSION, { upgrade });
}
