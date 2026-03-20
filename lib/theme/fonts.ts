/**
 * System font stack definitions
 */

export type FontFamily = 'sans' | 'serif' | 'mono';

export const FONT_STACKS: Record<FontFamily, string> = {
  sans: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`,
  serif: `Georgia, Cambria, "Times New Roman", Times, serif`,
  mono: `"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace`,
};

export const FONT_LABELS: Record<FontFamily, string> = {
  sans: 'Sans Serif',
  serif: 'Serif',
  mono: 'Monospace',
};
