import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cad_theme';

function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  // Default to dark - the app's primary "control room" identity - rather
  // than following the OS preference, since this is a shared/kiosk-style
  // tool as often as a personal device, and a consistent default is less
  // surprising than one that silently varies by whoever's logged in.
  return 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  return { theme, toggleTheme };
}
