'use client';

import { FONT_STACKS } from '@/lib/theme/fonts';
import type { FontFamily, ThemeColors, ThemeConfig } from '@/lib/theme/storage';
import { resetTheme as clearTheme, DEFAULT_THEME, getTheme, setTheme as saveTheme } from '@/lib/theme/storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextValue {
  colors: ThemeColors;
  font: FontFamily;
  isNightMode: boolean;
  setColors: (colors: ThemeColors) => void;
  setFont: (font: FontFamily) => void;
  toggleNightMode: () => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const NIGHT_MODE_STORAGE_KEY = 'facily-night-mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeConfig>(DEFAULT_THEME);
  const [isNightMode, setIsNightMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    setThemeState(getTheme());

    try {
      const storedNightMode = window.localStorage.getItem(NIGHT_MODE_STORAGE_KEY);
      setIsNightMode(storedNightMode === 'true');
    } catch {
      setIsNightMode(false);
    }

    setMounted(true);
  }, []);

  // Apply theme to document root whenever it changes
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    // Apply color custom properties
    root.style.setProperty('--color-background', theme.colors.background);
    root.style.setProperty('--color-foreground', theme.colors.foreground);
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-accent', theme.colors.accent);

    // Apply font family
    root.style.setProperty('--font-family', FONT_STACKS[theme.font]);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;

    // Apply .dark to <html> for Tailwind and CSS variable compatibility
    const html = document.documentElement;
    if (isNightMode) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }

    try {
      window.localStorage.setItem(NIGHT_MODE_STORAGE_KEY, String(isNightMode));
    } catch {
      // ignore localStorage write failures
    }
  }, [isNightMode, mounted]);

  const setColors = (colors: ThemeColors) => {
    const newTheme = { ...theme, colors };
    setThemeState(newTheme);
    saveTheme(newTheme);
  };

  const setFont = (font: FontFamily) => {
    const newTheme = { ...theme, font };
    setThemeState(newTheme);
    saveTheme(newTheme);
  };

  const toggleNightMode = () => {
    setIsNightMode((prev) => !prev);
  };

  const resetTheme = () => {
    setThemeState(DEFAULT_THEME);
    clearTheme();
    setIsNightMode(false);
    try {
      window.localStorage.removeItem(NIGHT_MODE_STORAGE_KEY);
    } catch {
      // ignore localStorage failures
    }
  };

  return (
    <ThemeContext.Provider value={{ colors: theme.colors, font: theme.font, isNightMode, setColors, setFont, toggleNightMode, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
