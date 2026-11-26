import { loadCards, loadConfig, saveCards, saveCollection, saveConfig } from './storage.js';
import {
  buildSearchUrl,
  fetchSet,
  fetchSetCards,
  fetchSets,
  fetchTokenCards,
  normalizeCard,
  refreshBulkDataIfStale,
  refreshSetCardPrices,
} from './scryfall.js';

const rawCard = (overrides) => ({
  id: 'abc',
  name: 'Abzan Guide',
  rarity: 'rare',
  mana_cost: '{2}{W}{B}{G}',
  collector_number: '169',
  set: 'ktk',
  ...overrides,
});

const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body });

describe('buildSearchUrl', () => {
  test('searches one set, unique cards, ordered by name', () => {
    expect(buildSearchUrl('ktk')).toBe(
      'https://api.scryfall.com/cards/search?q=set%3Aktk&unique=prints&order=name',
    );
  });
});

describe('normalizeCard', () => {
  test('keeps only the fields the app uses and uppercases the set', () => {
    expect(normalizeCard(rawCard())).toEqual({
      id: 'abc',
      name: 'Abzan Guide',
      rarity: 'rare',
      cost: '{2}{W}{B}{G}',
      number: '169',
      set: 'KTK',
      reserved: false,
      price: null,
      priceFoil: null,
      nonfoil: true,
      foil: true,
    });
  });

  test('extracts usd and usd_foil prices when present', () => {
    const card = normalizeCard(rawCard({ prices: { usd: '1.23', usd_foil: '4.56' } }));
    expect(card.price).toBe('1.23');
    expect(card.priceFoil).toBe('4.56');
  });

  test('defaults price and priceFoil to null when prices field is absent', () => {
    const card = normalizeCard(rawCard());
    expect(card.price).toBeNull();
    expect(card.priceFoil).toBeNull();
  });

  test('defaults individual prices to null when only one is present', () => {
    const card = normalizeCard(rawCard({ prices: { usd: '2.00' } }));
    expect(card.price).toBe('2.00');
    expect(card.priceFoil).toBeNull();
  });

  test('defaults nonfoil and foil to true when finishes is absent', () => {
    const card = normalizeCard(rawCard());
    expect(card.nonfoil).toBe(true);
    expect(card.foil).toBe(true);
  });

  test('sets nonfoil false for foil-only cards', () => {
    const card = normalizeCard(rawCard({ finishes: ['foil'] }));
    expect(card.nonfoil).toBe(false);
    expect(card.foil).toBe(true);
  });

  test('sets foil false for nonfoil-only cards', () => {
    const card = normalizeCard(rawCard({ finishes: ['nonfoil'] }));
    expect(card.nonfoil).toBe(true);
    expect(card.foil).toBe(false);
  });

  test('treats etched as foil', () => {
    const card = normalizeCard(rawCard({ finishes: ['etched'] }));
    expect(card.nonfoil).toBe(false);
    expect(card.foil).toBe(true);
  });

  test('sets reserved true when the card is on the reserved list', () => {
    expect(normalizeCard(rawCard({ reserved: true })).reserved).toBe(true);
  });

  test('defaults reserved to false when the field is absent', () => {
    expect(normalizeCard(rawCard()).reserved).toBe(false);
  });

  test('keeps an empty mana cost (lands)', () => {
    expect(normalizeCard(rawCard({ mana_cost: '' })).cost).toBe('');
  });

  test('joins the costs of double-faced cards, skipping empty faces', () => {
    const twoCosts = rawCard({
      mana_cost: undefined,
      card_faces: [{ mana_cost: '{1}{U}' }, { mana_cost: '{2}{R}' }],
    });
    const oneCost = rawCard({
      mana_cost: undefined,
      card_faces: [{ mana_cost: '{1}{U}' }, { mana_cost: '' }],
    });
    expect(normalizeCard(twoCosts).cost).toBe('{1}{U} // {2}{R}');
    expect(normalizeCard(oneCost).cost).toBe('{1}{U}');
  });

  test('falls back to an empty cost when there is no cost information', () => {
    expect(normalizeCard(rawCard({ mana_cost: undefined })).cost).toBe('');
  });

  test('normalizes a double-faced token with card_faces', () => {
    const dfcToken = {
      id: 'dfc-uuid',
      name: 'Eldrazi // Cat',
      rarity: 'token',
      collector_number: '11',
      set: 'tcmm',
      layout: 'double_faced_token',
      finishes: ['nonfoil'],
      card_faces: [
        { name: 'Eldrazi', mana_cost: '', type_line: 'Token Creature — Eldrazi' },
        { name: 'Cat', mana_cost: '', type_line: 'Token Creature — Cat' },
      ],
      prices: { usd: null, usd_foil: null },
    };
    const card = normalizeCard(dfcToken);
    expect(card.id).toBe('dfc-uuid');
    expect(card.name).toBe('Eldrazi // Cat');
    expect(card.cost).toBe('');
    expect(card.set).toBe('TCMM');
    expect(card.nonfoil).toBe(true);
    expect(card.foil).toBe(false);
  });
});

