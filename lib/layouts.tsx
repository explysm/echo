import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LyricLine } from '@/lib/lrclib';

export type LayoutSlot = 'editor' | 'player' | 'syncer';

export interface LayoutConfig {
  slots: {
    editor: { visible: boolean; flex: number };
    player: { visible: boolean; flex: number };
    syncer: { visible: boolean; flex: number };
  };
  direction: 'column' | 'row';
}

export const LAYOUT_PRESETS: Record<string, LayoutConfig> = {
  default: {
    slots: {
      editor: { visible: true, flex: 1 },
      player: { visible: false, flex: 0 },
      syncer: { visible: false, flex: 0 },
    },
    direction: 'column',
  },
  'side-by-side': {
    slots: {
      editor: { visible: true, flex: 1 },
      player: { visible: true, flex: 1 },
      syncer: { visible: true, flex: 1 },
    },
    direction: 'row',
  },
  'editor-focused': {
    slots: {
      editor: { visible: true, flex: 2 },
      player: { visible: true, flex: 1 },
      syncer: { visible: false, flex: 0 },
    },
    direction: 'column',
  },
  'player-focused': {
    slots: {
      editor: { visible: true, flex: 1 },
      player: { visible: true, flex: 2 },
      syncer: { visible: false, flex: 0 },
    },
    direction: 'column',
  },
};

export interface LayoutSlots {
  editor: React.ReactNode;
  player: React.ReactNode;
  syncer: React.ReactNode;
}

interface LayoutRendererProps {
  preset: string;
  slots: LayoutSlots;
}

export function LayoutRenderer({ preset, slots }: LayoutRendererProps) {
  const config = LAYOUT_PRESETS[preset] || LAYOUT_PRESETS.default;
  const isRow = config.direction === 'row';

  const containerStyle = isRow
    ? styles.rowContainer
    : styles.columnContainer;

  return (
    <View style={containerStyle}>
      {config.slots.editor.visible && (
        <View style={[styles.slot, { flex: config.slots.editor.flex }]}>
          {slots.editor}
        </View>
      )}
      {config.slots.player.visible && (
        <View style={[styles.slot, { flex: config.slots.player.flex }]}>
          {slots.player}
        </View>
      )}
      {config.slots.syncer.visible && (
        <View style={[styles.slot, { flex: config.slots.syncer.flex }]}>
          {slots.syncer}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  columnContainer: {
    flexDirection: 'column',
    flex: 1,
  },
  slot: {
    minHeight: 0,
  },
});
