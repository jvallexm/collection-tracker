import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Titlebar from './reuse/Titlebar.jsx';
import TitlebarButton from './reuse/TitlebarButton.jsx';
import CardPreview from './CardPreview.jsx';
import CardTable from './CardTable.jsx';
import ExportModal from './ExportModal.jsx';
import {
  sanitizeQuantityText,
  summarize,
  withFoilQuantity,
  withQuantity,
} from '../lib/collection.js';
import { useDebouncedSearch, usePersistedConfig } from '../lib/hooks.js';
import { buildMoxfieldList } from '../lib/moxfield.js';
import { matchesSearch } from '../lib/search.js';
import { buildTokenCards } from '../lib/cardkingdom.js';
import { fetchSetTokenCards } from '../lib/mtgjson.js';
import { fetchSetCards, refreshSetCardPrices } from '../lib/scryfall.js';
import { nextSortState, sortCards } from '../lib/sorting.js';
import { loadCards, loadCollection, saveCollection } from '../lib/storage.js';

/**
 * Builds the status bar text shown below the toolbar.
 * Shows a loading or error message until cards are ready, then a summary of what the user owns.
 * @param {{ loadError: string|null, cards: Object[], collection: Object }} params
 * @returns {string} Human-readable status line.
 */
function describeStatus({ loadError, cards, collection }) {
  if (loadError) return `Could not load cards: ${loadError}`;
  if (cards.length === 0) return 'Loading...';

  const { copies } = summarize(collection);
  return `${cards.length} cards | ${copies} in Collection`;
}

function computeVisibleCards(cards, sort, collection, search) {
  const filtered = search.trim() ? cards.filter((card) => matchesSearch(card.name, search)) : cards;
  if (sort.key === 'have') {
    const bySecondary = sortCards(filtered, sort.secondary.key, sort.secondary.direction);
    return [...bySecondary].sort((a, b) => {
      const hasA = collection[a.id] ? 1 : 0;
      const hasB = collection[b.id] ? 1 : 0;
      return (hasB - hasA) * sort.direction;
    });
  }
  return sortCards(filtered, sort.key, sort.direction);
}

/**
 * Tracks a user's card collection for a single Magic: The Gathering set.
 * Fetches the card list from Scryfall, persists quantities to IndexedDB,
 * and provides sorting and Moxfield export.
 * @param {Object} props
 * @param {string} props.setCode - Three-letter Scryfall set code, e.g. "ktk".
 * @param {string} props.setName - Human-readable set name shown in the title bar.
 * @param {boolean} props.minimized - Whether this window is currently minimized.
 * @param {number} props.minimizedIndex - Position among minimized windows (for stacking).
 * @param {function(): void} props.onMinimize - Called when the user clicks Minimize.
 * @param {function(): void} props.onRestore - Called when the user clicks Restore.
 */