describe('fetchSets', () => {
  test('returns normalized sets from the Scryfall sets endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { code: 'ktk', name: 'Khans of Tarkir', set_type: 'expansion' },
            { code: 'eld', name: 'Throne of Eldraine', set_type: 'expansion' },
          ],
        }),
      }),
    );
    const sets = await fetchSets();
    expect(sets).toEqual([
      { code: 'ktk', name: 'Khans of Tarkir', set_type: 'expansion' },
      { code: 'eld', name: 'Throne of Eldraine', set_type: 'expansion' },
    ]);
  });

  test('excludes Alchemy sets from results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { code: 'ktk', name: 'Khans of Tarkir', set_type: 'expansion' },
            { code: 'yna', name: 'Alchemy: Innistrad', set_type: 'alchemy' },
          ],
        }),
      }),
    );
    const sets = await fetchSets();
    expect(sets).toEqual([{ code: 'ktk', name: 'Khans of Tarkir', set_type: 'expansion' }]);
  });

  test('excludes token-only sets from results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { code: 'ktk', name: 'Khans of Tarkir', set_type: 'expansion' },
            { code: 'tktk', name: 'Khans of Tarkir Tokens', set_type: 'token' },
          ],
        }),
      }),
    );
    const sets = await fetchSets();
    expect(sets).toEqual([{ code: 'ktk', name: 'Khans of Tarkir', set_type: 'expansion' }]);
  });

  test('excludes art series sets from results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { code: 'ktk', name: 'Khans of Tarkir', set_type: 'expansion' },
            { code: 'sld', name: 'Secret Lair Drop', set_type: 'art_series' },
          ],
        }),
      }),
    );
    const sets = await fetchSets();
    expect(sets).toEqual([{ code: 'ktk', name: 'Khans of Tarkir', set_type: 'expansion' }]);
  });

  test('throws a readable error when Scryfall responds with a failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchSets()).rejects.toThrow('Scryfall request failed (HTTP 503)');
  });
});

describe('fetchSet', () => {
  test('returns code, name, and set_type for a valid set code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ code: 'ktk', name: 'Khans of Tarkir', set_type: 'expansion' }),
      }),
    );
    const result = await fetchSet('ktk');
    expect(result).toEqual({ code: 'ktk', name: 'Khans of Tarkir', set_type: 'expansion' });
  });

  test('returns null for a 404 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await fetchSet('xyz')).toBeNull();
  });

  test('returns null for alchemy set type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ code: 'yna', name: 'Alchemy: Innistrad', set_type: 'alchemy' }),
      }),
    );
    expect(await fetchSet('yna')).toBeNull();
  });

  test('returns null for token set type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ code: 'tktk', name: 'Tokens', set_type: 'token' }),
      }),
    );
    expect(await fetchSet('tktk')).toBeNull();
  });

  test('returns null for art_series set type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ code: 'sld', name: 'Secret Lair Drop', set_type: 'art_series' }),
      }),
    );
    expect(await fetchSet('sld')).toBeNull();
  });
});

