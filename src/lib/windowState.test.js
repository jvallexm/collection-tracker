import { closeSet, minimizeSet, openSet, refreshSet, restoreSet } from './windowState.js';

const set = (code, opts = {}) => ({ code, name: code.toUpperCase(), minimized: false, ...opts });

describe('openSet', () => {
  test('adds a new set as minimized then activates it', () => {
    const result = openSet([], 'ktk', 'Khans of Tarkir');
    expect(result).toEqual([{ code: 'ktk', name: 'Khans of Tarkir', minimized: false }]);
  });

  test('activates an already-open set without duplicating it', () => {
    const sets = [set('ktk', { minimized: true }), set('eld')];
    const result = openSet(sets, 'ktk', 'Khans');
    expect(result.filter((s) => s.code === 'ktk')).toHaveLength(1);
    expect(result.find((s) => s.code === 'ktk').minimized).toBe(false);
  });

  test('minimizes the currently active set when activating another', () => {
    const sets = [set('eld'), set('ktk', { minimized: true })];
    const result = openSet(sets, 'ktk', 'Khans');
    expect(result.find((s) => s.code === 'eld').minimized).toBe(true);
    expect(result.find((s) => s.code === 'ktk').minimized).toBe(false);
  });

  test('does not change already-minimized sets', () => {
    const sets = [set('eld'), set('ktk', { minimized: true }), set('ltr', { minimized: true })];
    const result = openSet(sets, 'eld', 'Eldraine');
    expect(result.find((s) => s.code === 'ltr').minimized).toBe(true);
  });
});

describe('minimizeSet', () => {
  test('sets minimized to true for the target', () => {
    const sets = [set('ktk'), set('eld', { minimized: true })];
    const result = minimizeSet(sets, 'ktk');
    expect(result.find((s) => s.code === 'ktk').minimized).toBe(true);
  });

  test('leaves other sets unchanged', () => {
    const sets = [set('ktk'), set('eld')];
    const result = minimizeSet(sets, 'ktk');
    expect(result.find((s) => s.code === 'eld').minimized).toBe(false);
  });
});

describe('restoreSet', () => {
  test('sets the target to not minimized', () => {
    const sets = [set('ktk', { minimized: true })];
    expect(restoreSet(sets, 'ktk')[0].minimized).toBe(false);
  });

  test('minimizes the currently active set', () => {
    const sets = [set('eld'), set('ktk', { minimized: true })];
    const result = restoreSet(sets, 'ktk');
    expect(result.find((s) => s.code === 'eld').minimized).toBe(true);
    expect(result.find((s) => s.code === 'ktk').minimized).toBe(false);
  });
});

describe('closeSet', () => {
  test('removes the set from the array', () => {
    const sets = [set('ktk'), set('eld', { minimized: true })];
    const result = closeSet(sets, 'ktk');
    expect(result.find((s) => s.code === 'ktk')).toBeUndefined();
    expect(result).toHaveLength(1);
  });

  test('auto-restores the first minimized set when closing the active one', () => {
    const sets = [set('ktk'), set('eld', { minimized: true }), set('ltr', { minimized: true })];
    const result = closeSet(sets, 'ktk');
    expect(result.find((s) => s.code === 'eld').minimized).toBe(false);
    expect(result.find((s) => s.code === 'ltr').minimized).toBe(true);
  });

  test('does not auto-restore when closing a minimized set', () => {
    const sets = [set('ktk'), set('eld', { minimized: true })];
    const result = closeSet(sets, 'eld');
    expect(result.find((s) => s.code === 'ktk').minimized).toBe(false);
  });
});

describe('refreshSet', () => {
  test('increments the refreshKey of the target set', () => {
    const sets = [set('ktk')];
    expect(refreshSet(sets, 'ktk')[0].refreshKey).toBe(1);
  });

  test('increments from an existing refreshKey', () => {
    const sets = [set('ktk', { refreshKey: 3 })];
    expect(refreshSet(sets, 'ktk')[0].refreshKey).toBe(4);
  });

  test('leaves other sets unchanged', () => {
    const sets = [set('ktk'), set('eld')];
    const result = refreshSet(sets, 'ktk');
    expect(result.find((s) => s.code === 'eld').refreshKey).toBeUndefined();
  });
});
