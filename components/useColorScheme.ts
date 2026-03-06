import { useAppSettings } from '@/context/AppSettingsContext';
import { useColorScheme as useNativeColorScheme } from 'react-native';

export const useColorScheme = () => {
  const native = useNativeColorScheme() ?? 'light';
  try {
    const { colorScheme } = useAppSettings();
    return colorScheme;
  } catch (e) {
    // Context might not be available yet in some cases
    return native === 'unspecified' ? 'light' : native;
  }
};
