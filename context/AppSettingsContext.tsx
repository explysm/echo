import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACCENT_COLORS, AccentKey, CustomTheme } from '@/constants/Theme';

type Theme = 'light' | 'dark' | 'system';

interface AppSettingsContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accentKey: AccentKey;
  setAccentKey: (key: AccentKey) => void;
  customTheme: CustomTheme;
  setCustomTheme: (theme: CustomTheme) => void;
  userAgent: string;
  setUserAgent: (ua: string) => void;
  pauseOnEnd: boolean;
  setPauseOnEnd: (value: boolean) => void;
  rewindAmount: number;
  setRewindAmount: (value: number) => void;
  solverUrl: string;
  setSolverUrl: (url: string) => void;
  solverKey: string;
  setSolverKey: (key: string) => void;
  useRemoteSolver: boolean;
  setUseRemoteSolver: (value: boolean) => void;
  colorScheme: 'light' | 'dark';
  isInitialized: boolean;
}

const STORAGE_KEYS = {
  THEME: '@echo_settings_theme',
  ACCENT: '@echo_settings_accent',
  USER_AGENT: '@echo_settings_user_agent',
  PAUSE_ON_END: '@echo_settings_pause_on_end',
  REWIND_AMOUNT: '@echo_settings_rewind_amount',
  SOLVER_URL: '@echo_settings_solver_url',
  SOLVER_KEY: '@echo_settings_solver_key',
  USE_REMOTE_SOLVER: '@echo_settings_use_remote_solver',
  CUSTOM_THEME: '@echo_settings_custom_theme',
};

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

const DEFAULT_SOLVER_URL = String(process.env.EXPO_PUBLIC_SOLVER_URL || '');
const DEFAULT_SOLVER_KEY = String(process.env.EXPO_PUBLIC_SOLVER_KEY || '');

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
  const [userAgent, setUserAgentState] = useState('Echo Lyric Editor (https://github.com/sudoloser/echo)');
  const [pauseOnEnd, setPauseOnEndState] = useState(true);
  const [rewindAmount, setRewindAmountState] = useState(1.5);
  const [solverUrl, setSolverUrlState] = useState(DEFAULT_SOLVER_URL);
  const [solverKey, setSolverKeyState] = useState(DEFAULT_SOLVER_KEY);
  const [useRemoteSolver, setUseRemoteSolverState] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [
          savedTheme, 
          savedAccent, 
          savedUA, 
          savedPause, 
          savedRewind, 
          savedSolver, 
          savedKey,
          savedUseRemote,
          savedCustomTheme
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.THEME),
          AsyncStorage.getItem(STORAGE_KEYS.ACCENT),
          AsyncStorage.getItem(STORAGE_KEYS.USER_AGENT),
          AsyncStorage.getItem(STORAGE_KEYS.PAUSE_ON_END),
          AsyncStorage.getItem(STORAGE_KEYS.REWIND_AMOUNT),
          AsyncStorage.getItem(STORAGE_KEYS.SOLVER_URL),
          AsyncStorage.getItem(STORAGE_KEYS.SOLVER_KEY),
          AsyncStorage.getItem(STORAGE_KEYS.USE_REMOTE_SOLVER),
          AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_THEME),
        ]);

        if (savedTheme) setThemeState(savedTheme as Theme);
        if (savedAccent) setAccentKeyState(savedAccent as AccentKey);
        if (savedUA) setUserAgentState(savedUA);
        if (savedPause) setPauseOnEndState(savedPause === 'true');
        if (savedSolver) setSolverUrlState(savedSolver);
        if (savedKey) setSolverKeyState(savedKey);
        if (savedUseRemote) setUseRemoteSolverState(savedUseRemote === 'true');
        if (savedCustomTheme) setCustomThemeState(JSON.parse(savedCustomTheme));
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

  const setSolverUrl = async (value: string) => {
    setSolverUrlState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.SOLVER_URL, value);
  };

  const setSolverKey = async (value: string) => {
    setSolverKeyState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.SOLVER_KEY, value);
  };

  const setUseRemoteSolver = async (value: boolean) => {
    setUseRemoteSolverState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.USE_REMOTE_SOLVER, value.toString());
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
        userAgent, 
        setUserAgent, 
        pauseOnEnd, 
        setPauseOnEnd, 
        rewindAmount,
        setRewindAmount,
        solverUrl,
        setSolverUrl,
        solverKey,
        setSolverKey,
        useRemoteSolver,
        setUseRemoteSolver,
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
