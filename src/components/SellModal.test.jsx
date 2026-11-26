import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { makeCard } from '../test/fixtures.js';
import { buildCKSellCsv } from '../lib/cardkingdom.js';
import { fetchCardsByIds } from '../lib/scryfall.js';
import {
  loadAllCollectionKeys,
  loadCards,
  loadCollection,
  loadConfig,
  loadPartialCards,
  saveConfig,
  savePartialCards,
} from '../lib/storage.js';
import SellModal from './SellModal.jsx';

vi.mock('../lib/cardkingdom.js', () => ({
  buildCKSellCsv: vi.fn().mockReturnValue('card name,edition,foil,quantity'),
  buildTokenCards: vi.fn().mockReturnValue([]),
}));

vi.mock('../lib/scryfall.js', () => ({
  fetchCardsByIds: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/storage.js', () => ({
  loadAllCollectionKeys: vi.fn().mockResolvedValue([]),
  loadCards: vi.fn().mockResolvedValue([]),
  loadCollection: vi.fn().mockResolvedValue({}),
  loadConfig: vi.fn().mockResolvedValue(null),
  loadPartialCards: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn().mockResolvedValue(undefined),
  savePartialCards: vi.fn().mockResolvedValue(undefined),
}));

const BOLT = makeCard({
  id: 'bolt',
  name: 'Lightning Bolt',
  rarity: 'common',
  number: '1',
  set: 'KTK',
  nonfoil: true,
  foil: true,
});
const WRATH = makeCard({
  id: 'wrath',
  name: 'Wrath of God',
  rarity: 'rare',
  number: '2',
  set: 'ELD',
  nonfoil: true,
  foil: false,
});

async function renderModal(props = {}) {
  render(<SellModal onClose={vi.fn()} openSets={[]} {...props} />);
  await act(async () => {});
}

describe('SellModal loading', () => {
  test('shows a loading spinner before data arrives', () => {
    loadAllCollectionKeys.mockReturnValue(new Promise(() => {}));
    render(<SellModal onClose={vi.fn()} openSets={[]} />);
    expect(document.querySelector('[aria-label="Loading"]')).not.toBeNull();
  });

  test('shows the table after data loads', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 2 } });
    await renderModal();
    expect(screen.getByText('Lightning Bolt')).not.toBeNull();
  });

  test('falls back to fetchCardsByIds when loadCards returns null', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue(null);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    fetchCardsByIds.mockResolvedValue([BOLT]);
    await renderModal();
    expect(screen.getByText('Lightning Bolt')).not.toBeNull();
  });

  test('shows empty list when both loadCards and fetchCardsByIds fail', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue(null);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    fetchCardsByIds.mockRejectedValue(new Error('network'));
    await renderModal();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(0);
  });
});

describe('SellModal owned cards', () => {
  test('only shows cards with nonzero quantity', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT, WRATH]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 }, wrath: { qty: 0 } });
    await renderModal();
    expect(screen.getByText('Lightning Bolt')).not.toBeNull();
    expect(screen.queryByText('Wrath of God')).toBeNull();
  });

  test('shows cards with only foil copies', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 0, foil: 1 } });
    await renderModal();
    expect(screen.getByText('Lightning Bolt')).not.toBeNull();
  });

  test('deduplicates cards that appear in multiple sets', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk', 'eld']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    await renderModal();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
  });
});

describe('SellModal columns', () => {
  test('has Sell and Foil Sell column headers', async () => {
    await renderModal();
    expect(screen.getByRole('columnheader', { name: 'Sell' })).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Foil Sell' })).not.toBeNull();
  });

  test('does not show $ or $F price columns', async () => {
    await renderModal();
    const headers = Array.from(document.querySelectorAll('th')).map((th) => th.textContent.trim());
    expect(headers).not.toContain('$');
    expect(headers).not.toContain('$F');
  });

  test('shows CK and CKF columns when ckPrices is provided', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    const ckPrices = new Map([['bolt', { nonfoilBuy: 1.5, foilBuy: 3.0 }]]);
    await renderModal({ ckPrices });
    expect(screen.getByRole('columnheader', { name: 'CK' })).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'CKF' })).not.toBeNull();
    expect(screen.getByText('$1.50')).not.toBeNull();
  });

  test('shows empty CK cell when buy price is null or zero', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    const ckPrices = new Map([['bolt', { nonfoilBuy: null, foilBuy: 0 }]]);
    await renderModal({ ckPrices });
    expect(screen.getAllByRole('cell', { name: '' }).length).toBeGreaterThan(0);
  });

  test('shows Set column with uppercase code', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    await renderModal();
    expect(screen.getByRole('columnheader', { name: 'Set' })).not.toBeNull();
    expect(screen.getByText('KTK')).not.toBeNull();
  });
});

