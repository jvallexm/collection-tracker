import { fetchSetTokenCards } from './mtgjson.js';

vi.mock('./storage.js', () => ({
  loadTokenCards: vi.fn().mockResolvedValue(null),
  saveTokenCards: vi.fn().mockResolvedValue(undefined),
}));

import { loadTokenCards, saveTokenCards } from './storage.js';

const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body });

function makeToken(overrides = {}) {
  return {
    uuid: 'uuid-a',
    name: 'Soldier',
    number: '1',
    identifiers: { scryfallId: 'scry-a' },
    tokenProducts: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  loadTokenCards.mockResolvedValue(null);
  saveTokenCards.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchSetTokenCards — cache hit', () => {
  test('returns cached data without calling fetch', async () => {
    const cached = [{ id: 'scry-fish', name: 'Fish', number: '7' }];
    loadTokenCards.mockResolvedValue(cached);
    const result = await fetchSetTokenCards('blb');
    expect(result).toEqual(cached);
  });

  test('does not call fetch when cache hit', async () => {
    loadTokenCards.mockResolvedValue([{ id: 'scry-fish', name: 'Fish', number: '7' }]);
    await fetchSetTokenCards('blb');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('fetchSetTokenCards — cache miss + fetch', () => {
  test('fetches the correct URL (uppercase setCode)', async () => {
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [] } }));
    await fetchSetTokenCards('blb');
    expect(fetch).toHaveBeenCalledWith('https://mtgjson.com/api/v5/BLB.json');
  });

  test('fetches the correct URL when setCode already uppercase', async () => {
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [] } }));
    await fetchSetTokenCards('BLB');
    expect(fetch).toHaveBeenCalledWith('https://mtgjson.com/api/v5/BLB.json');
  });

  test('saves processed result to IDB', async () => {
    const token = makeToken({
      uuid: 'uuid-a',
      name: 'Soldier',
      number: '1',
      identifiers: { scryfallId: 'scry-a' },
      tokenProducts: [],
    });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [token] } }));
    await fetchSetTokenCards('blb');
    expect(saveTokenCards).toHaveBeenCalledWith('blb', [
      { id: 'scry-a', name: 'Soldier', number: '1' },
    ]);
  });

  test('does not save to IDB on fetch error', async () => {
    fetch.mockRejectedValue(new Error('network error'));
    await fetchSetTokenCards('blb');
    expect(saveTokenCards).not.toHaveBeenCalled();
  });

  test('does not save to IDB on non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    await fetchSetTokenCards('blb');
    expect(saveTokenCards).not.toHaveBeenCalled();
  });
});

describe('fetchSetTokenCards — error handling', () => {
  test('returns [] when fetch throws', async () => {
    fetch.mockRejectedValue(new Error('network error'));
    expect(await fetchSetTokenCards('blb')).toEqual([]);
  });

  test('returns [] when response is not ok', async () => {
    fetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    expect(await fetchSetTokenCards('blb')).toEqual([]);
  });
});

