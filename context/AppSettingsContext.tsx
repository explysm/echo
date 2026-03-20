import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccentKey, CustomTheme } from '@/constants/Theme';

type Theme = 'light' | 'dark' | 'system';

interface AppSettingsContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accentKey: AccentKey;
  setAccentKey: (key: AccentKey) => void;
  customTheme: CustomTheme;
  setCustomTheme: (theme: CustomTheme) => void;
  pauseOnEnd: boolean;
  setPauseOnEnd: (value: boolean) => void;
  rewindAmount: number;
  setRewindAmount: (value: number) => void;
  enableFancyAnimations: boolean;
  setEnableFancyAnimations: (value: boolean) => void;
  hasCompletedTutorial: boolean;
  setHasCompletedTutorial: (value: boolean) => void;
  alwaysShowTutorial: boolean;
  setAlwaysShowTutorial: (value: boolean) => void;
  desktopMode: boolean;
  setDesktopMode: (value: boolean) => void;
  colorScheme: 'light' | 'dark';
  isInitialized: boolean;
}

const STORAGE_KEYS = {
  THEME: '@echo_settings_theme',
  ACCENT: '@echo_settings_accent',
  PAUSE_ON_END: '@echo_settings_pause_on_end',
  REWIND_AMOUNT: '@echo_settings_rewind_amount',
  CUSTOM_THEME: '@echo_settings_custom_theme',
  FANCY_ANIMATIONS: '@echo_settings_fancy_animations',
  HAS_COMPLETED_TUTORIAL: '@echo_settings_has_completed_tutorial',
  ALWAYS_SHOW_TUTORIAL: '@echo_settings_always_show_tutorial',
  DESKTOP_MODE: '@echo_settings_desktop_mode',
};

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useNativeColorScheme() ?? 'light';
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [theme, setThemeState] = useState<Theme>('system');
  const [accentKey, setAccentKeyState] = useState<AccentKey>('slate');
  const [customTheme, setCustomThemeState] = useState<CustomTheme>({
    background: '#ffffff',
    text: '#000000',
    secondaryText: '#666666',
    tint: '#0f172a',
  });
  const [pauseOnEnd, setPauseOnEndState] = useState(true);
  const [rewindAmount, setRewindAmountState] = useState(1.5);
  const [enableFancyAnimations, setEnableFancyAnimationsState] = useState(false);
  const [hasCompletedTutorial, setHasCompletedTutorialState] = useState(false);
  const [alwaysShowTutorial, setAlwaysShowTutorialState] = useState(false);
  const [desktopMode, setDesktopModeState] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [
          savedTheme, 
          savedAccent, 
          savedPause, 
          savedRewind, 
          savedCustomTheme,
          savedFancy,
          savedHasCompletedTutorial,
          savedAlwaysShowTutorial,
          savedDesktopMode
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.THEME),
          AsyncStorage.getItem(STORAGE_KEYS.ACCENT),
          AsyncStorage.getItem(STORAGE_KEYS.PAUSE_ON_END),
          AsyncStorage.getItem(STORAGE_KEYS.REWIND_AMOUNT),
          AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_THEME),
          AsyncStorage.getItem(STORAGE_KEYS.FANCY_ANIMATIONS),
          AsyncStorage.getItem(STORAGE_KEYS.HAS_COMPLETED_TUTORIAL),
          AsyncStorage.getItem(STORAGE_KEYS.ALWAYS_SHOW_TUTORIAL),
          AsyncStorage.getItem(STORAGE_KEYS.DESKTOP_MODE),
        ]);

        if (savedTheme) setThemeState(savedTheme as Theme);
        if (savedAccent) setAccentKeyState(savedAccent as AccentKey);
        if (savedPause) setPauseOnEndState(savedPause === 'true');
        if (savedCustomTheme) setCustomThemeState(JSON.parse(savedCustomTheme));
        if (savedFancy) setEnableFancyAnimationsState(savedFancy === 'true');
        if (savedHasCompletedTutorial) setHasCompletedTutorialState(savedHasCompletedTutorial === 'true');
        if (savedAlwaysShowTutorial) setAlwaysShowTutorialState(savedAlwaysShowTutorial === 'true');
        if (savedDesktopMode) setDesktopModeState(savedDesktopMode === 'true');
        if (savedRewind) {
          const val = parseFloat(savedRewind);
          if (!isNaN(val)) setRewindAmountState(val);
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setIsInitialized(true);
      }
    };

    loadSettings();
  }, []);

  const setTheme = async (value: Theme) => {
    setThemeState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, value);
  };

  const setAccentKey = async (value: AccentKey) => {
    setAccentKeyState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.ACCENT, value);
  };

  const setCustomTheme = async (value: CustomTheme) => {
    setCustomThemeState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_THEME, JSON.stringify(value));
  };

  const setPauseOnEnd = async (value: boolean) => {
    setPauseOnEndState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.PAUSE_ON_END, value.toString());
  };

  const setRewindAmount = async (value: number) => {
    setRewindAmountState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.REWIND_AMOUNT, value.toString());
  };

  const setEnableFancyAnimations = async (value: boolean) => {
    setEnableFancyAnimationsState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.FANCY_ANIMATIONS, value.toString());
  };

  const setHasCompletedTutorial = async (value: boolean) => {
    setHasCompletedTutorialState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.HAS_COMPLETED_TUTORIAL, value.toString());
  };

  const setAlwaysShowTutorial = async (value: boolean) => {
    setAlwaysShowTutorialState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.ALWAYS_SHOW_TUTORIAL, value.toString());
  };

  const setDesktopMode = async (value: boolean) => {
    setDesktopModeState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.DESKTOP_MODE, value.toString());
  };

  const colorScheme = theme === 'system' ? systemColorScheme : theme;

  return (
    <AppSettingsContext.Provider 
      value={{ 
        theme, 
        setTheme, 
        accentKey,
        setAccentKey,
        customTheme,
        setCustomTheme,
        pauseOnEnd, 
        setPauseOnEnd, 
        rewindAmount,
        setRewindAmount,
        enableFancyAnimations,
        setEnableFancyAnimations,
        hasCompletedTutorial,
        setHasCompletedTutorial,
        alwaysShowTutorial,
        setAlwaysShowTutorial,
        desktopMode,
        setDesktopMode,
        colorScheme,
        isInitialized
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
}
