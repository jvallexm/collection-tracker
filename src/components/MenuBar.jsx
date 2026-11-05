import { useEffect, useRef, useState } from 'react';
import { fetchSets } from '../lib/scryfall.js';

/**
 * Site-wide menu bar in a Windows 3.x style.
 * @param {Object} props
 * @param {'light'|'dark'|'synthwave'} props.theme - Currently active theme.
 * @param {function(string): void} props.onThemeChange - Called with the chosen theme name.
 * @param {{ code: string, name: string }[]} props.recentSets - Up to 3 recently opened sets.
 * @param {function(string, string): void} props.onOpenSet - Called with (code, name) when a set is chosen.
 */
export default function MenuBar({ theme, onThemeChange, recentSets = [], onOpenSet, activeSet = null, onRefreshSet }) {
  const [openMenu, setOpenMenu] = useState(null);
  const barRef = useRef(null);

  useEffect(() => {
    function handleMouseDown(e) {
      if (openMenu && !barRef.current.contains(e.target)) setOpenMenu(null);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [openMenu]);
  const [setSearch, setSetSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [allSets, setAllSets] = useState(null);
  const [setsLoading, setSetsLoading] = useState(false);

  function toggle(name) {
    const isOpening = openMenu !== name;
    setOpenMenu(isOpening ? name : null);
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

  const filteredSets =
    setSearch.trim() && allSets
      ? allSets
          .filter((s) => {
            const q = setSearch.toLowerCase();
            return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
          })
          .slice(0, 8)
      : [];

  function handleSearchChange(e) {
    setSetSearch(e.target.value);
    setHighlightedIndex(-1);
  }

  return (
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
                    <button className="menu-dropdown-item" onClick={() => openSet(s.code, s.name)}>
                      {s.name}
                    </button>
                  </li>
                ))}
              </>
            ) : (
              <li className="menu-subheading">No recent sets</li>
            )}
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
                {theme === 'synthwave' && <span aria-hidden="true">✓ </span>}Synthwave (experimental)
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
                  onClick={() => { onRefreshSet?.(); setOpenMenu(null); }}
                >
                  Refresh current set
                </button>
              </li>
            )}
            {!activeSet && (
              <li className="menu-subheading">No active set</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
