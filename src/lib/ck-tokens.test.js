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
  const dfcCard = { id: 'scry-fish', name: 'Fish // Iridescent Vinelasher', number: '7' };

  test('returns card for each mtgjson token', () => {
    const result = buildTokenCards([fishCard], [], 'ktk');
    expect(result).toHaveLength(1);
  });

  test('card id from mtgjson token', () => {
    const result = buildTokenCards([fishCard], [], 'ktk');
    expect(result[0].id).toBe('scry-fish');
  });

  test('card name from mtgjson token (including "A // B" DFC names)', () => {
    const result = buildTokenCards([dfcCard], [], 'ktk');
    expect(result[0].name).toBe('Fish // Iridescent Vinelasher');
  });

  test('card number from mtgjson token', () => {
    const result = buildTokenCards([fishCard], [], 'ktk');
    expect(result[0].number).toBe('7');
  });

  test('set is setCode uppercased', () => {
    const result = buildTokenCards([fishCard], [], 'ktk');
    expect(result[0].set).toBe('KTK');
  });

  test('rarity is common, cost is empty string, reserved is false', () => {
    const result = buildTokenCards([fishCard], [], 'ktk');
    expect(result[0].rarity).toBe('common');
    expect(result[0].cost).toBe('');
    expect(result[0].reserved).toBe(false);
  });

  test('nonfoil is true, foil is false, priceFoil is null', () => {
    const result = buildTokenCards([fishCard], [], 'ktk');
    expect(result[0].nonfoil).toBe(true);
    expect(result[0].foil).toBe(false);
    expect(result[0].priceFoil).toBeNull();
  });

  test('looks up price by scryfall_id from ckTokenItems', () => {
    const ckItem = makeTokenItem({
      sku: 'TKTK-0007',
      scryfall_id: 'scry-fish',
      price_retail: '0.99',
    });
    const result = buildTokenCards([fishCard], [ckItem], 'ktk');
    expect(result[0].price).toBe('0.99');
  });

  test('price is null when no matching CK item', () => {
    const result = buildTokenCards([fishCard], [], 'ktk');
    expect(result[0].price).toBeNull();
  });

  test('ignores foil CK items for price lookup (is_foil string "true")', () => {
    const foilItem = makeTokenItem({
      sku: 'TKTK-0007',
      scryfall_id: 'scry-fish',
      is_foil: 'true',
      price_retail: '1.50',
    });
    const result = buildTokenCards([fishCard], [foilItem], 'ktk');
    expect(result[0].price).toBeNull();
  });

  test('ignores foil CK items for price lookup (is_foil boolean true)', () => {
    const foilItem = makeTokenItem({
      sku: 'TKTK-0007',
      scryfall_id: 'scry-fish',
      is_foil: true,
      price_retail: '1.50',
    });
    const result = buildTokenCards([fishCard], [foilItem], 'ktk');
    expect(result[0].price).toBeNull();
  });

  test('uses first non-foil price when multiple CK items share the same scryfall_id', () => {
    const first = makeTokenItem({
      sku: 'TKTK-0007',
      scryfall_id: 'scry-fish',
      price_retail: '0.50',
    });
    const second = makeTokenItem({
      sku: 'TKTK-0008',
      scryfall_id: 'scry-fish',
      price_retail: '1.00',
    });
    const result = buildTokenCards([fishCard], [first, second], 'ktk');
    expect(result[0].price).toBe('0.50');
  });

  test('skips CK item with no scryfall_id when building price map', () => {
    const noId = makeTokenItem({ sku: 'TKTK-0007', scryfall_id: '' });
    const withId = makeTokenItem({
      sku: 'TKTK-0008',
      scryfall_id: 'scry-fish',
      price_retail: '0.75',
    });
    const result = buildTokenCards([fishCard], [noId, withId], 'ktk');
    expect(result[0].price).toBe('0.75');
  });

  test('price is null when matching CK item has null price_retail', () => {
    const ckItem = makeTokenItem({
      sku: 'TKTK-0007',
      scryfall_id: 'scry-fish',
      price_retail: null,
    });
    const result = buildTokenCards([fishCard], [ckItem], 'ktk');
    expect(result[0].price).toBeNull();
  });

  test('returns [] when mtgjsonTokenCards is empty and ckTokenItems is empty', () => {
    const result = buildTokenCards([], [], 'ktk');
    expect(result).toEqual([]);
  });
});

