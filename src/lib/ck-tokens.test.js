import { buildTokenCards } from './ck-tokens.js';

function makeTokenItem(overrides = {}) {
  return {
    id: 1,
    sku: 'TKTK-0001',
    scryfall_id: 'scry-abc',
    name: 'Soldier Token',
    variation: '',
    edition: 'Khans of Tarkir',
    is_foil: 'false',
    price_retail: '0.35',
    price_buy: '0.01',
    ...overrides,
  };
}

describe('buildTokenCards — MTGJSON path', () => {
  const fishCard = { id: 'scry-fish', name: 'Fish', number: '7' };

  test('builds card with correct shape from MTGJSON token', () => {
    const [card] = buildTokenCards([fishCard], [], 'ktk');
    expect(card).toMatchObject({
      id: 'scry-fish',
      name: 'Fish',
      number: '7',
      set: 'KTK',
      rarity: 'common',
      cost: '',
      reserved: false,
      nonfoil: true,
      foil: false,
      priceFoil: null,
      price: null,
    });
  });

  test('passes through DFC "A // B" names unchanged', () => {
    const dfcCard = { id: 'scry-fish', name: 'Fish // Vinelasher', number: '7' };
    expect(buildTokenCards([dfcCard], [], 'ktk')[0].name).toBe('Fish // Vinelasher');
  });

  test('looks up price by scryfall_id from non-foil CK item', () => {
    const ckItem = makeTokenItem({ scryfall_id: 'scry-fish', price_retail: '0.99' });
    expect(buildTokenCards([fishCard], [ckItem], 'ktk')[0].price).toBe('0.99');
  });

  test('price is null when matching CK item has null price_retail', () => {
    const ckItem = makeTokenItem({ scryfall_id: 'scry-fish', price_retail: null });
    expect(buildTokenCards([fishCard], [ckItem], 'ktk')[0].price).toBeNull();
  });

  test('ignores foil CK items for price lookup (string and boolean)', () => {
    const foilStr = makeTokenItem({
      scryfall_id: 'scry-fish',
      is_foil: 'true',
      price_retail: '1.50',
    });
    const foilBool = makeTokenItem({
      scryfall_id: 'scry-fish',
      is_foil: true,
      price_retail: '1.50',
    });
    expect(buildTokenCards([fishCard], [foilStr], 'ktk')[0].price).toBeNull();
    expect(buildTokenCards([fishCard], [foilBool], 'ktk')[0].price).toBeNull();
  });

  test('uses first non-foil price when multiple CK items share the same scryfall_id', () => {
    const first = makeTokenItem({ scryfall_id: 'scry-fish', price_retail: '0.50' });
    const second = makeTokenItem({
      sku: 'TKTK-0002',
      scryfall_id: 'scry-fish',
      price_retail: '1.00',
    });
    expect(buildTokenCards([fishCard], [first, second], 'ktk')[0].price).toBe('0.50');
  });

  test('skips CK items without scryfall_id when building price map', () => {
    const noId = makeTokenItem({ scryfall_id: '' });
    const withId = makeTokenItem({
      sku: 'TKTK-0002',
      scryfall_id: 'scry-fish',
      price_retail: '0.75',
    });
    expect(buildTokenCards([fishCard], [noId, withId], 'ktk')[0].price).toBe('0.75');
  });

  test('returns [] when mtgjsonTokenCards is empty', () => {
    expect(buildTokenCards([], [], 'ktk')).toEqual([]);
  });
});

describe('buildTokenCards — CK fallback path', () => {
  test('builds card with correct shape from CK item', () => {
    const item = makeTokenItem({
      variation: 'A',
      scryfall_id: 'scry-xyz',
      name: 'Goblin Token',
      price_retail: '1.25',
    });
    const [card] = buildTokenCards([], [item], 'ktk');
    expect(card).toMatchObject({
      id: 'scry-xyz',
      name: 'Goblin Token',
      number: 'A',
      set: 'KTK',
      rarity: 'common',
      cost: '',
      reserved: false,
      price: '1.25',
      priceFoil: null,
      nonfoil: true,
      foil: false,
    });
  });

  test('filters by TSETCODE- prefix, excludes other sets', () => {
    const items = [
      makeTokenItem({ sku: 'TKTK-0001', scryfall_id: 'scry-ktk' }),
      makeTokenItem({ sku: 'TELD-0001', scryfall_id: 'scry-eld' }),
    ];
    const result = buildTokenCards([], items, 'ktk');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('scry-ktk');
  });

  test('excludes items without scryfall_id', () => {
    expect(buildTokenCards([], [makeTokenItem({ scryfall_id: '' })], 'ktk')).toEqual([]);
  });

  test('price is null when price_retail is null', () => {
    expect(buildTokenCards([], [makeTokenItem({ price_retail: null })], 'ktk')[0].price).toBeNull();
  });

  test('nonfoil/foil derived from is_foil field (string and boolean)', () => {
    const r = (is_foil) => buildTokenCards([], [makeTokenItem({ is_foil })], 'ktk')[0];
    expect(r('false')).toMatchObject({ nonfoil: true, foil: false });
    expect(r('true')).toMatchObject({ nonfoil: false, foil: true });
    expect(r(false)).toMatchObject({ nonfoil: true, foil: false });
    expect(r(true)).toMatchObject({ nonfoil: false, foil: true });
  });

  test('uses variation as number when non-empty, SKU suffix otherwise', () => {
    const withVar = buildTokenCards([], [makeTokenItem({ variation: 'A' })], 'ktk')[0];
    const withSku = buildTokenCards(
      [],
      [makeTokenItem({ sku: 'TKTK-0042', variation: '' })],
      'ktk',
    )[0];
    expect(withVar.number).toBe('A');
    expect(withSku.number).toBe('0042');
  });

  test('SKU prefix matching is case-insensitive', () => {
    expect(buildTokenCards([], [makeTokenItem()], 'KTK')).toHaveLength(1);
  });
});