describe('SellModal sell qty inputs', () => {
  test('Sell input starts at 0', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 2 } });
    await renderModal();
    const input = screen.getByRole('textbox', { name: 'Sell Lightning Bolt' });
    expect(input.value).toBe('');
  });

  test('Foil Sell input starts at 0', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { foil: 1 } });
    await renderModal();
    const input = screen.getByRole('textbox', { name: 'Foil sell Lightning Bolt' });
    expect(input.value).toBe('');
  });

  test('typing a sell qty updates the input', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 3 } });
    await renderModal();
    const input = screen.getByRole('textbox', { name: 'Sell Lightning Bolt' });
    fireEvent.change(input, { target: { value: '2' } });
    expect(input.value).toBe('2');
  });

  test('sell qty is clamped to owned qty', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 2 } });
    await renderModal();
    const input = screen.getByRole('textbox', { name: 'Sell Lightning Bolt' });
    fireEvent.change(input, { target: { value: '99' } });
    expect(input.value).toBe('2');
  });

  test('Sell input is disabled when card has no nonfoil qty', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 0, foil: 1 } });
    await renderModal();
    expect(screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }).disabled).toBe(true);
  });

  test('Foil Sell input is disabled when card is not foil-printable', async () => {
    loadAllCollectionKeys.mockResolvedValue(['eld']);
    loadCards.mockResolvedValue([WRATH]);
    loadCollection.mockResolvedValue({ wrath: { qty: 1 } });
    await renderModal();
    expect(screen.getByRole('textbox', { name: 'Foil sell Wrath of God' }).disabled).toBe(true);
  });

  test('invalid input (NaN) is treated as 0', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 3 } });
    await renderModal();
    const input = screen.getByRole('textbox', { name: 'Sell Lightning Bolt' });
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input.value).toBe('');
  });

  test('typing 0 explicitly shows empty input', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 3 } });
    await renderModal();
    const input = screen.getByRole('textbox', { name: 'Sell Lightning Bolt' });
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.change(input, { target: { value: '0' } });
    expect(input.value).toBe('');
  });
});

