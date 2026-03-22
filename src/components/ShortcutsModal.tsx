import React from 'react';
import { StyleSheet, Modal, Pressable, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { 
  Play, 
  Pause, 
  Square, 
  Plus, 
  Save, 
  Undo2, 
  Redo2,
  Keyboard,
  X 
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { Text, View, useTheme } from './Themed';

interface ShortcutsModalProps {
  visible: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
  icon?: React.ReactNode;
}

export default function ShortcutsModal({ visible, onClose }: ShortcutsModalProps) {
  const theme = useTheme();
  
  const shortcuts: Shortcut[] = [
    { keys: ['Space'], description: 'Play / Pause', icon: <Play size={16} color={theme.tint} /> },
    { keys: ['Esc'], description: 'Stop playback', icon: <Square size={16} color={theme.tint} /> },
    { keys: ['N'], description: 'Add new timestamp', icon: <Plus size={16} color={theme.tint} /> },
    { keys: ['Enter'], description: 'Confirm / Save line', icon: <Save size={16} color={theme.tint} /> },
    { keys: ['Cmd', 'Z'], description: 'Undo', icon: <Undo2 size={16} color={theme.tint} /> },
    { keys: ['Cmd', 'Shift', 'Z'], description: 'Redo', icon: <Redo2 size={16} color={theme.tint} /> },
    { keys: ['Cmd', 'S'], description: 'Save LRC file' },
    { keys: ['Cmd', 'E'], description: 'Export' },
    { keys: ['-'], description: 'Nudge -1 second' },
    { keys: ['='], description: 'Nudge +1 second' },
    { keys: ['?'], description: 'Show shortcuts' },
  ];

  if (Platform.OS === 'web' || process.env.EXPO_PUBLIC_DESKTOP === 'true') {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Animated.View 
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.overlay}
        >
          <Pressable style={styles.backdrop} onPress={onClose}>
            <BlurView intensity={50} style={StyleSheet.absoluteFill} />
          </Pressable>
          
          <Pressable 
            style={[styles.content, { backgroundColor: theme.background }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <View style={styles.titleRow}>
                <Keyboard size={24} color={theme.tint} />
                <Text style={[styles.title, { color: theme.text }]}>Keyboard Shortcuts</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <X size={20} color={theme.secondaryText} />
              </Pressable>
            </View>
            
            <View style={styles.shortcutsList}>
              {shortcuts.map((shortcut, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.shortcutRow, 
                    { borderBottomColor: theme.border },
                    index === shortcuts.length - 1 && styles.lastRow
                  ]}
                >
                  <View style={styles.keysContainer}>
                    {shortcut.icon && (
                      <View style={styles.iconWrapper}>
                        {shortcut.icon}
                      </View>
                    )}
                    {shortcut.keys.map((key, keyIndex) => (
                      <React.Fragment key={keyIndex}>
                        {keyIndex > 0 && (
                          <Text style={[styles.plusSign, { color: theme.secondaryText }]}>+</Text>
                        )}
                        <View style={[styles.key, { backgroundColor: theme.tint + '20', borderColor: theme.tint }]}>
                          <Text style={[styles.keyText, { color: theme.tint }]}>{key}</Text>
                        </View>
                      </React.Fragment>
                    ))}
                  </View>
                  <Text style={[styles.description, { color: theme.text }]}>
                    {shortcut.description}
                  </Text>
                </View>
              ))}
            </View>
            
            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <Text style={[styles.footerText, { color: theme.secondaryText }]}>
                Press ? anytime to show this modal
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </Modal>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  shortcutsList: {
    padding: 8,
  },
  shortcutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  keysContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconWrapper: {
    marginRight: 8,
  },
  plusSign: {
    fontSize: 12,
    marginHorizontal: 2,
  },
  key: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    minWidth: 28,
    alignItems: 'center',
  },
  keyText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
  description: {
    fontSize: 14,
    flex: 1,
    marginLeft: 16,
    textAlign: 'right',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 12,
  },
});
