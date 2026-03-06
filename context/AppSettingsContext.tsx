import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark' | 'system';

export const ACCENT_COLORS = {
  slate: '#0f172a',
  indigo: '#4f46e5',
  rose: '#e11d48',
  amber: '#d97706',
  emerald: '#059669',
  violet: '#7c3aed',
};

export type AccentKey = keyof typeof ACCENT_COLORS;

interface AppSettingsContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accentKey: AccentKey;
  setAccentKey: (key: AccentKey) => void;
  userAgent: string;
  setUserAgent: (ua: string) => void;
  pauseOnEnd: boolean;
  setPauseOnEnd: (value: boolean) => void;
  rewindAmount: number;
  setRewindAmount: (value: number) => void;
  colorScheme: 'light' | 'dark';
  isInitialized: boolean;
}

const STORAGE_KEYS = {
  THEME: '@echo_settings_theme',
  ACCENT: '@echo_settings_accent',
  USER_AGENT: '@echo_settings_user_agent',
  PAUSE_ON_END: '@echo_settings_pause_on_end',
  REWIND_AMOUNT: '@echo_settings_rewind_amount',
};

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useNativeColorScheme() ?? 'light';
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [theme, setThemeState] = useState<Theme>('system');
  const [accentKey, setAccentKeyState] = useState<AccentKey>('slate');
  const [userAgent, setUserAgentState] = useState('Echo Lyric Editor (https://github.com/sudoloser/echo)');
  const [pauseOnEnd, setPauseOnEndState] = useState(true);
  const [rewindAmount, setRewindAmountState] = useState(1.5);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedTheme, savedAccent, savedUA, savedPause, savedRewind] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.THEME),
          AsyncStorage.getItem(STORAGE_KEYS.ACCENT),
          AsyncStorage.getItem(STORAGE_KEYS.USER_AGENT),
          AsyncStorage.getItem(STORAGE_KEYS.PAUSE_ON_END),
          AsyncStorage.getItem(STORAGE_KEYS.REWIND_AMOUNT),
        ]);

        if (savedTheme) setThemeState(savedTheme as Theme);
        if (savedAccent) setAccentKeyState(savedAccent as AccentKey);
        if (savedUA) setUserAgentState(savedUA);
        if (savedPause) setPauseOnEndState(savedPause === 'true');
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

  // Persistent Setters
  const setTheme = async (value: Theme) => {
    setThemeState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, value);
  };

  const setAccentKey = async (value: AccentKey) => {
    setAccentKeyState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.ACCENT, value);
  };

  const setUserAgent = async (value: string) => {
    setUserAgentState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.USER_AGENT, value);
  };

  const setPauseOnEnd = async (value: boolean) => {
    setPauseOnEndState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.PAUSE_ON_END, value.toString());
  };

  const setRewindAmount = async (value: number) => {
    setRewindAmountState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.REWIND_AMOUNT, value.toString());
  };

  const colorScheme = theme === 'system' ? systemColorScheme : theme;

  return (
    <AppSettingsContext.Provider 
      value={{ 
        theme, 
        setTheme, 
        accentKey,
        setAccentKey,
        userAgent, 
        setUserAgent, 
        pauseOnEnd, 
        setPauseOnEnd, 
        rewindAmount,
        setRewindAmount,
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
