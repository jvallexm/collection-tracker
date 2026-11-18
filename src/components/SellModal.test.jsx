import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { makeCard } from '../test/fixtures.js';
import { buildCKSellCsv } from '../lib/cardkingdom.js';
import { loadAllCollectionKeys, loadCards, loadCollection } from '../lib/storage.js';
import SellModal from './SellModal.jsx';

vi.mock('../lib/cardkingdom.js', () => ({
  buildCKSellCsv: vi.fn().mockReturnValue('card name,edition,foil,quantity'),
}));

vi.mock('../lib/storage.js', () => ({
  loadAllCollectionKeys: vi.fn().mockResolvedValue([]),
  loadCards: vi.fn().mockResolvedValue([]),
  loadCollection: vi.fn().mockResolvedValue({}),
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
    const input = screen.getByRole('spinbutton', { name: 'Sell Lightning Bolt' });
    expect(input.value).toBe('');
  });

  test('Foil Sell input starts at 0', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { foil: 1 } });
    await renderModal();
    const input = screen.getByRole('spinbutton', { name: 'Foil sell Lightning Bolt' });
    expect(input.value).toBe('');
  });

  test('typing a sell qty updates the input', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 3 } });
    await renderModal();
    const input = screen.getByRole('spinbutton', { name: 'Sell Lightning Bolt' });
    fireEvent.change(input, { target: { value: '2' } });
    expect(input.value).toBe('2');
  });

  test('sell qty is clamped to owned qty', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 2 } });
    await renderModal();
    const input = screen.getByRole('spinbutton', { name: 'Sell Lightning Bolt' });
    fireEvent.change(input, { target: { value: '99' } });
    expect(input.value).toBe('2');
  });

  test('Sell input is disabled when card has no nonfoil qty', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 0, foil: 1 } });
    await renderModal();
    expect(screen.getByRole('spinbutton', { name: 'Sell Lightning Bolt' }).disabled).toBe(true);
  });

  test('Foil Sell input is disabled when card is not foil-printable', async () => {
    loadAllCollectionKeys.mockResolvedValue(['eld']);
    loadCards.mockResolvedValue([WRATH]);
    loadCollection.mockResolvedValue({ wrath: { qty: 1 } });
    await renderModal();
    expect(screen.getByRole('spinbutton', { name: 'Foil sell Wrath of God' }).disabled).toBe(true);
  });

  test('invalid input (NaN) is treated as 0', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 3 } });
    await renderModal();
    const input = screen.getByRole('spinbutton', { name: 'Sell Lightning Bolt' });
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input.value).toBe('');
  });

  test('typing 0 explicitly shows empty input', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 3 } });
    await renderModal();
    const input = screen.getByRole('spinbutton', { name: 'Sell Lightning Bolt' });
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
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Sell Lightning Bolt' }), {
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
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Foil sell Lightning Bolt' }), {
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
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Sell Lightning Bolt' }), {
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
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Sell Lightning Bolt' }), {
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
