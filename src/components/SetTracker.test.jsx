import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fetchSetTokenCards } from '../lib/mtgjson.js';
import { fetchSetCards, refreshSetCardPrices } from '../lib/scryfall.js';
import {
  loadCards,
  loadCollection,
  loadConfig,
  saveCollection,
  saveConfig,
} from '../lib/storage.js';
import { makeCard } from '../test/fixtures.js';
import SetTracker from './SetTracker.jsx';

vi.mock('../lib/mtgjson.js', () => ({
  fetchSetTokenCards: vi.fn().mockResolvedValue([]),
}));
vi.mock('../lib/scryfall.js', () => ({
  fetchSetCards: vi.fn(),
  refreshSetCardPrices: vi.fn().mockResolvedValue({ main: [], tokens: null }),
}));
vi.mock('../lib/storage.js', () => ({
  loadCards: vi.fn().mockResolvedValue(null),
  loadCollection: vi.fn().mockResolvedValue({}),
  saveCollection: vi.fn().mockResolvedValue(undefined),
  loadConfig: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn().mockResolvedValue(undefined),
}));

const CARDS = [
  makeCard({ id: 'b', name: 'Bolt', rarity: 'common', number: '2' }),
  makeCard({ id: 'a', name: 'Arrow', rarity: 'rare', number: '1' }),
  makeCard({ id: 'c', name: 'Charm', rarity: 'common', number: '3' }),
];

const rowNames = () =>
  screen
    .getAllByRole('textbox')
    .filter((input) => input.getAttribute('aria-label').startsWith('Copies of '))
    .map((input) => input.getAttribute('aria-label').replace('Copies of ', ''));

beforeEach(() => {
  loadCards.mockResolvedValue(null);
  loadCollection.mockResolvedValue({});
  loadConfig.mockResolvedValue(null);
  refreshSetCardPrices.mockResolvedValue({ main: [], tokens: null });
  fetchSetTokenCards.mockResolvedValue([]);
});

async function renderLoadedTracker({
  minimized = false,
  onMinimize = vi.fn(),
  onRestore = vi.fn(),
  onClose = vi.fn(),
} = {}) {
  fetchSetCards.mockResolvedValue(CARDS);
  render(
    <SetTracker
      setCode="ktk"
      setName="Khans of Tarkir"
      minimized={minimized}
      onMinimize={onMinimize}
      onRestore={onRestore}
      onClose={onClose}
    />,
  );
  if (!minimized) {
    await screen.findByLabelText('Copies of Arrow');
    await act(async () => {}); // flush async collection load
  }
}

describe('SetTracker loading', () => {
  test('shows a loading state with export disabled', async () => {
    fetchSetCards.mockReturnValue(new Promise(() => {}));
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    expect(screen.getByText('Loading...')).not.toBeNull();
    expect(screen.getByText('Export…').disabled).toBe(true);
    expect(screen.getByLabelText('Loading')).not.toBeNull();
    await act(async () => {});
  });

  test('shows cached cards immediately without waiting for fetchSetCards', async () => {
    loadCards.mockResolvedValueOnce(CARDS);
    fetchSetCards.mockReturnValue(new Promise(() => {}));
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await screen.findByLabelText('Copies of Arrow');
    expect(screen.queryByLabelText('Loading')).toBeNull();
  });

  test('lists the cards alphabetically once loaded', async () => {
    await renderLoadedTracker();
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
    expect(screen.getByText('3 cards | 0 in Collection')).not.toBeNull();
    expect(screen.getByText('Export…').disabled).toBe(false);
  });

  test('shows the error when the cards cannot be loaded', async () => {
    fetchSetCards.mockRejectedValue(new Error('boom'));
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    expect(await screen.findByText('Could not load cards: boom')).not.toBeNull();
    await act(async () => {});
  });

  test('focuses the search input on mount', async () => {
    await renderLoadedTracker();
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Search…'));
  });

  test('refocuses the search input when clicking on a non-interactive area of the window', async () => {
    await renderLoadedTracker();
    screen.getByLabelText('Copies of Bolt').focus();
    expect(document.activeElement).toBe(screen.getByLabelText('Copies of Bolt'));
    fireEvent.click(screen.getByText('3 cards | 0 in Collection'));
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Search…'));
  });
});