describe('SellModal export', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:test'),
      revokeObjectURL: vi.fn(),
    });
    buildCKSellCsv.mockClear();
  });

  test('Export button triggers file download', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 2 } });
    await renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  test('Export button calls onClose', async () => {
    const onClose = vi.fn();
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 2 } });
    await renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onClose).toHaveBeenCalled();
  });

  test('calls buildCKSellCsv with sellCollection containing typed qty', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 3 } });
    await renderModal({ openSets: [{ code: 'ktk', name: 'Khans of Tarkir' }] });
    fireEvent.change(screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const [setsData] = buildCKSellCsv.mock.calls.at(-1);
    const sellCollection = setsData.flatMap((s) => Object.entries(s.sellCollection));
    expect(sellCollection).toContainEqual(['bolt', { qty: 2, foil: 0 }]);
  });

  test('calls buildCKSellCsv with foilSellCollection containing typed foil qty', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 0, foil: 3 } });
    await renderModal({ openSets: [{ code: 'ktk', name: 'Khans of Tarkir' }] });
    fireEvent.change(screen.getByRole('textbox', { name: 'Foil sell Lightning Bolt' }), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const [setsData] = buildCKSellCsv.mock.calls.at(-1);
    const sellCollection = setsData.flatMap((s) => Object.entries(s.sellCollection));
    expect(sellCollection).toContainEqual(['bolt', { qty: 0, foil: 2 }]);
  });

  test('cards with zero sell qty are excluded from sellCollection', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 2 } });
    await renderModal({ openSets: [{ code: 'ktk', name: 'Khans of Tarkir' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const [setsData] = buildCKSellCsv.mock.calls.at(-1);
    const allSellCollections = setsData.map((s) => s.sellCollection);
    expect(allSellCollections.every((sc) => Object.keys(sc).length === 0)).toBe(true);
  });

  test('uses set code as setName fallback when set is not in openSets', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    await renderModal({ openSets: [] });
    fireEvent.change(screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const [setsData] = buildCKSellCsv.mock.calls.at(-1);
    expect(setsData.some((s) => s.setName === 'ktk')).toBe(true);
  });

  test('skips cards from other sets when building sellCollection per set', async () => {
    const ARROW = makeCard({
      id: 'arrow',
      name: 'Arrow',
      rarity: 'common',
      number: '2',
      set: 'ELD',
      nonfoil: true,
      foil: true,
    });
    loadAllCollectionKeys.mockResolvedValue(['ktk', 'eld']);
    loadCards.mockImplementation((code) => Promise.resolve(code === 'ktk' ? [BOLT] : [ARROW]));
    loadCollection.mockResolvedValue({ bolt: { qty: 1 }, arrow: { qty: 1 } });
    await renderModal({
      openSets: [
        { code: 'ktk', name: 'Khans of Tarkir' },
        { code: 'eld', name: 'Eldraine' },
      ],
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const [setsData] = buildCKSellCsv.mock.calls.at(-1);
    const ktkSet = setsData.find((s) => s.setName === 'Khans of Tarkir');
    expect(ktkSet.sellCollection).toHaveProperty('bolt');
    expect(ktkSet.sellCollection).not.toHaveProperty('arrow');
  });

  test('shows RL badge for reserved list cards', async () => {
    const RL = makeCard({
      id: 'rl',
      name: 'Ancestral Recall',
      rarity: 'rare',
      number: '1',
      set: 'LEA',
      reserved: true,
    });
    loadAllCollectionKeys.mockResolvedValue(['lea']);
    loadCards.mockResolvedValue([RL]);
    loadCollection.mockResolvedValue({ rl: { qty: 1 } });
    await renderModal();
    expect(screen.getByText('RL')).not.toBeNull();
  });
});

describe('SellModal close', () => {
  test('Close button calls onClose', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  test('Escape key calls onClose', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  test('non-Escape keydown does not call onClose', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  test('clicking the backdrop calls onClose', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });
    fireEvent.click(document.querySelector('.modal-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  test('clicking inside the dialog does not call onClose', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });
    fireEvent.click(document.querySelector('.dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('SellModal card preview', () => {
  test('shows card preview when a sell input is focused', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 2 } });
    await renderModal();
    fireEvent.focus(screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }));
    expect(document.querySelector('.card-preview')).not.toBeNull();
  });

  test('hides card preview when no input is focused', async () => {
    await renderModal();
    expect(document.querySelector('.card-preview')).toBeNull();
  });
});

describe('SellModal keyboard navigation', () => {
  const BOLT_NOFOIL = makeCard({
    id: 'bolt-nf',
    name: 'Bolt NF',
    rarity: 'common',
    number: '3',
    set: 'KTK',
    nonfoil: true,
    foil: false,
  });

  beforeEach(() => {
    loadAllCollectionKeys.mockResolvedValue(['eld', 'ktk']);
    loadCards.mockImplementation((code) => Promise.resolve(code === 'eld' ? [WRATH] : [BOLT]));
    loadCollection.mockResolvedValue({ bolt: { qty: 2, foil: 1 }, wrath: { qty: 1 } });
  });

  // Rows after sort: WRATH (ELD) first, BOLT (KTK) second.
  // WRATH foil-sell is disabled (foil: false). BOLT foil-sell is enabled (foil: 1).

  test('ArrowDown from first sell focuses second sell', async () => {
    await renderModal();
    screen.getByRole('textbox', { name: 'Sell Wrath of God' }).focus();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Sell Wrath of God' }), {
      key: 'ArrowDown',
    });
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }),
    );
  });

  test('ArrowUp from second sell focuses first sell', async () => {
    await renderModal();
    screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }).focus();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }), {
      key: 'ArrowUp',
    });
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Sell Wrath of God' }));
  });

  test('ArrowDown from last sell does not move focus', async () => {
    await renderModal();
    const last = screen.getByRole('textbox', { name: 'Sell Lightning Bolt' });
    last.focus();
    fireEvent.keyDown(last, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(last);
  });

  test('ArrowUp from first sell does not move focus', async () => {
    await renderModal();
    const first = screen.getByRole('textbox', { name: 'Sell Wrath of God' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
  });

  test('Enter from first sell moves to second sell', async () => {
    await renderModal();
    screen.getByRole('textbox', { name: 'Sell Wrath of God' }).focus();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Sell Wrath of God' }), { key: 'Enter' });
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }),
    );
  });

  test('S key moves down, W key moves up', async () => {
    await renderModal();
    screen.getByRole('textbox', { name: 'Sell Wrath of God' }).focus();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Sell Wrath of God' }), { key: 's' });
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }),
    );
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }), { key: 'w' });
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Sell Wrath of God' }));
  });

  test('ArrowRight from sell moves to enabled foil-sell', async () => {
    await renderModal();
    screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }).focus();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }), {
      key: 'ArrowRight',
    });
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Foil sell Lightning Bolt' }),
    );
  });

  test('D key moves right, A key moves left', async () => {
    await renderModal();
    screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }).focus();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }), { key: 'd' });
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Foil sell Lightning Bolt' }),
    );
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Foil sell Lightning Bolt' }), {
      key: 'a',
    });
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }),
    );
  });

  test('ArrowLeft from first column does not move focus', async () => {
    await renderModal();
    const sell = screen.getByRole('textbox', { name: 'Sell Lightning Bolt' });
    sell.focus();
    fireEvent.keyDown(sell, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(sell);
  });

  test('ArrowRight from last column does not move focus', async () => {
    await renderModal();
    const foilSell = screen.getByRole('textbox', { name: 'Foil sell Lightning Bolt' });
    foilSell.focus();
    fireEvent.keyDown(foilSell, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(foilSell);
  });

  test('ArrowRight to disabled foil-sell finds next enabled foil-sell across rows', async () => {
    await renderModal();
    screen.getByRole('textbox', { name: 'Sell Wrath of God' }).focus();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Sell Wrath of God' }), {
      key: 'ArrowRight',
    });
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Foil sell Lightning Bolt' }),
    );
  });

  test('ArrowRight to disabled foil-sell with no next enabled does not move focus', async () => {
    loadCards.mockImplementation((code) =>
      Promise.resolve(code === 'eld' ? [WRATH] : [BOLT_NOFOIL]),
    );
    loadCollection.mockResolvedValue({ wrath: { qty: 1 }, 'bolt-nf': { qty: 1 } });
    await renderModal();
    const sell = screen.getByRole('textbox', { name: 'Sell Wrath of God' });
    sell.focus();
    fireEvent.keyDown(sell, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(sell);
  });

  test('non-nav key does not move focus', async () => {
    await renderModal();
    const sell = screen.getByRole('textbox', { name: 'Sell Wrath of God' });
    sell.focus();
    fireEvent.keyDown(sell, { key: 'F' });
    expect(document.activeElement).toBe(sell);
  });

  test('ArrowUp from foil-sell skips disabled foil-sell rows', async () => {
    await renderModal();
    const foilSell = screen.getByRole('textbox', { name: 'Foil sell Lightning Bolt' });
    foilSell.focus();
    fireEvent.keyDown(foilSell, { key: 'ArrowUp' });
    // WRATH foil-sell is disabled, so no prior enabled foil-sell exists → no movement
    expect(document.activeElement).toBe(foilSell);
  });

  test('ArrowDown from foil-sell skips disabled foil-sell rows', async () => {
    const ALPHA = makeCard({
      id: 'alpha',
      name: 'Alpha',
      rarity: 'common',
      number: '10',
      set: 'KTK',
      nonfoil: true,
      foil: true,
    });
    const BETA_NF = makeCard({
      id: 'beta',
      name: 'Beta',
      rarity: 'common',
      number: '11',
      set: 'KTK',
      nonfoil: true,
      foil: false,
    });
    const GAMMA = makeCard({
      id: 'gamma',
      name: 'Gamma',
      rarity: 'common',
      number: '12',
      set: 'KTK',
      nonfoil: true,
      foil: true,
    });
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([ALPHA, BETA_NF, GAMMA]);
    loadCollection.mockResolvedValue({
      alpha: { qty: 1, foil: 1 },
      beta: { qty: 1 },
      gamma: { qty: 1, foil: 1 },
    });
    await renderModal();
    // Sorted: ALPHA, BETA_NF (foil-sell disabled), GAMMA.
    // ArrowDown from ALPHA's foil-sell must skip BETA_NF and land on GAMMA.
    const foilSell = screen.getByRole('textbox', { name: 'Foil sell Alpha' });
    foilSell.focus();
    fireEvent.keyDown(foilSell, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Foil sell Gamma' }));
  });
});

