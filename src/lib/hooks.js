import { useEffect, useRef, useState } from 'react';

export function useEscapeToClose(onClose) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
}
import { loadConfig, saveConfig } from './storage.js';

export function useDebouncedSearch(delay = 150) {
  const [displayValue, setDisplayValue] = useState('');
  const [committedValue, setCommittedValue] = useState('');
  const deletePendingRef = useRef(false);
  const charsAfterDeleteRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function onChange(newText) {
    const isAddition = newText.length > displayValue.length;
    if (!isAddition) {
      deletePendingRef.current = true;
      charsAfterDeleteRef.current = 0;
    } else if (deletePendingRef.current) {
      charsAfterDeleteRef.current += 1;
    }
    setDisplayValue(newText);
    clearTimeout(timerRef.current);
    if (deletePendingRef.current && charsAfterDeleteRef.current >= 2) {
      deletePendingRef.current = false;
      charsAfterDeleteRef.current = 0;
      setCommittedValue(newText);
    } else {
      timerRef.current = setTimeout(() => {
        deletePendingRef.current = false;
        setCommittedValue(newText);
      }, delay);
    }
  }

  function commit() {
    clearTimeout(timerRef.current);
    deletePendingRef.current = false;
    charsAfterDeleteRef.current = 0;
    setCommittedValue(displayValue);
  }

  return { displayValue, onChange, committedValue, commit };
}

export function usePersistedConfig(key, defaultValue) {
  const [loaded, setLoaded] = useState(null);
  const userSetRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    userSetRef.current = false;
    loadConfig(key).then((saved) => {
      if (!cancelled && !userSetRef.current) setLoaded(saved ?? defaultValue);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (loaded === null) return;
    saveConfig(key, loaded);
  }, [key, loaded]);

  function setValue(v) {
    userSetRef.current = true;
    if (typeof v === 'function') {
      setLoaded((current) => v(current ?? defaultValue));
    } else {
      setLoaded(v);
    }
  }

  return [loaded ?? defaultValue, setValue];
}
