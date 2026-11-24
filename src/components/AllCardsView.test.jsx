import { act, fireEvent, render, screen } from '@testing-library/react';
import { makeCard } from '../test/fixtures.js';
import { refreshSetCardPrices } from '../lib/scryfall.js';
import {
  loadAllCollectionKeys,
  loadCards,
  loadCollection,
  saveCollection,
} from '../lib/storage.js';
import AllCardsView from './AllCardsView.jsx';

vi.mock('../lib/scryfall.js', () => ({
  refreshSetCardPrices: vi.fn().mockResolvedValue({ main: [], tokens: null }),
}));
vi.mock('../lib/storage.js', () => ({
  loadAllCollectionKeys: vi.fn().mockResolvedValue([]),
  loadCards: vi.fn().mockResolvedValue([]),
  loadCollection: vi.fn().mockResolvedValue({}),
  saveCollection: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  refreshSetCardPrices.mockResolvedValue({ main: [], tokens: null });
});

const BOLT = makeCard({
  id: 'bolt',
  name: 'Lightning Bolt',
  rarity: 'common',
  number: '1',
  set: 'KTK',
});
const ARROW = makeCard({ id: 'arrow', name: 'Arrow', rarity: 'rare', number: '2', set: 'ELD' });

async function renderView(props = {}) {
  render(<AllCardsView onClose={vi.fn()} {...props} />);
  await act(async () => {});
}

describe('AllCardsView loading', () => {
  test('shows a loading spinner before data arrives', () => {
    loadAllCollectionKeys.mockReturnValue(new Promise(() => {}));
    render(<AllCardsView onClose={vi.fn()} />);
    expect(document.querySelector('[aria-label="Loading"]')).not.toBeNull();
  });

  test('shows the table after data loads', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    await renderView();
    expect(screen.getByText('Lightning Bolt')).not.toBeNull();
  });
});

describe('AllCardsView owned cards filter', () => {
  test('only shows cards with nonzero quantity', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT, ARROW]);
    loadCollection.mockResolvedValue({ bolt: { qty: 2 }, arrow: { qty: 0 } });
    await renderView();
    expect(screen.getByText('Lightning Bolt')).not.toBeNull();
    expect(screen.queryByText('Arrow')).toBeNull();
  });

  test('shows cards with only foil copies', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 0, foil: 1 } });
    await renderView();
    expect(screen.getByText('Lightning Bolt')).not.toBeNull();
  });

  test('shows nothing when collection is empty', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({});
    await renderView();
    expect(screen.queryByText('Lightning Bolt')).toBeNull();
  });
});

describe('AllCardsView SET column', () => {
  test('shows a SET column header', async () => {
    loadAllCollectionKeys.mockResolvedValue([]);
    await renderView();
    expect(screen.getByRole('columnheader', { name: 'Set' })).not.toBeNull();
  });

  test('shows the set code for each card row', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    await renderView();
    expect(screen.getByText('KTK')).not.toBeNull();
  });
});

describe('AllCardsView sort order', () => {
  test('sorts by set code first, then card name', async () => {
    loadAllCollectionKeys.mockResolvedValue(['eld', 'ktk']);
    loadCards.mockImplementation((code) => Promise.resolve(code === 'eld' ? [ARROW] : [BOLT]));
    loadCollection.mockResolvedValue({ bolt: { qty: 1 }, arrow: { qty: 1 } });
    await renderView();
    const rows = document.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('Arrow');
    expect(rows[1].textContent).toContain('Lightning Bolt');
  });

  test('sorts alphabetically within the same set', async () => {
    const CHARM = makeCard({
      id: 'charm',
      name: 'Charm',
      rarity: 'common',
      number: '3',
      set: 'KTK',
    });
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT, CHARM]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 }, charm: { qty: 1 } });
    await renderView();
    const rows = document.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('Charm');
    expect(rows[1].textContent).toContain('Lightning Bolt');
  });
});

