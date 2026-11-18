import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchSet, fetchSets } from '../lib/scryfall.js';
import { loadAllCollectionKeys, loadCards, loadCollection } from '../lib/storage.js';
import DraggableCardPreview from './DraggableCardPreview.jsx';

export default function MenuBar({
  theme,
  onThemeChange,
  recentSets = [],
  onOpenSet,
  onViewAllCards,
  activeSet = null,
  onRefreshSet,
  onExportCsv,
  onExportSellCsv,
  showCKTools = true,
  onToggleCKTools,
  openSets = [],
  onAddCard,
  cardPreviewPos = null,
  onSaveCardPreviewPos,
  cardImageSize = null,
  onSaveCardImageSize,
  backgroundSyncing = false,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const barRef = useRef(null);

  const [cardSearch, setCardSearch] = useState('');
  const [cardSearchSets, setCardSearchSets] = useState(null);
  const [cardSearchLoading, setCardSearchLoading] = useState(false);
  const [cardHighlight, setCardHighlight] = useState(-1);

  useEffect(() => {
    function handleMouseDown(e) {
      if (barRef.current.contains(e.target)) return;
      if (openMenu) setOpenMenu(null);
      if (cardSearch) {
        setCardSearch('');
        setCardHighlight(-1);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [openMenu, cardSearch]);

  useEffect(() => {
    setCardSearchSets(null);
  }, [openSets]);

  useEffect(() => {
    if (!cardSearch.trim() || cardSearchSets !== null || cardSearchLoading) return;
    setCardSearchLoading(true);
    Promise.all(
      openSets.map(async (set) => ({
        setCode: set.code,
        cards: (await loadCards(set.code)) ?? [],
        collection: await loadCollection(set.code),
      })),
    )
      .then((data) => {
        setCardSearchSets(data);
        setCardSearchLoading(false);
      })
      .catch(() => {
        setCardSearchSets([]);
        setCardSearchLoading(false);
      });
  }, [cardSearch, cardSearchSets, cardSearchLoading, openSets]);

  const cardResults =
    cardSearch.trim() && cardSearchSets
      ? cardSearchSets
          .flatMap(({ setCode, cards, collection }) =>
            cards
              .filter((c) => c.name.toLowerCase().includes(cardSearch.toLowerCase()))
              .map((c) => ({
                setCode,
                card: c,
                qty: (collection[c.id]?.qty ?? 0) + (collection[c.id]?.foil ?? 0),
              })),
          )
          .slice(0, 8)
      : [];
  const [setSearch, setSetSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [allSets, setAllSets] = useState(null);
  const [setsLoading, setSetsLoading] = useState(false);
  const [directSetResult, setDirectSetResult] = useState(null);
  const [collectedSetCodes, setCollectedSetCodes] = useState(null);
  const [allSetsSubmenuOpen, setAllSetsSubmenuOpen] = useState(false);

  useEffect(() => {
    const q = setSearch.trim();
    if (!q) {
      setDirectSetResult(null);
      return;
    }
    let cancelled = false;
    fetchSet(q).then((result) => {
      if (!cancelled) setDirectSetResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [setSearch]);

  function toggle(name) {
    const isOpening = openMenu !== name;
    setOpenMenu(isOpening ? name : null);
    setCardSearch('');
    setCardHighlight(-1);
    if (name === 'addset' && isOpening && allSets === null && !setsLoading) {
      setSetsLoading(true);
      fetchSets()
        .then((sets) => {
          setAllSets(sets);
          setSetsLoading(false);
        })
        .catch(() => setSetsLoading(false));
    }
  }

  function selectTheme(name) {
    onThemeChange(name);
    setOpenMenu(null);
  }

  function openSet(code, name) {
    onOpenSet?.(code, name);
    setOpenMenu(null);
    setSetSearch('');
    setHighlightedIndex(-1);
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filteredSets.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if ((e.key === ' ' || e.key === 'Enter') && highlightedIndex >= 0) {
      e.preventDefault();
      openSet(filteredSets[highlightedIndex].code, filteredSets[highlightedIndex].name);
    }
  }

  function handleCardSearchChange(e) {
    setCardSearch(e.target.value);
    setCardHighlight(-1);
    setOpenMenu(null);
  }

  function handleCardSearchKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCardHighlight((i) => Math.min(i + 1, cardResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCardHighlight((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && cardHighlight >= 0) {
      e.preventDefault();
      const r = cardResults[cardHighlight];
      onAddCard?.(r.setCode, r.card.id);
      setCardSearch('');
      setCardHighlight(-1);
    } else if (e.key === 'Escape') {
      setCardSearch('');
      setCardHighlight(-1);
    }
  }

  function handleAddFromSearch(setCode, cardId) {
    onAddCard?.(setCode, cardId);
    setCardSearch('');
    setCardHighlight(-1);
  }

  const baseFilteredSets =
    setSearch.trim() && allSets
      ? allSets
          .filter((s) => {
            const q = setSearch.toLowerCase();
            return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
          })
          .slice(0, 8)
      : [];
  const filteredSets = (
    directSetResult && !baseFilteredSets.some((s) => s.code === directSetResult.code)
      ? [directSetResult, ...baseFilteredSets].slice(0, 8)
      : baseFilteredSets
  ).sort((a, b) => {
    const q = setSearch.toLowerCase();
    const matchRank = (s) => {
      if (s.code.toLowerCase() === q) return 0;
      if (s.name.toLowerCase().startsWith(q)) return 1;
      return 2;
    };
    const SECONDARY = new Set([
      'promo',
      'masterpiece',
      'memorabilia',
      'treasure_chest',
      'minigame',
    ]);
    return matchRank(a) - matchRank(b) || SECONDARY.has(a.set_type) - SECONDARY.has(b.set_type);
  });

  function handleSearchChange(e) {
    setSetSearch(e.target.value);
    setHighlightedIndex(-1);
  }

  function handleAllSetsEnter() {
    setAllSetsSubmenuOpen(true);
    if (collectedSetCodes === null) {
      loadAllCollectionKeys().then(setCollectedSetCodes);
    }
    if (allSets === null && !setsLoading) {
      setSetsLoading(true);
      fetchSets()
        .then((sets) => {
          setAllSets(sets);
          setSetsLoading(false);
        })
        .catch(() => setSetsLoading(false));
    }
  }

  const collectedSets = useMemo(() => {
    if (collectedSetCodes === null || (allSets === null && setsLoading)) return null;
    const nameMap = allSets ? new Map(allSets.map((s) => [s.code, s.name])) : new Map();
    return collectedSetCodes
      .filter((code) => !allSets || nameMap.has(code))
      .map((code) => ({ code, name: nameMap.get(code) ?? code.toUpperCase() }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [collectedSetCodes, allSets, setsLoading]);

  return (
    <>
      <div className="menubar" ref={barRef}>
        <div className="menu">
          <button
            className={`menu-label${openMenu === 'collection' ? ' menu-label--open' : ''}`}
            onClick={() => toggle('collection')}
          >
            My Collection
          </button>
          {openMenu === 'collection' && (
            <ul className="menu-dropdown">
              {recentSets.length > 0 ? (
                <>
                  <li className="menu-subheading">Recent</li>
                  {recentSets.map((s) => (
                    <li key={s.code}>
                      <button
                        className="menu-dropdown-item"
                        onClick={() => openSet(s.code, s.name)}
                      >
                        {s.name}
                      </button>
                    </li>
                  ))}
                </>
              ) : (
                <li className="menu-subheading">No recent sets</li>
              )}
              <li
                className="menu-item-has-submenu"
                onMouseEnter={handleAllSetsEnter}
                onMouseLeave={() => setAllSetsSubmenuOpen(false)}
              >
                <span className="menu-dropdown-item menu-dropdown-item--submenu-trigger">
                  All sets…
                </span>
                {allSetsSubmenuOpen && (
                  <div className="menu-submenu-panel">
                    {collectedSets === null ? (
                      <span className="menu-submenu-status">Loading…</span>
                    ) : collectedSets.length === 0 ? (
                      <span className="menu-submenu-status">No sets catalogued yet</span>
                    ) : (
                      <ul className="menu-submenu-sets">
                        {collectedSets.map((s) => (
                          <li key={s.code}>
                            <button
                              className="menu-dropdown-item"
                              onClick={() => openSet(s.code, s.name)}
                            >
                              {s.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
              <li>
                <button
                  className="menu-dropdown-item"
                  onClick={() => {
                    onViewAllCards?.();
                    setOpenMenu(null);
                  }}
                >
                  View all cards
                </button>
              </li>
            </ul>
          )}
        </div>
        <div className="menu">
          <button
            className={`menu-label${openMenu === 'addset' ? ' menu-label--open' : ''}`}
            onClick={() => toggle('addset')}
          >
            Add Set
          </button>
          {openMenu === 'addset' && (
            <ul className="menu-dropdown">
              <li className="menu-subheading">Search</li>
              <li className="menu-sets-search">
                <input
                  className="menu-sets-search-input"
                  type="search"
                  placeholder="Search sets…"
                  value={setSearch}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  autoFocus
                />
              </li>
              {setsLoading && <li className="menu-subheading">Loading…</li>}
              {filteredSets.map((s, i) => (
                <li key={s.code}>
                  <button
                    className="menu-dropdown-item"
                    aria-selected={i === highlightedIndex}
                    onClick={() => openSet(s.code, s.name)}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="menu">
          <button
            className={`menu-label${openMenu === 'view' ? ' menu-label--open' : ''}`}
            onClick={() => toggle('view')}
          >
            View
          </button>
          {openMenu === 'view' && (
            <ul className="menu-dropdown">
              <li className="menu-subheading">Mode</li>
              <li>
                <button className="menu-dropdown-item" onClick={() => selectTheme('light')}>
                  {theme === 'light' && <span aria-hidden="true">✓ </span>}Light Mode
                </button>
              </li>
              <li>
                <button className="menu-dropdown-item" onClick={() => selectTheme('dark')}>
                  {theme === 'dark' && <span aria-hidden="true">✓ </span>}Dark Mode
                </button>
              </li>
              <li>
                <button className="menu-dropdown-item" onClick={() => selectTheme('synthwave')}>
                  {theme === 'synthwave' && <span aria-hidden="true">✓ </span>}Synthwave
                  (experimental)
                </button>
              </li>
              <li className="menu-subheading">Windows</li>
              <li>
                <button
                  className="menu-dropdown-item"
                  onClick={() => {
                    setPreviewOpen((o) => !o);
                    setOpenMenu(null);
                  }}
                >
                  {previewOpen && <span aria-hidden="true">✓ </span>}Move card preview
                </button>
              </li>
              <li className="menu-subheading">Card Kingdom</li>
              <li>
                <button
                  className="menu-dropdown-item"
                  onClick={() => {
                    onToggleCKTools?.();
                    setOpenMenu(null);
                  }}
                >
                  {showCKTools && <span aria-hidden="true">✓ </span>}Add Card Kingdom sell tools
                </button>
              </li>
            </ul>
          )}
        </div>
        <div className="menu">
          <button
            className={`menu-label${openMenu === 'export' ? ' menu-label--open' : ''}`}
            onClick={() => toggle('export')}
          >
            Export Collection
          </button>
          {openMenu === 'export' && (
            <ul className="menu-dropdown">
              <li>
                <button
                  className="menu-dropdown-item"
                  onClick={() => {
                    onExportCsv?.();
                    setOpenMenu(null);
                  }}
                >
                  CSV
                </button>
              </li>
              <li>
                <button
                  className="menu-dropdown-item"
                  onClick={() => {
                    onExportSellCsv?.();
                    setOpenMenu(null);
                  }}
                >
                  Sell to Card Kingdom
                </button>
              </li>
            </ul>
          )}
        </div>
        <div className="menu">
          <button
            className={`menu-label${openMenu === 'debug' ? ' menu-label--open' : ''}`}
            onClick={() => toggle('debug')}
          >
            Debug
          </button>
          {openMenu === 'debug' && (
            <ul className="menu-dropdown">
              {activeSet && (
                <li>
                  <button
                    className="menu-dropdown-item"
                    onClick={() => {
                      onRefreshSet?.();
                      setOpenMenu(null);
                    }}
                  >
                    Refresh current set
                  </button>
                </li>
              )}
              {!activeSet && <li className="menu-subheading">No active set</li>}
            </ul>
          )}
        </div>
        <div className="menu-card-search">
          {backgroundSyncing && <span className="menu-syncing-text">Syncing…</span>}
          {(cardSearchLoading || setsLoading) && (
            <span className="menu-loading-spinner" aria-label="Loading" />
          )}
          <input
            className="menu-card-search-input"
            type="search"
            placeholder="Search for a card"
            value={cardSearch}
            onChange={handleCardSearchChange}
            onKeyDown={handleCardSearchKeyDown}
          />
          {(cardResults.length > 0 || (cardSearch.trim() && cardSearchLoading)) && (
            <ul className="menu-dropdown menu-card-search-dropdown">
              {cardSearchLoading && <li className="menu-subheading">Loading…</li>}
              {cardResults.map((result, i) => (
                <li key={`${result.setCode}-${result.card.id}`}>
                  <button
                    className="menu-dropdown-item menu-card-result"
                    aria-selected={i === cardHighlight}
                    onClick={() => handleAddFromSearch(result.setCode, result.card.id)}
                  >
                    <span className="menu-card-result-name">{result.card.name}</span>
                    <span className="menu-card-result-meta">
                      {result.setCode.toUpperCase()} {result.card.number}
                      {result.qty > 0 ? ` · ${result.qty}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {previewOpen && (
        <DraggableCardPreview
          onClose={() => setPreviewOpen(false)}
          initialPos={cardPreviewPos}
          onSavePos={onSaveCardPreviewPos}
          initialImageSize={cardImageSize ?? 'small'}
          onSaveSize={onSaveCardImageSize}
        />
      )}
    </>
  );
}
