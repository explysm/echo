import { ACCENT_COLORS, AccentKey, CustomTheme } from '@/constants/Theme';

export const getThemeColors = (accentKey: AccentKey = 'slate', customTheme?: CustomTheme) => {
  if (accentKey === 'custom' && customTheme) {
    // Ensure colors are 6-digit hex before appending alpha
    const safeSecondary = customTheme.secondaryText?.slice(0, 7) || '#666666';
    const safeTint = customTheme.tint?.slice(0, 7) || '#0f172a';
    const safeText = customTheme.text?.slice(0, 7) || '#000000';
    const safeBackground = customTheme.background?.slice(0, 7) || '#ffffff';

    const themeColors = {
      text: safeText,
      background: safeBackground,
      tint: safeTint,
      tabIconDefault: safeSecondary,
      tabIconSelected: safeTint,
      border: safeSecondary + '33', // 20% opacity
      secondaryText: safeSecondary,
    };
    return {
      light: themeColors,
      dark: themeColors,
    };
  }

  const tintColor = ACCENT_COLORS[accentKey as keyof typeof ACCENT_COLORS] || ACCENT_COLORS.slate;
  
  return {
    light: {
      text: '#0f172a',
      background: '#ffffff',
      tint: tintColor,
      tabIconDefault: '#94a3b8',
      tabIconSelected: tintColor,
      border: '#e2e8f0', // Slate 200
      secondaryText: '#64748b', // Slate 500
    },
    dark: {
      text: '#f8fafc',
      background: '#020617', // Slate 950
      tint: accentKey === 'slate' ? '#f8fafc' : tintColor,
      tabIconDefault: '#475569',
      tabIconSelected: accentKey === 'slate' ? '#f8fafc' : tintColor,
      border: '#1e293b', // Slate 800
      secondaryText: '#94a3b8', // Slate 400
    },
  };
};