describe('SellModal backtick fill', () => {
  test('backtick fills sell input with inventory qty', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 3, foil: 0 } });
    await renderModal();
    const input = screen.getByRole('textbox', { name: 'Sell Lightning Bolt' });
    input.focus();
    fireEvent.keyDown(input, { key: '`' });
    expect(input.value).toBe('3');
  });

  test('backtick fills foil-sell input with foil inventory qty', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 0, foil: 2 } });
    await renderModal();
    const input = screen.getByRole('textbox', { name: 'Foil sell Lightning Bolt' });
    input.focus();
    fireEvent.keyDown(input, { key: '`' });
    expect(input.value).toBe('2');
  });
});

describe('SellModal branch coverage', () => {
  test('skips uncachedIds for card already indexed from earlier cached set', async () => {
    // ktk cached first → bolt indexed; eld uncached second → bolt skipped (line 193 false branch)
    loadAllCollectionKeys.mockResolvedValue(['ktk', 'eld']);
    loadCards.mockImplementation((code) => Promise.resolve(code === 'ktk' ? [BOLT] : null));
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    fetchCardsByIds.mockResolvedValue([]);
    await renderModal();
    expect(fetchCardsByIds).not.toHaveBeenCalledWith(expect.arrayContaining(['bolt']));
    expect(screen.getByText('Lightning Bolt')).not.toBeNull();
  });

  test('skips fetched card already indexed from a later cached set', async () => {
    // eld uncached first → bolt pushed to uncachedIds; ktk cached second → bolt indexed
    // fetchCardsByIds returns bolt but !indexAccum[bolt] is false → skipped (lines 202-205 false branch)
    loadAllCollectionKeys.mockResolvedValue(['eld', 'ktk']);
    loadCards.mockImplementation((code) => Promise.resolve(code === 'ktk' ? [BOLT] : null));
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    fetchCardsByIds.mockResolvedValue([BOLT]);
    await renderModal();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  test('sorts two cards from the same set alphabetically by name', async () => {
    const WRATH_KTK = makeCard({
      id: 'wrath',
      name: 'Wrath of God',
      rarity: 'rare',
      number: '2',
      set: 'KTK',
      nonfoil: true,
      foil: false,
    });
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([WRATH_KTK, BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 }, wrath: { qty: 1 } });
    await renderModal();
    const rows = document.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).queryByText('Lightning Bolt')).not.toBeNull();
    expect(within(rows[1]).queryByText('Wrath of God')).not.toBeNull();
  });

  test('filters out fetched card whose id is absent from merged collection', async () => {
    // fetchCardsByIds returns a card with an id not in any collection entry
    // → mergedCollection[card.id] is undefined → entry?. optional chain fires its null/undefined path
    const OTHER = { ...BOLT, id: 'other-id' };
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue(null);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    fetchCardsByIds.mockResolvedValue([OTHER]);
    await renderModal();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(0);
  });
});

