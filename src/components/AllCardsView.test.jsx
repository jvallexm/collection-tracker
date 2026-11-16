import { act, fireEvent, render, screen } from '@testing-library/react';
import { makeCard } from '../test/fixtures.js';
import {
  loadAllCollectionKeys,
  loadCards,
  loadCollection,
  saveCollection,
} from '../lib/storage.js';
import AllCardsView from './AllCardsView.jsx';

vi.mock('../lib/storage.js', () => ({
  loadAllCollectionKeys: vi.fn().mockResolvedValue([]),
  loadCards: vi.fn().mockResolvedValue([]),
  loadCollection: vi.fn().mockResolvedValue({}),
  saveCollection: vi.fn().mockResolvedValue(undefined),
}));

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

  test('clicking sort headers does nothing (sort is fixed)', async () => {
    loadAllCollectionKeys.mockResolvedValue(['ktk']);
    loadCards.mockResolvedValue([BOLT]);
    loadCollection.mockResolvedValue({ bolt: { qty: 1 } });
    await renderView();
    fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }));
    expect(screen.getByText('Lightning Bolt')).not.toBeNull();
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
