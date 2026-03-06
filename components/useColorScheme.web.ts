import { useAppSettings } from '@/context/AppSettingsContext';

export const useColorScheme = () => {
  try {
    const { colorScheme } = useAppSettings();
    return colorScheme;
  } catch (e) {
    return 'light';
  }
};