describe('fetchSetCards', () => {
  const noTokens = { ok: false, status: 404 };

  afterEach(() => vi.useRealTimers());

  test('returns normalized cards from a single page', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url) =>
        url === buildSearchUrl('ktk')
          ? Promise.resolve(jsonResponse({ data: [rawCard()], has_more: false }))
          : Promise.resolve(noTokens),
      );
    vi.stubGlobal('fetch', fetchMock);

    const cards = await fetchSetCards('ktk');

    expect(fetchMock).toHaveBeenCalledWith(buildSearchUrl('ktk'), {
      headers: { Accept: 'application/json' },
    });
    expect(cards.map((card) => card.name)).toEqual(['Abzan Guide']);
  });

  test('follows next_page links and combines every page', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((url) => {
      if (url === buildSearchUrl('ktk'))
        return Promise.resolve(
          jsonResponse({
            data: [rawCard({ id: '1' })],
            has_more: true,
            next_page: 'https://next-page',
          }),
        );
      if (url === 'https://next-page')
        return Promise.resolve(jsonResponse({ data: [rawCard({ id: '2' })], has_more: false }));
      return Promise.resolve(noTokens);
    });
    vi.stubGlobal('fetch', fetchMock);

    const pending = fetchSetCards('ktk');
    await vi.advanceTimersByTimeAsync(2000);
    const cards = await pending;

    expect(cards.map((card) => card.id)).toEqual(['1', '2']);
  });

  test('calls onPage with accumulated cards after each page', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((url) => {
      if (url === buildSearchUrl('ktk'))
        return Promise.resolve(
          jsonResponse({ data: [rawCard({ id: '1' })], has_more: true, next_page: 'https://p2' }),
        );
      if (url === 'https://p2')
        return Promise.resolve(jsonResponse({ data: [rawCard({ id: '2' })], has_more: false }));
      return Promise.resolve(noTokens);
    });
    vi.stubGlobal('fetch', fetchMock);

    const snapshots = [];
    const pending = fetchSetCards('ktk', (partial) => snapshots.push(partial.map((c) => c.id)));
    await vi.advanceTimersByTimeAsync(2000);
    await pending;

    expect(snapshots).toEqual([['1'], ['1', '2']]);
  });

  test('throws a readable error when the main set fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(fetchSetCards('ktk')).rejects.toThrow('Scryfall request failed (HTTP 429)');
  });

  test('stores fetched cards in the database for future calls', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url) =>
          url === buildSearchUrl('ktk')
            ? Promise.resolve(jsonResponse({ data: [rawCard()], has_more: false }))
            : Promise.resolve(noTokens),
        ),
    );

    await fetchSetCards('ktk');

    const cached = await loadCards('ktk');
    expect(cached).toHaveLength(1);
    expect(cached[0].name).toBe('Abzan Guide');
  });

  test('returns cached cards without hitting the network', async () => {
    const cached = [
      { id: '1', name: 'Cached Card', rarity: 'rare', cost: '{W}', number: '1', set: 'KTK' },
    ];
    await saveCards('ktk', cached);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const cards = await fetchSetCards('ktk');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(cards).toEqual(cached);
  });

  test('returns only main cards when a token set exists', async () => {
    const tokenCard = rawCard({ id: 'tok1', name: 'Soldier Token', set: 'tktk' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === buildSearchUrl('ktk'))
          return Promise.resolve(jsonResponse({ data: [rawCard()], has_more: false }));
        if (url === buildSearchUrl('tktk'))
          return Promise.resolve(jsonResponse({ data: [tokenCard], has_more: false }));
        return Promise.reject(new Error('unexpected url'));
      }),
    );

    const cards = await fetchSetCards('ktk');

    expect(cards.map((c) => c.name)).toEqual(['Abzan Guide']);
  });

  test('saves token cards under the token set code', async () => {
    const tokenCard = rawCard({ id: 'tok1', name: 'Soldier Token', set: 'tktk' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === buildSearchUrl('ktk'))
          return Promise.resolve(jsonResponse({ data: [rawCard()], has_more: false }));
        if (url === buildSearchUrl('tktk'))
          return Promise.resolve(jsonResponse({ data: [tokenCard], has_more: false }));
        return Promise.reject(new Error('unexpected url'));
      }),
    );

    await fetchSetCards('ktk');

    expect(await loadCards('tktk')).toHaveLength(1);
    expect((await loadCards('tktk'))[0].name).toBe('Soldier Token');
  });

  test('fetches and saves double-faced tokens from the token set', async () => {
    const dfcToken = rawCard({
      id: 'dfc1',
      name: 'Snake // Zombie',
      set: 'tktk',
      layout: 'double_faced_token',
      mana_cost: undefined,
      card_faces: [
        { name: 'Snake', mana_cost: '' },
        { name: 'Zombie', mana_cost: '' },
      ],
    });
    const fetchMock = vi.fn().mockImplementation((url) => {
      if (url === buildSearchUrl('ktk'))
        return Promise.resolve(jsonResponse({ data: [rawCard()], has_more: false }));
      if (url === buildSearchUrl('tktk'))
        return Promise.resolve(jsonResponse({ data: [dfcToken], has_more: false }));
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchSetCards('ktk');

    const tokens = await loadCards('tktk');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].name).toBe('Snake // Zombie');
  });

  test('excludes digital-only cards from results', async () => {
    const digitalCard = rawCard({ id: 'digital1', name: 'Digital Card', digital: true });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url) =>
          url === buildSearchUrl('ktk')
            ? Promise.resolve(jsonResponse({ data: [rawCard(), digitalCard], has_more: false }))
            : Promise.resolve(noTokens),
        ),
    );

    const cards = await fetchSetCards('ktk');

    expect(cards.map((c) => c.name)).toEqual(['Abzan Guide']);
  });

  test('does not save a token set entry when no token set exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url) =>
          url === buildSearchUrl('ktk')
            ? Promise.resolve(jsonResponse({ data: [rawCard()], has_more: false }))
            : Promise.resolve(noTokens),
        ),
    );

    await fetchSetCards('ktk');

    expect(await loadCards('tktk')).toBeNull();
  });

  test('serializes concurrent calls so fetch is never called concurrently', async () => {
    vi.useFakeTimers();
    let activeCount = 0;
    let maxActive = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        return Promise.resolve({
          ok: true,
          json: async () => {
            activeCount--;
            return { data: [], has_more: false };
          },
        });
      }),
    );

    const p = Promise.all([fetchSetCards('ktk'), fetchSetCards('eld')]);
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(maxActive).toBe(1);
  });
});

