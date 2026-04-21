import { PRESET_PALETTES } from './Palettes';

export const ACCENT_COLORS = {
  purple: '#7b2cbf',
  deep: '#3c096c',
  lavender: '#c77dff',
  electric: '#9d4edd',
  lilac: '#e0aaff',
  rose: '#e11d48',
  amber: '#d97706',
  emerald: '#059669',
};

export type AccentKey = keyof typeof ACCENT_COLORS | keyof typeof PRESET_PALETTES | 'custom';

export interface CustomTheme {
  background: string;
  text: string;
  secondaryText: string;
  tint: string;
}
