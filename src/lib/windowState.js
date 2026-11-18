export function openSet(sets, code, name) {
  const alreadyOpen = sets.some((s) => s.code === code);
  const base = alreadyOpen ? sets : [...sets, { code, name, minimized: true }];
  return base.map((s) => {
    if (s.code === code) return { ...s, minimized: false };
    if (!s.minimized) return { ...s, minimized: true };
    return s;
  });
}

export function minimizeSet(sets, code) {
  return sets.map((s) => (s.code === code ? { ...s, minimized: true } : s));
}

export function restoreSet(sets, code) {
  return sets.map((s) => {
    if (s.code === code) return { ...s, minimized: false };
    if (!s.minimized) return { ...s, minimized: true };
    return s;
  });
}

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

export function refreshSet(sets, code) {
  return sets.map((s) => (s.code === code ? { ...s, refreshKey: (s.refreshKey ?? 0) + 1 } : s));
}
