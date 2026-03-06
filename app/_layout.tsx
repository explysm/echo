import 'react-native-reanimated';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { AppSettingsProvider, useAppSettings } from '@/context/AppSettingsContext';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  return (
    <AppSettingsProvider>
      <RootLayoutContent fontsLoaded={fontsLoaded} />
    </AppSettingsProvider>
  );
}

function RootLayoutContent({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { isInitialized } = useAppSettings();

  useEffect(() => {
    // Check for Remote JS Bundle Update
    const checkRemoteUpdate = async () => {
      if (Platform.OS === 'web' || !isInitialized) return;
      try {
        const BUNDLE_URL = 'https://sudoloser.github.io/echo/echo.js';
        const response = await fetch(BUNDLE_URL, { method: 'HEAD' });
        const lastModified = response.headers.get('last-modified');
        
        if (lastModified) {
          const storedDate = await AsyncStorage.getItem('@echo_bundle_last_modified');
          if (storedDate && storedDate !== lastModified) {
            Alert.alert(
              'Update Available',
              'A new version of the app logic is available. Please restart the app to apply.',
              [{ text: 'Got it', style: 'default' }]
            );
          }
          await AsyncStorage.setItem('@echo_bundle_last_modified', lastModified);
        }
      } catch (e) {
        // Silent fail
      }
    };

    // Native Module Check (Safety for hot-reloading JS)
    if (Platform.OS === 'android' && isInitialized) {
      const missingModules = [];
      
      // Check for native modules
      if (!Haptics || typeof Haptics.notificationAsync !== 'function') {
        missingModules.push('Haptics');
      }
      
      if (!GestureHandlerRootView) {
        missingModules.push('GestureHandler');
      }

      if (missingModules.length > 0) {
        Alert.alert(
          'Native Components Missing',
          `Your installed app version is missing native components (${missingModules.join(', ')}). Please update to the latest version for full functionality.`,
          [
            { 
              text: 'Download Latest', 
              onPress: () => Linking.openURL('https://github.com/explysm/echo/releases') 
            },
            { text: 'Later', style: 'cancel' }
          ],
          { cancelable: true }
        );
      }
    }

    if (fontsLoaded && isInitialized) {
      SplashScreen.hideAsync();
      checkRemoteUpdate();
    }
  }, [fontsLoaded, isInitialized]);

  if (!fontsLoaded || !isInitialized) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const { colorScheme } = useAppSettings();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
