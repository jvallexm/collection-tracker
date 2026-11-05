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
