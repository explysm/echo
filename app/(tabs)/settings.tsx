import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, TextInput, Switch, Modal, Pressable } from 'react-native';
import { Moon, Sun, Monitor, Palette, Check, X, ChevronRight } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import ColorPicker, { HueWheel, Panel1, Preview } from 'reanimated-color-picker';

import { Text, View, ScrollView, useTheme } from '@/components/Themed';
import { useAppSettings } from '@/context/AppSettingsContext';
import { ACCENT_COLORS, AccentKey, CustomTheme } from '@/constants/Theme';

export default function SettingsScreen() {
  const { 
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
    colorScheme 
  } = useAppSettings();
  const themeColors = useTheme();

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [tempTheme, setTempTheme] = useState<CustomTheme>(customTheme);
  const [editingKey, setEditingKey] = useState<keyof CustomTheme | null>(null);

  const onColorChange = ({ hex }: { hex: string }) => {
    if (editingKey) {
      setTempTheme(prev => ({ ...prev, [editingKey]: hex }));
    }
  };

  const handleApplyCustomTheme = () => {
    setCustomTheme(tempTheme);
    setAccentKey('custom');
    setShowThemeModal(false);
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
              { backgroundColor: customTheme.tint, justifyContent: 'center', alignItems: 'center' },
              accentKey === 'custom' && { borderColor: themeColors.text, borderWidth: 3 }
            ]}
            onPress={() => setShowThemeModal(true)}
          >
            <Palette size={20} color={customTheme.background} />
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
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>LRCLIB Configuration</Text>
        
        <View style={[styles.settingRow, { marginBottom: 20 }]}>
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Text style={styles.settingLabel}>Use Remote Solver</Text>
            <Text style={[styles.hint, { color: themeColors.secondaryText, marginTop: 4 }]}>
              Offload PoW solving to a dedicated server (much faster than mobile).
            </Text>
          </View>
          <Switch
            value={useRemoteSolver}
            onValueChange={setUseRemoteSolver}
            trackColor={{ false: themeColors.border, true: themeColors.tint }}
            thumbColor="#fff"
          />
        </View>

        {useRemoteSolver && (
          <>
            <Text style={[styles.label, { color: themeColors.secondaryText }]}>Solver URL</Text>
            <TextInput
              style={[
                styles.input, 
                { 
                  color: themeColors.text, 
                  borderColor: themeColors.border,
                  backgroundColor: themeColors.background,
                  marginBottom: 10
                }
              ]}
              value={solverUrl}
              onChangeText={setSolverUrl}
              placeholder="https://your-solver.render.com"
              placeholderTextColor={themeColors.secondaryText}
            />
            
            <Text style={[styles.label, { color: themeColors.secondaryText }]}>Solver Key (Optional)</Text>
            <TextInput
              style={[
                styles.input, 
                { 
                  color: themeColors.text, 
                  borderColor: themeColors.border,
                  backgroundColor: themeColors.background,
                  marginBottom: 10
                }
              ]}
              value={solverKey}
              onChangeText={setSolverKey}
              placeholder="Enter your solver security key"
              placeholderTextColor={themeColors.secondaryText}
              secureTextEntry
            />
          </>
        )}

        <Text style={[styles.label, { color: themeColors.secondaryText, marginTop: 10 }]}>User-Agent</Text>
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

      {/* Theme Maker Modal */}
      <Modal visible={showThemeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background, borderColor: themeColors.border, borderWidth: 1 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Custom Theme Maker</Text>
              <TouchableOpacity onPress={() => setShowThemeModal(false)}>
                <X color={themeColors.text} size={24} />
              </TouchableOpacity>
            </View>

            <View style={[styles.themePreview, { backgroundColor: tempTheme.background, borderColor: tempTheme.secondaryText + '33' }]}>
              <Text style={{ color: tempTheme.text, fontSize: 18, fontWeight: 'bold' }}>Theme Preview</Text>
              <Text style={{ color: tempTheme.secondaryText, fontSize: 14 }}>This is how your text will look.</Text>
              <View style={[styles.previewPill, { backgroundColor: tempTheme.tint }]}>
                <Text style={{ color: tempTheme.background, fontWeight: 'bold' }}>ACTIVE TINT</Text>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
              <ColorPickerRow 
                label="Background" 
                value={tempTheme.background} 
                onPress={() => setEditingKey(editingKey === 'background' ? null : 'background')}
                active={editingKey === 'background'}
                themeColors={themeColors}
              />
              <ColorPickerRow 
                label="Text" 
                value={tempTheme.text} 
                onPress={() => setEditingKey(editingKey === 'text' ? null : 'text')}
                active={editingKey === 'text'}
                themeColors={themeColors}
              />
              <ColorPickerRow 
                label="Secondary Text" 
                value={tempTheme.secondaryText} 
                onPress={() => setEditingKey(editingKey === 'secondaryText' ? null : 'secondaryText')}
                active={editingKey === 'secondaryText'}
                themeColors={themeColors}
              />
              <ColorPickerRow 
                label="Tint / Accent" 
                value={tempTheme.tint} 
                onPress={() => setEditingKey(editingKey === 'tint' ? null : 'tint')}
                active={editingKey === 'tint'}
                themeColors={themeColors}
              />

              {editingKey && (
                <View style={styles.pickerContainer}>
                  <ColorPicker 
                    value={tempTheme[editingKey]} 
                    onChange={onColorChange}
                  >
                    <Panel1 style={styles.pickerPanel} />
                    <HueWheel style={styles.pickerWheel} />
                    <Preview hideInitialColor />
                  </ColorPicker>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: themeColors.tint }]}
              onPress={handleApplyCustomTheme}
            >
              <Check size={20} color={themeColors.background} style={{ marginRight: 8 }} />
              <Text style={[styles.applyButtonText, { color: themeColors.background }]}>Apply Custom Theme</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

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
});
