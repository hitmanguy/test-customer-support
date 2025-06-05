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

  
  useEffect(() => {
    setIsClient(true);
    
    if (typeof window !== 'undefined') {
      
      const storedTheme = localStorage.getItem('theme') as Theme | null;
      
      if (storedTheme) {
        setThemeState(storedTheme);
      }
      
      
      updateDarkMode(storedTheme || 'system');
    }
  }, []);

  
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

  
  const updateDarkMode = (newTheme: Theme) => {
    if (newTheme === 'dark') {
      setIsDarkMode(true);
      updateDocumentClass(true);
    } else if (newTheme === 'light') {
      setIsDarkMode(false);
      updateDocumentClass(false);
    } else {
      
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(isDark);
      updateDocumentClass(isDark);
    }
  };

  
  const updateDocumentClass = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  };

  
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
      updateDarkMode(newTheme);
    }
  };

  
  const toggleTheme = () => {
    if (theme === 'system') {
      setTheme(isDarkMode ? 'light' : 'dark');
    } else {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };

  
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
