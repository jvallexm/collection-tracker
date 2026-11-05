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

describe('App recent sets', () => {
  test('shows KTK as a default recent set before config loads', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('Sets'));
    expect(screen.getByRole('button', { name: 'Khans of Tarkir' })).not.toBeNull();
  });

  test('opening a set prepends it to recent and saves to config', async () => {
    fetchSets.mockResolvedValue([{ code: 'eld', name: 'Throne of Eldraine' }]);
    await renderApp();
    fireEvent.click(screen.getByText('Sets'));
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
    fireEvent.click(screen.getByText('Sets'));
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
    fireEvent.click(screen.getByText('Sets'));
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