describe('SetTracker collection tracking', () => {
  test('updates the summary and saves to the database', async () => {
    await renderLoadedTracker();
    fireEvent.change(screen.getByLabelText('Copies of Arrow'), { target: { value: '2' } });

    expect(screen.getByText('3 cards | 2 in Collection')).not.toBeNull();
    await waitFor(() => {
      expect(saveCollection).toHaveBeenCalledWith('ktk', { a: { qty: 2 } });
    });
  });

  test('tracks foil copies separately and includes them in the summary', async () => {
    await renderLoadedTracker();
    fireEvent.change(screen.getByLabelText('Foil copies of Arrow'), { target: { value: '1' } });

    expect(screen.getByText('3 cards | 1 in Collection')).not.toBeNull();
    await waitFor(() => {
      expect(saveCollection).toHaveBeenCalledWith('ktk', { a: { foil: 1 } });
    });
  });

  test('removes a card when its box is cleared', async () => {
    await renderLoadedTracker();
    const input = screen.getByLabelText('Copies of Arrow');
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.change(input, { target: { value: '' } });

    expect(screen.getByText('3 cards | 0 in Collection')).not.toBeNull();
  });

  test('restores a previously saved collection', async () => {
    loadCollection.mockResolvedValue({ a: { qty: 4 } });
    await renderLoadedTracker();
    expect(screen.getByLabelText('Copies of Arrow').value).toBe('4');
  });

  test('preserves a quantity change made before the collection finishes loading', async () => {
    let resolveLoad;
    loadCollection.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await screen.findByLabelText('Copies of Arrow');

    fireEvent.change(screen.getByLabelText('Copies of Arrow'), { target: { value: '3' } });
    resolveLoad({ a: { qty: 99 } });
    await act(async () => {});

    expect(screen.getByLabelText('Copies of Arrow').value).toBe('3');
  });

  test('preserves a foil quantity change made before the collection finishes loading', async () => {
    let resolveLoad;
    loadCollection.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await screen.findByLabelText('Foil copies of Arrow');

    fireEvent.change(screen.getByLabelText('Foil copies of Arrow'), { target: { value: '2' } });
    resolveLoad({ a: { foil: 99 } });
    await act(async () => {});

    expect(screen.getByLabelText('Foil copies of Arrow').value).toBe('2');
  });
});

describe('SetTracker sorting', () => {
  test('clicking the active column reverses it; a new column starts ascending', async () => {
    await renderLoadedTracker();

    fireEvent.click(screen.getByRole('columnheader', { name: 'Name' }));
    expect(rowNames()).toEqual(['Charm', 'Bolt', 'Arrow']);

    fireEvent.click(screen.getByRole('columnheader', { name: 'R' }));
    expect(rowNames()).toEqual(['Bolt', 'Charm', 'Arrow']);
  });

  test('restores a previously saved sort from config', async () => {
    loadConfig.mockImplementation((key) => {
      if (key === 'sort:ktk')
        return Promise.resolve({ key: 'rarity', direction: 1, secondary: null });
      return Promise.resolve(null);
    });
    await renderLoadedTracker();
    expect(rowNames()).toEqual(['Bolt', 'Charm', 'Arrow']);
  });

  test('saves sort to config when changed', async () => {
    await renderLoadedTracker();
    fireEvent.click(screen.getByRole('columnheader', { name: 'R' }));
    expect(saveConfig).toHaveBeenCalledWith('sort:ktk', {
      key: 'rarity',
      direction: 1,
      secondary: null,
    });
  });

  test('sorting before config loads falls back to default sort', async () => {
    let resolveConfig;
    loadConfig.mockReturnValue(
      new Promise((r) => {
        resolveConfig = r;
      }),
    );
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await screen.findByLabelText('Copies of Arrow');
    fireEvent.click(screen.getByRole('columnheader', { name: 'R' }));
    expect(rowNames()).toEqual(['Bolt', 'Charm', 'Arrow']);
    resolveConfig(null);
    await act(async () => {});
  });
});

