import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  Modal,
  Pressable,
  Platform,
  LayoutChangeEvent,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  useSharedValue,
  interpolateColor,
  useDerivedValue
} from 'react-native-reanimated';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import {
  Play,
  Pause,
  Square,
  Plus,
  Save,
  FileMusic,
  Share,
  Trash2,
  Edit2,
  CloudUpload,
  FileDown,
  ChevronLeft,
  ChevronUp,
  Copy,
  CheckSquare,
  Gauge,
  Search,
  X,
  Type,
  ChevronLast,
  ChevronFirst,
  FastForward,
  Rewind,
  Activity,
  Maximize2,
  Undo2,
  Redo2,
} from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppWebView from '@/components/AppWebView';
import TutorialOverlay, { TutorialProvider, useTutorial, TutorialView } from '@/components/TutorialOverlay';
import { BlurView } from 'expo-blur';

import { Text, View, useTheme } from '@/components/Themed';
import { useAppSettings } from '@/context/AppSettingsContext';
import { EditorContent } from '@/components/EditorContent';
import {
  LyricLine,
  formatLyricsToLRC,
  parseLRCToLyrics,
  isSynced,
} from '@/lib/lrclib';

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
}: { 
  line: LyricLine, 
  isActive: boolean, 
  isExpanded: boolean,
  rhythmMode: boolean,
  onToggleExpand: (id: string) => void,
  onToggleRhythm: () => void,
  onPress: (line: LyricLine) => void, 
  onDelete: (id: string) => void, 
  onSeek: (time: number) => void,
  onSyllableSync: (lineId: string, wordIndex: number, time: number) => void,
  currentTime: number,
  theme: any 
}) => {
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
      height: heightProgress.value * (rhythmMode ? 180 : 120), // More height for rhythm button
      opacity: heightProgress.value,
      overflow: 'hidden',
    };
  });

  // Split text into words if syllables don't exist yet
  const words = useMemo(() => {
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

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}>
          <TouchableOpacity 
            onPress={() => onToggleExpand(line.id)} 
            style={{ padding: 10 }}
          >
            {isExpanded ? <ChevronUp size={20} color={safeTint} /> : <Plus size={20} color={safeTint} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(line.id)} style={{ padding: 10 }}>
            <Trash2 color="#ff4444" size={18} />
          </TouchableOpacity>
        </View>
      </Pressable>

      <Animated.View style={[styles.expandedContent, { backgroundColor: theme.background }, animatedStyle]}>
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
               Rhythm
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {words.map((word, idx) => (
                <View key={idx} style={[styles.miniWordChip, word.time > 0 && { backgroundColor: safeTint + '15', borderColor: safeTint }]}>
                   <Text style={[styles.miniWordText, { color: word.time > 0 ? safeTint : theme.secondaryText }]}>{word.text}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.wordChipContainer}>
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
          </View>
        )}
      </Animated.View>
    </View>
  );
}, (prev, next) => {
  return prev.isActive === next.isActive && 
         prev.isExpanded === next.isExpanded &&
         prev.rhythmMode === next.rhythmMode &&
         prev.currentTime === next.currentTime &&
         prev.line.id === next.line.id &&
         prev.line.text === next.line.text && 
         prev.line.start === next.line.start &&
         prev.line.syllables?.length === next.line.syllables?.length &&
         prev.line.position === next.line.position;
});

// Animated Sub-component for Player
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

  if (line.syllables && line.syllables.length > 0) {
    return (
      <View style={[styles.syllableLineContainer, { justifyContent: textAlign as any }]}>
        {line.syllables.map((s, i) => {
          return (
            <AnimatedSyllable 
              key={`${line.id}-${i}`}
              text={s.text}
              startTime={s.time}
              isLineActive={isActive}
              positionSV={positionSV}
              theme={theme}
              enableFancyAnimations={enableFancyAnimations}
            />
          );
        })}
      </View>
    );
  }

  return (
    <AnimatedLineText 
      text={line.text}
      isActive={isActive}
      theme={theme}
      enableFancyAnimations={enableFancyAnimations}
      textAlign={textAlign}
    />
  );
}