describe('refreshSetCardPrices', () => {
  const collectionResponse = (cards) => jsonResponse({ data: cards });

  test('updates price and priceFoil from fresh Scryfall data', async () => {
    await saveCards('ktk', [{ id: 'abc', name: 'Abzan Guide', price: '0.50', priceFoil: '1.00' }]);
    await saveCollection('ktk', { abc: { qty: 1, foil: 0 } });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          collectionResponse([rawCard({ prices: { usd: '1.50', usd_foil: '3.00' } })]),
        ),
    );

    const result = await refreshSetCardPrices('ktk');

    expect(result.main[0].price).toBe('1.50');
    expect(result.main[0].priceFoil).toBe('3.00');
  });

  test('preserves non-price fields', async () => {
    await saveCards('ktk', [
      {
        id: 'abc',
        name: 'Abzan Guide',
        rarity: 'rare',
        cost: '{W}',
        number: '169',
        set: 'KTK',
        price: '0.50',
        priceFoil: null,
      },
    ]);
    await saveCollection('ktk', { abc: { qty: 1, foil: 0 } });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          collectionResponse([rawCard({ prices: { usd: '2.00', usd_foil: null } })]),
        ),
    );

    const result = await refreshSetCardPrices('ktk');

    expect(result.main[0].name).toBe('Abzan Guide');
    expect(result.main[0].rarity).toBe('rare');
    expect(result.main[0].number).toBe('169');
  });

  test('saves merged cards to IDB', async () => {
    await saveCards('ktk', [{ id: 'abc', name: 'Abzan Guide', price: '0.50', priceFoil: null }]);
    await saveCollection('ktk', { abc: { qty: 1, foil: 0 } });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          collectionResponse([rawCard({ prices: { usd: '2.00', usd_foil: null } })]),
        ),
    );

    await refreshSetCardPrices('ktk');

    expect((await loadCards('ktk'))[0].price).toBe('2.00');
  });

  test('skips network fetch and returns cached data when bulk timestamp is fresh', async () => {
    await saveCards('ktk', [{ id: 'abc', name: 'Abzan Guide', price: '1.00', priceFoil: null }]);
    await saveCards('tktk', [
      { id: 'tok1', name: 'Soldier Token', price: '0.10', priceFoil: null },
    ]);
    await saveConfig('bulkTimestamp', Date.now() - 60 * 60 * 1000);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await refreshSetCardPrices('ktk');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.main[0].price).toBe('1.00');
    expect(result.tokens[0].price).toBe('0.10');
  });

  test('returns null tokens when bulk is fresh but no token cache exists', async () => {
    await saveCards('ktk', [{ id: 'abc', name: 'Abzan Guide', price: '1.00', priceFoil: null }]);
    await saveConfig('bulkTimestamp', Date.now() - 60 * 60 * 1000);
    vi.stubGlobal('fetch', vi.fn());

    const result = await refreshSetCardPrices('ktk');

    expect(result.tokens).toBeNull();
  });

  test('returns empty main when no cache exists', async () => {
    const result = await refreshSetCardPrices('ktk');
    expect(result.main).toEqual([]);
    expect(result.tokens).toBeNull();
  });

  test('returns cached data unchanged and skips fetch when no cards are owned', async () => {
    await saveCards('ktk', [{ id: 'abc', name: 'Abzan Guide', price: '0.50', priceFoil: null }]);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await refreshSetCardPrices('ktk');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.main[0].price).toBe('0.50');
  });

  test('unowned cards keep their original prices', async () => {
    await saveCards('ktk', [
      { id: 'abc', name: 'Abzan Guide', price: '0.50', priceFoil: null },
      { id: 'xyz', name: 'Other Card', price: '1.00', priceFoil: '2.00' },
    ]);
    await saveCollection('ktk', { abc: { qty: 1, foil: 0 } });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          collectionResponse([rawCard({ id: 'abc', prices: { usd: '0.75', usd_foil: null } })]),
        ),
    );

    const result = await refreshSetCardPrices('ktk');

    expect(result.main.find((c) => c.id === 'xyz').price).toBe('1.00');
    expect(result.main.find((c) => c.id === 'xyz').priceFoil).toBe('2.00');
  });

  test('uses collection endpoint not search endpoint', async () => {
    await saveCards('ktk', [{ id: 'abc', name: 'Abzan Guide', price: '0.50', priceFoil: null }]);
    await saveCollection('ktk', { abc: { qty: 1, foil: 0 } });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        collectionResponse([rawCard({ prices: { usd: '1.00', usd_foil: null } })]),
      );
    vi.stubGlobal('fetch', fetchMock);

    await refreshSetCardPrices('ktk');

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.scryfall.com/cards/collection');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  test('updates token card prices and returns them when token cache exists', async () => {
    await saveCards('ktk', [{ id: 'abc', name: 'Abzan Guide', price: '0.50', priceFoil: null }]);
    await saveCards('tktk', [{ id: 'tok1', name: 'Soldier Token', price: null, priceFoil: null }]);
    await saveCollection('ktk', { abc: { qty: 1, foil: 0 } });
    await saveCollection('tktk', { tok1: { qty: 1, foil: 0 } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url, opts) => {
        const ids = JSON.parse(opts.body).identifiers.map((i) => i.id);
        if (ids.includes('abc'))
          return Promise.resolve(
            collectionResponse([rawCard({ prices: { usd: '1.00', usd_foil: null } })]),
          );
        if (ids.includes('tok1'))
          return Promise.resolve(
            collectionResponse([
              rawCard({ id: 'tok1', set: 'tktk', prices: { usd: null, usd_foil: '5.00' } }),
            ]),
          );
        return Promise.reject(new Error(`unexpected ids: ${ids}`));
      }),
    );

    const result = await refreshSetCardPrices('ktk');

    expect(result.tokens[0].priceFoil).toBe('5.00');
    expect((await loadCards('tktk'))[0].priceFoil).toBe('5.00');
  });

  test('returns null tokens when no token cache exists', async () => {
    await saveCards('ktk', [{ id: 'abc', name: 'Abzan Guide', price: '0.50', priceFoil: null }]);
    await saveCollection('ktk', { abc: { qty: 1, foil: 0 } });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          collectionResponse([rawCard({ prices: { usd: '1.00', usd_foil: null } })]),
        ),
    );

    const result = await refreshSetCardPrices('ktk');

    expect(result.tokens).toBeNull();
  });

  test('preserves token card prices when token card is absent from fresh data', async () => {
    await saveCards('ktk', [{ id: 'abc', name: 'Abzan Guide', price: '0.50', priceFoil: null }]);
    await saveCards('tktk', [
      { id: 'tok1', name: 'Soldier Token', price: '0.10', priceFoil: null },
      { id: 'tok2', name: 'Other Token', price: '0.20', priceFoil: null },
    ]);
    await saveCollection('ktk', { abc: { qty: 1, foil: 0 } });
    await saveCollection('tktk', { tok1: { qty: 1, foil: 0 }, tok2: { qty: 1, foil: 0 } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url, opts) => {
        const ids = JSON.parse(opts.body).identifiers.map((i) => i.id);
        if (ids.includes('abc'))
          return Promise.resolve(
            collectionResponse([rawCard({ prices: { usd: '1.00', usd_foil: null } })]),
          );
        if (ids.includes('tok1'))
          return Promise.resolve(
            collectionResponse([
              rawCard({ id: 'tok1', set: 'tktk', prices: { usd: '0.50', usd_foil: null } }),
            ]),
          );
        return Promise.reject(new Error(`unexpected ids: ${ids}`));
      }),
    );

    const result = await refreshSetCardPrices('ktk');

    expect(result.tokens.find((c) => c.id === 'tok1').price).toBe('0.50');
    expect(result.tokens.find((c) => c.id === 'tok2').price).toBe('0.20');
  });

  test('skips null collection entries when computing owned ids', async () => {
    await saveCards('ktk', [
      { id: 'abc', name: 'Abzan Guide', price: '0.50', priceFoil: null },
      { id: 'nil', name: 'Nil Card', price: '0.10', priceFoil: null },
    ]);
    await saveCollection('ktk', { abc: { qty: 1, foil: 0 }, nil: null });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        collectionResponse([rawCard({ prices: { usd: '2.00', usd_foil: null } })]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await refreshSetCardPrices('ktk');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).identifiers).toHaveLength(1);
    expect(result.main.find((c) => c.id === 'abc').price).toBe('2.00');
    expect(result.main.find((c) => c.id === 'nil').price).toBe('0.10');
  });

  test('skips null token collection entries', async () => {
    await saveCards('ktk', [{ id: 'abc', name: 'Abzan Guide', price: '0.50', priceFoil: null }]);
    await saveCards('tktk', [
      { id: 'tok1', name: 'Soldier Token', price: '0.10', priceFoil: null },
      { id: 'tok2', name: 'Other Token', price: '0.20', priceFoil: null },
    ]);
    await saveCollection('ktk', { abc: { qty: 1, foil: 0 } });
    await saveCollection('tktk', { tok1: { qty: 1, foil: 0 }, tok2: null });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url, opts) => {
        const ids = JSON.parse(opts.body).identifiers.map((i) => i.id);
        if (ids.includes('abc'))
          return Promise.resolve(
            collectionResponse([rawCard({ prices: { usd: '1.00', usd_foil: null } })]),
          );
        return Promise.resolve(
          collectionResponse([
            rawCard({ id: 'tok1', set: 'tktk', prices: { usd: '0.50', usd_foil: null } }),
          ]),
        );
      }),
    );

    const result = await refreshSetCardPrices('ktk');

    expect(result.tokens.find((c) => c.id === 'tok1').price).toBe('0.50');
    expect(result.tokens.find((c) => c.id === 'tok2').price).toBe('0.20');
  });

  test('returns token cache unchanged when no tokens are owned', async () => {
    await saveCards('ktk', [{ id: 'abc', name: 'Abzan Guide', price: '0.50', priceFoil: null }]);
    await saveCards('tktk', [
      { id: 'tok1', name: 'Soldier Token', price: '0.10', priceFoil: null },
    ]);
    await saveCollection('ktk', { abc: { qty: 1, foil: 0 } });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          collectionResponse([rawCard({ prices: { usd: '1.00', usd_foil: null } })]),
        ),
    );

    const result = await refreshSetCardPrices('ktk');

    expect(result.tokens[0].price).toBe('0.10');
  });

  test('returns null tokens when the token fetch throws', async () => {
    await saveCards('ktk', [{ id: 'abc', name: 'Abzan Guide', price: '0.50', priceFoil: null }]);
    await saveCards('tktk', [{ id: 'tok1', name: 'Soldier Token', price: null, priceFoil: null }]);
    await saveCollection('ktk', { abc: { qty: 1, foil: 0 } });
    await saveCollection('tktk', { tok1: { qty: 1, foil: 0 } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url, opts) => {
        const ids = JSON.parse(opts.body).identifiers.map((i) => i.id);
        if (ids.includes('abc'))
          return Promise.resolve(
            collectionResponse([rawCard({ prices: { usd: '1.00', usd_foil: null } })]),
          );
        return Promise.resolve({ ok: false, status: 429 });
      }),
    );

    const result = await refreshSetCardPrices('ktk');

    expect(result.tokens).toBeNull();
  });
});

