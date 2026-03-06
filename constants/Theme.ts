export const ACCENT_COLORS = {
  slate: '#0f172a',
  indigo: '#4f46e5',
  rose: '#e11d48',
  amber: '#d97706',
  emerald: '#059669',
  violet: '#7c3aed',
};

export type AccentKey = keyof typeof ACCENT_COLORS | 'custom';

export interface CustomTheme {
  background: string;
  text: string;
  secondaryText: string;
  tint: string;
}