function AnimatedSyllable({ text, startTime, isLineActive, positionSV, theme, enableFancyAnimations }: any) {
  const safeTint = useDerivedValue(() => {
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

function AnimatedLineText({ text, isActive, theme, enableFancyAnimations, textAlign }: any) {
  const safeTint = useDerivedValue(() => {
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

// Helper to get contrast color
const getContrastColor = (hex: string) => {
  if (!hex || hex.includes('NaN')) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
};

// Memoized Mode Toggle
const ModeTogglePill = memo(({ 
  currentMode, 
  onModeChange, 
  theme 
}: { 
  currentMode: 'raw' | 'sync' | 'play', 
  onModeChange: (mode: 'raw' | 'sync' | 'play') => void, 
  theme: any 
}) => {
  const { enableFancyAnimations, colorScheme } = useAppSettings();
  const modes: ('raw' | 'sync' | 'play')[] = ['raw', 'sync', 'play'];
  const activeIndex = modes.indexOf(currentMode);
  
  const indicatorPosition = useSharedValue(activeIndex);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    indicatorPosition.value = withSpring(activeIndex, {
      damping: 20,
      stiffness: 150,
      mass: 0.5,
    });
  }, [activeIndex]);

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    const segmentWidth = containerWidth / modes.length;
    return {
      transform: [{ translateX: indicatorPosition.value * segmentWidth }],
      width: segmentWidth,
    };
  });

  const isWeb = Platform.OS === 'web';
  const showBlur = enableFancyAnimations && !isWeb;
  const contrastColor = getContrastColor(theme.tint);

  return (
    <View 
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={[
        styles.pill, 
        { backgroundColor: theme.border },
        enableFancyAnimations && { 
          backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', 
          borderWidth: 0,
          overflow: 'hidden' 
        }
      ]}
    >
      {showBlur && (
        <BlurView 
          intensity={colorScheme === 'dark' ? 20 : 30} 
          tint={colorScheme === 'dark' ? 'dark' : 'light'} 
          style={StyleSheet.absoluteFill} 
        />
      )}
      
      {enableFancyAnimations && containerWidth > 0 && (
        <Animated.View style={[
          styles.activeIndicator, 
          { backgroundColor: theme.tint },
          animatedIndicatorStyle,
          { 
            borderRadius: 16,
            shadowColor: theme.tint,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5,
          }
        ]} />
      )}
      {modes.map((mode) => (
        <TouchableOpacity
          key={mode}
          activeOpacity={0.7}
          style={[
            styles.pillSegment,
            !enableFancyAnimations && currentMode === mode && { backgroundColor: theme.tint }
          ]}
          onPress={() => onModeChange(mode)}
        >
          <Text 
            style={[
              styles.pillText, 
              { color: currentMode === mode 
                ? (enableFancyAnimations ? contrastColor : theme.background) 
                : theme.secondaryText 
              },
              enableFancyAnimations && currentMode === mode && {
                textShadowColor: contrastColor === '#ffffff' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }
            ]}
          >
            {mode.toUpperCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});

// Safe Haptics helper
const triggerHaptic = (type: 'light' | 'medium' | 'success') => {
  if (Platform.OS === 'web') return;
  try {
    if (type === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (e) {
    console.warn('Haptics not available in this build');
  }
};

export default function EditorScreen() {
  const { colorScheme, pauseOnEnd, rewindAmount, enableFancyAnimations, desktopMode } = useAppSettings();
  const isDesktopBuild = process.env.EXPO_PUBLIC_DESKTOP === 'true';
  const showDesktopLayout = isDesktopBuild && desktopMode;
  const theme = useTheme();
  const { registerLayout, isVisible: isTutorialVisible, currentStep, steps } = useTutorial();

  const isTutorialFABStep = isTutorialVisible && steps[currentStep]?.targetKey === 'fab_sync';

  // Storage Keys for Auto-save
  const EDITOR_STORAGE_KEYS = useMemo(() => ({
    RAW_LRC: '@echo_editor_raw_lrc',
    TRACK: '@echo_editor_track',
    ARTIST: '@echo_editor_artist',
    ALBUM: '@echo_editor_album',
    AUTOFILL_HINT: '@echo_editor_dont_show_autofill_hint',
  }), []);

  // Audio state
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const positionSV = useSharedValue(0);
  const [duration, setDuration] = useState(0);
  const [audioFile, setAudioFile] = useState<{ uri: string; name: string } | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [manualRate, setManualRate] = useState('1.0');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Autofill Modal state
  const [showAutofillModal, setShowAutofillModal] = useState(false);
  const [dontShowAutofillHint, setDontShowAutofillHint] = useState(false);
  const [okButtonVisible, setOkButtonVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const okTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Lyrics state
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [rawLRC, setRawLRC] = useState('');
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoRedoAction = useRef(false);
  const [editorMode, setEditorMode] = useState<'raw' | 'sync' | 'play'>('raw');
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [rhythmMode, setRhythmMode] = useState(false);
  const isInternalUpdate = useRef(false);

  // Metadata state
  const [trackName, setTrackName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [albumName, setAlbumName] = useState('');

  // Undo/Redo logic
  const addToHistory = (text: string) => {
    setHistory(prev => {
      if (text === prev[historyIndex]) return prev;
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(text);
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => {
      const newLen = Math.min(history.length + 1, 51);
      const nextIndex = history.slice(0, historyIndex + 1).length;
      return nextIndex;
    });
  };

  const undo = () => {
    if (historyIndex > 0) {
      isUndoRedoAction.current = true;
      const prev = history[historyIndex - 1];
      setRawLRC(prev);
      setHistoryIndex(historyIndex - 1);
      triggerHaptic('light');
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      isUndoRedoAction.current = true;
      const next = history[historyIndex + 1];
      setRawLRC(next);
      setHistoryIndex(historyIndex + 1);
      triggerHaptic('light');
    }
  };

  // Debounced history tracking
  useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    const timer = setTimeout(() => {
      addToHistory(rawLRC);
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [rawLRC]);

  // Auto-save logic
  useEffect(() => {
    const saveProgress = async () => {
      try {
        await Promise.all([
          AsyncStorage.setItem(EDITOR_STORAGE_KEYS.RAW_LRC, rawLRC),
          AsyncStorage.setItem(EDITOR_STORAGE_KEYS.TRACK, trackName),
          AsyncStorage.setItem(EDITOR_STORAGE_KEYS.ARTIST, artistName),
          AsyncStorage.setItem(EDITOR_STORAGE_KEYS.ALBUM, albumName),
        ]);
      } catch (e) {
        console.error('Auto-save failed:', e);
      }
    };
    if (rawLRC || trackName || artistName) {
      saveProgress();
    }
  }, [rawLRC, trackName, artistName, albumName, EDITOR_STORAGE_KEYS]);

  // Initial load
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const [lrc, track, artist, album, hintSuppressed] = await Promise.all([
          AsyncStorage.getItem(EDITOR_STORAGE_KEYS.RAW_LRC),
          AsyncStorage.getItem(EDITOR_STORAGE_KEYS.TRACK),
          AsyncStorage.getItem(EDITOR_STORAGE_KEYS.ARTIST),
          AsyncStorage.getItem(EDITOR_STORAGE_KEYS.ALBUM),
          AsyncStorage.getItem(EDITOR_STORAGE_KEYS.AUTOFILL_HINT),
        ]);
        if (lrc) setRawLRC(lrc);
        if (track) setTrackName(track);
        if (artist) setArtistName(artist);
        if (album) setAlbumName(album);
        if (hintSuppressed === 'true') setDontShowAutofillHint(true);
      } catch (e) {
        console.error('Initial load failed:', e);
      }
    };
    loadProgress();
  }, [EDITOR_STORAGE_KEYS]);
  
  // Refs
  const playerScrollRef = useRef<ScrollView>(null);
  const lineHeights = useRef<{ [key: number]: number }>({});
  
  // FAB / Syncing state
  const [syncState, setSyncState] = useState<'idle' | 'capturing_start' | 'capturing_end'>('idle');
  const [currentLineStart, setCurrentLineStart] = useState<number | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  // Share / Export state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareStep, setShareStep] = useState<'options' | 'lrclib'>('options');
  const [showWebView, setShowWebView] = useState(false);

  const getLrclibUpUrl = () => {
    const baseUrl = 'https://lrclibup.boidu.dev/';
    const params = new URLSearchParams();
    
    // Using 'title' as expected by the website
    if (trackName) params.set('title', trackName);
    if (artistName) params.set('artist', artistName);
    if (albumName) params.set('album', albumName);
    
    // Attempt to extract duration from [length:mm:ss.xx] if state is 0
    let effectiveDuration = duration;
    if (effectiveDuration <= 0) {
      const lengthMatch = rawLRC.match(/\[length:\s*(\d+):(\d+)\.?(\d*)\]/i);
      if (lengthMatch) {
        effectiveDuration = parseInt(lengthMatch[1], 10) * 60 + parseInt(lengthMatch[2], 10);
      }
    }

    if (effectiveDuration > 0) {
      params.set('duration', Math.round(effectiveDuration).toString());
    }
    
    // Website currently doesn't support lyrics via URL params, 
    // but we'll keep them here for future-proofing and use injectedJavaScript
    if (isSynced(rawLRC)) {
      params.set('syncedLyrics', rawLRC);
    } else {
      params.set('plainLyrics', rawLRC);
    }
    
    return `${baseUrl}?${params.toString()}`;
  };

  const getInjectedJS = () => {
    const isSyncedLyrics = isSynced(rawLRC);
    const plainLyrics = isSyncedLyrics 
      ? rawLRC.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim() 
      : rawLRC;
    
    // Re-extract duration for injected JS
    let effectiveDuration = duration;
    if (effectiveDuration <= 0) {
      const lengthMatch = rawLRC.match(/\[length:\s*(\d+):(\d+)\.?(\d*)\]/i);
      if (lengthMatch) {
        effectiveDuration = parseInt(lengthMatch[1], 10) * 60 + parseInt(lengthMatch[2], 10);
      }
    }
      
    const script = `
      (function() {
        var attempts = 0;
        var maxAttempts = 50;
        var interval = setInterval(function() {
          attempts++;
          var track = document.getElementById('trackName');
          var artist = document.getElementById('artistName');
          var plain = document.getElementById('plainLyrics');
          var synced = document.getElementById('syncedLyrics');
          var dur = document.getElementById('duration');

          if ((track && artist && (plain || synced)) || attempts > maxAttempts) {
            clearInterval(interval);
            
            function fill(el, value) {
              if (el && value) {
                try {
                  var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                  var nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
                  
                  if (el.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
                    nativeTextAreaValueSetter.call(el, value);
                  } else if (el.tagName === 'INPUT' && nativeInputValueSetter) {
                    nativeInputValueSetter.call(el, value);
                  } else {
                    el.value = value;
                  }
                  
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                  // Some Svelte versions respond better to this
                  el.dispatchEvent(new Event('blur', { bubbles: true }));
                } catch (e) {}
              }
            }

            function doFill() {
              fill(document.getElementById('trackName'), ${JSON.stringify(trackName)});
              fill(document.getElementById('artistName'), ${JSON.stringify(artistName)});
              fill(document.getElementById('albumName'), ${JSON.stringify(albumName)});
              fill(document.getElementById('duration'), ${JSON.stringify(effectiveDuration > 0 ? Math.round(effectiveDuration).toString() : '')});
              fill(document.getElementById('plainLyrics'), ${JSON.stringify(plainLyrics)});
              fill(document.getElementById('syncedLyrics'), ${JSON.stringify(isSyncedLyrics ? rawLRC : '')});
            }

            doFill();
            // Second pass after a short delay for Svelte hydration/reactivity
            setTimeout(doFill, 500);
          }
        }, 200);
      })();
      true;
    `;
    return script;
  };

  const handleExportLRC = async () => {
    if (!rawLRC) {
      Alert.alert('Empty Lyrics', 'There are no lyrics to export.');
      return;
    }

    const safeFilename = (trackName || 'lyrics').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${safeFilename}.lrc`;

    // 1. Handle Web Download
    if (Platform.OS === 'web') {
      const element = document.createElement("a");
      const file = new Blob([rawLRC], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = filename;
      document.body.appendChild(element);
      element.click();
      setShowShareModal(false);
      return;
    }

    try {
      // 2. Handle Android "Download" (Save to Folder)
      if (Platform.OS === 'android') {
        if (FileSystem.StorageAccessFramework) {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const uri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              filename,
              'text/plain'
            );
            await FileSystem.writeAsStringAsync(uri, rawLRC, { encoding: 'utf8' });
            Alert.alert('Success', `Saved ${filename} to folder.`);
            setShowShareModal(false);
            return;
          }
        } else {
          console.warn('StorageAccessFramework is undefined. Falling back to Share sheet.');
        }
      }

      // 3. Fallback for iOS/Others or Android if SAF is unavailable: Use System Share Sheet
      const fileUri = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + filename;
      await FileSystem.writeAsStringAsync(fileUri, rawLRC, { 
        encoding: 'utf8' 
      });
      
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: 'Export LRC File',
          mimeType: 'text/plain',
        });
      } else {
        Alert.alert('Sharing Unavailable', 'Could not open share sheet.');
      }
      setShowShareModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unknown error occurred during export.');
    }
  };

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  useEffect(() => {
    if (sound) {
      sound.setRateAsync(playbackRate, true);
    }
  }, [playbackRate, sound]);

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      const pos = status.positionMillis / 1000;
      setPosition(pos);
      positionSV.value = pos;
      setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
      setIsPlaying(status.isPlaying);
    }
  };

  const parseMetadataFromFilename = (filename: string) => {
    // 1. Remove extension and clean up common suffixes
    let name = filename.replace(/\.[^/.]+$/, "");
    name = name.replace(/\s*[\(\[][^)]*(?:official|video|audio|lyrics|hd|4k|remastered)[^)]*[\)\]]/gi, "").trim();
    
    // 2. Try common separators: " - ", " – ", " — ", " _ "
    const parts = name.split(/\s*(?:\s-\s|\s–\s|\s—\s|\s_\s)\s*/);

    if (parts.length >= 4) {
      // Pattern: Artist - Album - TrackNo - Title or similar
      setArtistName(parts[0].trim());
      setAlbumName(parts[1].trim());
      setTrackName(parts.slice(3).join(" - ").trim());
    } else if (parts.length === 3) {
      // Pattern: Artist - Album - Title
      setArtistName(parts[0].trim());
      setAlbumName(parts[1].trim());
      setTrackName(parts[2].trim());
    } else if (parts.length === 2) {
      // Pattern: Artist - Title
      setArtistName(parts[0].trim());
      setTrackName(parts[1].trim());
    } else {
      // No standard separator found, try to clean track numbers from start
      setTrackName(name.replace(/^\d+[\s\.\-_]+/, "").trim());
    }

    // 3. Final cleanup: Remove track numbers like "01. ", "02 - " from trackName
    setTrackName(prev => prev.replace(/^\d+[\s\.\-_]+/, "").trim());
  };

  const pickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setAudioFile({ uri: asset.uri, name: asset.name });
      parseMetadataFromFilename(asset.name);

      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: asset.uri },
        { 
          shouldPlay: false,
          rate: playbackRate,
          shouldCorrectPitch: true,
          progressUpdateIntervalMillis: 100, // Smoother updates for player
        },
        onPlaybackStatusUpdate
      );
      setSound(newSound);
    }
  };

  const togglePlayback = async () => {
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  };

  const stopPlayback = async () => {
    if (!sound) return;
    await sound.stopAsync();
    await sound.setPositionAsync(0);
  };

  const onSliderValueChange = async (value: number) => {
    if (sound) {
      await sound.setPositionAsync(value * 1000);
      positionSV.value = value;
    }
  };

  const nudgePosition = async (seconds: number) => {
    if (!sound) return;
    const newPos = Math.max(0, Math.min(duration, position + seconds));
    await sound.setPositionAsync(newPos * 1000);
    triggerHaptic('light');
  };

  const handleFABPress = async () => {
    triggerHaptic('light');
    setEditingLineId(null);
    setPendingText('');
    if (syncState === 'idle') {
      setSyncState('capturing_start');
      setCurrentLineStart(position);
    } else if (syncState === 'capturing_start') {
      if (pauseOnEnd && sound) {
        await sound.pauseAsync();
        const rewindPos = Math.max(0, position - rewindAmount);
        await sound.setPositionAsync(rewindPos * 1000);
      }
      setSyncState('capturing_end');
      setShowTextInput(true);
    }
  };

  const handleEditLine = (line: LyricLine) => {
    setEditingLineId(line.id);
    setPendingText(line.text);
    setShowTextInput(true);
  };

  const saveLyricLine = () => {
    triggerHaptic('success');
    let updatedLyrics = [...lyrics];

    if (editingLineId) {
      updatedLyrics = updatedLyrics.map((l) => 
        l.id === editingLineId ? { ...l, text: pendingText } : l
      );
    } else if (currentLineStart !== null) {
      const newLine: LyricLine = {
        id: Math.random().toString(36).substr(2, 9),
        start: currentLineStart,
        end: position,
        text: pendingText,
      };
      updatedLyrics.push(newLine);
    }
    
    updatedLyrics.sort((a, b) => a.start - b.start);
    isInternalUpdate.current = true;
    setLyrics(updatedLyrics);
    setRawLRC(formatLyricsToLRC(updatedLyrics));
    
    setPendingText('');
    setShowTextInput(false);
    setSyncState('idle');
    setCurrentLineStart(null);
    setEditingLineId(null);
  };

  const handleToggleExpand = (id: string) => {
    const next = new Set(expandedLines);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedLines(next);
  };

  const handleSyllableSync = (lineId: string, wordIdx: number, time: number) => {
    triggerHaptic('light');
    const updatedLyrics = lyrics.map(l => {
      if (l.id === lineId) {
        // If syllables don't exist yet, initialize them from text
        const syllables = l.syllables || l.text.split(' ').filter(w => w.trim()).map(w => ({ time: 0, text: w }));
        const nextSyllables = [...syllables];
        
        // Toggle logic: if already has time, reset it to 0
        if (nextSyllables[wordIdx].time > 0) {
          nextSyllables[wordIdx] = { ...nextSyllables[wordIdx], time: 0 };
        } else {
          nextSyllables[wordIdx] = { ...nextSyllables[wordIdx], time };
        }

        // Check if any syllable still has a timestamp
        const hasAnySyllable = nextSyllables.some(s => s.time > 0);
        
        return { 
          ...l, 
          syllables: hasAnySyllable ? nextSyllables : undefined 
        };
      }
      return l;
    });
    isInternalUpdate.current = true;
    setLyrics(updatedLyrics);
    setRawLRC(formatLyricsToLRC(updatedLyrics));
  };

  const deleteLyricLine = (id: string) => {
    const updatedLyrics = lyrics.filter((l) => l.id !== id);
    isInternalUpdate.current = true;
    setLyrics(updatedLyrics);
    setRawLRC(formatLyricsToLRC(updatedLyrics));
  };

  const handleRawLRCChange = (text: string) => {
    isInternalUpdate.current = false;
    setRawLRC(text);
  };

  useEffect(() => {
    if (editorMode !== 'raw' && !isInternalUpdate.current) {
      setLyrics(parseLRCToLyrics(rawLRC));
    }
    isInternalUpdate.current = false;
  }, [editorMode, rawLRC]);

  const currentLineIndex = lyrics.findIndex((line, index) => {
    const nextLine = lyrics[index + 1];
    return position >= line.start && (!nextLine || position < nextLine.start);
  });

  // Auto-scroll effect
  useEffect(() => {
    if (editorMode === 'play' && currentLineIndex !== -1 && playerScrollRef.current) {
      let offset = 0;
      for (let i = 0; i < currentLineIndex; i++) {
        // Approximate height if not measured yet
        offset += lineHeights.current[i] || 60; 
      }
      
      playerScrollRef.current.scrollTo({
        y: offset,
        animated: true,
      });
    }
  }, [currentLineIndex, editorMode]);

  const handleReset = () => {
    const performReset = async () => {
      // Audio reset
      if (sound) {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch (e) {
          console.warn('Error unloading sound during reset:', e);
        }
      }
      setSound(null);
      setAudioFile(null);
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);

      // Lyrics & Metadata reset
      setRawLRC('');
      setLyrics([]);
      setTrackName('');
      setArtistName('');
      setAlbumName('');
      
      // UI State reset
      setEditorMode('raw');
      setSyncState('idle');
      setCurrentLineStart(null);
      setShowTextInput(false);
      setPendingText('');
      setEditingLineId(null);
      setShowShareModal(false);
      setShowWebView(false);

      // Persistence reset
      try {
        await AsyncStorage.multiRemove(Object.values(EDITOR_STORAGE_KEYS));
      } catch (e) {
        console.error('Failed to clear storage during reset:', e);
      }

      triggerHaptic('success');
      
      // On web, sometimes a slight delay helps with UI consistency
      if (Platform.OS === 'web') {
        setTimeout(() => {
          // Force UI update if needed, though state updates should be enough
        }, 100);
      }
    };

    if (Platform.OS === 'web') {
      // Use standard window.confirm on web for better reliability if Alert polyfill is tricky
      if (window.confirm('Reset Editor? This will clear all lyrics, metadata, and the attached audio.')) {
        performReset();
      }
    } else {
      Alert.alert(
        'Reset Editor',
        'This will clear all lyrics, metadata, and the attached audio. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Reset', 
            style: 'destructive',
            onPress: performReset
          }
        ]
      );
    }
  };

  const applyOffset = (ms: number) => {
    const seconds = ms / 1000;
    const updatedLyrics = lyrics.map(l => ({
      ...l,
      start: Math.max(0, l.start + seconds),
      end: l.end ? Math.max(0, l.end + seconds) : null,
    }));
    setLyrics(updatedLyrics);
    setRawLRC(formatLyricsToLRC(updatedLyrics));
    triggerHaptic('medium');
  };

  useEffect(() => {
    return () => {
      if (okTimerRef.current) clearTimeout(okTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (showSearchModal && !searchQuery) {
      const initialQuery = artistName && trackName ? `${artistName} ${trackName}` : trackName || artistName || '';
      setSearchQuery(initialQuery);
    }
  }, [showSearchModal]);

  const handleLrclibSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert('Search Failed', 'Could not connect to LRCLIB.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportLrc = (item: any) => {
    const performImport = () => {
      if (item.syncedLyrics) {
        setRawLRC(item.syncedLyrics);
      } else if (item.plainLyrics) {
        setRawLRC(item.plainLyrics);
      }

      if (item.trackName) setTrackName(item.trackName);
      if (item.artistName) setArtistName(item.artistName);
      if (item.albumName) setAlbumName(item.albumName);

      setShowSearchModal(false);
      setSearchResults([]);
      setSearchQuery('');
      triggerHaptic('success');
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Import lyrics for "${item.trackName}"? This will overwrite your current lyrics.`)) {
        performImport();
      }
    } else {
      Alert.alert(
        'Import Lyrics',
        `Import lyrics for "${item.trackName}"? This will overwrite your current lyrics.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Import', 
            onPress: performImport
          }
        ]
      );
    }
  };
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayback();
          break;
        case 'Enter':
          e.preventDefault();
          handleFABPress();
          break;
        case 'ArrowRight':
          if (sound) {
            e.preventDefault();
            sound.setPositionAsync((position + 5) * 1000);
          }
          break;
        case 'ArrowLeft':
          if (sound) {
            e.preventDefault();
            sound.setPositionAsync(Math.max(0, position - 5) * 1000);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [sound, position, syncState, isPlaying, pauseOnEnd, rewindAmount]);

  const handlePublish = async () => {
    const trimmedTrack = trackName.trim();
    const trimmedArtist = artistName.trim();

    if (!trimmedTrack || !trimmedArtist) {
      Alert.alert('Metadata Required', 'Please enter at least Track Name and Artist Name.');
      return;
    }

    setShowShareModal(false);

    if (dontShowAutofillHint) {
      setShowWebView(true);
    } else {
      setShowAutofillModal(true);
      setOkButtonVisible(false);
      setCountdown(5);
      
      if (okTimerRef.current) clearTimeout(okTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      okTimerRef.current = setTimeout(() => {
        setOkButtonVisible(true);
      }, 5000);
    }
  };

  const handleAutofillOk = async () => {
    if (dontShowAutofillHint) {
      try {
        await AsyncStorage.setItem(EDITOR_STORAGE_KEYS.AUTOFILL_HINT, 'true');
      } catch (e) {
        console.error('Failed to save autofill hint preference:', e);
      }
    }
    setShowAutofillModal(false);
    setShowWebView(true);
  };

  const handleCopyToClipboard = (content: string, type: 'lyrics' | 'duration') => {
    import('expo-clipboard').then(Clipboard => {
      Clipboard.setStringAsync(content);
      triggerHaptic('success');
      
      setCopyFeedback(type === 'lyrics' ? 'Lyrics copied!' : 'Duration copied!');
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setCopyFeedback(null);
      }, 2000);
    });
  };


  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      
      {/* Audio Controls */}
      <TutorialView 
        style={styles.audioControls}
        targetKey="audio_controls"
      >
        <TouchableOpacity 
          onPress={pickAudio} 
          style={[styles.fileButton, { borderColor: theme.border }]}
        >
          <FileMusic color={theme.tint} size={24} />
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Text style={styles.fileName} numberOfLines={1}>
              {audioFile ? audioFile.name : 'Load MP3'}
            </Text>
            {audioFile && (
              <Text style={[styles.metaHint, { color: theme.secondaryText }]}>
                {artistName ? `${artistName} - ${trackName}` : 'No metadata found'}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.sliderRow}>
          <Slider
            style={{ flex: 1, height: 40 }}
            minimumValue={0}
            maximumValue={duration || 1}
            value={position}
            onSlidingComplete={onSliderValueChange}
            minimumTrackTintColor={theme.tint}
            maximumTrackTintColor={theme.border}
            thumbTintColor={theme.tint}
          />
          <Text style={[styles.timeText, { color: theme.secondaryText }]}>
            {formatTime(position)} / {formatTime(duration)}
          </Text>
        </View>

        <View style={styles.playbackButtons}>
          <TouchableOpacity onPress={() => setShowRateModal(true)} style={styles.controlButton}>
            <Gauge color={theme.tint} size={24} />
            <Text style={[styles.controlButtonText, { color: theme.tint }]}>{playbackRate.toFixed(2)}x</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlayback} disabled={!sound}>
            {isPlaying ? (
              <Pause color={theme.tint} size={32} />
            ) : (
              <Play color={theme.tint} size={32} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={stopPlayback} disabled={!sound}>
            <Square color={theme.tint} size={32} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowSearchModal(true)} style={styles.controlButton}>
            <Search color={theme.tint} size={24} />
          </TouchableOpacity>
        </View>

        <TutorialView 
          style={styles.nudgeRow}
          targetKey="nudge_controls"
        >
          <TouchableOpacity onPress={() => nudgePosition(-5)} style={[styles.nudgeButton, { borderColor: theme.border }]}>
            <ChevronFirst color={theme.secondaryText} size={18} />
            <Text style={[styles.nudgeText, { color: theme.secondaryText }]}>-5s</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => nudgePosition(-1)} style={[styles.nudgeButton, { borderColor: theme.border }]}>
            <Rewind color={theme.secondaryText} size={18} />
            <Text style={[styles.nudgeText, { color: theme.secondaryText }]}>-1s</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => nudgePosition(-0.5)} style={[styles.nudgeButton, { borderColor: theme.border }]}>
             <Text style={[styles.nudgeText, { color: theme.tint }]}>-0.5s</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => nudgePosition(0.5)} style={[styles.nudgeButton, { borderColor: theme.border }]}>
             <Text style={[styles.nudgeText, { color: theme.tint }]}>+0.5s</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => nudgePosition(1)} style={[styles.nudgeButton, { borderColor: theme.border }]}>
            <FastForward color={theme.secondaryText} size={18} />
            <Text style={[styles.nudgeText, { color: theme.secondaryText }]}>+1s</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => nudgePosition(5)} style={[styles.nudgeButton, { borderColor: theme.border }]}>
            <ChevronLast color={theme.secondaryText} size={18} />
            <Text style={[styles.nudgeText, { color: theme.secondaryText }]}>+5s</Text>
          </TouchableOpacity>
        </TutorialView>
      </TutorialView>

      {/* Mode Toggle Pill */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity onPress={handleReset} style={{ padding: 4 }}>
          <Trash2 color="#ff4444" size={24} />
        </TouchableOpacity>
        <TutorialView 
          style={{ flex: 1, height: 40, justifyContent: 'center' }}
          targetKey="mode_toggle"
        >
          <ModeTogglePill 
            currentMode={editorMode} 
            onModeChange={setEditorMode} 
            theme={theme} 
          />
        </TutorialView>
        <TutorialView 
          targetKey="share_button"
        >
          <TouchableOpacity 
            onPress={() => {
              setShareStep('options');
              setShowShareModal(true);
            }}
            style={{ padding: 4 }}
          >
            <Share color={theme.tint} size={24} />
          </TouchableOpacity>
        </TutorialView>
      </View>

      {/* Content Area */}
      {showDesktopLayout ? (
        <View style={styles.desktopLayout}>
          <View style={[styles.desktopEditor, { borderColor: theme.border }]}>
            <EditorContent editorMode={editorMode} lyrics={lyrics} theme={theme} expandedLines={expandedLines} rhythmMode={rhythmMode} currentLineIndex={currentLineIndex} position={position} historyIndex={historyIndex} history={history} rawLRC={rawLRC} playerScrollRef={playerScrollRef} lineHeights={lineHeights} positionSV={positionSV} TutorialView={TutorialView} handleToggleExpand={handleToggleExpand} setRhythmMode={setRhythmMode} handleEditLine={handleEditLine} deleteLyricLine={deleteLyricLine} onSliderValueChange={onSliderValueChange} handleSyllableSync={handleSyllableSync} applyOffset={applyOffset} undo={undo} redo={redo} handleRawLRCChange={handleRawLRCChange} />
          </View>
          <View style={styles.desktopRightColumn}>
            <View style={[styles.desktopPlayer, { borderColor: theme.border }]}>
              <EditorContent editorMode="play" lyrics={lyrics} theme={theme} expandedLines={expandedLines} rhythmMode={rhythmMode} currentLineIndex={currentLineIndex} position={position} historyIndex={historyIndex} history={history} rawLRC={rawLRC} playerScrollRef={playerScrollRef} lineHeights={lineHeights} positionSV={positionSV} TutorialView={TutorialView} handleToggleExpand={handleToggleExpand} setRhythmMode={setRhythmMode} handleEditLine={handleEditLine} deleteLyricLine={deleteLyricLine} onSliderValueChange={onSliderValueChange} handleSyllableSync={handleSyllableSync} applyOffset={applyOffset} undo={undo} redo={redo} handleRawLRCChange={handleRawLRCChange} />
            </View>
            <View style={[styles.desktopControls, { borderColor: theme.border }]}>
              <View style={styles.desktopAudioControls}>
                <TouchableOpacity onPress={pickAudio} style={[styles.fileButton, { borderColor: theme.border }]}>
                  <FileMusic color={theme.tint} size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName} numberOfLines={1}>{audioFile ? audioFile.name : 'Load MP3'}</Text>
                    {audioFile && <Text style={[styles.metaHint, { color: theme.secondaryText }]}>{artistName ? `${artistName} - ${trackName}` : 'No metadata found'}</Text>}
                  </View>
                </TouchableOpacity>
                <View style={styles.sliderRow}>
                  <Slider style={{ flex: 1, height: 30 }} minimumValue={0} maximumValue={duration || 1} value={position} onSlidingComplete={onSliderValueChange} minimumTrackTintColor={theme.tint} maximumTrackTintColor={theme.border} thumbTintColor={theme.tint} />
                  <Text style={[styles.timeText, { color: theme.secondaryText }]}>{formatTime(position)} / {formatTime(duration)}</Text>
                </View>
                <View style={styles.playbackButtons}>
                  <TouchableOpacity onPress={() => setShowRateModal(true)} style={styles.controlButton}>
                    <Gauge color={theme.tint} size={20} />
                    <Text style={[styles.controlButtonText, { color: theme.tint }]}>{playbackRate.toFixed(2)}x</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={togglePlayback} disabled={!sound}>
                    {isPlaying ? <Pause color={theme.tint} size={28} /> : <Play color={theme.tint} size={28} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={stopPlayback} disabled={!sound}>
                    <Square color={theme.tint} size={28} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowSearchModal(true)} style={styles.controlButton}>
                    <Search color={theme.tint} size={20} />
                  </TouchableOpacity>
                </View>
                <View style={styles.nudgeRow}>
                  <TouchableOpacity onPress={() => nudgePosition(-5)} style={[styles.nudgeButton, { borderColor: theme.border }]}>
                    <Text style={[styles.nudgeText, { color: theme.secondaryText }]}>-5s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => nudgePosition(-1)} style={[styles.nudgeButton, { borderColor: theme.border }]}>
                    <Text style={[styles.nudgeText, { color: theme.secondaryText }]}>-1s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => nudgePosition(0.5)} style={[styles.nudgeButton, { borderColor: theme.border }]}>
                    <Text style={[styles.nudgeText, { color: theme.tint }]}>-0.5s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => nudgePosition(0.5)} style={[styles.nudgeButton, { borderColor: theme.border }]}>
                    <Text style={[styles.nudgeText, { color: theme.tint }]}>+0.5s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => nudgePosition(1)} style={[styles.nudgeButton, { borderColor: theme.border }]}>
                    <Text style={[styles.nudgeText, { color: theme.secondaryText }]}>+1s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => nudgePosition(5)} style={[styles.nudgeButton, { borderColor: theme.border }]}>
                    <Text style={[styles.nudgeText, { color: theme.secondaryText }]}>+5s</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.contentArea, { borderColor: theme.border }]}>
          <EditorContent editorMode={editorMode} lyrics={lyrics} theme={theme} expandedLines={expandedLines} rhythmMode={rhythmMode} currentLineIndex={currentLineIndex} position={position} historyIndex={historyIndex} history={history} rawLRC={rawLRC} playerScrollRef={playerScrollRef} lineHeights={lineHeights} positionSV={positionSV} TutorialView={TutorialView} handleToggleExpand={handleToggleExpand} setRhythmMode={setRhythmMode} handleEditLine={handleEditLine} deleteLyricLine={deleteLyricLine} onSliderValueChange={onSliderValueChange} handleSyllableSync={handleSyllableSync} applyOffset={applyOffset} undo={undo} redo={redo} handleRawLRCChange={handleRawLRCChange} />
        </View>
      )}

      {/* FAB */}
      {(editorMode === 'sync' && (sound || isTutorialFABStep)) && (
        <TutorialView
          targetKey="fab_sync"
          style={styles.fabContainer}
        >
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: theme.tint, position: 'relative', bottom: 0, right: 0 }]}
            onPress={handleFABPress}
          >
            {syncState === 'idle' ? (
              <Plus color={theme.background} size={32} />
            ) : syncState === 'capturing_start' ? (
              <Text style={[styles.fabText, { color: theme.background }]}>END</Text>
            ) : (
              <Save color={theme.background} size={32} />
            )}
          </TouchableOpacity>
        </TutorialView>
      )}

      {/* Text Input Modal for FAB Sync & Editing */}
      <Modal visible={showTextInput} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {enableFancyAnimations && Platform.OS !== 'web' && (
            <BlurView intensity={25} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <View style={[
            styles.modalContent, 
            { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 },
            enableFancyAnimations && { backgroundColor: theme.background + 'CC' }
          ]}>
            <Text style={styles.modalTitle}>
              {editingLineId ? 'Edit Lyric' : 'Enter Lyric Text'}
            </Text>
            <TextInput
              style={[styles.textInput, { color: theme.text, borderColor: theme.border }]}
              value={pendingText}
              onChangeText={setPendingText}
              autoFocus
              placeholder="Type the lyric..."
              placeholderTextColor={theme.secondaryText}
            />

            <View style={styles.modalActions}>
               <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.border, marginRight: 10 }]}
                onPress={() => {
                  setShowTextInput(false);
                  setSyncState('idle');
                  setEditingLineId(null);
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.tint, flex: 1 }]}
                onPress={saveLyricLine}
              >
                <Text style={[styles.modalButtonText, { color: theme.background }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share / Export Modal */}
      <Modal visible={showShareModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          {enableFancyAnimations && Platform.OS !== 'web' && (
            <BlurView intensity={25} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <View style={[
            styles.modalContent, 
            { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 },
            enableFancyAnimations && { backgroundColor: theme.background + 'CC' }
          ]}>
            {shareStep === 'options' ? (
              <>
                <Text style={styles.modalTitle}>Share & Export</Text>
                
                <TouchableOpacity 
                  style={[styles.shareOption, { borderColor: theme.border }]}
                  onPress={() => setShareStep('lrclib')}
                >
                  <CloudUpload color={theme.tint} size={28} />
                  <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                    <Text style={styles.shareOptionTitle}>Upload to LRCLIB</Text>
                    <Text style={[styles.shareOptionDesc, { color: theme.secondaryText }]}>
                      Submit your lyrics to the public database.
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.shareOption, { borderColor: theme.border }]}
                  onPress={handleExportLRC}
                >
                  <FileDown color={theme.tint} size={28} />
                  <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                    <Text style={styles.shareOptionTitle}>Export as .lrc File</Text>
                    <Text style={[styles.shareOptionDesc, { color: theme.secondaryText }]}>
                      Save or share the raw LRC file.
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.border, marginTop: 10 }]}
                  onPress={() => setShowShareModal(false)}
                >
                  <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.modalHeader, { backgroundColor: 'transparent' }]}>
                  <TouchableOpacity onPress={() => setShareStep('options')}>
                    <ChevronLeft color={theme.tint} size={24} />
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>Publish to LRCLIB</Text>
                  <View style={{ width: 24, backgroundColor: 'transparent' }} />
                </View>

                <TextInput
                  style={[styles.textInput, { color: theme.text, borderColor: theme.border }]}
                  placeholder="Track Name"
                  placeholderTextColor={theme.secondaryText}
                  value={trackName}
                  onChangeText={setTrackName}
                />
                <TextInput
                  style={[styles.textInput, { color: theme.text, borderColor: theme.border }]}
                  placeholder="Artist Name"
                  placeholderTextColor={theme.secondaryText}
                  value={artistName}
                  onChangeText={setArtistName}
                />
                <TextInput
                  style={[styles.textInput, { color: theme.text, borderColor: theme.border }]}
                  placeholder="Album Name"
                  placeholderTextColor={theme.secondaryText}
                  value={albumName}
                  onChangeText={setAlbumName}
                />
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: theme.border, marginRight: 10 }]}
                    onPress={() => setShowShareModal(false)}
                  >
                    <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: theme.tint, flex: 1 }]}
                    onPress={handlePublish}
                  >
                    <Text style={[styles.modalButtonText, { color: theme.background }]}>
                       Upload via LRCLIB UP
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Autofill Hint Modal */}
      <Modal visible={showAutofillModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {enableFancyAnimations && Platform.OS !== 'web' && (
            <BlurView intensity={25} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <View style={[
            styles.modalContent, 
            { backgroundColor: theme.background, maxWidth: 400 },
            enableFancyAnimations && { backgroundColor: theme.background + 'CC' }
          ]}>
            <Text style={styles.modalTitle}>Autofill Note</Text>
            <Text style={[styles.modalSubtitle, { color: theme.secondaryText, marginBottom: 20 }]}>
              Note: Duration and lyrics don't autofill. Press to copy lyrics and duration.
            </Text>

            <View style={{ gap: 10, marginBottom: 20 }}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.tint, flexDirection: 'row', gap: 8 }]}
                onPress={() => handleCopyToClipboard(rawLRC, 'lyrics')}
              >
                <Copy color={theme.background} size={18} />
                <Text style={[styles.modalButtonText, { color: theme.background }]}>Copy Lyrics</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.tint, flexDirection: 'row', gap: 8 }]}
                onPress={() => {
                  let effectiveDuration = duration;
                  if (effectiveDuration <= 0) {
                    const lengthMatch = rawLRC.match(/\[length:\s*(\d+):(\d+)\.?(\d*)\]/i);
                    if (lengthMatch) {
                      effectiveDuration = parseInt(lengthMatch[1], 10) * 60 + parseInt(lengthMatch[2], 10);
                    }
                  }
                  handleCopyToClipboard(Math.round(effectiveDuration).toString(), 'duration');
                }}
              >
                <Copy color={theme.background} size={18} />
                <Text style={[styles.modalButtonText, { color: theme.background }]}>Copy Duration</Text>
              </TouchableOpacity>
            </View>

            {copyFeedback && (
              <View style={{ backgroundColor: theme.tint + '20', padding: 8, borderRadius: 8, marginBottom: 15, alignItems: 'center' }}>
                <Text style={{ color: theme.tint, fontWeight: 'bold', fontSize: 12 }}>{copyFeedback}</Text>
              </View>
            )}

            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}
              onPress={() => setDontShowAutofillHint(!dontShowAutofillHint)}
            >
              {dontShowAutofillHint ? (
                <CheckSquare color={theme.tint} size={20} />
              ) : (
                <Square color={theme.tint} size={20} />
              )}
              <Text style={{ color: theme.text }}>Don't show again</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              {okButtonVisible ? (
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.tint, flex: 1 }]}
                  onPress={handleAutofillOk}
                >
                  <Text style={[styles.modalButtonText, { color: theme.background }]}>OK</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.modalButton, { backgroundColor: theme.border, flex: 1, opacity: 0.5 }]}>
                  <Text style={[styles.modalButtonText, { color: theme.secondaryText }]}>OK ({countdown}s)</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Playback Rate Modal */}
      <Modal visible={showRateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {enableFancyAnimations && Platform.OS !== 'web' && (
            <BlurView intensity={25} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <View style={[
            styles.modalContent, 
            { backgroundColor: theme.background, maxWidth: 400 },
            enableFancyAnimations && { backgroundColor: theme.background + 'CC' }
          ]}>
            <Text style={styles.modalTitle}>Playback Speed</Text>
            
            <View style={styles.rateGrid}>
              {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
                <TouchableOpacity
                  key={rate}
                  style={[
                    styles.rateOption,
                    { borderColor: theme.border },
                    playbackRate === rate && { backgroundColor: theme.tint, borderColor: theme.tint }
                  ]}
                  onPress={() => {
                    setPlaybackRate(rate);
                    setManualRate(rate.toString());
                    setShowRateModal(false);
                  }}
                >
                  <Text style={[
                    styles.rateText,
                    { color: theme.text },
                    playbackRate === rate && { color: theme.background }
                  ]}>{rate.toFixed(2)}x</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ marginTop: 10 }}>
              <Text style={[styles.label, { color: theme.secondaryText }]}>Manual Speed:</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  style={[styles.textInput, { flex: 1, color: theme.text, borderColor: theme.border }]}
                  value={manualRate}
                  onChangeText={setManualRate}
                  keyboardType="numeric"
                  placeholder="e.g. 1.1"
                />
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.tint, paddingHorizontal: 20 }]}
                  onPress={() => {
                    const r = parseFloat(manualRate);
                    if (!isNaN(r) && r > 0 && r <= 4) {
                      setPlaybackRate(r);
                      setShowRateModal(false);
                    } else {
                      Alert.alert('Invalid Speed', 'Please enter a value between 0.1 and 4.0');
                    }
                  }}
                >
                  <Text style={{ color: theme.background, fontWeight: 'bold' }}>Set</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.border, marginTop: 10 }]}
              onPress={() => setShowRateModal(false)}
            >
              <Text style={[styles.modalButtonText, { color: theme.text }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* LRCLIB Search Modal */}
      <Modal visible={showSearchModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          {enableFancyAnimations && Platform.OS !== 'web' && (
            <BlurView intensity={25} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <View style={[
            styles.modalContent, 
            { backgroundColor: theme.background, height: '80%' },
            enableFancyAnimations && { backgroundColor: theme.background + 'CC' }
          ]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import from LRCLIB</Text>
              <TouchableOpacity onPress={() => setShowSearchModal(false)}>
                <X color={theme.text} size={24} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                style={[styles.textInput, { flex: 1, color: theme.text, borderColor: theme.border }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search track or artist..."
                placeholderTextColor={theme.secondaryText}
                onSubmitEditing={handleLrclibSearch}
              />
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.tint, paddingHorizontal: 20 }]}
                onPress={handleLrclibSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <ActivityIndicator color={theme.background} />
                ) : (
                  <Search color={theme.background} size={20} />
                )}
              </TouchableOpacity>
            </View>

            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id.toString()}
              style={{ marginTop: 10 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.searchResultItem, { borderBottomColor: theme.border }]}
                  onPress={() => handleImportLrc(item)}
                >
                  <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                    <Text style={[styles.resultTrack, { color: theme.text }]}>{item.trackName}</Text>
                    <Text style={[styles.resultArtist, { color: theme.secondaryText }]}>
                      {item.artistName} {item.albumName ? `• ${item.albumName}` : ''}
                    </Text>
                  </View>
                  {item.syncedLyrics ? (
                    <View style={[styles.badge, { backgroundColor: theme.tint + '20' }]}>
                      <Text style={{ color: theme.tint, fontSize: 10, fontWeight: 'bold' }}>SYNCED</Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, { backgroundColor: theme.border }]}>
                      <Text style={{ color: theme.secondaryText, fontSize: 10, fontWeight: 'bold' }}>PLAIN</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                !isSearching && searchQuery ? (
                  <Text style={{ textAlign: 'center', marginTop: 40, color: theme.secondaryText }}>
                    No results found.
                  </Text>
                ) : null
              }
            />
          </View>
        </View>
      </Modal>

      {/* WebView Modal */}
      <Modal visible={showWebView} transparent animationType="slide">
        <View style={styles.webViewOverlay}>
          {enableFancyAnimations && Platform.OS !== 'web' && (
            <BlurView intensity={25} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <View style={[
            styles.webViewHeader, 
            { backgroundColor: theme.background, borderBottomColor: theme.border },
            enableFancyAnimations && { backgroundColor: theme.background + 'CC' }
          ]}>
            <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Upload to LRCLIB</Text>
            <TouchableOpacity onPress={() => setShowWebView(false)} style={styles.closeButton}>
              <Text style={{ color: theme.tint, fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <AppWebView 
              source={{ uri: getLrclibUpUrl() }} 
              injectedJavaScript={getInjectedJS()}
              onMessage={(event) => {
                // Handle messages from WebView if needed
              }}
            />
          </View>
        </View>
      </Modal>
      <TutorialOverlay onModeChange={setEditorMode} />
    </View>
  );
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  rawToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    backgroundColor: 'transparent',
  },
  toolButton: {
    padding: 6,
    borderRadius: 8,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  audioControls: {
    marginBottom: 20,
    gap: 10,
  },
  audioControlsContainer: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderRadius: 8,
    margin: 4,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
  },
  metaHint: {
    fontSize: 12,
    marginTop: 2,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeText: {
    fontSize: 12,
    minWidth: 80,
    textAlign: 'right',
    fontFamily: 'SpaceMono',
  },
  playbackButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
  },
  nudgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: 'transparent',
  },
  nudgeButton: {
    alignItems: 'center',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 44,
  },
  nudgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 15,
    backgroundColor: 'transparent',
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    height: 40,
    borderRadius: 20,
    padding: 4,
  },
  pillSegment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    zIndex: 1,
  },
  activeIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 16,
  },
  pillText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  offsetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  offsetLabel: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  offsetButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  contentArea: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    overflow: 'hidden',
  },
  rawInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  lyricList: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  emptyHint: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  lyricLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lyricLineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    backgroundColor: 'transparent',
  },
  timestampPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    width: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lyricTimestamp: {
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
    fontSize: 12,
  },
  lyricText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  expandedContent: {
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 0,
  },
  wordChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: 'transparent',
  },
  wordChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wordChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  wordChipTime: {
    fontSize: 10,
    fontWeight: 'bold',
    opacity: 0.8,
  },
  expandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  rhythmToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rhythmToggleText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  rhythmTapButton: {
    height: 60,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  rhythmTapButtonText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  miniWordChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  miniWordText: {
    fontSize: 12,
    fontWeight: '600',
  },
  positionRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  positionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  positionButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  syllableLineContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginVertical: 12,
  },
  syllableText: {
    fontSize: 22,
    fontWeight: '600',
  },
  playerContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  playerScrollContent: {
    paddingVertical: '50%',
    alignItems: 'center',
  },
  playerLine: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 12,
    paddingHorizontal: 20,
    opacity: 0.6,
  },
  playerLineActive: {
    fontSize: 28,
    fontWeight: '800',
    opacity: 1,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    zIndex: 10,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  fabText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    padding: 24,
    borderRadius: 20,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  shareOptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  modalButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  webViewOverlay: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'ios' ? 50 : 0,
  },
  webViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 10,
  },
  controlButtonText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  rateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginVertical: 10,
  },
  rateOption: {
    width: '22%',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  rateText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  resultTrack: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultArtist: {
    fontSize: 13,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  desktopEditor: {
    flex: 60,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    overflow: 'hidden',
  },
  desktopRightColumn: {
    flex: 40,
    gap: 12,
  },
  desktopPlayer: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    overflow: 'hidden',
  },
  desktopControls: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  desktopAudioControls: {
    gap: 8,
  },
});
