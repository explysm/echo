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
import * as Updates from 'expo-updates';

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
    // Check for OTA Updates (expo-updates)
    const checkRemoteUpdate = async () => {
      if (__DEV__ || Platform.OS === 'web' || !isInitialized) return;
      
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            'Update Available',
            'A new version of Echo is available. Restart the app now to apply the update?',
            [
              { text: 'Later', style: 'cancel' },
              { 
                text: 'Restart', 
                style: 'default',
                onPress: async () => {
                  await Updates.reloadAsync();
                }
              }
            ]
          );
        }
      } catch (e) {
        // Silent fail for update checks
        console.log('Update check failed:', e);
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
