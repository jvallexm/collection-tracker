import { useEffect, useState } from 'react';
import MenuBar from './components/MenuBar.jsx';
import AllCardsView from './components/AllCardsView.jsx';
import SellModal from './components/SellModal.jsx';
import SetTracker from './components/SetTracker.jsx';
import { withQuantity } from './lib/collection.js';
import { usePersistedConfig } from './lib/hooks.js';
import { fetchCKPrices } from './lib/cardkingdom.js';
import { refreshBulkDataIfStale } from './lib/scryfall.js';
import { buildMoxfieldCsv } from './lib/moxfield.js';
import {
  closeSet as closeSetState,
  minimizeSet,
  openSet as openSetState,
  refreshSet,
  restoreSet,
} from './lib/windowState.js';
import {
  deleteCards,
  loadCards,
  loadCollection,
  loadConfig,
  saveCollection,
  saveConfig,
} from './lib/storage.js';

export default function App() {
  const [theme, setTheme] = usePersistedConfig('theme', 'light');
  const [openSets, setOpenSets] = useState(null);
  const [recentSets, setRecentSets] = useState([{ code: 'ktk', name: 'Khans of Tarkir' }]);
  const [collectionVersions, setCollectionVersions] = useState({});
  const [focusTarget, setFocusTarget] = useState(null);
  const [cardPreviewPos, setCardPreviewPos] = usePersistedConfig('cardPreviewPos', null);
  const [cardImageSize, setCardImageSize] = usePersistedConfig('cardImageSize', null);
  const [ckPrices, setCkPrices] = useState(null);
  const [ckTokenItems, setCkTokenItems] = useState([]);
  const [showCKTools, setShowCKTools] = usePersistedConfig('showCKTools', false);
  const [showAllCards, setShowAllCards] = useState(false);
  const [allCardsMinimized, setAllCardsMinimized] = useState(false);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [showSellModal, setShowSellModal] = usePersistedConfig('showSellModal', false);

  function refreshCKPrices() {
    fetchCKPrices()
      .then((result) => {
        if (result) {
          setCkPrices(result.prices);
          setCkTokenItems(result.tokenItems);
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    refreshCKPrices();
  }, []);

  useEffect(() => {
    refreshBulkDataIfStale().catch(() => {});
  }, []);

  useEffect(() => {
    loadConfig('recentSets').then((saved) => {
      if (saved) setRecentSets(saved);
    });
    loadConfig('openSets').then((saved) => {
      setOpenSets(
        Array.isArray(saved) ? saved : [{ code: 'ktk', name: 'Khans of Tarkir', minimized: false }],
      );
    });
  }, []);

  useEffect(() => {
    if (openSets === null) return;
    saveConfig('openSets', openSets);
  }, [openSets]);

  function handleOpenSet(code, name) {
    setOpenSets((current) => openSetState(current, code, name));
    setRecentSets((current) => {
      const updated = [{ code, name }, ...current.filter((s) => s.code !== code)].slice(0, 5);
      saveConfig('recentSets', updated);
      return updated;
    });
    if (showAllCards && !allCardsMinimized) setAllCardsMinimized(true);
  }

  function handleMinimize(code) {
    setOpenSets((current) => minimizeSet(current, code));
  }

  function handleRestore(code) {
    setOpenSets((current) => restoreSet(current, code));
  }

  function handleClose(code) {
    setOpenSets((current) => closeSetState(current, code));
  }

  function handleExportSellCsv() {
    setShowSellModal(true);
  }

  async function handleExportCsv() {
    const allSetsData = await Promise.all(
      (openSets ?? []).map(async (set) => ({
        cards: (await loadCards(set.code)) ?? [],
        collection: await loadCollection(set.code),
      })),
    );
    const csv = buildMoxfieldCsv(allSetsData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'collection.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleAddCard(setCode, cardId) {
    const current = await loadCollection(setCode);
    const newQty = (current[cardId]?.qty ?? 0) + 1;
    const updated = withQuantity(current, cardId, newQty);
    await saveCollection(setCode, updated);
    setCollectionVersions((v) => ({ ...v, [setCode]: (v[setCode] ?? 0) + 1 }));
    setFocusTarget({ setCode, cardId });
  }

  function handleCloseAllMinimized() {
    const minimizedCodes = openSets.filter((s) => s.minimized).map((s) => s.code);
    for (const code of minimizedCodes) deleteCards(code);
    setOpenSets((current) => current.filter((s) => !s.minimized));
  }

  function handleToggleCKTools() {
    setShowCKTools((current) => !current);
  }

  function handleViewAllCards() {
    setShowAllCards(true);
    setAllCardsMinimized(false);
    setPricesLoading(true);
    refreshCKPrices();
  }

  function handleCloseAllCards() {
    setShowAllCards(false);
    setAllCardsMinimized(false);
    setPricesLoading(false);
  }

  async function handleRefreshSet() {
    const active = openSets.find((s) => !s.minimized);
    await deleteCards(active.code);
    setOpenSets((current) => refreshSet(current, active.code));
  }

  const minimizedSets = (openSets ?? []).filter((s) => s.minimized);
  const activeSet = (openSets ?? []).find((s) => !s.minimized) ?? null;

  return (
    <div className={`app-root ${theme}`}>
      <MenuBar
        theme={theme}
        onThemeChange={setTheme}
        recentSets={recentSets}
        onOpenSet={handleOpenSet}
        activeSet={activeSet}
        onRefreshSet={handleRefreshSet}
        onExportCsv={handleExportCsv}
        onExportSellCsv={handleExportSellCsv}
        onViewAllCards={handleViewAllCards}
        sellDisabled={pricesLoading}
        showCKTools={showCKTools}
        onToggleCKTools={handleToggleCKTools}
        openSets={openSets ?? []}
        onAddCard={handleAddCard}
        cardPreviewPos={cardPreviewPos}
        onSaveCardPreviewPos={setCardPreviewPos}
        cardImageSize={cardImageSize}
        onSaveCardImageSize={setCardImageSize}
      />
      <div className="page-content">
        {(openSets ?? []).map((set) => {
          if (!set.minimized && showAllCards && !allCardsMinimized) return null;
          return (
            <SetTracker
              key={`${set.code}-${set.refreshKey ?? 0}`}
              setCode={set.code}
              setName={set.name}
              minimized={set.minimized}
              minimizedIndex={
                minimizedSets.findIndex((s) => s.code === set.code) +
                (minimizedSets.length > 1 ? 1 : 0)
              }
              onMinimize={() => handleMinimize(set.code)}
              onRestore={() => handleRestore(set.code)}
              onClose={() => handleClose(set.code)}
              collectionVersion={collectionVersions[set.code] ?? 0}
              cardFocus={focusTarget?.setCode === set.code ? focusTarget : null}
              cardPreviewPos={cardPreviewPos}
              cardImageSize={cardImageSize}
              ckPrices={ckPrices}
              ckTokenItems={ckTokenItems}
              showCKTools={showCKTools}
            />
          );
        })}
        {minimizedSets.length > 1 && (
          <div className="window-icon" style={{ bottom: '8px' }}>
            <div className="window-icon-titlebar">
              <span>Close sets</span>
              <div className="titlebar-buttons">
                <button
                  className="titlebar-btn"
                  aria-label="Close all minimized sets"
                  onClick={handleCloseAllMinimized}
                >
                  <span className="close-icon" />
                </button>
              </div>
            </div>
          </div>
        )}
        {showAllCards && (
          <AllCardsView
            onClose={handleCloseAllCards}
            ckPrices={ckPrices}
            showCKTools={showCKTools}
            openSets={openSets}
            onPricesReady={() => setPricesLoading(false)}
            cardPreviewPos={cardPreviewPos}
            cardImageSize={cardImageSize}
            minimized={allCardsMinimized}
            onMinimize={() => setAllCardsMinimized(true)}
            onRestore={() => setAllCardsMinimized(false)}
          />
        )}
        {showSellModal && (
          <SellModal
            onClose={() => setShowSellModal(false)}
            openSets={openSets ?? []}
            ckPrices={ckPrices}
            cardPreviewPos={cardPreviewPos}
            cardImageSize={cardImageSize}
          />
        )}
      </div>
    </div>
  );
}