describe('fetchTokenCards', () => {
  const noTokens = { ok: false, status: 404 };
  const tokenCard = rawCard({ id: 'tok1', name: 'Soldier Token', set: 'tktk' });
  const dfcToken = rawCard({
    id: 'dfc1',
    name: 'Snake Token // Zombie Token',
    set: 'tktk',
    mana_cost: undefined,
    card_faces: [
      { name: 'Snake Token', mana_cost: '' },
      { name: 'Zombie Token', mana_cost: '' },
    ],
  });

  test('returns cached tokens without hitting the network', async () => {
    await saveCards('tktk', [{ id: 'tok1', name: 'Soldier Token' }]);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const tokens = await fetchTokenCards('ktk');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].name).toBe('Soldier Token');
  });

  test('fetches from network when no cache exists and saves them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ data: [tokenCard], has_more: false })),
    );

    const tokens = await fetchTokenCards('ktk');

    expect(tokens).toHaveLength(1);
    expect(tokens[0].name).toBe('Soldier Token');
    expect(await loadCards('tktk')).toHaveLength(1);
  });

  test('returns empty array when no cache and network returns 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(noTokens));

    const tokens = await fetchTokenCards('ktk');

    expect(tokens).toEqual([]);
  });

  test('includes double-faced tokens as single trackable rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ data: [dfcToken], has_more: false })),
    );

    const tokens = await fetchTokenCards('ktk');

    expect(tokens).toHaveLength(1);
    expect(tokens[0].name).toBe('Snake Token // Zombie Token');
    expect(tokens[0].id).toBe('dfc1');
  });
});

