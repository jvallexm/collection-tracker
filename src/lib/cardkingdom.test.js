import { buildCKSellCsv, fetchCKPrices } from './cardkingdom.js';
import { makeCard } from '../test/fixtures.js';

function makeItem(overrides) {
  return {
    scryfall_id: 'abc',
    name: 'Lightning Bolt',
    is_foil: false,
    price_buy: 1.25,
    ...overrides,
  };
}

describe('fetchCKPrices', () => {
  test('returns a map with nonfoil buy price (boolean false)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [makeItem({ price_buy: 2.5, is_foil: false })] }),
      }),
    );
    expect((await fetchCKPrices()).prices.get('abc')).toEqual({ nonfoilBuy: 2.5 });
  });

  test('returns a map with nonfoil buy price (string "false")', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [makeItem({ price_buy: '2.50', is_foil: 'false' })] }),
      }),
    );
    expect((await fetchCKPrices()).prices.get('abc')).toEqual({ nonfoilBuy: 2.5 });
  });

  test('returns a map with foil buy price (boolean true)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [makeItem({ price_buy: 5.0, is_foil: true })] }),
      }),
    );
    expect((await fetchCKPrices()).prices.get('abc')).toEqual({ foilBuy: 5 });
  });

  test('returns a map with foil buy price (string "true")', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [makeItem({ price_buy: '5.00', is_foil: 'true' })] }),
      }),
    );
    expect((await fetchCKPrices()).prices.get('abc')).toEqual({ foilBuy: 5 });
  });

  test('merges nonfoil and foil entries for the same scryfall_id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            makeItem({ price_buy: '2.00', is_foil: 'false' }),
            makeItem({ price_buy: '6.00', is_foil: 'true' }),
          ],
        }),
      }),
    );
    expect((await fetchCKPrices()).prices.get('abc')).toEqual({ nonfoilBuy: 2, foilBuy: 6 });
  });

  test('stores null for nonfoil when price_buy is 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [makeItem({ price_buy: '0', is_foil: 'false' })] }),
      }),
    );
    expect((await fetchCKPrices()).prices.get('abc')).toEqual({ nonfoilBuy: null });
  });

  test('stores null for foil when price_buy is 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [makeItem({ price_buy: '0', is_foil: 'true' })] }),
      }),
    );
    expect((await fetchCKPrices()).prices.get('abc')).toEqual({ foilBuy: null });
  });

  test('skips items with no scryfall_id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [makeItem({ scryfall_id: '' })] }),
      }),
    );
    expect((await fetchCKPrices()).prices.size).toBe(0);
  });

  test('returns null on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    expect(await fetchCKPrices()).toBeNull();
  });

  test('returns null on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    expect(await fetchCKPrices()).toBeNull();
  });

  test('tokenItems includes entries where name contains "Token"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [makeItem({ name: 'Soldier Token', sku: 'TKTK-0001' })],
        }),
      }),
    );
    const result = await fetchCKPrices();
    expect(result.tokenItems).toHaveLength(1);
    expect(result.tokenItems[0].name).toBe('Soldier Token');
  });

  test('tokenItems excludes entries where name does not contain "Token"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            makeItem({ name: 'Lightning Bolt', sku: 'KTK-0001' }),
            makeItem({ name: 'Soldier Token', sku: 'TKTK-0001' }),
          ],
        }),
      }),
    );
    const result = await fetchCKPrices();
    expect(result.tokenItems).toHaveLength(1);
    expect(result.tokenItems[0].name).toBe('Soldier Token');
  });

  test('tokenItems is empty when no entries have "Token" in name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [makeItem({ name: 'Lightning Bolt', sku: 'KTK-0001' })],
        }),
      }),
    );
    const result = await fetchCKPrices();
    expect(result.tokenItems).toEqual([]);
  });
});

describe('buildCKSellCsv', () => {
  const BOLT = makeCard({ id: 'b', name: 'Lightning Bolt', set: 'LEB' });
  const WRATH = makeCard({ id: 'w', name: 'Wrath of God', set: 'LEB' });

  test('generates header and one nonfoil row', () => {
    const csv = buildCKSellCsv([
      {
        setName: 'Limited Edition Beta',
        cards: [BOLT],
        sellCollection: { b: { qty: 3 } },
      },
    ]);
    expect(csv).toBe(
      'card name,edition,foil,quantity\nLightning Bolt,Limited Edition Beta,false,3',
    );
  });

  test('generates a foil row when foil sell qty > 0', () => {
    const csv = buildCKSellCsv([
      {
        setName: 'Limited Edition Beta',
        cards: [BOLT],
        sellCollection: { b: { foil: 2 } },
      },
    ]);
    expect(csv).toBe('card name,edition,foil,quantity\nLightning Bolt,Limited Edition Beta,true,2');
  });

  test('generates both nonfoil and foil rows when both have sell qty', () => {
    const csv = buildCKSellCsv([
      {
        setName: 'Limited Edition Beta',
        cards: [BOLT],
        sellCollection: { b: { qty: 1, foil: 1 } },
      },
    ]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('false,1');
    expect(lines[2]).toContain('true,1');
  });

  test('skips cards not in sellCollection', () => {
    const csv = buildCKSellCsv([
      {
        setName: 'Limited Edition Beta',
        cards: [BOLT, WRATH],
        sellCollection: { b: { qty: 2 } },
      },
    ]);
    expect(csv).not.toContain('Wrath of God');
  });

  test('skips rows where sell qty is 0 or missing', () => {
    const csv = buildCKSellCsv([
      {
        setName: 'Limited Edition Beta',
        cards: [BOLT],
        sellCollection: { b: { qty: 0 } },
      },
    ]);
    expect(csv).toBe('card name,edition,foil,quantity');
  });

  test('quotes card names containing commas', () => {
    const comma = makeCard({ id: 'c', name: 'Who, What, When' });
    const csv = buildCKSellCsv([
      {
        setName: 'Test',
        cards: [comma],
        sellCollection: { c: { qty: 1 } },
      },
    ]);
    expect(csv).toContain('"Who, What, When"');
  });

  test('combines rows from multiple sets', () => {
    const csv = buildCKSellCsv([
      { setName: 'Alpha', cards: [BOLT], sellCollection: { b: { qty: 1 } } },
      { setName: 'Beta', cards: [WRATH], sellCollection: { w: { qty: 2 } } },
    ]);
    expect(csv).toContain('Alpha');
    expect(csv).toContain('Beta');
  });
});
