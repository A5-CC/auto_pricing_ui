/**
 * Theme storage utilities for localStorage persistence
 */

import type { FontFamily } from './fonts';

export interface ThemeColors {
  background: string;
  foreground: string;
  primary: string;
  accent: string;
}

export type { FontFamily };

export interface ThemeConfig {
  colors: ThemeColors;
  font: FontFamily;
}

const THEME_STORAGE_KEY = 'facily-theme';

export const DEFAULT_THEME: ThemeConfig = {
  colors: {
    background: 'rgb(247, 246, 249)',
    foreground: 'rgb(17, 24, 39)',
    primary: 'rgb(113, 38, 217)',
    accent: 'rgb(233, 222, 247)',
  },
  font: 'sans',
};

/**
 * Get theme from localStorage or return default
 */
export function getTheme(): ThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (!stored) return DEFAULT_THEME;
    
    const parsed = JSON.parse(stored);
    return {
      colors: { ...DEFAULT_THEME.colors, ...parsed.colors },
      font: parsed.font || DEFAULT_THEME.font,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Save theme to localStorage
 */
export function setTheme(theme: ThemeConfig): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch (error) {
    console.error('Failed to save theme to localStorage:', error);
  }
}

/**
 * Reset theme to defaults
 */
export function resetTheme(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to reset theme:', error);
  }
}