describe('fetchCardsByIds', () => {
  afterEach(() => vi.useRealTimers());

  test('returns normalized cards for the given IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ data: [rawCard({ id: 'abc' }), rawCard({ id: 'def', name: 'Other' })] }),
        ),
    );

    const { fetchCardsByIds } = await import('./scryfall.js');
    const cards = await fetchCardsByIds(['abc', 'def']);
    expect(cards.map((c) => c.id)).toEqual(['abc', 'def']);
  });

  test('POSTs identifiers as JSON to the collection endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [rawCard({ id: 'abc' })] }));
    vi.stubGlobal('fetch', fetchMock);

    const { fetchCardsByIds } = await import('./scryfall.js');
    await fetchCardsByIds(['abc']);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.scryfall.com/cards/collection');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ identifiers: [{ id: 'abc' }] });
  });

  test('returns empty array for empty input without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { fetchCardsByIds } = await import('./scryfall.js');
    const cards = await fetchCardsByIds([]);
    expect(cards).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('splits into batches of 75 and makes one request per batch', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const { fetchCardsByIds } = await import('./scryfall.js');
    const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`);
    const p = fetchCardsByIds(ids);
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).identifiers).toHaveLength(75);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).identifiers).toHaveLength(25);
  });

  test('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const { fetchCardsByIds } = await import('./scryfall.js');
    await expect(fetchCardsByIds(['abc'])).rejects.toThrow('Scryfall request failed (HTTP 429)');
  });
});

const BULK_META_URL = 'https://api.scryfall.com/bulk-data';
const BULK_DOWNLOAD_URL = 'https://downloads.scryfall.com/json/default-cards.json';

const bulkMetaResponse = jsonResponse({
  data: [{ type: 'default_cards', download_uri: BULK_DOWNLOAD_URL }],
});

function makeBulkFetch(cards) {
  return vi.fn().mockImplementation((url) => {
    if (url === BULK_META_URL) return Promise.resolve(bulkMetaResponse);
    if (url === BULK_DOWNLOAD_URL) return Promise.resolve(jsonResponse(cards));
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
}

describe('refreshBulkDataIfStale', () => {
  test('does nothing when bulk timestamp is under 12 hours old', async () => {
    await saveConfig('bulkTimestamp', Date.now() - 60 * 60 * 1000);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await refreshBulkDataIfStale();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('downloads when no timestamp exists', async () => {
    vi.stubGlobal('fetch', makeBulkFetch([rawCard({ id: 'abc', set: 'ktk' })]));

    await refreshBulkDataIfStale();

    expect(await loadCards('ktk')).toHaveLength(1);
  });

  test('downloads when timestamp is older than 12 hours', async () => {
    await saveConfig('bulkTimestamp', Date.now() - 13 * 60 * 60 * 1000);
    vi.stubGlobal('fetch', makeBulkFetch([rawCard({ id: 'abc', set: 'ktk' })]));

    await refreshBulkDataIfStale();

    expect(await loadCards('ktk')).not.toBeNull();
  });

  test('groups cards by set and writes each set to IDB', async () => {
    vi.stubGlobal(
      'fetch',
      makeBulkFetch([
        rawCard({ id: '1', set: 'ktk' }),
        rawCard({ id: '2', set: 'eld' }),
        rawCard({ id: '3', set: 'ktk' }),
      ]),
    );

    await refreshBulkDataIfStale();

    expect(await loadCards('ktk')).toHaveLength(2);
    expect(await loadCards('eld')).toHaveLength(1);
  });

  test('filters out digital-only cards', async () => {
    vi.stubGlobal(
      'fetch',
      makeBulkFetch([
        rawCard({ id: '1', set: 'ktk' }),
        rawCard({ id: '2', set: 'ktk', digital: true }),
      ]),
    );

    await refreshBulkDataIfStale();

    expect(await loadCards('ktk')).toHaveLength(1);
  });

  test('saves a bulk timestamp after a successful download', async () => {
    const before = Date.now();
    vi.stubGlobal('fetch', makeBulkFetch([]));

    await refreshBulkDataIfStale();

    expect(await loadConfig('bulkTimestamp')).toBeGreaterThanOrEqual(before);
  });

  test('throws when the metadata request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(refreshBulkDataIfStale()).rejects.toThrow('HTTP 503');
  });

  test('throws when the bulk file download fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === BULK_META_URL) return Promise.resolve(bulkMetaResponse);
        return Promise.resolve({ ok: false, status: 503 });
      }),
    );

    await expect(refreshBulkDataIfStale()).rejects.toThrow('HTTP 503');
  });
});