describe('buildTokenCards — CK fallback path', () => {
  test('returns [] when no CK items match the set', () => {
    const items = [makeTokenItem({ sku: 'TELD-0001' })];
    expect(buildTokenCards([], items, 'ktk')).toEqual([]);
  });

  test('returns cards matching T{SETCODE}- prefix', () => {
    const items = [makeTokenItem({ sku: 'TKTK-0001' })];
    const result = buildTokenCards([], items, 'ktk');
    expect(result).toHaveLength(1);
  });

  test('excludes items from other sets', () => {
    const items = [
      makeTokenItem({ sku: 'TKTK-0001', scryfall_id: 'scry-ktk' }),
      makeTokenItem({ sku: 'TELD-0001', scryfall_id: 'scry-eld', name: 'Human Token' }),
    ];
    const result = buildTokenCards([], items, 'ktk');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('scry-ktk');
  });

  test('excludes items without scryfall_id', () => {
    const items = [makeTokenItem({ sku: 'TKTK-0001', scryfall_id: '' })];
    expect(buildTokenCards([], items, 'ktk')).toEqual([]);
  });

  test('uses scryfall_id as card id', () => {
    const items = [makeTokenItem({ sku: 'TKTK-0001', scryfall_id: 'scry-xyz' })];
    const result = buildTokenCards([], items, 'ktk');
    expect(result[0].id).toBe('scry-xyz');
  });

  test('uses CK name', () => {
    const items = [makeTokenItem({ sku: 'TKTK-0001', name: 'Goblin Token' })];
    const result = buildTokenCards([], items, 'ktk');
    expect(result[0].name).toBe('Goblin Token');
  });

  test('uses price_retail as card.price', () => {
    const items = [makeTokenItem({ sku: 'TKTK-0001', price_retail: '1.25' })];
    const result = buildTokenCards([], items, 'ktk');
    expect(result[0].price).toBe('1.25');
  });

  test('price null when price_retail null', () => {
    const items = [makeTokenItem({ sku: 'TKTK-0001', price_retail: null })];
    const result = buildTokenCards([], items, 'ktk');
    expect(result[0].price).toBeNull();
  });

  test('sets nonfoil=true foil=false for is_foil "false"', () => {
    const items = [makeTokenItem({ sku: 'TKTK-0001', is_foil: 'false' })];
    const result = buildTokenCards([], items, 'ktk');
    expect(result[0].nonfoil).toBe(true);
    expect(result[0].foil).toBe(false);
  });

  test('sets nonfoil=false foil=true for is_foil "true"', () => {
    const items = [makeTokenItem({ sku: 'TKTK-0001', is_foil: 'true' })];
    const result = buildTokenCards([], items, 'ktk');
    expect(result[0].nonfoil).toBe(false);
    expect(result[0].foil).toBe(true);
  });

  test('sets nonfoil=true foil=false for is_foil boolean false', () => {
    const items = [makeTokenItem({ sku: 'TKTK-0001', is_foil: false })];
    const result = buildTokenCards([], items, 'ktk');
    expect(result[0].nonfoil).toBe(true);
    expect(result[0].foil).toBe(false);
  });

  test('sets nonfoil=false foil=true for is_foil boolean true', () => {
    const items = [makeTokenItem({ sku: 'TKTK-0001', is_foil: true })];
    const result = buildTokenCards([], items, 'ktk');
    expect(result[0].nonfoil).toBe(false);
    expect(result[0].foil).toBe(true);
  });

  test('uses variation as number when non-empty', () => {
    const items = [makeTokenItem({ sku: 'TKTK-0001', variation: 'A' })];
    const result = buildTokenCards([], items, 'ktk');
    expect(result[0].number).toBe('A');
  });

  test('uses SKU suffix as number when variation empty', () => {
    const items = [makeTokenItem({ sku: 'TKTK-0042', variation: '' })];
    const result = buildTokenCards([], items, 'ktk');
    expect(result[0].number).toBe('0042');
  });

  test('SKU prefix matching is case-insensitive', () => {
    const items = [makeTokenItem({ sku: 'TKTK-0001' })];
    const result = buildTokenCards([], items, 'KTK');
    expect(result).toHaveLength(1);
  });
});
