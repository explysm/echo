import { ACCENT_COLORS, AccentKey, CustomTheme } from '@/constants/Theme';

/**
 * Generates the theme color palette based on the selected accent and custom theme settings.
 */
export const getThemeColors = (accentKey: AccentKey = 'purple', customTheme?: CustomTheme) => {
  // Determine the primary tint color
  const tintColor = (accentKey === 'custom' && customTheme) 
    ? customTheme.tint?.slice(0, 7) 
    : (ACCENT_COLORS[accentKey as keyof typeof ACCENT_COLORS] || ACCENT_COLORS.purple);

  // Check if we are using a "Full Custom Theme" (background/text modified) 
  // or just a "Custom Accent" (only tint modified, or defaults preserved).
  const isFullCustom = accentKey === 'custom' && customTheme && (
    (customTheme.background && customTheme.background !== '#ffffff' && customTheme.background !== '#10002b') || 
    (customTheme.text && customTheme.text !== '#000000' && customTheme.text !== '#e0aaff')
  );

  if (isFullCustom && customTheme) {
    const safeSecondary = customTheme.secondaryText?.slice(0, 7) || '#9d4edd';
    const safeTint = customTheme.tint?.slice(0, 7) || '#7b2cbf';
    const safeText = customTheme.text?.slice(0, 7) || '#e0aaff';
    const safeBackground = customTheme.background?.slice(0, 7) || '#10002b';

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

  // Standard themes with dynamic accent support
  return {
    light: {
      text: '#10002b',
      background: '#ffffff',
      tint: tintColor,
      tabIconDefault: '#9d4edd',
      tabIconSelected: tintColor,
      border: '#e0aaff66',
      secondaryText: '#5a189a',
    },
    dark: {
      text: '#e0aaff',
      background: '#10002b', // Midnight Purple
      tint: tintColor,
      tabIconDefault: '#5a189a',
      tabIconSelected: tintColor,
      border: '#240046', // Deep Purple Border
      secondaryText: '#9d4edd', // Lavender
    },
  };
};