describe('SetTracker have sorting', () => {
  test('clicking Have puts owned cards first regardless of quantity', async () => {
    // Bolt:2, Charm:1 are owned; Arrow:0 is not
    loadCollection.mockResolvedValue({ b: { qty: 2 }, c: { qty: 1 } });
    await renderLoadedTracker();

    fireEvent.click(screen.getByRole('columnheader', { name: 'Qty' }));
    // owned group (Bolt, Charm by name), then unowned (Arrow)
    expect(rowNames()).toEqual(['Bolt', 'Charm', 'Arrow']);
  });

  test('within each group the previous sort order is preserved', async () => {
    // Sort by rarity first: Bolt(C), Charm(C), Arrow(R)
    // Then Have with Arrow+Bolt owned — within owned group rarity order applies
    loadCollection.mockResolvedValue({ a: { qty: 1 }, b: { qty: 1 } });
    await renderLoadedTracker();

    fireEvent.click(screen.getByRole('columnheader', { name: 'R' }));
    fireEvent.click(screen.getByRole('columnheader', { name: 'Qty' }));
    // owned: Bolt(C) before Arrow(R); unowned: Charm
    expect(rowNames()).toEqual(['Bolt', 'Arrow', 'Charm']);
  });

  test('clicking Have again puts unowned cards first', async () => {
    loadCollection.mockResolvedValue({ b: { qty: 2 }, c: { qty: 1 } });
    await renderLoadedTracker();

    fireEvent.click(screen.getByRole('columnheader', { name: 'Qty' }));
    fireEvent.click(screen.getByRole('columnheader', { name: 'Qty' }));
    // unowned: Arrow; owned: Bolt, Charm
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
  });

  test('clicking another column after Have removes have sort', async () => {
    loadCollection.mockResolvedValue({ b: { qty: 2 }, c: { qty: 1 } });
    await renderLoadedTracker();

    fireEvent.click(screen.getByRole('columnheader', { name: 'Qty' }));
    fireEvent.click(screen.getByRole('columnheader', { name: 'Name' }));
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
  });
});

describe('SetTracker search', () => {
  test('shows all cards when the search box is empty', async () => {
    await renderLoadedTracker();
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
  });

  test('shows all cards when the search box contains only whitespace', async () => {
    await renderLoadedTracker();
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: '   ' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
  });

  test('filters cards to those whose name matches the search string', async () => {
    await renderLoadedTracker();
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'arr' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(rowNames()).toEqual(['Arrow']);
  });

  test('ignores commas in card names when matching', async () => {
    fetchSetCards.mockResolvedValue([
      ...CARDS,
      makeCard({ id: 'd', name: 'Ajani, Outland Liberator', rarity: 'mythic', number: '4' }),
    ]);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await screen.findByLabelText('Copies of Ajani, Outland Liberator');
    await act(async () => {});

    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'ajani out' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(rowNames()).toContain('Ajani, Outland Liberator');
    expect(rowNames()).not.toContain('Arrow');
  });

  test('ignores apostrophes in card names when matching', async () => {
    fetchSetCards.mockResolvedValue([
      ...CARDS,
      makeCard({ id: 'd', name: "Urza's Mine", rarity: 'uncommon', number: '4' }),
    ]);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await screen.findByLabelText("Copies of Urza's Mine");
    await act(async () => {});

    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'urzas mine' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(rowNames()).toContain("Urza's Mine");
    expect(rowNames()).not.toContain('Arrow');
  });

  test('matches hyphenated names when query omits hyphens', async () => {
    fetchSetCards.mockResolvedValue([
      ...CARDS,
      makeCard({ id: 'd', name: "Man-o'-War", rarity: 'rare', number: '4' }),
    ]);
    render(<SetTracker setCode="ltr" setName="Lord of the Rings" />);
    await screen.findByLabelText("Copies of Man-o'-War");
    await act(async () => {});

    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'mano' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(rowNames()).toContain("Man-o'-War");
    expect(rowNames()).not.toContain('Arrow');
  });

  test('matches accented characters with their unaccented equivalents', async () => {
    fetchSetCards.mockResolvedValue([
      ...CARDS,
      makeCard({ id: 'd', name: 'Lórien Revealed', rarity: 'uncommon', number: '4' }),
    ]);
    render(<SetTracker setCode="ltr" setName="Lord of the Rings" />);
    await screen.findByLabelText('Copies of Lórien Revealed');
    await act(async () => {});

    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'lo' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(rowNames()).toContain('Lórien Revealed');
    expect(rowNames()).not.toContain('Arrow');
  });

  test('restores all cards when search is cleared', async () => {
    await renderLoadedTracker();
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'arr' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    fireEvent.change(box, { target: { value: '' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
  });
});

describe('SetTracker search debounce', () => {
  test('does not filter immediately on change', async () => {
    await renderLoadedTracker();
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'arr' } });
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
    vi.useRealTimers();
  });

  test('filters after 150 ms debounce', async () => {
    await renderLoadedTracker();
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'arr' } });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(rowNames()).toEqual(['Arrow']);
    vi.useRealTimers();
  });

  test('deletion does not commit immediately', async () => {
    await renderLoadedTracker();
    vi.useFakeTimers();
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'bol' } });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    fireEvent.change(box, { target: { value: 'bo' } });
    expect(rowNames()).toEqual(['Bolt']);
    vi.useRealTimers();
  });

  test('2 chars after deletion commits without waiting for timer', async () => {
    await renderLoadedTracker();
    vi.useFakeTimers();
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'bol' } });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    fireEvent.change(box, { target: { value: 'bo' } }); // delete
    fireEvent.change(box, { target: { value: 'bol' } }); // 1st char after delete
    expect(rowNames()).toEqual(['Bolt']); // not committed yet
    fireEvent.change(box, { target: { value: 'bolt' } }); // 2nd char — commits
    expect(rowNames()).toEqual(['Bolt']);
    vi.useRealTimers();
  });

  test('commits after 150 ms following deletion with fewer than 2 chars', async () => {
    await renderLoadedTracker();
    vi.useFakeTimers();
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'bol' } });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    fireEvent.change(box, { target: { value: 'bo' } }); // delete
    fireEvent.change(box, { target: { value: 'bol' } }); // only 1 char after delete
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(rowNames()).toEqual(['Bolt']);
    vi.useRealTimers();
  });
});

