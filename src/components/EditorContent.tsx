import React, { memo, useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, ScrollView, TouchableOpacity, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  useSharedValue, 
  useDerivedValue,
  interpolateColor,
  withSpring
} from 'react-native-reanimated';
import { 
  Trash2, 
  ChevronUp, 
  Plus, 
  Activity, 
  Undo2, 
  Redo2,
  ChevronDown
} from 'lucide-react-native';
import { LyricLine } from '@/lib/lrclib';
import { useAppSettings } from '@/context/AppSettingsContext';

function formatTime(seconds: number) {
  if (seconds < 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

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
  onUpdateLine: (id: string, updates: Partial<LyricLine>) => void;
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
  onUpdateLine,
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

  // Animation logic
  const heightProgress = useSharedValue(isExpanded ? 1 : 0);
  
  useEffect(() => {
    heightProgress.value = withTiming(isExpanded ? 1 : 0, { duration: 300 });
  }, [isExpanded]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: heightProgress.value * (rhythmMode ? 180 : 120),
      opacity: heightProgress.value,
      overflow: 'hidden',
    };
  });

  const words = React.useMemo(() => {
    if (line.syllables && line.syllables.length > 0) {
      return line.syllables;
    }
    return line.text.split(' ').filter(w => w.trim()).map(w => ({ time: 0, text: w }));
  }, [line.text, line.syllables]);

  const nextUnsyncedIndex = words.findIndex(w => w.time === 0);

  return (
    <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: safeBorder }}>
      <Pressable 
        style={({ pressed }) => [
          styles.lyricLine, 
          pressed && { backgroundColor: safeBorder },
          isActive && { 
            backgroundColor: safeTint + '08',
            borderLeftColor: safeTint,
            borderLeftWidth: 4
          }
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
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', backgroundColor: 'transparent' }}>
              {line.speaker && (
                <View style={[
                  styles.speakerBadge, 
                  { backgroundColor: line.speaker === 'v1' ? '#3b82f620' : line.speaker === 'v2' ? '#ef444420' : safeTint + '15' }
                ]}>
                  <Text style={[
                    styles.speakerText, 
                    { color: line.speaker === 'v1' ? '#3b82f6' : line.speaker === 'v2' ? '#ef4444' : safeTint }
                  ]}>
                    {line.speaker.toUpperCase()}
                  </Text>
                </View>
              )}
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
            {line.background && (
              <Text style={[styles.backgroundVocal, { color: theme.secondaryText }]}>
                (bg: {line.background})
              </Text>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}>
          <TouchableOpacity 
            onPress={() => onToggleExpand(line.id)} 
            style={{ padding: 10 }}
          >
            {isExpanded ? <ChevronUp size={20} color={safeTint} /> : <ChevronDown size={20} color={safeTint} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(line.id)} style={{ padding: 10 }}>
            <Trash2 color="#ff4444" size={18} />
          </TouchableOpacity>
        </View>
      </Pressable>

      <Animated.View style={[styles.expandedContent, { backgroundColor: theme.background }, animatedStyle]}>
        <View style={styles.advancedControls}>
          <View style={{ flex: 1, gap: 10 }}>
            <Text style={[styles.controlLabel, { color: theme.secondaryText }]}>Speaker Tag:</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['v1', 'v2', 'none'].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => onUpdateLine(line.id, { speaker: s === 'none' ? undefined : s })}
                  style={[
                    styles.speakerOption,
                    { borderColor: safeBorder },
                    (line.speaker === s || (s === 'none' && !line.speaker)) && { backgroundColor: safeTint, borderColor: safeTint }
                  ]}
                >
                  <Text style={[
                    styles.speakerOptionText,
                    { color: theme.text },
                    (line.speaker === s || (s === 'none' && !line.speaker)) && { color: theme.background }
                  ]}>
                    {s.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ flex: 1, gap: 8 }}>
            <Text style={[styles.controlLabel, { color: theme.secondaryText }]}>Background Vocal:</Text>
            <TextInput
              style={[styles.smallInput, { color: theme.text, borderColor: safeBorder }]}
              placeholder="e.g. Oh oh oh..."
              placeholderTextColor={theme.secondaryText}
              value={line.background || ''}
              onChangeText={(text) => onUpdateLine(line.id, { background: text || undefined })}
            />
          </View>
        </View>

        <View style={styles.expandHeader}>
           <Text style={[styles.hint, { color: theme.secondaryText, flex: 1 }]}>
             {rhythmMode ? 'Rhythm Mode: Tap the big button for each word.' : 'Manual Mode: Tap word chips.'}
           </Text>
           <TouchableOpacity 
             onPress={onToggleRhythm}
             style={[styles.rhythmToggle, rhythmMode && { backgroundColor: safeTint + '15' }]}
           >
             <Activity size={16} color={rhythmMode ? safeTint : theme.secondaryText} />
             <Text style={[styles.rhythmToggleText, { color: rhythmMode ? safeTint : theme.secondaryText }]}>
               Word Sync
             </Text>
           </TouchableOpacity>
        </View>

        {rhythmMode ? (
          <View style={{ gap: 10, marginTop: 5 }}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={[styles.rhythmTapButton, { backgroundColor: safeTint }]}
              onPress={() => {
                if (nextUnsyncedIndex !== -1) {
                  onSyllableSync(line.id, nextUnsyncedIndex, currentTime);
                }
              }}
              disabled={nextUnsyncedIndex === -1}
            >
              <Text style={[styles.rhythmTapButtonText, { color: theme.background }]}>
                {nextUnsyncedIndex === -1 ? 'ALL WORDS SYNCED' : `TAP: "${words[nextUnsyncedIndex].text}"`}
              </Text>
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
              {words.map((word, idx) => (
                <View key={idx} style={[styles.miniWordChip, { borderColor: safeBorder }, word.time > 0 && { backgroundColor: safeTint + '15', borderColor: safeTint }]}>
                   <Text style={[styles.miniWordText, { color: word.time > 0 ? safeTint : theme.secondaryText }]}>{word.text}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wordChipContainer}>
            {words.map((word, idx) => (
              <TouchableOpacity
                key={`${line.id}-word-${idx}`}
                onPress={() => onSyllableSync(line.id, idx, currentTime)}
                style={[
                  styles.wordChip,
                  { borderColor: theme.border },
                  word.time > 0 && { backgroundColor: safeTint, borderColor: safeTint }
                ]}
              >
                <Text style={[
                  styles.wordChipText,
                  { color: theme.text },
                  word.time > 0 && { color: theme.background }
                ]}>
                  {word.text}
                </Text>
                {word.time > 0 && (
                  <Text style={[styles.wordChipTime, { color: theme.background }]}>
                    {word.time.toFixed(1)}s
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
});

function AnimatedLyricLine({ 
  line,
  isActive, 
  positionSV,
  theme 
}: { 
  line: LyricLine, 
  isActive: boolean, 
  positionSV: Animated.SharedValue<number>,
  theme: any 
}) {
  const { enableFancyAnimations } = useAppSettings();

  // Handle positioning
  const textAlign = line.position === 'left' ? 'flex-start' : line.position === 'right' ? 'flex-end' : 'center';
  const speakerColor = line.speaker === 'v1' ? '#3b82f6' : line.speaker === 'v2' ? '#ef4444' : undefined;

  return (
    <View style={{ alignItems: textAlign as any, width: '100%', backgroundColor: 'transparent' }}>
      {line.syllables && line.syllables.length > 0 ? (
        <View style={[styles.syllableLineContainer, { justifyContent: textAlign as any }]}>
          {line.syllables.map((s, i) => (
            <AnimatedSyllable 
              key={`${line.id}-${i}`}
              text={s.text}
              startTime={s.time}
              isLineActive={isActive}
              positionSV={positionSV}
              theme={theme}
              enableFancyAnimations={enableFancyAnimations}
              overrideColor={speakerColor}
            />
          ))}
        </View>
      ) : (
        <AnimatedLineText 
          text={line.text}
          isActive={isActive}
          theme={theme}
          enableFancyAnimations={enableFancyAnimations}
          textAlign={textAlign}
          overrideColor={speakerColor}
        />
      )}
      {line.background && (
        <Text style={[
          styles.playerBackgroundVocal, 
          { 
            color: theme.secondaryText, 
            textAlign: (textAlign === 'flex-start' ? 'left' : textAlign === 'flex-end' ? 'right' : 'center') as any,
            opacity: isActive ? 0.8 : 0.4
          }
        ]}>
          ({line.background})
        </Text>
      )}
    </View>
  );
}

function AnimatedSyllable({ text, startTime, isLineActive, positionSV, theme, enableFancyAnimations, overrideColor }: any) {
  const safeTint = useDerivedValue(() => {
    if (overrideColor) return overrideColor;
    const val = theme.tint;
    return (typeof val === 'string' && val.startsWith('#') && !val.includes('NaN')) ? val.slice(0, 7) : '#0f172a';
  });

  const safeSecondary = useDerivedValue(() => {
    const val = theme.secondaryText;
    return (typeof val === 'string' && val.startsWith('#') && !val.includes('NaN')) ? val.slice(0, 7) : '#666666';
  });

  const activeProgress = useDerivedValue(() => {
    const isActive = isLineActive && positionSV.value >= startTime;
    return withTiming(isActive ? 1 : 0, { duration: 150 });
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: 1 + (activeProgress.value * 0.15) }],
      opacity: 0.5 + (activeProgress.value * 0.5),
      color: interpolateColor(
        activeProgress.value,
        [0, 1],
        [safeSecondary.value, safeTint.value]
      ),
    };
  });

  return (
    <Animated.Text style={[styles.syllableText, animatedStyle]}>
      {text}{' '}
    </Animated.Text>
  );
}

function AnimatedLineText({ text, isActive, theme, enableFancyAnimations, textAlign, overrideColor }: any) {
  const safeTint = useDerivedValue(() => {
    if (overrideColor) return overrideColor;
    const val = theme.tint;
    return (typeof val === 'string' && val.startsWith('#') && !val.includes('NaN')) ? val.slice(0, 7) : '#0f172a';
  });

  const safeSecondary = useDerivedValue(() => {
    const val = theme.secondaryText;
    return (typeof val === 'string' && val.startsWith('#') && !val.includes('NaN')) ? val.slice(0, 7) : '#666666';
  });

  const activeProgress = useDerivedValue(() => {
    return withTiming(isActive ? 1 : 0, { duration: 300 });
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: 1 + (activeProgress.value * 0.05) }],
      opacity: 0.6 + (activeProgress.value * 0.4),
      color: interpolateColor(
        activeProgress.value,
        [0, 1],
        [safeSecondary.value, safeTint.value]
      ),
      textAlign: (textAlign === 'flex-start' ? 'left' : textAlign === 'flex-end' ? 'right' : 'center') as any,
    };
  });

  return (
    <Animated.Text style={[styles.playerLine, animatedStyle]}>
      {text}
    </Animated.Text>
  );
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
  onUpdateLine: (id: string, updates: Partial<LyricLine>) => void;
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
  onUpdateLine,
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
              onUpdateLine={onUpdateLine}
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
  expandedContent: {
    padding: 12,
    borderTopWidth: 0,
    borderTopColor: 'rgba(150,150,150,0.1)',
  },
  advancedControls: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.1)',
    backgroundColor: 'transparent',
  },
  controlLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  speakerOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 45,
    alignItems: 'center',
  },
  speakerOptionText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  smallInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  expandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  hint: {
    fontSize: 12,
  },
  rhythmToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rhythmToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  wordChipContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  wordChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wordChipText: {
    fontSize: 14,
  },
  wordChipTime: {
    fontSize: 10,
    opacity: 0.8,
  },
  rhythmTapButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rhythmTapButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  miniWordChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  miniWordText: {
    fontSize: 12,
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
    // @ts-ignore - Web only
    outlineStyle: 'none',
  },
  playerContainer: {
    flex: 1,
  },
  playerScrollContent: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  playerLine: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
  },
  playerLineText: {
    fontSize: 22,
    textAlign: 'center',
    lineHeight: 32,
  },
  playerLineActive: {
    fontWeight: 'bold',
  },
  speakerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  speakerText: {
    fontSize: 10,
    fontWeight: '800',
  },
  backgroundVocal: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
  },
  playerBackgroundVocal: {
    fontSize: 16,
    fontStyle: 'italic',
    paddingBottom: 8,
  },
  syllableLineContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  syllableText: {
    fontSize: 22,
    lineHeight: 32,
  },
});
