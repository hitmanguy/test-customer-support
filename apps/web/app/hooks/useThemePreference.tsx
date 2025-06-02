'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  isDarkMode: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

export const useThemePreference = () => useContext(ThemeContext);

export const ThemePreferenceProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>('system');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Initialize from localStorage and system preference on mount
  useEffect(() => {
    setIsClient(true);
    
    if (typeof window !== 'undefined') {
      // Get stored theme preference
      const storedTheme = localStorage.getItem('theme') as Theme | null;
      
      if (storedTheme) {
        setThemeState(storedTheme);
      }
      
      // Determine initial dark mode state
      updateDarkMode(storedTheme || 'system');
    }
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    if (!isClient) return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        setIsDarkMode(mediaQuery.matches);
        updateDocumentClass(mediaQuery.matches);
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, isClient]);

  // Update dark mode status based on theme
  const updateDarkMode = (newTheme: Theme) => {
    if (newTheme === 'dark') {
      setIsDarkMode(true);
      updateDocumentClass(true);
    } else if (newTheme === 'light') {
      setIsDarkMode(false);
      updateDocumentClass(false);
    } else {
      // System preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(isDark);
      updateDocumentClass(isDark);
    }
  };

  // Update document class for CSS variables
  const updateDocumentClass = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  };

  // Set theme with persistence
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
      updateDarkMode(newTheme);
    }
  };

  // Toggle between light and dark (respecting system if that was the preference)
  const toggleTheme = () => {
    if (theme === 'system') {
      setTheme(isDarkMode ? 'light' : 'dark');
    } else {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };

  // Don't render anything during SSR to avoid hydration issues
  if (!isClient) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDarkMode,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