describe('SellModal partial cache', () => {
  test('uses partial cache for set when full cache is absent', async () => {
    loadAllCollectionKeys.mockResolvedValue(['znc']);
    loadCards.mockResolvedValue(null);
    loadPartialCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    await renderModal();
    expect(fetchCardsByIds).not.toHaveBeenCalled();
    expect(screen.getByText('Lightning Bolt')).not.toBeNull();
  });

  test('saves fetched cards as partial cache grouped by set', async () => {
    const WRATH = makeCard({
      id: 'wrath',
      name: 'Wrath of God',
      set: 'ELD',
      nonfoil: true,
      foil: false,
    });
    loadAllCollectionKeys.mockResolvedValue(['znc']);
    loadCards.mockResolvedValue(null);
    loadPartialCards.mockResolvedValue(null);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 }, wrath: { qty: 1 } });
    fetchCardsByIds.mockResolvedValue([BOLT, WRATH]);
    await renderModal();
    expect(savePartialCards).toHaveBeenCalledWith('ktk', [BOLT]);
    expect(savePartialCards).toHaveBeenCalledWith('eld', [WRATH]);
  });

  test('does not add to uncachedIds when partial cache is available', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue(null);
    loadPartialCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    await renderModal();
    expect(fetchCardsByIds).not.toHaveBeenCalledWith(expect.arrayContaining(['bolt']));
  });
});

