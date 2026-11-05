import { act, fireEvent, render, screen } from '@testing-library/react';
import { fetchSetCards, fetchSets } from './lib/scryfall.js';
import { loadCollection, loadConfig, saveCollection, saveConfig } from './lib/storage.js';
import App from './App.jsx';

vi.mock('./lib/scryfall.js', () => ({
  fetchSetCards: vi.fn().mockResolvedValue([]),
  fetchSets: vi.fn().mockResolvedValue([]),
}));
vi.mock('./lib/storage.js', () => ({
  loadCollection: vi.fn().mockResolvedValue({}),
  saveCollection: vi.fn().mockResolvedValue(undefined),
  loadCards: vi.fn().mockResolvedValue(null),
  saveCards: vi.fn().mockResolvedValue(undefined),
  loadConfig: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  loadConfig.mockResolvedValue(null);
  fetchSets.mockResolvedValue([]);
});

async function renderApp() {
  render(<App />);
  await act(async () => {});
}

test('starts in light mode by default', async () => {
  await renderApp();
  expect(document.querySelector('.app-root').classList.contains('light')).toBe(true);
});

test('applies a saved dark theme on load', async () => {
  loadConfig.mockResolvedValue('dark');
  await renderApp();
  expect(document.querySelector('.app-root').classList.contains('dark')).toBe(true);
});

test('saves the theme to config when changed', async () => {
  await renderApp();
  fireEvent.click(screen.getByText('View'));
  fireEvent.click(screen.getByText('Dark Mode'));
  expect(saveConfig).toHaveBeenCalledWith('theme', 'dark');
});

test('defaults to KTK when no open sets are saved', async () => {
  await renderApp();
  expect(screen.getByRole('button', { name: 'Minimize' })).not.toBeNull();
});

test('restores open sets from config on load', async () => {
  loadConfig.mockImplementation((key) => {
    if (key === 'openSets')
      return Promise.resolve([
        { code: 'eld', name: 'Throne of Eldraine', minimized: false },
        { code: 'ktk', name: 'Khans of Tarkir', minimized: true },
      ]);
    return Promise.resolve(null);
  });
  await renderApp();
  expect(screen.getByRole('button', { name: 'Minimize' })).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Restore' })).not.toBeNull();
});

test('saves open sets to config when a set is opened', async () => {
  fetchSets.mockResolvedValue([{ code: 'eld', name: 'Throne of Eldraine' }]);
  await renderApp();
  fireEvent.click(screen.getByText('Add Set'));
  await act(async () => {});
  fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'eld' } });
  fireEvent.click(screen.getByRole('button', { name: 'Throne of Eldraine' }));
  expect(saveConfig).toHaveBeenCalledWith('openSets', expect.arrayContaining([
    expect.objectContaining({ code: 'eld', minimized: false }),
  ]));
});

describe('App recent sets', () => {
  test('shows KTK as a default recent set before config loads', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('My Collection'));
    expect(screen.getByRole('button', { name: 'Khans of Tarkir' })).not.toBeNull();
  });

  test('opening a set prepends it to recent and saves to config', async () => {
    fetchSets.mockResolvedValue([{ code: 'eld', name: 'Throne of Eldraine' }]);
    await renderApp();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'eld' } });
    fireEvent.click(screen.getByRole('button', { name: 'Throne of Eldraine' }));

    expect(saveConfig).toHaveBeenCalledWith('recentSets', [
      { code: 'eld', name: 'Throne of Eldraine' },
      { code: 'ktk', name: 'Khans of Tarkir' },
    ]);
  });

  test('opening a set already in recent deduplicates it', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('My Collection'));
    fireEvent.click(screen.getByRole('button', { name: 'Khans of Tarkir' }));

    expect(saveConfig).toHaveBeenCalledWith('recentSets', [
      { code: 'ktk', name: 'Khans of Tarkir' },
    ]);
  });

  test('recent sets list is capped at 3', async () => {
    loadConfig.mockImplementation((key) => {
      if (key === 'recentSets')
        return Promise.resolve([
          { code: 'a', name: 'Set A' },
          { code: 'b', name: 'Set B' },
          { code: 'c', name: 'Set C' },
        ]);
      return Promise.resolve(null);
    });
    fetchSets.mockResolvedValue([{ code: 'd', name: 'Set D' }]);
    await renderApp();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'Set D' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set D' }));

    expect(saveConfig).toHaveBeenCalledWith('recentSets', [
      { code: 'd', name: 'Set D' },
      { code: 'a', name: 'Set A' },
      { code: 'b', name: 'Set B' },
    ]);
  });
});

