import { act, fireEvent, render, screen } from '@testing-library/react';
import { makeCard } from './test/fixtures.js';
import { fetchSetCards, fetchSets } from './lib/scryfall.js';
import {
  deleteCards,
  loadCards,
  loadCollection,
  loadConfig,
  saveCollection,
  saveConfig,
} from './lib/storage.js';
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
  deleteCards: vi.fn().mockResolvedValue(undefined),
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
  expect(saveConfig).toHaveBeenCalledWith(
    'openSets',
    expect.arrayContaining([expect.objectContaining({ code: 'eld', minimized: false })]),
  );
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

describe('App Debug menu', () => {
  test('refresh deletes the card cache and remounts the active set', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('Debug'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh current set' }));
    await act(async () => {});
    expect(deleteCards).toHaveBeenCalledWith('ktk');
    expect(fetchSetCards).toHaveBeenCalled();
  });

  test('refresh only updates the active set when multiple sets are open', async () => {
    fetchSets.mockResolvedValue([{ code: 'eld', name: 'Throne of Eldraine' }]);
    await renderApp();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'eld' } });
    fireEvent.click(screen.getByRole('button', { name: 'Throne of Eldraine' }));
    fireEvent.click(screen.getByText('Debug'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh current set' }));
    await act(async () => {});
    expect(deleteCards).toHaveBeenCalledWith('eld');
    expect(fetchSetCards).toHaveBeenCalled();
  });

  test('refresh is not available when no set is active', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    fireEvent.click(screen.getByText('Debug'));
    expect(screen.queryByRole('button', { name: 'Refresh current set' })).toBeNull();
  });
});

describe('App Export Collection', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:test'),
      revokeObjectURL: vi.fn(),
    });
  });

  test('clicking CSV loads cards and collection for each open set', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('Export Collection'));
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    await act(async () => {});
    expect(loadCards).toHaveBeenCalledWith('ktk');
    expect(loadCollection).toHaveBeenCalledWith('ktk');
  });

  test('clicking CSV triggers a file download', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('Export Collection'));
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    await act(async () => {});
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  test('clicking CSV works when loadCards returns actual cards', async () => {
    loadCards.mockResolvedValue([{ id: 'a', name: 'Test Card', number: '1', set: 'KTK', rarity: 'common', cost: '{1}' }]);
    await renderApp();
    fireEvent.click(screen.getByText('Export Collection'));
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    await act(async () => {});
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  test('clicking CSV before openSets resolves falls back to empty array', async () => {
    let resolveOpenSets;
    loadConfig.mockImplementation((key) => {
      if (key === 'openSets') return new Promise((r) => { resolveOpenSets = r; });
      return Promise.resolve(null);
    });
    render(<App />);
    // Export before openSets config resolves — openSets is null
    fireEvent.click(screen.getByText('Export Collection'));
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    await act(async () => {});
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    resolveOpenSets(null);
  });
});

describe('App handleAddCard', () => {
  const BOLT = { id: 'bolt', name: 'Lightning Bolt', number: '1', set: 'KTK', rarity: 'common', cost: '{R}' };

  test('adds a first copy when card has no prior entry', async () => {
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({});
    await renderApp();
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Lightning' } });
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: /Lightning Bolt/ }));
    await act(async () => {});
    expect(saveCollection).toHaveBeenCalledWith('ktk', expect.objectContaining({ bolt: { qty: 1 } }));
  });

  test('increments qty when card already has copies', async () => {
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 3 } });
    await renderApp();
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Lightning' } });
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: /Lightning Bolt/ }));
    await act(async () => {});
    expect(saveCollection).toHaveBeenCalledWith('ktk', expect.objectContaining({ bolt: { qty: 4 } }));
  });

  test('adding twice covers both branches of collectionVersions update', async () => {
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({});
    await renderApp();
    const input = screen.getByPlaceholderText('Search for a card');
    // First add: v['ktk'] is undefined → ?? 0 fires
    fireEvent.change(input, { target: { value: 'Lightning' } });
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: /Lightning Bolt/ }));
    await act(async () => {});
    // Second add: v['ktk'] is 1 → ?? 0 skipped
    fireEvent.change(input, { target: { value: 'Lightning' } });
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: /Lightning Bolt/ }));
    await act(async () => {});
    expect(saveCollection).toHaveBeenCalledWith('ktk', expect.any(Object));
  });
});

describe('App card preview position', () => {
  test('loads saved position from config and applies it to the preview window', async () => {
    loadConfig.mockImplementation((key) =>
      key === 'cardPreviewPos'
        ? Promise.resolve({ x: 500, y: 200 })
        : key === 'openSets'
          ? Promise.resolve([{ code: 'ktk', name: 'Khans of Tarkir', minimized: false }])
          : Promise.resolve(null),
    );
    await renderApp();
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByRole('button', { name: 'Move card preview' }));
    const el = document.querySelector('.draggable-preview');
    expect(el.style.left).toBe('500px');
    expect(el.style.top).toBe('200px');
  });

  test('clicking Move here saves position to config', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByRole('button', { name: 'Move card preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move here' }));
    expect(saveConfig).toHaveBeenCalledWith('cardPreviewPos', { x: 300, y: 100 });
  });

  test('clicking a size button saves the size to config', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByRole('button', { name: 'Move card preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'large size' }));
    expect(saveConfig).toHaveBeenCalledWith('cardImageSize', 'large');
  });

  test('loads saved image size from config and applies it to the preview', async () => {
    loadConfig.mockImplementation((key) =>
      key === 'cardImageSize' ? Promise.resolve('normal') : Promise.resolve(null),
    );
    await renderApp();
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByRole('button', { name: 'Move card preview' }));
    expect(screen.getByRole('button', { name: 'normal size' }).getAttribute('aria-pressed')).toBe('true');
  });

  test('saved image size is used in the card table preview', async () => {
    fetchSetCards.mockResolvedValue([makeCard({ id: 'a', name: 'Arrow', rarity: 'rare', number: '1' })]);
    loadConfig.mockImplementation((key) =>
      key === 'cardImageSize'
        ? Promise.resolve('large')
        : key === 'openSets'
          ? Promise.resolve([{ code: 'ktk', name: 'Khans of Tarkir', minimized: false }])
          : Promise.resolve(null),
    );
    await renderApp();
    fireEvent.focus(screen.getByLabelText('Copies of Arrow'));
    expect(document.querySelector('.card-preview img').getAttribute('src')).toContain('version=large');
  });

  test('saved position is applied to card preview in set tracker', async () => {
    fetchSetCards.mockResolvedValue([makeCard({ id: 'a', name: 'Arrow', rarity: 'rare', number: '1' })]);
    loadConfig.mockImplementation((key) =>
      key === 'cardPreviewPos'
        ? Promise.resolve({ x: 400, y: 150 })
        : key === 'openSets'
          ? Promise.resolve([{ code: 'ktk', name: 'Khans of Tarkir', minimized: false }])
          : Promise.resolve(null),
    );
    await renderApp();
    fireEvent.focus(screen.getByLabelText('Copies of Arrow'));
    const el = document.querySelector('.card-preview');
    expect(el.style.left).toBe('400px');
    expect(el.style.top).toBe('150px');
  });
});