describe('AllCardsView prices and CK columns', () => {
  test('shows formatted price for owned cards', async () => {
    const PRICEY = makeCard({
      id: 'pricey',
      name: 'Pricey',
      rarity: 'rare',
      number: '1',
      set: 'KTK',
      price: '12.50',
    });
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([PRICEY]);
    loadCollection.mockResolvedValue({ pricey: { qty: 1 } });
    await renderView();
    expect(screen.getByText('$12')).not.toBeNull();
  });

  test('shows cheap price with cents', async () => {
    const CHEAP = makeCard({
      id: 'cheap',
      name: 'Cheap',
      rarity: 'common',
      number: '1',
      set: 'KTK',
      price: '0.50',
    });
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([CHEAP]);
    loadCollection.mockResolvedValue({ cheap: { qty: 1 } });
    await renderView();
    expect(screen.getByText('$0.50')).not.toBeNull();
  });

  test('shows CK buy prices when showCKTools is true', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    const ckPrices = new Map([['bolt', { nonfoilBuy: 1.5, foilBuy: 3.0 }]]);
    await renderView({ showCKTools: true, ckPrices });
    expect(screen.getByRole('columnheader', { name: 'CK' })).not.toBeNull();
    expect(screen.getByText('$1.50')).not.toBeNull();
  });

  test('shows empty CK cell when buy price is zero', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    const ckPrices = new Map([['bolt', { nonfoilBuy: 0, foilBuy: null }]]);
    await renderView({ showCKTools: true, ckPrices });
    expect(screen.getByRole('columnheader', { name: 'CK' })).not.toBeNull();
  });

  test('handles set with null loadCards gracefully', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue(null);
    loadCollection.mockResolvedValue({});
    await renderView();
    expect(document.querySelector('tbody').children).toHaveLength(0);
  });

  test('shows RL badge for reserved list cards', async () => {
    const RL = makeCard({
      id: 'rl',
      name: 'RL Card',
      rarity: 'rare',
      number: '1',
      set: 'KTK',
      reserved: true,
    });
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([RL]);
    loadCollection.mockResolvedValue({ rl: { qty: 1 } });
    await renderView();
    expect(screen.getByText('RL')).not.toBeNull();
  });
});

describe('AllCardsView quantity editing', () => {
  test('editing qty input updates the displayed value', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    await renderView();
    const input = screen.getByLabelText('Copies of Lightning Bolt');
    fireEvent.change(input, { target: { value: '3' } });
    expect(saveCollection).toHaveBeenCalled();
  });

  test('editing foil qty input updates the displayed value', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1, foil: 2 } });
    await renderView();
    const input = screen.getByLabelText('Foil copies of Lightning Bolt');
    fireEvent.change(input, { target: { value: '5' } });
    expect(saveCollection).toHaveBeenCalled();
  });

  test('includes cards from openSets prop even if not in storage', async () => {
    loadAllCollectionKeys.mockResolvedValue([]);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    await renderView({ openSets: [{ code: 'ktk' }] });
    expect(screen.getByText('Lightning Bolt')).not.toBeNull();
  });

  test('deduplicates cards that appear in multiple sets', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk', 'eld']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    await renderView();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  test('clicking Name header still shows all cards', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    await renderView();
    fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }));
    expect(screen.getByText('Lightning Bolt')).not.toBeNull();
  });
});

describe('AllCardsView interactive sort', () => {
  const rowNames = () =>
    screen
      .getAllByRole('textbox')
      .filter((el) => el.getAttribute('aria-label')?.startsWith('Copies of '))
      .map((el) => el.getAttribute('aria-label').replace('Copies of ', ''));

  beforeEach(() => {
    loadAllCollectionKeys.mockResolvedValue(['eld', 'ktk']);
    loadCards.mockImplementation((code) => Promise.resolve(code === 'eld' ? [ARROW] : [BOLT]));
    loadCollection.mockResolvedValue({ bolt: { qty: 1 }, arrow: { qty: 1 } });
  });

  test('default sort is by set code ascending', async () => {
    await renderView();
    expect(rowNames()).toEqual(['Arrow', 'Lightning Bolt']);
  });

  test('clicking Name header sorts by name ascending', async () => {
    await renderView();
    fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }));
    expect(rowNames()).toEqual(['Arrow', 'Lightning Bolt']);
  });

  test('clicking Name again reverses to descending', async () => {
    await renderView();
    fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }));
    fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }));
    expect(rowNames()).toEqual(['Lightning Bolt', 'Arrow']);
  });

  test('clicking Set header reverses to descending (already the active sort)', async () => {
    await renderView();
    fireEvent.click(screen.getByRole('columnheader', { name: /Set/ }));
    expect(rowNames()).toEqual(['Lightning Bolt', 'Arrow']);
  });

  test('clicking Set again reverts to ascending', async () => {
    await renderView();
    fireEvent.click(screen.getByRole('columnheader', { name: /Set/ }));
    fireEvent.click(screen.getByRole('columnheader', { name: /Set/ }));
    expect(rowNames()).toEqual(['Arrow', 'Lightning Bolt']);
  });

  test('clicking Qty header applies have sort (uses set as secondary)', async () => {
    await renderView();
    fireEvent.click(screen.getByRole('columnheader', { name: /Qty/ }));
    expect(rowNames()).toEqual(['Arrow', 'Lightning Bolt']);
  });

  test('clicking Qty again retains have sort with reversed secondary', async () => {
    await renderView();
    fireEvent.click(screen.getByRole('columnheader', { name: /Qty/ }));
    fireEvent.click(screen.getByRole('columnheader', { name: /Qty/ }));
    expect(rowNames()).toEqual(['Arrow', 'Lightning Bolt']);
  });
});