export default function SetTracker({
  setCode,
  setName,
  minimized = false,
  minimizedIndex = 0,
  onMinimize,
  onRestore,
  onClose,
  collectionVersion = 0,
  cardFocus = null,
  cardPreviewPos = null,
  cardImageSize = null,
  ckPrices = null,
  ckTokenItems = [],
  showCKTools = true,
}) {
  const windowRef = useRef(null);
  const searchRef = useRef(null);
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [collection, setCollection] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [focusedCard, setFocusedCard] = useState(null);
  const [focusedCardIsFoil, setFocusedCardIsFoil] = useState(false);
  const {
    displayValue: searchText,
    onChange: onSearchChange,
    committedValue: search,
    commit: commitSearch,
  } = useDebouncedSearch();
  const [mtgjsonTokenCards, setMtgjsonTokenCards] = useState([]);
  const DEFAULT_SORT = { key: 'name', direction: 1, secondary: null };
  const [sort, setSort] = usePersistedConfig(`sort:${setCode}`, DEFAULT_SORT);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const cached = await loadCards(setCode);
        if (cached && !cancelled) {
          setCards(cached);
          setIsLoading(false);
        }
        const main = await fetchSetCards(setCode, (partial) => {
          if (!cancelled) setCards(partial);
        });
        if (!cancelled) {
          setCards(main);
          setIsLoading(false);
        }
        if (cached) {
          refreshSetCardPrices(setCode)
            .then(({ main: fresh }) => {
              if (cancelled) return;
              setCards(fresh);
            })
            .catch(() => {});
        }
      } catch (error) {
        if (!cancelled) setLoadError(error.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setCode]);

  // Load saved quantities from IDB. Uses a functional update so any quantity the user
  // types before the load completes is not overwritten by the arriving saved data.
  useEffect(() => {
    let cancelled = false;
    setCollection(null);
    loadCollection(setCode).then((saved) => {
      if (!cancelled) setCollection((current) => current ?? saved);
    });
    return () => {
      cancelled = true;
    };
  }, [setCode]);

  // Persist every change to IDB, but skip the initial render before the load completes.
  useEffect(() => {
    if (collection === null) return;
    saveCollection(setCode, collection);
  }, [collection, setCode]);

  // Reload when an external change (e.g. global card search add) bumps the version.
  useEffect(() => {
    if (collectionVersion === 0) return;
    loadCollection(setCode).then((saved) => {
      setCollection(saved ?? {});
    });
  }, [collectionVersion, setCode]);

  // Focus the qty input for a card added via global search.
  useEffect(() => {
    if (!cardFocus || !windowRef.current) return;
    const row = windowRef.current.querySelector(`[data-card-id="${cardFocus.cardId}"]`);
    if (!row) return;
    const input = row.querySelector('input');
    if (input) input.focus();
  }, [cardFocus]);

  const safeCollection = collection ?? {};
  const safeSort = sort;

  useEffect(() => {
    let cancelled = false;
    fetchSetTokenCards(setCode)
      .then((cards) => {
        if (!cancelled) setMtgjsonTokenCards(cards);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setCode]);

  const tokenCards = useMemo(
    () => buildTokenCards(mtgjsonTokenCards, ckTokenItems, setCode),
    [mtgjsonTokenCards, ckTokenItems, setCode],
  );

  const visibleCards = useMemo(
    () => computeVisibleCards(cards, safeSort, safeCollection, search),
    [cards, safeSort, safeCollection, search],
  );

  const visibleTokenCards = useMemo(
    () => computeVisibleCards(tokenCards, safeSort, safeCollection, search),
    [tokenCards, safeSort, safeCollection, search],
  );

  function handleSort(key) {
    setSort((current) => nextSortState(current, key));
  }

  /**
   * Parses raw input from a quantity box and saves the updated count to the collection.
   * Invalid or empty input is treated as zero, which removes the card from the collection.
   * @param {string} cardId - The Scryfall card ID being edited.
   * @param {string} typedText - Raw text the user typed into the quantity input.
   */
  function handleQuantityChange(cardId, typedText) {
    const quantity = parseInt(sanitizeQuantityText(typedText), 10);
    setCollection((current) => withQuantity(current ?? {}, cardId, quantity));
  }

  function handleFoilQuantityChange(cardId, typedText) {
    const quantity = parseInt(sanitizeQuantityText(typedText), 10);
    setCollection((current) => withFoilQuantity(current ?? {}, cardId, quantity));
  }

  if (minimized) {
    return (
      <div className="window-icon" style={{ bottom: `${8 + minimizedIndex * 40}px` }}>
        <div className="window-icon-titlebar">
          <span>{setCode.toUpperCase()}</span>
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
        <span>{setName}</span>
        {isLoading && cards.length > 0 && (
          <span className="loading-spinner loading-spinner--inline" aria-label="Loading" />
        )}
        <div className="titlebar-buttons">
          <TitlebarButton label="Minimize" iconClass="minimize-bar" onClick={onMinimize} />
          <TitlebarButton label="Close" iconClass="close-icon" onClick={onClose} />
        </div>
      </Titlebar>
      <div className="toolbar">
        <button
          className="export-btn"
          onClick={() => setExportOpen(true)}
          disabled={cards.length === 0}
        >
          Export…
        </button>
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
      {cards.length === 0 && !loadError ? (
        <div className="table-scroll table-loading">
          <span className="loading-spinner" aria-label="Loading" />
        </div>
      ) : (
        <CardTable
          cards={visibleCards}
          tokenCards={visibleTokenCards}
          collection={safeCollection}
          sort={safeSort}
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
          ckPrices={ckPrices}
          showCKTools={showCKTools}
        />
      )}
      <CardPreview
        key={focusedCard?.id}
        card={focusedCard}
        pos={cardPreviewPos}
        imageSize={cardImageSize ?? 'small'}
        isFoil={focusedCardIsFoil}
      />
      <div className="statusbar">
        {describeStatus({ loadError, cards, collection: safeCollection })}
      </div>
      {exportOpen && (
        <ExportModal
          text={buildMoxfieldList(cards, safeCollection)}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}
