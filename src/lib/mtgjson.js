import { loadTokenCards, saveTokenCards } from './storage.js';

const MTGJSON_BASE = 'https://mtgjson.com/api/v5';

export async function fetchSetTokenCards(setCode) {
  const cached = await loadTokenCards(setCode);
  if (cached !== null) return cached;

  let response;
  try {
    response = await fetch(`${MTGJSON_BASE}/${setCode.toUpperCase()}.json`);
  } catch {
    return [];
  }
  if (!response.ok) return [];

  const json = await response.json();
  const tokens = json.data?.tokens ?? [];
  const byUuid = new Map(tokens.map((t) => [t.uuid, t]));
  const dfcIds = new Set();
  const seen = new Set();
  const dfcCards = [];

  for (const token of tokens) {
    for (const product of token.tokenProducts ?? []) {
      if (product.tokenParts?.length !== 2) continue;
      const [a, b] = product.tokenParts;
      const tokenA = byUuid.get(a.uuid);
      const tokenB = byUuid.get(b.uuid);
      if (!tokenA || !tokenB) continue;
      const key = [a.uuid, b.uuid].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const frontId = tokenA.identifiers?.scryfallId;
      if (!frontId) continue;
      dfcIds.add(a.uuid);
      dfcIds.add(b.uuid);
      dfcCards.push({
        id: frontId,
        name: `${tokenA.name} // ${tokenB.name}`,
        number: tokenA.number ?? '',
      });
    }
  }

  const singleCards = tokens
    .filter((t) => !dfcIds.has(t.uuid) && t.identifiers?.scryfallId)
    .map((t) => ({
      id: t.identifiers.scryfallId,
      name: t.name,
      number: t.number ?? '',
    }));

  const result = [...dfcCards, ...singleCards];
  await saveTokenCards(setCode, result);
  return result;
}