describe('fetchSetTokenCards — token processing', () => {
  test('returns [] when tokens array is empty', async () => {
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [] } }));
    expect(await fetchSetTokenCards('blb')).toEqual([]);
  });

  test('returns single-faced token with id from identifiers.scryfallId', async () => {
    const token = makeToken({ identifiers: { scryfallId: 'scry-xyz' } });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [token] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result[0].id).toBe('scry-xyz');
  });

  test('returns single-faced token with correct name', async () => {
    const token = makeToken({ name: 'Goblin' });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [token] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result[0].name).toBe('Goblin');
  });

  test('returns single-faced token with correct number from token.number field', async () => {
    const token = makeToken({ number: '42' });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [token] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result[0].number).toBe('42');
  });

  test('returns empty string for number when token.number is absent', async () => {
    const token = makeToken();
    delete token.number;
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [token] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result[0].number).toBe('');
  });

  test('skips token with no identifiers.scryfallId', async () => {
    const token = makeToken({ identifiers: {} });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [token] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result).toEqual([]);
  });

  test('returns multiple single-faced tokens', async () => {
    const t1 = makeToken({
      uuid: 'uuid-a',
      identifiers: { scryfallId: 'scry-a' },
      name: 'Soldier',
      number: '1',
    });
    const t2 = makeToken({
      uuid: 'uuid-b',
      identifiers: { scryfallId: 'scry-b' },
      name: 'Goblin',
      number: '2',
    });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [t1, t2] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result).toHaveLength(2);
  });

  test('returns DFC pair merged with "Front // Back" name', async () => {
    const front = makeToken({
      uuid: 'uuid-fish',
      name: 'Fish',
      number: '7',
      identifiers: { scryfallId: 'scry-fish' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-fish' }, { uuid: 'uuid-vine' }] }],
    });
    const back = makeToken({
      uuid: 'uuid-vine',
      name: 'Iridescent Vinelasher',
      number: '8',
      identifiers: { scryfallId: 'scry-vine' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-fish' }, { uuid: 'uuid-vine' }] }],
    });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [front, back] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result.find((c) => c.name === 'Fish // Iridescent Vinelasher')).toBeDefined();
  });

  test('merged DFC card id is front face scryfallId (first tokenPart)', async () => {
    const front = makeToken({
      uuid: 'uuid-fish',
      name: 'Fish',
      number: '7',
      identifiers: { scryfallId: 'scry-fish' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-fish' }, { uuid: 'uuid-vine' }] }],
    });
    const back = makeToken({
      uuid: 'uuid-vine',
      name: 'Iridescent Vinelasher',
      number: '8',
      identifiers: { scryfallId: 'scry-vine' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-fish' }, { uuid: 'uuid-vine' }] }],
    });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [front, back] } }));
    const result = await fetchSetTokenCards('blb');
    const dfc = result.find((c) => c.name.includes('//'));
    expect(dfc.id).toBe('scry-fish');
  });

  test('merged DFC card number is front face number', async () => {
    const front = makeToken({
      uuid: 'uuid-fish',
      name: 'Fish',
      number: '7',
      identifiers: { scryfallId: 'scry-fish' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-fish' }, { uuid: 'uuid-vine' }] }],
    });
    const back = makeToken({
      uuid: 'uuid-vine',
      name: 'Iridescent Vinelasher',
      number: '8',
      identifiers: { scryfallId: 'scry-vine' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-fish' }, { uuid: 'uuid-vine' }] }],
    });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [front, back] } }));
    const result = await fetchSetTokenCards('blb');
    const dfc = result.find((c) => c.name.includes('//'));
    expect(dfc.number).toBe('7');
  });

  test('deduplicates DFC pair (1 card even though both faces list it in tokenProducts)', async () => {
    const front = makeToken({
      uuid: 'uuid-fish',
      name: 'Fish',
      number: '7',
      identifiers: { scryfallId: 'scry-fish' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-fish' }, { uuid: 'uuid-vine' }] }],
    });
    const back = makeToken({
      uuid: 'uuid-vine',
      name: 'Iridescent Vinelasher',
      number: '8',
      identifiers: { scryfallId: 'scry-vine' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-fish' }, { uuid: 'uuid-vine' }] }],
    });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [front, back] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result.filter((c) => c.name.includes('//'))).toHaveLength(1);
  });

  test('DFC face tokens not included as single-faced cards', async () => {
    const front = makeToken({
      uuid: 'uuid-fish',
      name: 'Fish',
      number: '7',
      identifiers: { scryfallId: 'scry-fish' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-fish' }, { uuid: 'uuid-vine' }] }],
    });
    const back = makeToken({
      uuid: 'uuid-vine',
      name: 'Iridescent Vinelasher',
      number: '8',
      identifiers: { scryfallId: 'scry-vine' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-fish' }, { uuid: 'uuid-vine' }] }],
    });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [front, back] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result.find((c) => c.name === 'Fish')).toBeUndefined();
    expect(result.find((c) => c.name === 'Iridescent Vinelasher')).toBeUndefined();
  });

  test('handles tokens with empty tokenProducts (treated as single-faced)', async () => {
    const token = makeToken({ tokenProducts: [] });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [token] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Soldier');
  });

  test('skips DFC tokenProduct if first uuid not in token map', async () => {
    const orphan = makeToken({
      uuid: 'uuid-orphan',
      name: 'Orphan',
      identifiers: { scryfallId: 'scry-orphan' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-missing' }, { uuid: 'uuid-orphan' }] }],
    });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [orphan] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result.find((c) => c.name.includes('//'))).toBeUndefined();
  });

  test('skips DFC tokenProduct if second uuid not in token map', async () => {
    const orphan = makeToken({
      uuid: 'uuid-orphan',
      name: 'Orphan',
      identifiers: { scryfallId: 'scry-orphan' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-orphan' }, { uuid: 'uuid-missing' }] }],
    });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [orphan] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result.find((c) => c.name.includes('//'))).toBeUndefined();
  });

  test('returns [] when response json has no data property', async () => {
    fetch.mockResolvedValue(jsonResponse({}));
    expect(await fetchSetTokenCards('blb')).toEqual([]);
  });

  test('treats token with no tokenProducts key as single-faced', async () => {
    const token = makeToken();
    delete token.tokenProducts;
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [token] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Soldier');
  });

  test('skips DFC tokenProduct when tokenParts key is absent', async () => {
    const token = makeToken({
      tokenProducts: [{}],
    });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [token] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Soldier');
  });

  test('merged DFC card number is empty string when front token has no number', async () => {
    const front = makeToken({
      uuid: 'uuid-fish',
      name: 'Fish',
      identifiers: { scryfallId: 'scry-fish' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-fish' }, { uuid: 'uuid-vine' }] }],
    });
    delete front.number;
    const back = makeToken({
      uuid: 'uuid-vine',
      name: 'Vine',
      identifiers: { scryfallId: 'scry-vine' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-fish' }, { uuid: 'uuid-vine' }] }],
    });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [front, back] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result.find((c) => c.name.includes('//')).number).toBe('');
  });

  test('skips DFC pair when front token has no scryfallId', async () => {
    const front = makeToken({
      uuid: 'uuid-front',
      name: 'Front',
      identifiers: {},
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-front' }, { uuid: 'uuid-back' }] }],
    });
    const back = makeToken({
      uuid: 'uuid-back',
      name: 'Back',
      identifiers: { scryfallId: 'scry-back' },
      tokenProducts: [{ tokenParts: [{ uuid: 'uuid-front' }, { uuid: 'uuid-back' }] }],
    });
    fetch.mockResolvedValue(jsonResponse({ data: { tokens: [front, back] } }));
    const result = await fetchSetTokenCards('blb');
    expect(result.find((c) => c.name.includes('//'))).toBeUndefined();
  });
});
