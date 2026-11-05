import { useEffect, useMemo, useState } from 'react';
import CardPreview from './CardPreview.jsx';
import CardTable from './CardTable.jsx';
import ExportModal from './ExportModal.jsx';
import { sanitizeQuantityText, summarize, withFoilQuantity, withQuantity } from '../lib/collection.js';
import { buildMoxfieldList } from '../lib/moxfield.js';
import { fetchSetCards } from '../lib/scryfall.js';
import { sortCards } from '../lib/sorting.js';
import { loadCollection, loadConfig, saveCollection, saveConfig } from '../lib/storage.js';

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

function normalizeSearchText(s) {
  return s.replace(/,/g, '').toLowerCase();
}

function matchesSearch(card, query) {
  return normalizeSearchText(card.name).includes(normalizeSearchText(query));
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
export default function SetTracker({ setCode, setName, minimized = false, minimizedIndex = 0, onMinimize, onRestore, onClose }) {
  const [cards, setCards] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [collection, setCollection] = useState(null); // null = not yet loaded from IDB
  const [sort, setSort] = useState({ key: 'name', direction: 1, secondary: null });
  const [sortLoaded, setSortLoaded] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [focusedCard, setFocusedCard] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSetCards(setCode)
      .then(setCards)
      .catch((error) => setLoadError(error.message));
  }, [setCode]);

  // Load saved quantities from IDB. Uses a functional update so any quantity the user
  // types before the load completes is not overwritten by the arriving saved data.
  useEffect(() => {
    setCollection(null);
    loadCollection(setCode).then((saved) => {
      setCollection((current) => current ?? saved);
    });
  }, [setCode]);

  // Persist every change to IDB, but skip the initial render before the load completes.
  useEffect(() => {
    if (collection === null) return;
    saveCollection(setCode, collection);
  }, [collection, setCode]);

  useEffect(() => {
    setSortLoaded(false);
    loadConfig(`sort:${setCode}`).then((saved) => {
      if (saved) setSort(saved);
      setSortLoaded(true);
    });
  }, [setCode]);

  useEffect(() => {
    if (!sortLoaded) return;
    saveConfig(`sort:${setCode}`, sort);
  }, [sort, setCode, sortLoaded]);

  const safeCollection = collection ?? {};

  const visibleCards = useMemo(() => {
    const filtered = search.trim() ? cards.filter((card) => matchesSearch(card, search)) : cards;
    if (sort.key === 'have') {
      const bySecondary = sortCards(filtered, sort.secondary.key, sort.secondary.direction);
      return [...bySecondary].sort((a, b) => {
        const hasA = safeCollection[a.id] ? 1 : 0;
        const hasB = safeCollection[b.id] ? 1 : 0;
        return (hasB - hasA) * sort.direction;
      });
    }
    return sortCards(filtered, sort.key, sort.direction);
  }, [cards, sort, safeCollection, search]);

  /**
   * Updates the active sort column and direction.
   * Clicking the already-active column flips between ascending and descending.
   * Clicking a different column always starts ascending.
   * @param {string} key - Column key to sort by.
   */
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
            <button className="titlebar-btn" aria-label="Restore" onClick={onRestore}>
              <span className="restore-icon" />
            </button>
            <button className="titlebar-btn" aria-label="Close" onClick={onClose}>
              <span className="close-icon" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="window">
      <div className="titlebar">
        <span>{setName}</span>
        {cards.length === 0 && !loadError && <span className="loading-spinner" aria-label="Loading" />}
        <div className="titlebar-buttons">
          <button className="titlebar-btn" aria-label="Minimize" onClick={onMinimize}>
            <span className="minimize-bar" />
          </button>
          <button className="titlebar-btn" aria-label="Close" onClick={onClose}>
            <span className="close-icon" />
          </button>
        </div>
      </div>
      <div className="toolbar">
        <button
          className="export-btn"
          onClick={() => setExportOpen(true)}
          disabled={cards.length === 0}
        >
          Export…
        </button>
        <input
          className="search-input"
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="status">
          {describeStatus({ loadError, cards, collection: safeCollection })}
        </span>
      </div>
      <CardTable
        cards={visibleCards}
        collection={safeCollection}
        sort={sort}
        onQuantityChange={handleQuantityChange}
        onFoilQuantityChange={handleFoilQuantityChange}
        onSort={handleSort}
        onInputFocus={setFocusedCard}
        onTableBlur={() => setFocusedCard(null)}
      />
      <CardPreview key={focusedCard?.id} card={focusedCard} />
      {/*<p className="help">W / S or Up / Down moves between rows. A / D or Left / Right switches columns. Click a heading to sort.</p>*/}
      {exportOpen && (
        <ExportModal
          text={buildMoxfieldList(cards, safeCollection)}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}
