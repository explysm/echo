import React from 'react';
import { StyleSheet, TouchableOpacity, TextInput, Switch } from 'react-native';
import { Moon, Sun, Monitor, Clock } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

import { Text, View, ScrollView, useTheme } from '@/components/Themed';
import { useAppSettings, ACCENT_COLORS, AccentKey } from '@/context/AppSettingsContext';

export default function SettingsScreen() {
  const { 
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
    colorScheme 
  } = useAppSettings();
  const themeColors = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.themeRow}>
          <ThemeButton
            label="Light"
            active={theme === 'light'}
            onPress={() => setTheme('light')}
            icon={<Sun size={20} color={theme === 'light' ? themeColors.background : themeColors.tint} />}
            themeColors={themeColors}
          />
          <ThemeButton
            label="Dark"
            active={theme === 'dark'}
            onPress={() => setTheme('dark')}
            icon={<Moon size={20} color={theme === 'dark' ? themeColors.background : themeColors.tint} />}
            themeColors={themeColors}
          />
          <ThemeButton
            label="System"
            active={theme === 'system'}
            onPress={() => setTheme('system')}
            icon={<Monitor size={20} color={theme === 'system' ? themeColors.background : themeColors.tint} />}
            themeColors={themeColors}
          />
        </View>

        <Text style={[styles.label, { marginTop: 20, color: themeColors.secondaryText }]}>Accent Color</Text>
        <View style={styles.accentRow}>
          {(Object.keys(ACCENT_COLORS) as AccentKey[]).map((key) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.accentButton,
                { backgroundColor: ACCENT_COLORS[key] },
                accentKey === key && { borderColor: themeColors.text, borderWidth: 3 }
              ]}
              onPress={() => setAccentKey(key)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync Editor</Text>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Text style={styles.settingLabel}>Pause on line end</Text>
            <Text style={[styles.hint, { color: themeColors.secondaryText, marginTop: 4 }]}>
              Automatically pause playback when you finish syncing a lyric line.
            </Text>
          </View>
          <Switch
            value={pauseOnEnd}
            onValueChange={setPauseOnEnd}
            trackColor={{ false: themeColors.border, true: themeColors.tint }}
            thumbColor="#fff"
          />
        </View>

        {pauseOnEnd && (
          <View style={[styles.settingRow, { marginTop: 20 }]}>
            <View style={{ flex: 1, backgroundColor: 'transparent' }}>
              <Text style={styles.settingLabel}>Rewind on pause (s)</Text>
              <Text style={[styles.hint, { color: themeColors.secondaryText, marginTop: 4 }]}>
                Jump back by this many seconds to compensate for delay.
              </Text>
            </View>
            <TextInput
              style={[
                styles.smallInput,
                { 
                  color: themeColors.text, 
                  borderColor: themeColors.border,
                  backgroundColor: themeColors.background 
                }
              ]}
              value={rewindAmount.toString()}
              onChangeText={(text) => {
                const val = parseFloat(text);
                if (!isNaN(val)) setRewindAmount(val);
                else if (text === '') setRewindAmount(0);
              }}
              keyboardType="numeric"
              maxLength={4}
            />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>LRCLIB Configuration</Text>
        <Text style={[styles.label, { color: themeColors.secondaryText }]}>User-Agent</Text>
        <TextInput
          style={[
            styles.input, 
            { 
              color: themeColors.text, 
              borderColor: themeColors.border,
              backgroundColor: themeColors.background 
            }
          ]}
          value={userAgent}
          onChangeText={setUserAgent}
          placeholder="Enter User-Agent"
          placeholderTextColor={themeColors.secondaryText}
        />
        <Text style={[styles.hint, { color: themeColors.secondaryText }]}>
          LRCLIB requires a descriptive User-Agent. Include your app name and a contact link or
          email.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About Echo</Text>
        <Text style={styles.aboutText}>
          Echo is a minimalist lyric editor for syncing and publishing lyrics to LRCLIB.
        </Text>
        <Text style={[styles.version, { color: themeColors.secondaryText }]}>Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

function ThemeButton({
  label,
  active,
  onPress,
  icon,
  themeColors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  themeColors: any;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.themeButton,
        { borderColor: themeColors.border },
        active && { backgroundColor: themeColors.tint, borderColor: themeColors.tint },
      ]}
      onPress={onPress}
    >
      {icon}
      <Text 
        style={[
          styles.themeButtonLabel, 
          { color: active ? themeColors.background : themeColors.text }
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  accentRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    backgroundColor: 'transparent',
    flexWrap: 'wrap',
  },
  accentButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  themeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  themeButtonLabel: {
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  smallInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    width: 60,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  aboutText: {
    fontSize: 16,
    lineHeight: 24,
  },
  version: {
    fontSize: 12,
    marginTop: 10,
  },
});