describe('App multi-set windows', () => {
  test('renders a window for each open set', async () => {
    fetchSets.mockResolvedValue([{ code: 'eld', name: 'Throne of Eldraine' }]);
    await renderApp();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'eld' } });
    fireEvent.click(screen.getByRole('button', { name: 'Throne of Eldraine' }));

    expect(screen.getByRole('button', { name: 'Minimize', hidden: true })).not.toBeNull();
  });

  test('opening a new set minimizes the current one', async () => {
    fetchSets.mockResolvedValue([{ code: 'eld', name: 'Throne of Eldraine' }]);
    await renderApp();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'eld' } });
    fireEvent.click(screen.getByRole('button', { name: 'Throne of Eldraine' }));

    expect(screen.getByRole('button', { name: 'Restore' })).not.toBeNull();
  });

  test('opening an already-open set restores it and minimizes the active one', async () => {
    fetchSets.mockResolvedValue([{ code: 'eld', name: 'Throne of Eldraine' }]);
    await renderApp();
    // Open ELD — KTK minimizes
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'eld' } });
    fireEvent.click(screen.getByRole('button', { name: 'Throne of Eldraine' }));
    // Re-open KTK from My Collection — ELD should minimize, KTK should restore
    fireEvent.click(screen.getByText('My Collection'));
    fireEvent.click(screen.getByRole('button', { name: 'Khans of Tarkir' }));

    expect(screen.getByRole('button', { name: 'Minimize' })).not.toBeNull();
  });

  test('clicking minimize on one window leaves other windows unchanged', async () => {
    fetchSets.mockResolvedValue([{ code: 'eld', name: 'Throne of Eldraine' }]);
    await renderApp();
    // Open ELD — now KTK(minimized) + ELD(active)
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'eld' } });
    fireEvent.click(screen.getByRole('button', { name: 'Throne of Eldraine' }));
    // Minimize ELD — KTK should stay minimized (false branch in handleMinimize map)
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));

    expect(screen.getAllByRole('button', { name: 'Restore' })).toHaveLength(2);
  });

  test('restoring a minimized window minimizes the active one', async () => {
    fetchSets.mockResolvedValue([{ code: 'eld', name: 'Throne of Eldraine' }]);
    await renderApp();
    // Open ELD — KTK(minimized) + ELD(active)
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'eld' } });
    fireEvent.click(screen.getByRole('button', { name: 'Throne of Eldraine' }));
    // Restore KTK — ELD should minimize, KTK becomes active
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    expect(screen.getByRole('button', { name: 'Minimize' })).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Restore' })).toHaveLength(1);
  });

  test('opening a third set leaves already-minimized windows minimized', async () => {
    fetchSets.mockResolvedValue([
      { code: 'eld', name: 'Throne of Eldraine' },
      { code: 'znr', name: 'Zendikar Rising' },
    ]);
    await renderApp();
    // Open ELD — KTK minimizes
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'eld' } });
    fireEvent.click(screen.getByRole('button', { name: 'Throne of Eldraine' }));
    // Open ZNR — ELD minimizes, KTK stays minimized
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'znr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zendikar Rising' }));

    expect(screen.getAllByRole('button', { name: 'Restore' })).toHaveLength(2);
  });

  test('restoring with two already-minimized windows leaves the other minimized', async () => {
    fetchSets.mockResolvedValue([
      { code: 'eld', name: 'Throne of Eldraine' },
      { code: 'znr', name: 'Zendikar Rising' },
    ]);
    await renderApp();
    // Open ELD — KTK minimizes
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'eld' } });
    fireEvent.click(screen.getByRole('button', { name: 'Throne of Eldraine' }));
    // Open ZNR — ELD minimizes, KTK stays minimized: [KTK(min), ELD(min), ZNR(active)]
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'znr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zendikar Rising' }));
    // Restore ELD — ZNR minimizes, KTK stays minimized (hits line 52)
    fireEvent.click(screen.getAllByRole('button', { name: 'Restore' })[1]);

    expect(screen.getByRole('button', { name: 'Minimize' })).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Restore' })).toHaveLength(2);
  });
});

describe('App close window', () => {
  test('closing the active window removes it', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('button', { name: 'Minimize' })).toBeNull();
  });

  test('closing a minimized window removes it', async () => {
    fetchSets.mockResolvedValue([{ code: 'eld', name: 'Throne of Eldraine' }]);
    await renderApp();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'eld' } });
    fireEvent.click(screen.getByRole('button', { name: 'Throne of Eldraine' }));
    // KTK is now minimized; ELD is active. KTK renders first so its Close is index 0.
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1);
  });
});
