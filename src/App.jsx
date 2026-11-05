import { useEffect, useState } from 'react';
import { SET_CODE, SET_NAME } from './config.js';
import MenuBar from './components/MenuBar.jsx';
import SetTracker from './components/SetTracker.jsx';
import { loadConfig, saveConfig } from './lib/storage.js';

export default function App() {
  const [theme, setTheme] = useState('light');
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
    setRecentSets((current) => {
      const without = current.filter((s) => s.code !== code);
      const updated = [{ code, name }, ...without].slice(0, 3);
      saveConfig('recentSets', updated);
      return updated;
    });
  }

  return (
    <div className={`app-root ${theme}`}>
      <MenuBar
        theme={theme}
        onThemeChange={handleThemeChange}
        recentSets={recentSets}
        onOpenSet={handleOpenSet}
      />
      <div className="page-content">
        <SetTracker setCode={SET_CODE} setName={SET_NAME} />
      </div>
    </div>
  );
}
