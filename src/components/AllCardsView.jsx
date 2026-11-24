import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import CardPreview from './CardPreview.jsx';
import CardTable from './CardTable.jsx';
import Titlebar from './reuse/Titlebar.jsx';
import TitlebarButton from './reuse/TitlebarButton.jsx';
import { sanitizeQuantityText, withFoilQuantity, withQuantity } from '../lib/collection.js';
import { useDebouncedSearch } from '../lib/hooks.js';
import { matchesSearch } from '../lib/search.js';
import { refreshSetCardPrices } from '../lib/scryfall.js';
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
  onPricesReady = null,
  cardPreviewPos = null,
  cardImageSize = null,
  minimized = false,
  onMinimize,
  onRestore,
  sellIds = new Set(),
  onSellToggle,
}) {
  const DEFAULT_SORT = { key: 'set', direction: 1, secondary: null };
  const windowRef = useRef(null);
  const searchRef = useRef(null);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [allCards, setAllCards] = useState(null);
  const [collections, setCollections] = useState({});
  const [cardSetMap, setCardSetMap] = useState({});
  const [focusedCard, setFocusedCard] = useState(null);
  const [focusedCardIsFoil, setFocusedCardIsFoil] = useState(false);
  const {
    displayValue: searchText,
    onChange: onSearchChange,
    committedValue: search,
    commit: commitSearch,
  } = useDebouncedSearch();

  useEffect(() => {
    let cancelled = false;
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

      if (cancelled) return;
      setAllCards(cardAccum);
      setCollections(collectionAccum);
      setCardSetMap(indexAccum);

      for (const code of allCodes) {
        const { main } = await refreshSetCardPrices(code);
        if (cancelled) return;
        setAllCards((prev) => {
          const priceMap = new Map(main.map((c) => [c.id, c]));
          return prev.map((c) => priceMap.get(c.id) ?? c);
        });
      }
      onPricesReady?.();
    })();
    return () => {
      cancelled = true;
    };
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

  const visibleCards = useMemo(() => {
    if (!sortedOwnedCards) return null;
    return search.trim()
      ? sortedOwnedCards.filter((c) => matchesSearch(c.name, search))
      : sortedOwnedCards;
  }, [sortedOwnedCards, search]);

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

  if (minimized) {
    return (
      <div className="window-icon" style={{ bottom: '8px', right: '16px', left: 'auto' }}>
        <div className="window-icon-titlebar">
          <span>All Cards</span>
          <div className="titlebar-buttons">
            <TitlebarButton label="Restore" iconClass="restore-icon" onClick={onRestore} />
            <TitlebarButton label="Close" iconClass="close-icon" onClick={onClose} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="window"
      ref={windowRef}
      onClick={(e) => {
        if (!e.target.closest('input, button, select, textarea, a')) {
          searchRef.current?.focus();
        }
      }}
    >
      <Titlebar>
        <span>All Cards</span>
        <div className="titlebar-buttons">
          <TitlebarButton label="Minimize" iconClass="minimize-bar" onClick={onMinimize} />
          <TitlebarButton label="Close" iconClass="close-icon" onClick={onClose} />
        </div>
      </Titlebar>
      <div className="toolbar">
        <input
          ref={searchRef}
          className="search-input"
          type="search"
          placeholder="Search…"
          autoFocus
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitSearch();
              return;
            }
            if (e.key !== 'ArrowDown') return;
            e.preventDefault();
            flushSync(() => commitSearch());
            const first = windowRef.current?.querySelector('table input:not(:disabled)');
            if (first) first.focus();
          }}
        />
      </div>
      {visibleCards === null ? (
        <div className="table-scroll table-loading">
          <span className="loading-spinner" aria-label="Loading" />
        </div>
      ) : (
        <CardTable
          cards={visibleCards}
          collection={mergedCollection}
          sort={sort}
          onQuantityChange={handleQuantityChange}
          onFoilQuantityChange={handleFoilQuantityChange}
          onSort={handleSort}
          onInputFocus={(card, isFoil) => {
            setFocusedCard(card);
            setFocusedCardIsFoil(isFoil);
          }}
          onTableBlur={() => {
            setFocusedCard(null);
            setFocusedCardIsFoil(false);
          }}
          onEscapeTop={() => {
            searchRef.current?.focus();
            searchRef.current?.select();
          }}
          showSetColumn={true}
          ckPrices={ckPrices}
          showCKTools={showCKTools}
          sellIds={sellIds}
          onSellToggle={onSellToggle}
        />
      )}
      <CardPreview
        key={focusedCard?.id}
        card={focusedCard}
        pos={cardPreviewPos}
        imageSize={cardImageSize ?? 'small'}
        isFoil={focusedCardIsFoil}
      />
    </div>
  );
}