describe('SellModal persistence', () => {
  beforeEach(() => {
    saveConfig.mockClear();
    loadConfig.mockResolvedValue(null);
  });

  test('loads saved sell qtys from config on mount', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 3 } });
    loadConfig.mockImplementation((key) =>
      Promise.resolve(key === 'sellQtys' ? { bolt: 2 } : null),
    );
    await renderModal();
    expect(screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }).value).toBe('2');
  });

  test('loads saved foil sell qtys from config on mount', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 0, foil: 3 } });
    loadConfig.mockImplementation((key) =>
      Promise.resolve(key === 'foilSellQtys' ? { bolt: 1 } : null),
    );
    await renderModal();
    expect(screen.getByRole('textbox', { name: 'Foil sell Lightning Bolt' }).value).toBe('1');
  });

  test('saves sell qtys to config when changed', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 3 } });
    await renderModal();
    fireEvent.change(screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }), {
      target: { value: '2' },
    });
    expect(saveConfig).toHaveBeenCalledWith('sellQtys', { bolt: 2 });
  });

  test('saves foil sell qtys to config when changed', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 0, foil: 3 } });
    await renderModal();
    fireEvent.change(screen.getByRole('textbox', { name: 'Foil sell Lightning Bolt' }), {
      target: { value: '2' },
    });
    expect(saveConfig).toHaveBeenCalledWith('foilSellQtys', { bolt: 2 });
  });

  test('does not save sell qtys before config is loaded', async () => {
    let resolveConfig;
    loadConfig.mockReturnValueOnce(
      new Promise((r) => {
        resolveConfig = r;
      }),
    );
    loadConfig.mockResolvedValue(null);
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 3 } });
    render(<SellModal onClose={vi.fn()} openSets={[]} />);
    // Don't await act — config hasn't loaded yet
    expect(saveConfig).not.toHaveBeenCalledWith('sellQtys', expect.anything());
    await act(async () => {
      resolveConfig(null);
    });
  });
});

describe('SellModal CK total', () => {
  const ckPrices = new Map([
    ['bolt', { nonfoilBuy: 2.5, foilBuy: 5.0 }],
    ['wrath', { nonfoilBuy: 1.0, foilBuy: null }],
  ]);

  beforeEach(() => {
    loadAllCollectionKeys.mockResolvedValue(['ktk', 'eld']);
    loadCards.mockImplementation((code) => Promise.resolve(code === 'eld' ? [WRATH] : [BOLT]));
    loadCollection.mockResolvedValue({ bolt: { qty: 2, foil: 1 }, wrath: { qty: 1 } });
  });

  test('shows $0.00 when no sell qtys are set', async () => {
    await renderModal({ ckPrices });
    expect(screen.getByText(/CK total:/).textContent).toBe('CK total: $0.00');
  });

  test('adds nonfoil and foil prices to running total', async () => {
    await renderModal({ ckPrices });
    fireEvent.change(screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Foil sell Lightning Bolt' }), {
      target: { value: '1' },
    });
    // 2 * 2.50 + 1 * 5.00 = 10.00
    expect(screen.getByText(/CK total:/).textContent).toBe('CK total: $10.00');
  });

  test('skips cards with no CK entry in total', async () => {
    const noCK = new Map([['wrath', { nonfoilBuy: 1.0, foilBuy: null }]]);
    await renderModal({ ckPrices: noCK });
    fireEvent.change(screen.getByRole('textbox', { name: 'Sell Lightning Bolt' }), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Sell Wrath of God' }), {
      target: { value: '1' },
    });
    // bolt has no CK entry → skipped; wrath: 1 * 1.00 = 1.00
    expect(screen.getByText(/CK total:/).textContent).toBe('CK total: $1.00');
  });

  test('hides total when ckPrices is not provided', async () => {
    await renderModal();
    expect(screen.queryByText(/CK total:/)).toBeNull();
  });
});
