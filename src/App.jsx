import { useEffect, useState } from 'react';
import MenuBar from './components/MenuBar.jsx';
import SetTracker from './components/SetTracker.jsx';
import { withQuantity } from './lib/collection.js';
import { buildMoxfieldCsv } from './lib/moxfield.js';
import { deleteCards, loadCards, loadCollection, loadConfig, saveCollection, saveConfig } from './lib/storage.js';

export default function App() {
  const [theme, setTheme] = useState('light');
  const [openSets, setOpenSets] = useState(null);
  const [recentSets, setRecentSets] = useState([{ code: 'ktk', name: 'Khans of Tarkir' }]);
  const [collectionVersions, setCollectionVersions] = useState({});
  const [focusTarget, setFocusTarget] = useState(null);

  useEffect(() => {
    loadConfig('theme').then((saved) => {
      if (saved) setTheme(saved);
    });
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

  function handleThemeChange(newTheme) {
    setTheme(newTheme);
    saveConfig('theme', newTheme);
  }

  function handleOpenSet(code, name) {
    setOpenSets((current) => {
      const alreadyOpen = current.some((s) => s.code === code);
      const base = alreadyOpen ? current : [...current, { code, name, minimized: true }];
      return base.map((s) => {
        if (s.code === code) return { ...s, minimized: false };
        if (!s.minimized) return { ...s, minimized: true };
        return s;
      });
    });
    setRecentSets((current) => {
      const without = current.filter((s) => s.code !== code);
      const updated = [{ code, name }, ...without].slice(0, 3);
      saveConfig('recentSets', updated);
      return updated;
    });
  }

  function handleMinimize(code) {
    setOpenSets((current) => current.map((s) => (s.code === code ? { ...s, minimized: true } : s)));
  }

  function handleRestore(code) {
    setOpenSets((current) =>
      current.map((s) => {
        if (s.code === code) return { ...s, minimized: false };
        if (!s.minimized) return { ...s, minimized: true };
        return s;
      }),
    );
  }

  function handleClose(code) {
    setOpenSets((current) => current.filter((s) => s.code !== code));
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

  async function handleRefreshSet() {
    const active = openSets.find((s) => !s.minimized);
    await deleteCards(active.code);
    setOpenSets((current) =>
      current.map((s) =>
        s.code === active.code ? { ...s, refreshKey: (s.refreshKey ?? 0) + 1 } : s,
      ),
    );
  }

  const minimizedSets = (openSets ?? []).filter((s) => s.minimized);
  const activeSet = (openSets ?? []).find((s) => !s.minimized) ?? null;

  return (
    <div className={`app-root ${theme}`}>
      <MenuBar
        theme={theme}
        onThemeChange={handleThemeChange}
        recentSets={recentSets}
        onOpenSet={handleOpenSet}
        activeSet={activeSet}
        onRefreshSet={handleRefreshSet}
        onExportCsv={handleExportCsv}
        openSets={openSets ?? []}
        onAddCard={handleAddCard}
      />
      <div className="page-content">
        {(openSets ?? []).map((set) => (
          <SetTracker
            key={`${set.code}-${set.refreshKey ?? 0}`}
            setCode={set.code}
            setName={set.name}
            minimized={set.minimized}
            minimizedIndex={minimizedSets.findIndex((s) => s.code === set.code)}
            onMinimize={() => handleMinimize(set.code)}
            onRestore={() => handleRestore(set.code)}
            onClose={() => handleClose(set.code)}
            collectionVersion={collectionVersions[set.code] ?? 0}
            cardFocus={focusTarget?.setCode === set.code ? focusTarget : null}
          />
        ))}
      </div>
    </div>
  );
}
