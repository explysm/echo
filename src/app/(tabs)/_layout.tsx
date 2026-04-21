import React from 'react';
import { Tabs } from 'expo-router';
import { Music, Settings } from 'lucide-react-native';
import { View } from 'react-native';

import { getThemeColors } from '@/constants/Colors';
import { useAppSettings } from '@/context/AppSettingsContext';
import { TutorialProvider, useTutorial, TutorialView } from '@/components/TutorialOverlay';

function TabBarIcon({ color, name }: { color: string, name: string }) {
  if (name === 'settings') {
    return (
      <TutorialView targetKey="settings_tab">
        <Settings color={color} size={24} />
      </TutorialView>
    );
  }
  
  return name === 'index' ? <Music color={color} size={24} /> : null;
}

export default function TabLayout() {
  return (
    <TutorialProvider>
      <TabLayoutContent />
    </TutorialProvider>
  );
}

function TabLayoutContent() {
  const { colorScheme, accentKey, customTheme } = useAppSettings();
  const themeColors = getThemeColors(accentKey, customTheme);
  const theme = themeColors[colorScheme] || themeColors.light || themeColors.dark;

  if (!theme) return null; // Last resort safety

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
        },
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTintColor: theme.text,
        headerShown: true,
        animation: 'fade', // Add fade animation between tabs
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Editor',
          tabBarIcon: ({ color }) => <TabBarIcon color={color} name="index" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabBarIcon color={color} name="settings" />,
        }}
      />
    </Tabs>
  );
}
