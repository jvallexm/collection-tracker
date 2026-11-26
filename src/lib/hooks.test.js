import { act, renderHook } from '@testing-library/react';
import { loadConfig, saveConfig } from './storage.js';
import { useDebouncedSearch, usePersistedConfig } from './hooks.js';

vi.mock('./storage.js', () => ({
  loadConfig: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn().mockResolvedValue(undefined),
}));

describe('useDebouncedSearch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('displayValue updates immediately on change', () => {
    const { result } = renderHook(() => useDebouncedSearch());
    act(() => result.current.onChange('foo'));
    expect(result.current.displayValue).toBe('foo');
  });

  test('committedValue starts empty', () => {
    const { result } = renderHook(() => useDebouncedSearch());
    expect(result.current.committedValue).toBe('');
  });

  test('committedValue updates after 150ms debounce', () => {
    const { result } = renderHook(() => useDebouncedSearch());
    act(() => result.current.onChange('foo'));
    expect(result.current.committedValue).toBe('');
    act(() => vi.advanceTimersByTime(150));
    expect(result.current.committedValue).toBe('foo');
  });

  test('commit() updates committedValue immediately', () => {
    const { result } = renderHook(() => useDebouncedSearch());
    act(() => result.current.onChange('foo'));
    act(() => result.current.commit());
    expect(result.current.committedValue).toBe('foo');
  });

  test('commit() cancels the pending debounce timer', () => {
    const { result } = renderHook(() => useDebouncedSearch());
    act(() => result.current.onChange('foo'));
    act(() => result.current.commit());
    act(() => result.current.onChange('bar')); // new uncommitted change
    expect(result.current.committedValue).toBe('foo'); // timer didn't fire for 'foo' again
  });

  test('deletion commits after 150ms timer', () => {
    const { result } = renderHook(() => useDebouncedSearch());
    act(() => {
      result.current.onChange('bolt');
      vi.advanceTimersByTime(150);
    });
    act(() => result.current.onChange('bol')); // delete
    expect(result.current.committedValue).toBe('bolt'); // timer pending, not fired yet
    act(() => vi.advanceTimersByTime(150));
    expect(result.current.committedValue).toBe('bol');
  });

  test('2 chars after deletion commits immediately without waiting for timer', () => {
    const { result } = renderHook(() => useDebouncedSearch());
    act(() => {
      result.current.onChange('bolt');
      vi.advanceTimersByTime(150);
    });
    act(() => result.current.onChange('bo')); // delete
    act(() => result.current.onChange('bol')); // +1 char after delete
    expect(result.current.committedValue).toBe('bolt'); // not yet
    act(() => result.current.onChange('bola')); // +2 chars → auto-commit
    expect(result.current.committedValue).toBe('bola');
  });

  test('150ms after deletion commits even with only 1 new char', () => {
    const { result } = renderHook(() => useDebouncedSearch());
    act(() => {
      result.current.onChange('bolt');
      vi.advanceTimersByTime(150);
    });
    act(() => result.current.onChange('bo')); // delete
    act(() => result.current.onChange('bol')); // +1 char (not enough to auto-commit)
    expect(result.current.committedValue).toBe('bolt'); // still old value
    act(() => vi.advanceTimersByTime(150));
    expect(result.current.committedValue).toBe('bol');
  });

  test('respects custom delay', () => {
    const { result } = renderHook(() => useDebouncedSearch(300));
    act(() => result.current.onChange('foo'));
    act(() => vi.advanceTimersByTime(150));
    expect(result.current.committedValue).toBe('');
    act(() => vi.advanceTimersByTime(150));
    expect(result.current.committedValue).toBe('foo');
  });
});

describe('usePersistedConfig', () => {
  beforeEach(() => {
    loadConfig.mockResolvedValue(null);
    saveConfig.mockResolvedValue(undefined);
  });

  test('returns defaultValue before load completes', () => {
    loadConfig.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePersistedConfig('theme', 'light'));
    expect(result.current[0]).toBe('light');
  });

  test('returns saved value after load resolves', async () => {
    loadConfig.mockResolvedValue('dark');
    const { result } = renderHook(() => usePersistedConfig('theme', 'light'));
    await act(async () => {});
    expect(result.current[0]).toBe('dark');
  });

  test('returns defaultValue when nothing is saved', async () => {
    loadConfig.mockResolvedValue(null);
    const { result } = renderHook(() => usePersistedConfig('theme', 'light'));
    await act(async () => {});
    expect(result.current[0]).toBe('light');
  });

  test('functional updater receives defaultValue when called before load completes', () => {
    loadConfig.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePersistedConfig('key', 42));
    act(() => result.current[1]((current) => current + 1));
    expect(result.current[0]).toBe(43);
  });

  test('calls saveConfig when value is set by caller', async () => {
    const { result } = renderHook(() => usePersistedConfig('theme', 'light'));
    await act(async () => {});
    saveConfig.mockClear();
    act(() => result.current[1]('dark'));
    expect(saveConfig).toHaveBeenCalledWith('theme', 'dark');
  });

  test('does not call saveConfig before load completes', () => {
    loadConfig.mockReturnValue(new Promise(() => {}));
    renderHook(() => usePersistedConfig('theme', 'light'));
    expect(saveConfig).not.toHaveBeenCalled();
  });

  test('reloads when key changes', async () => {
    loadConfig.mockImplementation((key) =>
      Promise.resolve(key === 'sort:ktk' ? { key: 'name' } : { key: 'number' }),
    );
    const { result, rerender } = renderHook(({ code }) => usePersistedConfig(`sort:${code}`, {}), {
      initialProps: { code: 'ktk' },
    });
    await act(async () => {});
    expect(result.current[0]).toEqual({ key: 'name' });

    rerender({ code: 'eld' });
    await act(async () => {});
    expect(result.current[0]).toEqual({ key: 'number' });
  });

  test('setValue before load completes is not overwritten when load resolves', async () => {
    let resolveLoad;
    loadConfig.mockReturnValue(
      new Promise((r) => {
        resolveLoad = r;
      }),
    );
    const { result } = renderHook(() => usePersistedConfig('showSellModal', false));
    act(() => result.current[1](true)); // user sets value before IDB resolves
    act(() => resolveLoad(null)); // IDB resolves with null (would default to false)
    await act(async () => {});
    expect(result.current[0]).toBe(true); // user's choice wins
  });

  test('cancels inflight load when key changes', async () => {
    let resolveFirst;
    loadConfig
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolveFirst = r;
          }),
      )
      .mockResolvedValueOnce('dark');

    const { result, rerender } = renderHook(({ key }) => usePersistedConfig(key, 'light'), {
      initialProps: { key: 'theme' },
    });
    rerender({ key: 'other' });
    await act(async () => {});
    act(() => resolveFirst('stale'));
    expect(result.current[0]).toBe('dark');
  });
});
