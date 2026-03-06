import React from 'react';
import { Tabs } from 'expo-router';
import { Music, Settings } from 'lucide-react-native';

import Colors from '@/constants/Colors';
import { useAppSettings } from '@/context/AppSettingsContext';

export default function TabLayout() {
  const { colorScheme, accentKey } = useAppSettings();
  const theme = Colors(accentKey)[colorScheme];

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
          tabBarIcon: ({ color }) => <Music color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
