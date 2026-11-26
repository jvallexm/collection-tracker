/**
 * Opens a set window, making it active and minimizing any currently active set.
 * If the set is already open, restores it; otherwise appends it.
 * @param {Object[]} sets - Current openSets array.
 * @param {string} code - Set code to open.
 * @param {string} name - Set display name.
 * @returns {Object[]} Updated sets array.
 */
export function openSet(sets, code, name) {
  const alreadyOpen = sets.some((s) => s.code === code);
  const base = alreadyOpen ? sets : [...sets, { code, name, minimized: true }];
  return base.map((s) => {
    if (s.code === code) return { ...s, minimized: false };
    if (!s.minimized) return { ...s, minimized: true };
    return s;
  });
}

/**
 * Minimizes a single set window.
 * @param {Object[]} sets
 * @param {string} code
 * @returns {Object[]}
 */
export function minimizeSet(sets, code) {
  return sets.map((s) => (s.code === code ? { ...s, minimized: true } : s));
}

/**
 * Restores a minimized set window to active, minimizing any currently active set.
 * @param {Object[]} sets
 * @param {string} code
 * @returns {Object[]}
 */
export function restoreSet(sets, code) {
  return sets.map((s) => {
    if (s.code === code) return { ...s, minimized: false };
    if (!s.minimized) return { ...s, minimized: true };
    return s;
  });
}

/**
 * Closes a set window. If the closed set was active, automatically restores
 * the first minimized set so there is always an active window when possible.
 * @param {Object[]} sets
 * @param {string} code
 * @returns {Object[]}
 */
export function closeSet(sets, code) {
  const closing = sets.find((s) => s.code === code);
  const remaining = sets.filter((s) => s.code !== code);
  if (!closing?.minimized) {
    const firstMinimized = remaining.find((s) => s.minimized);
    if (firstMinimized) {
      return remaining.map((s) =>
        s.code === firstMinimized.code ? { ...s, minimized: false } : s,
      );
    }
  }
  return remaining;
}

/**
 * Increments the refreshKey on a set, causing its SetTracker to remount and re-fetch cards.
 * @param {Object[]} sets
 * @param {string} code
 * @returns {Object[]}
 */
export function refreshSet(sets, code) {
  return sets.map((s) => (s.code === code ? { ...s, refreshKey: (s.refreshKey ?? 0) + 1 } : s));
}
