// Builds a normalized card; override only the fields a test cares about.
export const makeCard = (overrides) => ({
  id: '1',
  name: 'Alpha',
  rarity: 'common',
  cost: '{G}',
  number: '1',
  set: 'KTK',
  price: null,
  priceFoil: null,
  ...overrides,
});