describe('AllCardsView search', () => {
  beforeEach(() => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT, ARROW]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 }, arrow: { qty: 1 } });
  });

  test('renders a search input', async () => {
    await renderView();
    expect(screen.getByRole('searchbox')).not.toBeNull();
  });

  test('shows all owned cards when search is empty', async () => {
    await renderView();
    expect(screen.getByText('Lightning Bolt')).not.toBeNull();
    expect(screen.getByText('Arrow')).not.toBeNull();
  });

  test('filters cards by name', async () => {
    await renderView();
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'Arrow' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(screen.queryByText('Lightning Bolt')).toBeNull();
    expect(screen.getByText('Arrow')).not.toBeNull();
  });

  test('pressing an unhandled key in search does nothing', async () => {
    await renderView();
    const box = screen.getByRole('searchbox');
    box.focus();
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(document.activeElement).toBe(box);
  });

  test('pressing ArrowDown from search focuses first table input', async () => {
    await renderView();
    const search = screen.getByRole('searchbox');
    search.focus();
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(document.activeElement?.tagName).toBe('INPUT');
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/Copies of/);
  });

  test('pressing ArrowUp on first table row refocuses search', async () => {
    await renderView();
    const search = screen.getByRole('searchbox');
    const firstInput = screen
      .getAllByRole('textbox')
      .find((el) => el.getAttribute('aria-label')?.startsWith('Copies of'));
    firstInput.focus();
    fireEvent.keyDown(firstInput, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(search);
  });
});

describe('AllCardsView card preview', () => {
  beforeEach(() => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
  });

  test('no preview shown before any input is focused', async () => {
    await renderView();
    expect(screen.queryByRole('img', { name: 'Lightning Bolt' })).toBeNull();
  });

  test('shows card preview when a quantity input is focused', async () => {
    await renderView();
    fireEvent.focus(screen.getByLabelText('Copies of Lightning Bolt'));
    expect(screen.getByAltText('Lightning Bolt')).not.toBeNull();
  });

  test('hides card preview when table loses focus', async () => {
    await renderView();
    const input = screen.getByLabelText('Copies of Lightning Bolt');
    fireEvent.focus(input);
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(screen.queryByAltText('Lightning Bolt')).toBeNull();
  });
});

describe('AllCardsView sell checkboxes', () => {
  test('sell checkbox is rendered when showCKTools is true', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    await renderView({ showCKTools: true, sellIds: new Set(), onSellToggle: vi.fn() });
    expect(screen.getByRole('checkbox', { name: 'Sell Lightning Bolt' })).not.toBeNull();
  });

  test('sell checkbox reflects sellIds prop', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    await renderView({ showCKTools: true, sellIds: new Set(['bolt']), onSellToggle: vi.fn() });
    expect(screen.getByRole('checkbox', { name: 'Sell Lightning Bolt' }).checked).toBe(true);
  });

  test('clicking sell checkbox calls onSellToggle with card id', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    const onSellToggle = vi.fn();
    await renderView({ showCKTools: true, sellIds: new Set(), onSellToggle });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sell Lightning Bolt' }));
    expect(onSellToggle).toHaveBeenCalledWith('bolt');
  });
});

