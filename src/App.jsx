import { useEffect, useState } from 'react';
import MenuBar from './components/MenuBar.jsx';
import SetTracker from './components/SetTracker.jsx';
import { loadConfig, saveConfig } from './lib/storage.js';

export default function App() {
  const [theme, setTheme] = useState('light');
  const [openSets, setOpenSets] = useState([{ code: 'ktk', name: 'Khans of Tarkir', minimized: false }]);
  const [recentSets, setRecentSets] = useState([{ code: 'ktk', name: 'Khans of Tarkir' }]);

  useEffect(() => {
    loadConfig('theme').then((saved) => {
      if (saved) setTheme(saved);
    });
    loadConfig('recentSets').then((saved) => {
      if (saved) setRecentSets(saved);
    });
  }, []);

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

  const minimizedSets = openSets.filter((s) => s.minimized);

  return (
    <div className={`app-root ${theme}`}>
      <MenuBar
        theme={theme}
        onThemeChange={handleThemeChange}
        recentSets={recentSets}
        onOpenSet={handleOpenSet}
      />
      <div className="page-content">
        {openSets.map((set) => (
          <SetTracker
            key={set.code}
            setCode={set.code}
            setName={set.name}
            minimized={set.minimized}
            minimizedIndex={minimizedSets.findIndex((s) => s.code === set.code)}
            onMinimize={() => handleMinimize(set.code)}
            onRestore={() => handleRestore(set.code)}
            onClose={() => handleClose(set.code)}
          />
        ))}
      </div>
    </div>
  );
}
