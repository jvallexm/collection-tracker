import { loadCards, saveCards } from './storage.js';
import { buildSearchUrl, fetchSetCards, fetchSets, normalizeCard } from './scryfall.js';

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
    });
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
});

describe('fetchSets', () => {
  test('returns normalized sets from the Scryfall sets endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { code: 'ktk', name: 'Khans of Tarkir' },
            { code: 'eld', name: 'Throne of Eldraine' },
          ],
        }),
      }),
    );
    const sets = await fetchSets();
    expect(sets).toEqual([
      { code: 'ktk', name: 'Khans of Tarkir' },
      { code: 'eld', name: 'Throne of Eldraine' },
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
    expect(sets).toEqual([{ code: 'ktk', name: 'Khans of Tarkir' }]);
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
    expect(sets).toEqual([{ code: 'ktk', name: 'Khans of Tarkir' }]);
  });

  test('throws a readable error when Scryfall responds with a failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchSets()).rejects.toThrow('Scryfall request failed (HTTP 503)');
  });
});

describe('fetchSetCards', () => {
  const noTokens = { ok: false, status: 404 };

  test('returns normalized cards from a single page', async () => {
    const fetchMock = vi.fn().mockImplementation((url) =>
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
        return Promise.resolve(jsonResponse({ data: [rawCard({ id: '1' })], has_more: true, next_page: 'https://next-page' }));
      if (url === 'https://next-page')
        return Promise.resolve(jsonResponse({ data: [rawCard({ id: '2' })], has_more: false }));
      return Promise.resolve(noTokens);
    });
    vi.stubGlobal('fetch', fetchMock);

    const pending = fetchSetCards('ktk');
    await vi.runAllTimersAsync();
    const cards = await pending;

    expect(cards.map((card) => card.id)).toEqual(['1', '2']);
  });

  test('throws a readable error when the main set fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(fetchSetCards('ktk')).rejects.toThrow('Scryfall request failed (HTTP 429)');
  });

  test('stores fetched cards in the database for future calls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) =>
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

  test('excludes digital-only cards from results', async () => {
    const digitalCard = rawCard({ id: 'digital1', name: 'Digital Card', digital: true });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) =>
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
      vi.fn().mockImplementation((url) =>
        url === buildSearchUrl('ktk')
          ? Promise.resolve(jsonResponse({ data: [rawCard()], has_more: false }))
          : Promise.resolve(noTokens),
      ),
    );

    await fetchSetCards('ktk');

    expect(await loadCards('tktk')).toBeNull();
  });
});