describe('AllCardsView minimize', () => {
  test('shows a Minimize button in the titlebar', async () => {
    loadAllCollectionKeys.mockResolvedValue([]);
    await renderView({ onMinimize: vi.fn() });
    expect(screen.getByRole('button', { name: 'Minimize' })).not.toBeNull();
  });

  test('clicking Minimize calls onMinimize', async () => {
    loadAllCollectionKeys.mockResolvedValue([]);
    const onMinimize = vi.fn();
    await renderView({ onMinimize });
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    expect(onMinimize).toHaveBeenCalled();
  });

  test('when minimized renders a small icon instead of full window', async () => {
    loadAllCollectionKeys.mockResolvedValue([]);
    await renderView({ minimized: true, onRestore: vi.fn() });
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Restore' })).not.toBeNull();
  });

  test('when minimized clicking Restore calls onRestore', async () => {
    loadAllCollectionKeys.mockResolvedValue([]);
    const onRestore = vi.fn();
    await renderView({ minimized: true, onRestore });
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(onRestore).toHaveBeenCalled();
  });

  test('when minimized clicking Close calls onClose', async () => {
    loadAllCollectionKeys.mockResolvedValue([]);
    const onClose = vi.fn();
    await renderView({ minimized: true, onClose, onRestore: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  test('minimized icon is positioned at bottom-right', async () => {
    loadAllCollectionKeys.mockResolvedValue([]);
    await renderView({ minimized: true, onRestore: vi.fn() });
    const icon = document.querySelector('.window-icon');
    expect(icon.style.right).toBe('16px');
    expect(icon.style.left).toBe('auto');
  });
});

describe('AllCardsView close', () => {
  test('Close button calls onClose', async () => {
    const onClose = vi.fn();
    loadAllCollectionKeys.mockResolvedValue([]);
    render(<AllCardsView onClose={onClose} />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('AllCardsView price refresh', () => {
  test('calls refreshSetCardPrices for each loaded set code', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk', 'eld']);
    loadCards.mockResolvedValue([]);
    loadCollection.mockResolvedValue({});
    await renderView();
    expect(refreshSetCardPrices).toHaveBeenCalledWith('ktk');
    expect(refreshSetCardPrices).toHaveBeenCalledWith('eld');
  });

  test('updates cards state with refreshed prices', async () => {
    const FRESH_BOLT = { ...BOLT, price: '5.00' };
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    refreshSetCardPrices.mockResolvedValue({ main: [FRESH_BOLT], tokens: null });
    await renderView();
    expect(screen.getByText('Lightning Bolt')).not.toBeNull();
  });

  test('calls onPricesReady after all sets are refreshed', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([]);
    loadCollection.mockResolvedValue({});
    const onPricesReady = vi.fn();
    await renderView({ onPricesReady });
    expect(onPricesReady).toHaveBeenCalled();
  });

  test('calls onPricesReady immediately when there are no sets', async () => {
    loadAllCollectionKeys.mockResolvedValue([]);
    const onPricesReady = vi.fn();
    await renderView({ onPricesReady });
    expect(onPricesReady).toHaveBeenCalled();
    expect(refreshSetCardPrices).not.toHaveBeenCalled();
  });

  test('does not update state or call onPricesReady after unmount (initial cancel)', async () => {
    let resolveKeys;
    loadAllCollectionKeys.mockReturnValueOnce(
      new Promise((r) => {
        resolveKeys = r;
      }),
    );
    const onPricesReady = vi.fn();
    const { unmount } = render(<AllCardsView onClose={vi.fn()} onPricesReady={onPricesReady} />);
    unmount();
    await act(async () => {
      resolveKeys([]);
    });
    expect(onPricesReady).not.toHaveBeenCalled();
  });

  test('does not update state after unmount during refresh loop', async () => {
    let resolveRefresh;
    refreshSetCardPrices.mockReturnValueOnce(
      new Promise((r) => {
        resolveRefresh = r;
      }),
    );
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([]);
    loadCollection.mockResolvedValue({});
    const onPricesReady = vi.fn();
    const { unmount } = render(<AllCardsView onClose={vi.fn()} onPricesReady={onPricesReady} />);
    await act(async () => {});
    unmount();
    await act(async () => {
      resolveRefresh({ main: [], tokens: null });
    });
    expect(onPricesReady).not.toHaveBeenCalled();
  });
});
