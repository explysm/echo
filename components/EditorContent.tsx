import React, { memo, useRef } from 'react';
import { View, Text, TextInput, FlatList, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { LyricLine } from '@/lib/lrclib';
import { Undo2, Redo2 } from 'lucide-react-native';

interface SyncLyricLineProps {
  line: LyricLine;
  isActive: boolean;
  isExpanded: boolean;
  rhythmMode: boolean;
  onToggleExpand: (id: string) => void;
  onToggleRhythm: () => void;
  onPress: (line: LyricLine) => void;
  onDelete: (id: string) => void;
  onSeek: (time: number) => void;
  onSyllableSync: (lineId: string, wordIndex: number, time: number) => void;
  currentTime: number;
  theme: any;
}

const SyncLyricLine = memo(({
  line,
  isActive,
  isExpanded,
  rhythmMode,
  onToggleExpand,
  onToggleRhythm,
  onPress,
  onDelete,
  onSeek,
  onSyllableSync,
  currentTime,
  theme
}: SyncLyricLineProps) => {
  const getSafeColor = (color: any, fallback: string) => {
    if (typeof color === 'string' && color.startsWith('#') && !color.includes('NaN')) {
      return color.slice(0, 7);
    }
    return fallback;
  };

  const safeTint = getSafeColor(theme.tint, '#0f172a');
  const safeBorder = getSafeColor(theme.border, '#e2e8f0');

  const words = line.syllables && line.syllables.length > 0
    ? line.syllables
    : line.text.split(' ').filter(w => w.trim()).map(w => ({ time: 0, text: w }));

  return (
    <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: safeBorder }}>
      <TouchableOpacity
        style={[
          styles.lyricLine,
          { borderLeftColor: isActive ? safeTint : 'transparent', borderLeftWidth: isActive ? 4 : 0 },
          isActive && { backgroundColor: safeTint + '08' }
        ]}
        onPress={() => onPress(line)}
      >
        <View style={styles.lyricLineInfo}>
          <TouchableOpacity
            onPress={() => onSeek(line.start)}
            style={[styles.timestampPill, { backgroundColor: safeTint + '15' }]}
          >
            <Text style={[styles.lyricTimestamp, { color: safeTint }]}>
              {formatTime(line.start)}
            </Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[
              styles.lyricText,
              { color: getSafeColor(theme.text, '#000000') },
              isActive && { fontWeight: '600', color: safeTint }
            ]}>
              {line.text}
              {line.syllables && <Text style={{ fontSize: 10, color: safeTint }}> ✨</Text>}
              {line.position && line.position !== 'center' && (
                <Text style={{ fontSize: 10, color: safeTint }}> 📍{line.position.toUpperCase()}</Text>
              )}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => onToggleExpand(line.id)} style={{ padding: 10 }}>
            <Text style={{ color: safeTint, fontSize: 18 }}>{isExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(line.id)} style={{ padding: 10 }}>
            <Text style={{ color: '#ff4444', fontSize: 16 }}>🗑</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
});

const AnimatedLyricLine = memo(({ line, isActive, positionSV, theme }: {
  line: LyricLine;
  isActive: boolean;
  positionSV: any;
  theme: any;
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const progress = isActive ? 1 : 0;
    return {
      opacity: 1,
      transform: [{ scale: 1 }],
    };
  });

  const getSafeColor = (color: any, fallback: string) => {
    if (typeof color === 'string' && color.startsWith('#') && !color.includes('NaN')) {
      return color.slice(0, 7);
    }
    return fallback;
  };

  const safeTint = getSafeColor(theme.tint, '#0f172a');
  const safeText = getSafeColor(theme.text, '#000000');

  return (
    <Animated.View style={[styles.playerLine, animatedStyle]}>
      <Text style={[
        styles.playerLineText,
        { color: isActive ? safeTint : safeText },
        isActive && styles.playerLineActive
      ]}>
        {line.text}
      </Text>
    </Animated.View>
  );
});

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

interface EditorContentProps {
  editorMode: 'raw' | 'sync' | 'play';
  lyrics: LyricLine[];
  theme: any;
  expandedLines: Set<string>;
  rhythmMode: boolean;
  currentLineIndex: number;
  position: number;
  historyIndex: number;
  history: string[];
  rawLRC: string;
  playerScrollRef: React.RefObject<ScrollView | null>;
  lineHeights: React.MutableRefObject<{ [key: number]: number }>;
  positionSV: any;
  TutorialView: any;
  handleToggleExpand: (id: string) => void;
  setRhythmMode: (v: boolean) => void;
  handleEditLine: (line: LyricLine) => void;
  deleteLyricLine: (id: string) => void;
  onSliderValueChange: (v: number) => void;
  handleSyllableSync: (lineId: string, wordIndex: number, time: number) => void;
  applyOffset: (ms: number) => void;
  undo: () => void;
  redo: () => void;
  handleRawLRCChange: (text: string) => void;
}

