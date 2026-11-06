import { openDatabase } from './db.js';

/**
 * Reads the saved collection for a set from IndexedDB.
 * Returns an empty object if nothing has been saved yet or if the database errors.
 * @param {string} setCode - Three-letter set code, e.g. "ktk".
 * @returns {Promise<Object>} Collection map of cardId → quantity.
 */
export async function loadCollection(setCode) {
  try {
    const db = await openDatabase();
    return (await db.get('collections', setCode)) ?? {};
  } catch {
    return {};
  }
}

/**
 * Writes the current collection for a set to IndexedDB so it persists across page reloads.
 * Silently does nothing if the database errors.
 * @param {string} setCode - Three-letter set code, e.g. "ktk".
 * @param {Object} collection - Collection map of cardId → quantity to persist.
 * @returns {Promise<void>}
 */
export async function saveCollection(setCode, collection) {
  try {
    const db = await openDatabase();
    await db.put('collections', collection, setCode);
  } catch {
    // Database unavailable; tracking keeps working in memory.
  }
}

/**
 * Reads the cached card list for a set from IndexedDB.
 * Returns null if nothing has been cached yet or if the database errors.
 * @param {string} setCode - Three-letter set code, e.g. "ktk".
 * @returns {Promise<Object[]|null>} Array of normalized card objects, or null on a cache miss.
 */
export async function loadCards(setCode) {
  try {
    const db = await openDatabase();
    return (await db.get('cards', setCode)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Removes the cached card list for a set from IndexedDB so the next fetch hits the network.
 * Silently does nothing if the database errors.
 * @param {string} setCode - Three-letter set code, e.g. "ktk".
 * @returns {Promise<void>}
 */
export async function deleteCards(setCode) {
  try {
    const db = await openDatabase();
    await db.delete('cards', setCode);
  } catch {
    // Database unavailable; cache entry may persist but will be overwritten on next save.
  }
}

/**
 * Writes the card list for a set to IndexedDB so future loads skip the network.
 * Silently does nothing if the database errors.
 * @param {string} setCode - Three-letter set code, e.g. "ktk".
 * @param {Object[]} cards - Array of normalized card objects to cache.
 * @returns {Promise<void>}
 */
export async function saveCards(setCode, cards) {
  try {
    const db = await openDatabase();
    await db.put('cards', cards, setCode);
  } catch {
    // Database unavailable; app still works with in-memory data.
  }
}

/**
 * Reads a user config value from IndexedDB.
 * Returns null if the key has no saved value or if the database errors.
 * @param {string} key - Config key, e.g. "theme".
 * @returns {Promise<*>} The saved value, or null on a miss.
 */
export async function loadConfig(key) {
  try {
    const db = await openDatabase();
    return (await db.get('config', key)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Writes a user config value to IndexedDB so it persists across sessions.
 * Silently does nothing if the database errors.
 * @param {string} key - Config key, e.g. "theme".
 * @param {*} value - Value to persist.
 * @returns {Promise<void>}
 */
export async function saveConfig(key, value) {
  try {
    const db = await openDatabase();
    await db.put('config', value, key);
  } catch {
    // Database unavailable; preference is not persisted.
  }
}

/**
 * Returns all set codes that have a saved collection entry in IndexedDB.
 * Returns an empty array if the database errors or no collections exist.
 * @returns {Promise<string[]>} Array of set codes, e.g. ["ktk", "eld"].
 */
export async function loadAllCollectionKeys() {
  try {
    const db = await openDatabase();
    return await db.getAllKeys('collections');
  } catch {
    return [];
  }
}
