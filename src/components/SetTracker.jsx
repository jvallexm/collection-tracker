import { useEffect, useMemo, useState } from 'react';
import CardTable from './CardTable.jsx';
import ExportModal from './ExportModal.jsx';
import { sanitizeQuantityText, summarize, withQuantity } from '../lib/collection.js';
import { buildMoxfieldList } from '../lib/moxfield.js';
import { fetchSetCards } from '../lib/scryfall.js';
import { sortCards } from '../lib/sorting.js';
import { loadCollection, saveCollection } from '../lib/storage.js';

/**
 * Builds the status bar text shown below the toolbar.
 * Shows a loading or error message until cards are ready, then a summary of what the user owns.
 * @param {{ loadError: string|null, cards: Object[], collection: Object }} params
 * @returns {string} Human-readable status line.
 */
function describeStatus({ loadError, cards, collection }) {
  if (loadError) return `Could not load cards: ${loadError}`;
  if (cards.length === 0) return 'Loading...';

  const { unique, copies } = summarize(collection);
  return `${cards.length} cards | ${unique} unique owned | ${copies} total copies`;
}

/**
 * Tracks a user's card collection for a single Magic: The Gathering set.
 * Fetches the card list from Scryfall, persists quantities to IndexedDB,
 * and provides sorting and Moxfield export.
 * @param {Object} props
 * @param {string} props.setCode - Three-letter Scryfall set code, e.g. "ktk".
 * @param {string} props.setName - Human-readable set name shown in the title bar.
 */
export default function SetTracker({ setCode, setName }) {
  const [cards, setCards] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [collection, setCollection] = useState({});
  const [collectionReady, setCollectionReady] = useState(false);
  const [sort, setSort] = useState({ key: 'name', direction: 1 });
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    fetchSetCards(setCode)
      .then(setCards)
      .catch((error) => setLoadError(error.message));
  }, [setCode]);

  useEffect(() => {
    setCollectionReady(false);
    loadCollection(setCode).then((saved) => {
      setCollection(saved);
      setCollectionReady(true);
    });
  }, [setCode]);

  useEffect(() => {
    if (!collectionReady) return;
    saveCollection(setCode, collection);
  }, [collection, collectionReady, setCode]);

  const visibleCards = useMemo(
    () => sortCards(cards, sort.key, sort.direction),
    [cards, sort],
  );

  /**
   * Updates the active sort column and direction.
   * Clicking the already-active column flips between ascending and descending.
   * Clicking a different column always starts ascending.
   * @param {string} key - Column key to sort by.
   */
  function handleSort(key) {
    setSort((current) =>
      current.key === key
        ? { key, direction: -current.direction }
        : { key, direction: 1 },
    );
  }

  /**
   * Parses raw input from a quantity box and saves the updated count to the collection.
   * Invalid or empty input is treated as zero, which removes the card from the collection.
   * @param {string} cardId - The Scryfall card ID being edited.
   * @param {string} typedText - Raw text the user typed into the quantity input.
   */
  function handleQuantityChange(cardId, typedText) {
    const quantity = parseInt(sanitizeQuantityText(typedText), 10);
    setCollection((current) => withQuantity(current, cardId, quantity));
  }

  return (
    <div className="window">
      <div className="titlebar">{`${setName} - Collection`}</div>
      <div className="toolbar">
        <button onClick={() => setExportOpen(true)} disabled={cards.length === 0}>
          Export...
        </button>
        <span className="status">{describeStatus({ loadError, cards, collection })}</span>
      </div>
      <CardTable
        cards={visibleCards}
        collection={collection}
        onQuantityChange={handleQuantityChange}
        onSort={handleSort}
      />
      <p className="help">W / S or Up / Down moves between boxes. Click a heading to sort.</p>
      {exportOpen && (
        <ExportModal
          text={buildMoxfieldList(cards, collection)}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}
