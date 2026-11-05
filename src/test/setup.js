import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';

// Keep every test independent of the one before it.
afterEach(() => {
  globalThis.indexedDB = new IDBFactory();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
