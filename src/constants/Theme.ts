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

export const PRESET_PALETTES = {
  // Dark Palettes
  midnight: { background: '#0a0e27', text: '#e2e8f0', secondaryText: '#a78bfa', tint: '#6c8eff' },
  obsidian: { background: '#0f0f0f', text: '#f5f5f5', secondaryText: '#00a3cc', tint: '#00d4aa' },
  slate: { background: '#0f172a', text: '#f1f5f9', secondaryText: '#818cf8', tint: '#38bdf8' },
  carbon: { background: '#121212', text: '#e1e1e1', secondaryText: '#03dac6', tint: '#bb86fc' },
  ocean: { background: '#001e3c', text: '#eceff1', secondaryText: '#29b6f6', tint: '#4fc3f7' },
  charcoal: { background: '#1c1c1e', text: '#f2f2f7', secondaryText: '#5e5ce6', tint: '#0a84ff' },
  graphite: { background: '#18181b', text: '#fafafa', secondaryText: '#ec4899', tint: '#a855f7' },
  void: { background: '#0d1117', text: '#c9d1d9', secondaryText: '#79c0ff', tint: '#58a6ff' },
  twilight: { background: '#1a1625', text: '#dcd7e8', secondaryText: '#7aa2f7', tint: '#9d7cd8' },
  matrix: { background: '#0e0e10', text: '#f0f0f0', secondaryText: '#00e0ff', tint: '#00ff9f' },
  // Light Palettes
  cloud: { background: '#fafafa', text: '#0f172a', secondaryText: '#7c3aed', tint: '#2563eb' },
  pearl: { background: '#f8f9fa', text: '#212529', secondaryText: '#6610f2', tint: '#0066cc' },
  ivory: { background: '#f5f5f4', text: '#1c1917', secondaryText: '#06b6d4', tint: '#0891b2' },
  linen: { background: '#fef7f0', text: '#292524', secondaryText: '#ea580c', tint: '#d97706' },
  porcelain: { background: '#f9fafb', text: '#111827', secondaryText: '#8b5cf6', tint: '#4f46e5' },
  cream: { background: '#fefce8', text: '#365314', secondaryText: '#84cc16', tint: '#65a30d' },
  arctic: { background: '#f0f9ff', text: '#0c4a6e', secondaryText: '#0ea5e9', tint: '#0284c7' },
  alabaster: { background: '#fcfcfc', text: '#1e293b', secondaryText: '#2563eb', tint: '#1d4ed8' },
  sand: { background: '#faf8f5', text: '#451a03', secondaryText: '#d97706', tint: '#b45309' },
  frost: { background: '#f1f5f9', text: '#0f172a', secondaryText: '#14b8a6', tint: '#0f766e' },
};

export type AccentKey = keyof typeof ACCENT_COLORS | keyof typeof PRESET_PALETTES | 'custom';

export interface CustomTheme {
  background: string;
  text: string;
  secondaryText: string;
  tint: string;
}