describe('SetTracker card preview', () => {
  test('shows a card image when a quantity input is focused', async () => {
    await renderLoadedTracker();
    fireEvent.focus(screen.getByLabelText('Copies of Arrow'));
    expect(screen.getByAltText('Arrow')).not.toBeNull();
  });

  test('updates the preview when focus moves to a different input', async () => {
    await renderLoadedTracker();
    fireEvent.focus(screen.getByLabelText('Copies of Arrow'));
    fireEvent.focus(screen.getByLabelText('Copies of Bolt'));
    expect(screen.getByAltText('Bolt')).not.toBeNull();
    expect(screen.queryByAltText('Arrow')).toBeNull();
  });

  test('shows foil overlay when a foil input is focused', async () => {
    await renderLoadedTracker();
    fireEvent.focus(screen.getByLabelText('Foil copies of Arrow'));
    expect(document.querySelector('.card-preview-foil-overlay')).not.toBeNull();
  });

  test('hides foil overlay when a qty input is focused', async () => {
    await renderLoadedTracker();
    fireEvent.focus(screen.getByLabelText('Foil copies of Arrow'));
    fireEvent.focus(screen.getByLabelText('Copies of Arrow'));
    expect(document.querySelector('.card-preview-foil-overlay')).toBeNull();
  });

  test('hides the preview when focus leaves the table', async () => {
    await renderLoadedTracker();
    const input = screen.getByLabelText('Copies of Arrow');
    fireEvent.focus(input);
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('SetTracker minimize', () => {
  test('title bar has a minimize button', async () => {
    await renderLoadedTracker();
    expect(screen.getByRole('button', { name: 'Minimize' })).not.toBeNull();
  });

  test('title bar has a close button', async () => {
    await renderLoadedTracker();
    expect(screen.getByRole('button', { name: 'Close' })).not.toBeNull();
  });

  test('clicking minimize calls onMinimize', async () => {
    const onMinimize = vi.fn();
    await renderLoadedTracker({ onMinimize });
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    expect(onMinimize).toHaveBeenCalled();
  });

  test('clicking close calls onClose', async () => {
    const onClose = vi.fn();
    await renderLoadedTracker({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  test('when minimized prop is true, hides the card table', async () => {
    await renderLoadedTracker({ minimized: true });
    expect(screen.queryByRole('table')).toBeNull();
  });

  test('minimized icon shows the set code and a restore button', async () => {
    await renderLoadedTracker({ minimized: true });
    expect(screen.getByText('KTK')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Restore' })).not.toBeNull();
  });

  test('minimized icon has a close button', async () => {
    await renderLoadedTracker({ minimized: true });
    expect(screen.getByRole('button', { name: 'Close' })).not.toBeNull();
  });

  test('clicking restore calls onRestore', async () => {
    const onRestore = vi.fn();
    await renderLoadedTracker({ minimized: true, onRestore });
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(onRestore).toHaveBeenCalled();
  });

  test('clicking close on minimized icon calls onClose', async () => {
    const onClose = vi.fn();
    await renderLoadedTracker({ minimized: true, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  test('stacks at the correct vertical position based on minimizedIndex', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    render(
      <SetTracker
        setCode="ktk"
        setName="Khans of Tarkir"
        minimized={true}
        minimizedIndex={2}
        onMinimize={vi.fn()}
        onRestore={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const icon = document.querySelector('.window-icon');
    expect(icon.style.bottom).toBe('88px');
  });
});

describe('SetTracker export', () => {
  test('opens the Moxfield list and closes again', async () => {
    await renderLoadedTracker();
    fireEvent.change(screen.getByLabelText('Copies of Arrow'), { target: { value: '2' } });

    fireEvent.click(screen.getByText('Export…'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('textarea').value).toBe('2 Arrow (KTK) 1');

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

function makeCKTokenItem(overrides = {}) {
  return {
    sku: 'TKTK-0001',
    scryfall_id: 'tok1',
    name: 'Soldier Token',
    variation: 'T1',
    is_foil: 'false',
    price_retail: '0.35',
    price_buy: '0.01',
    ...overrides,
  };
}

describe('SetTracker token section', () => {
  test('shows no Tokens heading when there are no token cards', async () => {
    await renderLoadedTracker();
    expect(screen.queryByText('Tokens')).toBeNull();
  });

  test('filters token cards by search text', async () => {
    const items = [
      makeCKTokenItem({
        sku: 'TKTK-0001',
        scryfall_id: 'tok1',
        name: 'Soldier Token',
        variation: 'T1',
      }),
      makeCKTokenItem({
        sku: 'TKTK-0002',
        scryfall_id: 'tok2',
        name: 'Goblin Token',
        variation: 'T2',
      }),
    ];
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" ckTokenItems={items} />);
    await screen.findByLabelText('Copies of Arrow');
    await act(async () => {});
    const box = screen.getByPlaceholderText('Search…');
    fireEvent.change(box, { target: { value: 'Sol' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(screen.getByText('Soldier Token')).not.toBeNull();
    expect(screen.queryByText('Goblin Token')).toBeNull();
  });

  test('shows a Tokens heading when token cards are available', async () => {
    const items = [makeCKTokenItem()];
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" ckTokenItems={items} />);
    await screen.findByLabelText('Copies of Arrow');
    await act(async () => {});
    expect(screen.getByText('Tokens')).not.toBeNull();
  });

  test('renders token card names under the Tokens heading', async () => {
    const items = [makeCKTokenItem()];
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" ckTokenItems={items} />);
    await screen.findByLabelText('Copies of Arrow');
    await act(async () => {});
    expect(screen.getByText('Soldier Token')).not.toBeNull();
  });

  test('renders a double-faced token as a single trackable row', async () => {
    const items = [
      makeCKTokenItem({
        sku: 'TKTK-0005',
        scryfall_id: 'dfc1',
        name: 'Snake Token // Zombie Token',
        variation: 'T5',
      }),
    ];
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" ckTokenItems={items} />);
    await screen.findByLabelText('Copies of Arrow');
    await act(async () => {});
    expect(screen.getByText('Snake Token // Zombie Token')).not.toBeNull();
    expect(screen.getByLabelText('Copies of Snake Token // Zombie Token')).not.toBeNull();
  });

  test('sorts token cards by have when sorting by have column', async () => {
    const items = [
      makeCKTokenItem({
        sku: 'TKTK-0001',
        scryfall_id: 'tok1',
        name: 'Soldier Token',
        variation: 'T1',
      }),
      makeCKTokenItem({
        sku: 'TKTK-0002',
        scryfall_id: 'tok2',
        name: 'Goblin Token',
        variation: 'T2',
      }),
      makeCKTokenItem({
        sku: 'TKTK-0003',
        scryfall_id: 'tok3',
        name: 'Zombie Token',
        variation: 'T3',
      }),
      makeCKTokenItem({
        sku: 'TKTK-0004',
        scryfall_id: 'tok4',
        name: 'Angel Token',
        variation: 'T4',
      }),
    ];
    fetchSetCards.mockResolvedValue(CARDS);
    loadCollection.mockResolvedValue({ tok1: { qty: 2 }, tok4: { qty: 1 } });
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" ckTokenItems={items} />);
    await screen.findByLabelText('Copies of Arrow');
    await act(async () => {});
    fireEvent.click(screen.getAllByText('Qty')[0]);
    expect(screen.getByText('Soldier Token')).not.toBeNull();
    expect(screen.getByText('Goblin Token')).not.toBeNull();
  });
});

describe('SetTracker collectionVersion', () => {
  test('reloads collection when collectionVersion prop changes', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    loadCollection.mockResolvedValue({ b: { qty: 1 } });
    const { rerender } = render(
      <SetTracker setCode="ktk" setName="Khans of Tarkir" collectionVersion={0} />,
    );
    await act(async () => {});
    const callsBefore = loadCollection.mock.calls.length;

    loadCollection.mockResolvedValue({ b: { qty: 2 } });
    rerender(<SetTracker setCode="ktk" setName="Khans of Tarkir" collectionVersion={1} />);
    await act(async () => {});

    expect(loadCollection.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  test('skips reload when collectionVersion is 0', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" collectionVersion={0} />);
    await act(async () => {});
    // Only the initial load effect fires, not the version effect
    expect(loadCollection).toHaveBeenCalledTimes(1);
  });

  test('handles null saved collection on version bump', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    loadCollection.mockResolvedValueOnce({}).mockResolvedValueOnce(null);
    const { rerender } = render(
      <SetTracker setCode="ktk" setName="Khans of Tarkir" collectionVersion={0} />,
    );
    await act(async () => {});
    rerender(<SetTracker setCode="ktk" setName="Khans of Tarkir" collectionVersion={1} />);
    await act(async () => {});
    // Should not crash — collection falls back to {}
    expect(screen.getByText('Khans of Tarkir')).not.toBeNull();
  });
});

describe('SetTracker cardFocus', () => {
  async function renderAndLoad(props = {}) {
    fetchSetCards.mockResolvedValue(CARDS);
    const result = render(<SetTracker setCode="ktk" setName="Khans of Tarkir" {...props} />);
    await act(async () => {});
    return result;
  }

  test('focuses the qty input for the given card', async () => {
    const { rerender } = await renderAndLoad();
    rerender(
      <SetTracker
        setCode="ktk"
        setName="Khans of Tarkir"
        cardFocus={{ setCode: 'ktk', cardId: 'b' }}
      />,
    );
    await act(async () => {});
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Copies of Bolt' }));
  });

  test('does nothing when cardFocus is null', async () => {
    await renderAndLoad({ cardFocus: null });
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Search…'));
  });

  test('does nothing when card id is not found in the table', async () => {
    const { rerender } = await renderAndLoad();
    rerender(
      <SetTracker
        setCode="ktk"
        setName="Khans of Tarkir"
        cardFocus={{ setCode: 'ktk', cardId: 'unknown-id' }}
      />,
    );
    await act(async () => {});
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Search…'));
  });

  test('does nothing when window is minimized', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    render(
      <SetTracker
        setCode="ktk"
        setName="Khans of Tarkir"
        minimized
        cardFocus={{ setCode: 'ktk', cardId: 'b' }}
        onRestore={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await act(async () => {});
    expect(document.activeElement).toBe(document.body);
  });

  test('does nothing when the matched element has no input inside', async () => {
    const { rerender } = await renderAndLoad();
    // Append a bare element with data-card-id but no input inside
    const windowEl = document.querySelector('.window');
    const fakeEl = document.createElement('div');
    fakeEl.setAttribute('data-card-id', 'no-input-card');
    windowEl.appendChild(fakeEl);
    rerender(
      <SetTracker
        setCode="ktk"
        setName="Khans of Tarkir"
        cardFocus={{ setCode: 'ktk', cardId: 'no-input-card' }}
      />,
    );
    await act(async () => {});
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Search…'));
  });

  test('refocuses when cardFocus changes to a new object for the same card', async () => {
    const { rerender } = await renderAndLoad();
    rerender(
      <SetTracker
        setCode="ktk"
        setName="Khans of Tarkir"
        cardFocus={{ setCode: 'ktk', cardId: 'b' }}
      />,
    );
    await act(async () => {});
    screen.getByRole('textbox', { name: 'Copies of Arrow' }).focus();
    rerender(
      <SetTracker
        setCode="ktk"
        setName="Khans of Tarkir"
        cardFocus={{ setCode: 'ktk', cardId: 'b' }}
      />,
    );
    await act(async () => {});
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Copies of Bolt' }));
  });
});

describe('SetTracker cardPreviewPos', () => {
  test('card preview uses saved position when cardPreviewPos is provided', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    render(
      <SetTracker setCode="ktk" setName="Khans of Tarkir" cardPreviewPos={{ x: 400, y: 150 }} />,
    );
    await act(async () => {});
    fireEvent.focus(screen.getByLabelText('Copies of Arrow'));
    const el = document.querySelector('.card-preview');
    expect(el.style.left).toBe('400px');
    expect(el.style.top).toBe('150px');
  });

  test('card preview image uses cardImageSize when provided', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" cardImageSize="large" />);
    await act(async () => {});
    fireEvent.focus(screen.getByLabelText('Copies of Arrow'));
    expect(document.querySelector('.card-preview img').getAttribute('src')).toContain(
      'version=large',
    );
  });
});

describe('SetTracker search ArrowDown', () => {
  test('pressing ArrowDown in the search bar focuses the first table input', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await act(async () => {});
    const search = screen.getByPlaceholderText('Search…');
    search.focus();
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByLabelText('Copies of Arrow'));
  });

  test('pressing ArrowDown commits the search text before focusing', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await act(async () => {});
    const search = screen.getByPlaceholderText('Search…');
    fireEvent.change(search, { target: { value: 'arr' } });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByLabelText('Copies of Arrow'));
    expect(screen.queryByLabelText('Copies of Bolt')).toBeNull();
  });

  test('pressing other keys in the search bar does nothing special', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await act(async () => {});
    const search = screen.getByPlaceholderText('Search…');
    search.focus();
    fireEvent.keyDown(search, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(search);
  });
});

describe('SetTracker onEscapeTop', () => {
  test('pressing Up on the first row focuses the search input', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await act(async () => {});
    const firstInput = screen.getByLabelText('Copies of Arrow');
    firstInput.focus();
    fireEvent.keyDown(firstInput, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Search…'));
  });

  test('pressing Up on the first row selects all text in the search input', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await act(async () => {});
    const searchInput = screen.getByPlaceholderText('Search…');
    searchInput.select = vi.fn();
    const firstInput = screen.getByLabelText('Copies of Arrow');
    firstInput.focus();
    fireEvent.keyDown(firstInput, { key: 'ArrowUp' });
    expect(searchInput.select).toHaveBeenCalled();
  });
});

describe('SetTracker background price refresh', () => {
  const REFRESHED = CARDS.map((c) => ({ ...c, price: '9.99' }));
  const TOKEN = {
    id: 'tok1',
    name: 'Soldier Token',
    rarity: 'common',
    number: '1',
    set: 'KTK',
    cost: '',
    nonfoil: true,
    foil: false,
    reserved: false,
    price: null,
    priceFoil: null,
  };

  test('triggers refresh when cache existed', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    loadCards.mockResolvedValueOnce(CARDS); // cache check → hit
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await screen.findByLabelText('Copies of Arrow');
    await act(async () => {});
    expect(refreshSetCardPrices).toHaveBeenCalledWith('ktk');
  });

  test('does not trigger refresh on first open (no cache)', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    // loadCards returns null by default — no cache
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await screen.findByLabelText('Copies of Arrow');
    await act(async () => {});
    expect(refreshSetCardPrices).not.toHaveBeenCalled();
  });

  test('updates displayed cards when refresh resolves', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    loadCards.mockResolvedValueOnce(CARDS);
    refreshSetCardPrices.mockResolvedValueOnce({ main: [CARDS[1]], tokens: null });
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await screen.findByLabelText('Copies of Arrow');
    await act(async () => {});
    expect(rowNames()).toEqual(['Arrow']);
  });

  test('swallows refresh errors without showing an error message', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    loadCards.mockResolvedValueOnce(CARDS);
    refreshSetCardPrices.mockRejectedValueOnce(new Error('network error'));
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await screen.findByLabelText('Copies of Arrow');
    await act(async () => {});
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
    expect(screen.queryByText(/Could not load/)).toBeNull();
  });

  test('token cards come from ckTokenItems prop, not from refresh', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    loadCards.mockResolvedValueOnce(CARDS);
    refreshSetCardPrices.mockResolvedValueOnce({ main: CARDS, tokens: null });
    const ckTokenItems = [
      {
        sku: 'TKTK-0001',
        scryfall_id: 'tok1',
        name: 'Soldier Token',
        variation: 'T1',
        is_foil: 'false',
        price_retail: '0.35',
        price_buy: '0.01',
      },
    ];
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" ckTokenItems={ckTokenItems} />);
    await screen.findByLabelText('Copies of Arrow');
    await act(async () => {});
    expect(screen.getByText('Tokens')).not.toBeNull();
    expect(screen.getByLabelText('Copies of Soldier Token')).not.toBeNull();
  });

  test('does not set error state when setCode changes before fetch error resolves', async () => {
    let rejectCards;
    fetchSetCards.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectCards = reject;
      }),
    );
    fetchSetCards.mockResolvedValue(CARDS);
    const { rerender } = render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await act(async () => {});
    rerender(<SetTracker setCode="eld" setName="Eldraine" />);
    await act(async () => {
      rejectCards(new Error('network error'));
    });
    expect(screen.queryByText(/Could not load/)).toBeNull();
  });

  test('does not update state after component unmounts', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    loadCards.mockResolvedValueOnce(CARDS);
    let resolveRefresh;
    refreshSetCardPrices.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    const { unmount } = render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await screen.findByLabelText('Copies of Arrow');
    unmount();
    await act(async () => {
      resolveRefresh({ main: [CARDS[0]], tokens: null });
    });
    // No assertion needed beyond "no error thrown"; the cancelled flag prevents state updates
  });
});

describe('SetTracker MTGJSON integration', () => {
  const fishCard = { id: 'scry-fish', name: 'Fish', number: '7' };
  const vineCard = { id: 'scry-vine', name: 'Iridescent Vinelasher', number: '8' };
  const dfcCard = { id: 'scry-fish', name: 'Fish // Iridescent Vinelasher', number: '7' };

  const fishItem = {
    sku: 'TKTK-0007',
    scryfall_id: 'scry-fish',
    name: 'Fish Token',
    variation: 'T7',
    is_foil: 'false',
    price_retail: '0.25',
    price_buy: '0.01',
  };
  const vineItem = {
    sku: 'TKTK-0008',
    scryfall_id: 'scry-vine',
    name: 'Iridescent Vinelasher Token',
    variation: 'T8',
    is_foil: 'false',
    price_retail: '0.30',
    price_buy: '0.01',
  };

  async function renderWithTokens(ckTokenItems, mtgjsonCards = []) {
    fetchSetCards.mockResolvedValue(CARDS);
    fetchSetTokenCards.mockResolvedValue(mtgjsonCards);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" ckTokenItems={ckTokenItems} />);
    await screen.findByLabelText('Copies of Arrow');
    await act(async () => {});
  }

  test('calls fetchSetTokenCards with the set code on mount', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await act(async () => {});
    expect(fetchSetTokenCards).toHaveBeenCalledWith('ktk');
  });

  test('shows token cards returned by fetchSetTokenCards', async () => {
    await renderWithTokens([], [fishCard]);
    expect(screen.getByText('Fish')).not.toBeNull();
  });

  test('DFC token shows as combined "A // B" row', async () => {
    await renderWithTokens([], [dfcCard]);
    expect(screen.getByText('Fish // Iridescent Vinelasher')).not.toBeNull();
  });

  test('CK items used as fallback when fetchSetTokenCards returns []', async () => {
    fetchSetTokenCards.mockResolvedValue([]);
    await renderWithTokens([fishItem, vineItem], []);
    expect(screen.getByText('Fish Token')).not.toBeNull();
    expect(screen.getByText('Iridescent Vinelasher Token')).not.toBeNull();
  });

  test('swallows fetchSetTokenCards errors, falls back to CK items', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    fetchSetTokenCards.mockRejectedValue(new Error('network error'));
    render(
      <SetTracker setCode="ktk" setName="Khans of Tarkir" ckTokenItems={[fishItem, vineItem]} />,
    );
    await screen.findByLabelText('Copies of Arrow');
    await act(async () => {});
    expect(screen.getByText('Fish Token')).not.toBeNull();
  });

  test('does not update state after unmount', async () => {
    fetchSetCards.mockResolvedValue(CARDS);
    let resolveTokenCards;
    fetchSetTokenCards.mockReturnValue(
      new Promise((resolve) => {
        resolveTokenCards = resolve;
      }),
    );
    const { unmount } = render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await act(async () => {});
    unmount();
    await act(async () => {
      resolveTokenCards([fishCard]);
    });
  });
});
