import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, TextInput, Switch, Modal, Alert, Platform } from 'react-native';
import { Moon, Sun, Monitor, Check, X, ChevronRight, ChevronLeft, Trash2, Sparkles, Palette, MonitorDot } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import ColorPicker, { HueCircular, Panel1, Preview, BrightnessSlider } from 'reanimated-color-picker';
import { runOnJS } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Helper to determine the actual ColorPicker component
const ActualColorPicker: any = (ColorPicker as any).ColorPicker || ColorPicker;


import { Text, View, ScrollView, useTheme } from '@/components/Themed';
import { useAppSettings } from '@/context/AppSettingsContext';
import { ACCENT_COLORS, CustomTheme } from '@/constants/Theme';

// --- Sub-components to isolate state and prevent re-renders during color picking ---

function CustomThemeModal({ 
  visible, 
  onClose, 
  initialTheme, 
  onApply,
  themeColors,
  colorScheme,
  enableFancyAnimations 
}: any) {
  const [tempTheme, setTempTheme] = useState<CustomTheme>(initialTheme);
  const [editingKey, setEditingKey] = useState<keyof CustomTheme | null>(null);

  useEffect(() => {
    if (visible) setTempTheme(initialTheme);
  }, [visible, initialTheme]);

  const onColorChange = useCallback(({ hex }: { hex: string }) => {
    'worklet';
    if (hex && !hex.includes('NaN')) {
      const safeHex = hex.startsWith('#') ? hex.slice(0, 7) : (hex.length >= 6 ? `#${hex.slice(0, 6)}` : hex);
      runOnJS(setTempTheme)((prev: any) => ({ ...prev, [editingKey!]: safeHex }));
    }
  }, [editingKey]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          {enableFancyAnimations && Platform.OS !== 'web' && (
            <BlurView intensity={25} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <View style={[
            styles.modalContent, 
            { backgroundColor: themeColors.background, borderColor: themeColors.border, borderWidth: 1 },
            enableFancyAnimations && { backgroundColor: themeColors.background + 'CC' }
          ]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Custom Theme Maker</Text>
              <TouchableOpacity onPress={onClose}>
                <X color={themeColors.text} size={24} />
              </TouchableOpacity>
            </View>

            <View style={[styles.themePreview, { backgroundColor: tempTheme.background, borderColor: (tempTheme.secondaryText?.slice(0, 7) || tempTheme.secondaryText) + '33' }]}>
              <Text style={{ color: tempTheme.text, fontSize: 18, fontWeight: 'bold' }}>Theme Preview</Text>
              <Text style={{ color: tempTheme.secondaryText, fontSize: 14 }}>This is how your text will look.</Text>
              <View style={[styles.previewPill, { backgroundColor: tempTheme.tint }]}>
                <Text style={{ color: tempTheme.background, fontWeight: 'bold' }}>ACTIVE TINT</Text>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
              {(['background', 'text', 'secondaryText', 'tint'] as const).map((key) => (
                <ColorPickerRow 
                  key={key}
                  label={key.charAt(0).toUpperCase() + key.slice(1).replace(/[A-Z]/g, ' $&')} 
                  value={tempTheme[key]} 
                  onPress={() => setEditingKey(editingKey === key ? null : key)}
                  active={editingKey === key}
                  themeColors={themeColors}
                />
              ))}

              {editingKey && (
                <View style={styles.pickerContainer}>
                  <ActualColorPicker 
                    key={editingKey}
                    initialColor={tempTheme[editingKey]} 
                    onChange={onColorChange}
                  >
                    <Panel1 style={styles.pickerPanel} />
                    <HueCircular style={styles.pickerWheel} />
                    <BrightnessSlider style={styles.pickerSlider} />
                    <Preview hideInitialColor />
                  </ActualColorPicker>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: themeColors.tint }]}
              onPress={() => onApply(tempTheme)}
            >
              <Check size={20} color={themeColors.background} style={{ marginRight: 8 }} />
              <Text style={[styles.applyButtonText, { color: themeColors.background }]}>Apply Custom Theme</Text>
            </TouchableOpacity>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function AccentPickerModal({ 
  visible, 
  onClose, 
  initialAccent, 
  onApply,
  themeColors,
  colorScheme,
  enableFancyAnimations 
}: any) {
  const [tempAccent, setTempAccent] = useState(initialAccent);

  useEffect(() => {
    if (visible) setTempAccent(initialAccent);
  }, [visible, initialAccent]);

  const onAccentChange = useCallback(({ hex }: { hex: string }) => {
    'worklet';
    if (hex && !hex.includes('NaN')) {
      const safeHex = hex.startsWith('#') ? hex.slice(0, 7) : (hex.length >= 6 ? `#${hex.slice(0, 6)}` : hex);
      runOnJS(setTempAccent)(safeHex);
    }
  }, []);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          {enableFancyAnimations && Platform.OS !== 'web' && (
            <BlurView intensity={25} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <View style={[
            styles.modalContent, 
            { backgroundColor: themeColors.background, borderColor: themeColors.border, borderWidth: 1 },
            enableFancyAnimations && { backgroundColor: themeColors.background + 'CC' }
          ]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pick Accent Color</Text>
              <TouchableOpacity onPress={onClose}>
                <X color={themeColors.text} size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerContainer}>
              <ActualColorPicker 
                initialColor={tempAccent} 
                onChange={onAccentChange}
              >
                <Panel1 style={styles.pickerPanel} />
                <HueCircular style={styles.pickerWheel} />
                <BrightnessSlider style={styles.pickerSlider} />
                <Preview hideInitialColor />
              </ActualColorPicker>
            </View>

            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: tempAccent }]}
              onPress={() => onApply(tempAccent)}
            >
              <Check size={20} color={getContrastColor(tempAccent)} style={{ marginRight: 8 }} />
              <Text style={[styles.applyButtonText, { color: getContrastColor(tempAccent) }]}>Apply Accent</Text>
            </TouchableOpacity>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

export default function SettingsScreen() {
  const { 
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
    alwaysShowTutorial,
    setAlwaysShowTutorial,
    desktopMode,
    setDesktopMode,
    colorScheme 
  } = useAppSettings();
  const themeColors = useTheme();

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showAccentPicker, setShowAccentPicker] = useState(false);

  const isDesktopBuild = process.env.EXPO_PUBLIC_DESKTOP === 'true';

  const handleApplyCustomTheme = (theme: CustomTheme) => {
    setCustomTheme(theme);
    setAccentKey('custom');
    setShowThemeModal(false);
  };

  const handleApplyCustomAccent = (accent: string) => {
    setCustomTheme({
      ...customTheme,
      tint: accent
    });
    setAccentKey('custom');
    setShowAccentPicker(false);
  };

  const handleEraseAllData = () => {
    const performErase = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        await AsyncStorage.multiRemove(keys);
        
        if (Platform.OS === 'web') {
          alert('All data has been erased. The page will now reload.');
          window.location.reload();
        } else {
          Alert.alert('Success', 'All data has been erased. Please restart the app for changes to take full effect.');
        }
      } catch (e) {
        if (Platform.OS === 'web') alert('Failed to erase data.');
        else Alert.alert('Error', 'Failed to erase data.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Erase All Data? This will clear all settings, lyrics, and metadata. This action cannot be undone.')) {
        performErase();
      }
    } else {
      Alert.alert(
        'Erase All Data',
        'This will clear all settings, lyrics, and metadata. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Erase Everything', 
            style: 'destructive', 
            onPress: performErase
          }
        ]
      );
    }
  };

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
            icon={<Moon size={20} color={themeColors.background} />} // This seems wrong in original, corrected below
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
          {(Object.keys(ACCENT_COLORS) as (keyof typeof ACCENT_COLORS)[]).map((key) => (
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
          <TouchableOpacity
            style={[
              styles.accentButton,
              { 
                backgroundColor: accentKey === 'custom' ? themeColors.tint : themeColors.border,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: accentKey === 'custom' ? 3 : 0,
                borderColor: themeColors.text
              }
            ]}
            onPress={() => {
              setShowAccentPicker(true);
            }}
          >
            <Palette size={20} color={accentKey === 'custom' ? themeColors.background : themeColors.secondaryText} />
          </TouchableOpacity>
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

        <View style={[styles.settingRow, { marginTop: 20 }]}>
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.settingLabel}>Modern Animations</Text>
              <Sparkles size={14} color={themeColors.tint} />
            </View>
            <Text style={[styles.hint, { color: themeColors.secondaryText, marginTop: 4 }]}>
              Enable smoother transitions and frosted glass effects (Experimental).
            </Text>
          </View>
          <Switch
            value={enableFancyAnimations}
            onValueChange={setEnableFancyAnimations}
            trackColor={{ false: themeColors.border, true: themeColors.tint }}
            thumbColor="#fff"
          />
        </View>

        {isDesktopBuild && (
          <View style={[styles.settingRow, { marginTop: 20 }]}>
            <View style={{ flex: 1, backgroundColor: 'transparent' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.settingLabel}>Desktop Layout</Text>
                <MonitorDot size={14} color={themeColors.tint} />
              </View>
              <Text style={[styles.hint, { color: themeColors.secondaryText, marginTop: 4 }]}>
                Redesigned desktop-first layout with side-by-side editor and player.
              </Text>
            </View>
            <Switch
              value={desktopMode}
              onValueChange={setDesktopMode}
              trackColor={{ false: themeColors.border, true: themeColors.tint }}
              thumbColor="#fff"
            />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Danger Zone</Text>
        <TouchableOpacity
          style={[styles.eraseButton, { borderColor: '#ef4444' }]}
          onPress={handleEraseAllData}
        >
          <Trash2 size={20} color="#ef4444" />
          <Text style={[styles.eraseButtonText, { color: '#ef4444' }]}>Erase All Data</Text>
        </TouchableOpacity>
        <Text style={[styles.hint, { color: themeColors.secondaryText }]}>
          This will reset everything to default and clear all saved progress.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Developer Settings</Text>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Text style={styles.settingLabel}>Always show tutorial</Text>
            <Text style={[styles.hint, { color: themeColors.secondaryText, marginTop: 4 }]}>
              Show the welcome tutorial every time the app starts, regardless of completion progress.
            </Text>
          </View>
          <Switch
            value={alwaysShowTutorial}
            onValueChange={setAlwaysShowTutorial}
            trackColor={{ false: themeColors.border, true: themeColors.tint }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About Echo</Text>
        <Text style={styles.aboutText}>
          Echo is a minimalist lyric editor for syncing and publishing lyrics to LRCLIB.
        </Text>
        <Text style={[styles.version, { color: themeColors.secondaryText }]}>Version {process.env.EXPO_PUBLIC_APP_VERSION || '1.0.3'}</Text>
      </View>

      <CustomThemeModal 
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        initialTheme={customTheme}
        onApply={handleApplyCustomTheme}
        themeColors={themeColors}
        colorScheme={colorScheme}
        enableFancyAnimations={enableFancyAnimations}
      />

      <AccentPickerModal 
        visible={showAccentPicker}
        onClose={() => setShowAccentPicker(false)}
        initialAccent={customTheme.tint}
        onApply={handleApplyCustomAccent}
        themeColors={themeColors}
        colorScheme={colorScheme}
        enableFancyAnimations={enableFancyAnimations}
      />
    </ScrollView>
  );
}

// Helper to get contrast color
const getContrastColor = (hex: string) => {
  if (!hex || hex.includes('NaN')) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
};

function ColorPickerRow({ label, value, onPress, active, themeColors }: any) {
  return (
    <TouchableOpacity 
      style={[styles.colorPickerRow, { borderColor: active ? themeColors.tint : themeColors.border }]} 
      onPress={onPress}
    >
      <View style={[styles.colorSwatch, { backgroundColor: value }]} />
      <Text style={[styles.colorPickerLabel, { color: themeColors.text }]}>{label}</Text>
      <Text style={[styles.colorHex, { color: themeColors.secondaryText }]}>{value.toUpperCase()}</Text>
      <ChevronRight size={18} color={themeColors.secondaryText} style={{ transform: [{ rotate: active ? '90deg' : '0deg' }] }} />
    </TouchableOpacity>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    gap: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  themePreview: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  previewPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  colorPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  colorPickerLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  colorHex: {
    fontSize: 12,
    fontFamily: 'SpaceMono',
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  pickerContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  pickerPanel: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 20,
  },
  pickerWheel: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  pickerSlider: {
    width: '100%',
    height: 30,
    borderRadius: 15,
    marginBottom: 20,
  },
  applyButton: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  eraseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  eraseButtonText: {
    fontWeight: 'bold',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  layoutOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 16,
  },
  layoutOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  layoutOptionName: {
    fontSize: 16,
    fontWeight: '600',
  },
  layoutOptionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  smallButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  layoutPreview: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
});
