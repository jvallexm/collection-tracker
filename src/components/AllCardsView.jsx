import { useEffect, useMemo, useState } from 'react';
import CardTable from './CardTable.jsx';
import Titlebar from './reuse/Titlebar.jsx';
import TitlebarButton from './reuse/TitlebarButton.jsx';
import { sanitizeQuantityText, withFoilQuantity, withQuantity } from '../lib/collection.js';
import { sortCards } from '../lib/sorting.js';
import {
  loadAllCollectionKeys,
  loadCards,
  loadCollection,
  saveCollection,
} from '../lib/storage.js';

export default function AllCardsView({
  onClose,
  ckPrices = null,
  showCKTools = false,
  openSets = [],
}) {
  const DEFAULT_SORT = { key: 'set', direction: 1, secondary: null };
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [allCards, setAllCards] = useState(null);
  const [collections, setCollections] = useState({});
  const [cardSetMap, setCardSetMap] = useState({});

  useEffect(() => {
    (async () => {
      const storedKeys = await loadAllCollectionKeys();
      const openCodes = openSets.map((s) => s.code);
      const allCodes = [...new Set([...storedKeys, ...openCodes])];

      const cardAccum = [];
      const collectionAccum = {};
      const indexAccum = {};

      for (const code of allCodes) {
        const cards = (await loadCards(code)) ?? [];
        const coll = await loadCollection(code);
        collectionAccum[code] = coll;
        for (const card of cards) {
          if (!indexAccum[card.id]) {
            indexAccum[card.id] = code;
            cardAccum.push(card);
          }
        }
      }

      cardAccum.sort(
        (a, b) => indexAccum[a.id].localeCompare(indexAccum[b.id]) || a.name.localeCompare(b.name),
      );

      setAllCards(cardAccum);
      setCollections(collectionAccum);
      setCardSetMap(indexAccum);
    })();
  }, []);

  const mergedCollection = useMemo(() => {
    const merged = {};
    for (const coll of Object.values(collections)) Object.assign(merged, coll);
    return merged;
  }, [collections]);

  const ownedCards = useMemo(() => {
    if (allCards === null) return null;
    return allCards.filter((card) => {
      const entry = mergedCollection[card.id];
      return (entry?.qty ?? 0) > 0 || (entry?.foil ?? 0) > 0;
    });
  }, [allCards, mergedCollection]);

  function handleSort(key) {
    setSort((current) => {
      if (key === 'have') {
        const secondary =
          current.key === 'have'
            ? current.secondary
            : { key: current.key, direction: current.direction };
        const direction = current.key === 'have' ? -current.direction : 1;
        return { key: 'have', direction, secondary };
      }
      return current.key === key
        ? { key, direction: -current.direction, secondary: null }
        : { key, direction: 1, secondary: null };
    });
  }

  const sortedOwnedCards = useMemo(() => {
    if (!ownedCards) return null;
    if (sort.key === 'have') {
      return sortCards(ownedCards, sort.secondary.key, sort.secondary.direction);
    }
    return sortCards(ownedCards, sort.key, sort.direction);
  }, [ownedCards, sort]);

  function handleQuantityChange(cardId, text) {
    const setCode = cardSetMap[cardId];
    const quantity = parseInt(sanitizeQuantityText(text), 10);
    setCollections((prev) => {
      const updated = withQuantity(prev[setCode], cardId, quantity);
      saveCollection(setCode, updated);
      return { ...prev, [setCode]: updated };
    });
  }

  function handleFoilQuantityChange(cardId, text) {
    const setCode = cardSetMap[cardId];
    const quantity = parseInt(sanitizeQuantityText(text), 10);
    setCollections((prev) => {
      const updated = withFoilQuantity(prev[setCode], cardId, quantity);
      saveCollection(setCode, updated);
      return { ...prev, [setCode]: updated };
    });
  }

  return (
    <div className="window">
      <Titlebar>
        <span>All Cards</span>
        <div className="titlebar-buttons">
          <TitlebarButton label="Close" iconClass="close-icon" onClick={onClose} />
        </div>
      </Titlebar>
      {sortedOwnedCards === null ? (
        <div className="table-scroll table-loading">
          <span className="loading-spinner" aria-label="Loading" />
        </div>
      ) : (
        <CardTable
          cards={sortedOwnedCards}
          collection={mergedCollection}
          sort={sort}
          onQuantityChange={handleQuantityChange}
          onFoilQuantityChange={handleFoilQuantityChange}
          onSort={handleSort}
          showSetColumn={true}
          ckPrices={ckPrices}
          showCKTools={showCKTools}
        />
      )}
    </div>
  );
}