export function EditorContent({
  editorMode,
  lyrics,
  theme,
  expandedLines,
  rhythmMode,
  currentLineIndex,
  position,
  historyIndex,
  history,
  rawLRC,
  playerScrollRef,
  lineHeights,
  positionSV,
  TutorialView,
  handleToggleExpand,
  setRhythmMode,
  handleEditLine,
  deleteLyricLine,
  onSliderValueChange,
  handleSyllableSync,
  applyOffset,
  undo,
  redo,
  handleRawLRCChange,
}: EditorContentProps) {
  const getSafeColor = (color: any, fallback: string) => {
    if (typeof color === 'string' && color.startsWith('#') && !color.includes('NaN')) {
      return color.slice(0, 7);
    }
    return fallback;
  };

  const safeTint = getSafeColor(theme.tint, '#0f172a');
  const safeBorder = getSafeColor(theme.border, '#e2e8f0');

  if (editorMode === 'sync') {
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.offsetRow, { height: 40, justifyContent: 'center', borderBottomColor: safeBorder }]}>
          <Text style={[styles.offsetLabel, { color: theme.secondaryText }]}>Global Offset:</Text>
          <TouchableOpacity style={[styles.offsetButton, { borderColor: safeBorder }]} onPress={() => applyOffset(-100)}>
            <Text style={{ color: safeTint, fontSize: 12 }}>-100ms</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.offsetButton, { borderColor: safeBorder }]} onPress={() => applyOffset(100)}>
            <Text style={{ color: safeTint, fontSize: 12 }}>+100ms</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={lyrics}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <SyncLyricLine
              line={item}
              isActive={currentLineIndex === index}
              isExpanded={expandedLines.has(item.id)}
              rhythmMode={rhythmMode}
              onToggleExpand={handleToggleExpand}
              onToggleRhythm={() => setRhythmMode(!rhythmMode)}
              onPress={handleEditLine}
              onDelete={deleteLyricLine}
              onSeek={onSliderValueChange}
              onSyllableSync={handleSyllableSync}
              currentTime={position}
              theme={theme}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyHint, { color: theme.secondaryText }]}>
              No lyrics yet. Use the + button to start syncing.
            </Text>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
          removeClippedSubviews={true}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      </View>
    );
  }

  if (editorMode === 'raw') {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.rawToolbar}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={undo}
              disabled={historyIndex === 0}
              style={[styles.toolButton, historyIndex === 0 && { opacity: 0.3 }]}
            >
              <Undo2 size={20} color={safeTint} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={redo}
              disabled={historyIndex >= history.length - 1}
              style={[styles.toolButton, historyIndex >= history.length - 1 && { opacity: 0.3 }]}
            >
              <Redo2 size={20} color={safeTint} />
            </TouchableOpacity>
          </View>
        </View>
        <TextInput
          style={[styles.rawInput, { color: theme.text }]}
          multiline
          value={rawLRC}
          onChangeText={handleRawLRCChange}
          placeholder="Paste raw LRC or plain text here..."
          placeholderTextColor={theme.secondaryText}
          textAlignVertical="top"
        />
      </View>
    );
  }

  return (
    <View style={styles.playerContainer}>
      {lyrics.length === 0 ? (
        <Text style={[styles.emptyHint, { color: theme.secondaryText }]}>
          No lyrics to play. Sync some first!
        </Text>
      ) : (
        <ScrollView
          ref={playerScrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.playerScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {lyrics.map((line, index) => {
            const alignment = line.position === 'left' ? 'flex-start' : line.position === 'right' ? 'flex-end' : 'center';
            return (
              <View
                key={line.id}
                onLayout={(e) => {
                  lineHeights.current[index] = e.nativeEvent.layout.height;
                }}
                style={{ alignItems: alignment, width: '100%' }}
              >
                <AnimatedLyricLine
                  line={line}
                  isActive={currentLineIndex === index}
                  positionSV={positionSV}
                  theme={theme}
                />
              </View>
            );
          })}
          <View style={{ height: 400 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lyricLine: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'transparent',
  },
  lyricLineInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timestampPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  lyricTimestamp: {
    fontSize: 12,
    fontFamily: 'SpaceMono',
  },
  lyricText: {
    flex: 1,
    fontSize: 16,
  },
  offsetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  offsetLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  offsetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  emptyHint: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  rawToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  toolButton: {
    padding: 6,
    borderRadius: 8,
  },
  rawInput: {
    flex: 1,
    padding: 16,
    fontSize: 14,
    fontFamily: 'SpaceMono',
  },
  playerContainer: {
    flex: 1,
    padding: 20,
  },
  playerScrollContent: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  playerLine: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  playerLineText: {
    fontSize: 20,
    textAlign: 'center',
  },
  playerLineActive: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
