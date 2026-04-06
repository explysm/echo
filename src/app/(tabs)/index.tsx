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
  Info,
} from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppWebView from '@/components/AppWebView';
import TutorialOverlay, { TutorialProvider, useTutorial, TutorialView } from '@/components/TutorialOverlay';
import { BlurView } from 'expo-blur';

import { Text, View, useTheme } from '@/components/Themed';
import DropZone from '@/components/DropZone';
import { useAppSettings } from '@/context/AppSettingsContext';
import { EditorContent } from '@/components/EditorContent';
import { ModeTogglePill } from '@/components/ModeTogglePill';
import * as Clipboard from 'expo-clipboard';
import {
  LyricLine,
  formatLyricsToLRC,
  parseLRCToLyrics,
  isSynced,
  formatLyricsToSRT,
  formatLyricsToVTT,
} from '@/lib/lrclib';
import { getAudioSrc, isAudioFile, isLrcFile, revokeBlobUrl } from '@/lib/audioUtils';

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

function formatTime(seconds: number) {
  if (seconds < 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function EditorScreen() {
  const { colorScheme, pauseOnEnd, rewindAmount, enableFancyAnimations, desktopMode, onePressSync } = useAppSettings();
  const isDesktopBuild = process.env.EXPO_PUBLIC_DESKTOP === 'true';

  useEffect(() => {
    setSyncState('idle');
  }, [onePressSync]);
  const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => setScreenWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);
  
  const showDesktopLayout = desktopMode && screenWidth >= 768;
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
  const hasEnhancedFeatures = lyrics.some(l => l.speaker || l.isBackground);
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
  const [shareStep, setShareStep] = useState<'options' | 'lrclib' | 'export'>('options');
  const [selectedExportFormat, setSelectedExportFormat] = useState<'lrc' | 'srt' | 'vtt'>('lrc');
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

  const handleExport = async () => {
    if (!rawLRC) {
      Alert.alert('Empty Lyrics', 'There are no lyrics to export.');
      return;
    }

    let exportContent: string;
    let filename: string;
    let mimeType: string;
    const baseFilename = (trackName || 'lyrics').replace(/[^a-z0-9]/gi, '_').toLowerCase();

    if (selectedExportFormat === 'lrc') {
      exportContent = rawLRC;
      filename = `${baseFilename}.lrc`;
      mimeType = 'text/plain';
    } else if (selectedExportFormat === 'srt') {
      const parsedLyrics = parseLRCToLyrics(rawLRC);
      exportContent = formatLyricsToSRT(parsedLyrics);
      filename = `${baseFilename}.srt`;
      mimeType = 'text/srt';
    } else {
      const parsedLyrics = parseLRCToLyrics(rawLRC);
      exportContent = formatLyricsToVTT(parsedLyrics);
      filename = `${baseFilename}.vtt`;
      mimeType = 'text/vtt';
    }

    // 1. Handle Web Download
    if (Platform.OS === 'web') {
      const element = document.createElement("a");
      const file = new Blob([exportContent], {type: mimeType});
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
              mimeType
            );
            await FileSystem.writeAsStringAsync(uri, exportContent, { encoding: 'utf8' });
            Alert.alert('Success', `Saved ${filename}`);
            setShowShareModal(false);
            return;
          }
        } else {
          console.warn('StorageAccessFramework is undefined. Falling back to Share sheet.');
        }
      }

      // 3. Fallback for iOS/Others or Android if SAF is unavailable: Use System Share Sheet
      const fileUri = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + filename;
      await FileSystem.writeAsStringAsync(fileUri, exportContent, { 
        encoding: 'utf8' 
      });
      
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: `Export ${selectedExportFormat.toUpperCase()} File`,
          mimeType: mimeType,
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
      if (audioFile?.uri) {
        revokeBlobUrl(audioFile.uri);
      }
      const audioSrc = await getAudioSrc(asset.uri, asset.name);
      setAudioFile({ uri: asset.uri, name: asset.name });
      parseMetadataFromFilename(asset.name);

      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioSrc },
        { 
          shouldPlay: false,
          rate: playbackRate,
          shouldCorrectPitch: true,
          progressUpdateIntervalMillis: 100,
        },
        onPlaybackStatusUpdate
      );
      setSound(newSound);
    }
  };

  const handleAudioDrop = async (file: File) => {
    if (audioFile?.uri) {
      revokeBlobUrl(audioFile.uri);
    }
    const blobUrl = URL.createObjectURL(file);
    setAudioFile({ uri: blobUrl, name: file.name });
    parseMetadataFromFilename(file.name);

    if (sound) {
      await sound.unloadAsync();
    }

    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: blobUrl },
      { 
        shouldPlay: false,
        rate: playbackRate,
        shouldCorrectPitch: true,
        progressUpdateIntervalMillis: 100,
      },
      onPlaybackStatusUpdate
    );
    setSound(newSound);
  };

  const handleLrcDrop = async (file: File) => {
    const text = await file.text();
    setRawLRC(text);
    triggerHaptic('success');
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
    
    if (onePressSync) {
      // Find the first unsynced line (start < 0)
      const firstUnsyncedIndex = lyrics.findIndex(l => l.start < 0);
      
      if (firstUnsyncedIndex !== -1) {
        const updatedLyrics = [...lyrics];
        updatedLyrics[firstUnsyncedIndex] = {
          ...updatedLyrics[firstUnsyncedIndex],
          start: position,
        };
        
        // Recalculate end times
        updatedLyrics.sort((a, b) => {
          if (a.start < 0 && b.start < 0) return 0;
          if (a.start < 0) return 1;
          if (b.start < 0) return -1;
          return a.start - b.start;
        });
        for (let i = 0; i < updatedLyrics.length - 1; i++) {
          updatedLyrics[i].end = updatedLyrics[i + 1].start;
        }
        
        isInternalUpdate.current = true;
        setLyrics(updatedLyrics);
        setRawLRC(formatLyricsToLRC(updatedLyrics));
        setSyncState('idle');
        return;
      }
      
      // If no unsynced lines, we need to add a new one.
      // For "one press", we follow the normal flow but skip the pause.
      if (syncState === 'idle') {
        setSyncState('capturing_start');
        setCurrentLineStart(position);
        triggerHaptic('light');
      } else if (syncState === 'capturing_start') {
        setSyncState('capturing_end');
        setEditingLineId(null);
        setPendingText('');
        setShowTextInput(true);
        triggerHaptic('medium');
      }
      return;
    }

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
    if (onePressSync && line.start < 0) {
      triggerHaptic('light');
      const updatedLyrics = lyrics.map(l => 
        l.id === line.id ? { ...l, start: position } : l
      );
      updatedLyrics.sort((a, b) => {
        if (a.start < 0 && b.start < 0) return 0;
        if (a.start < 0) return 1;
        if (b.start < 0) return -1;
        return a.start - b.start;
      });
      for (let i = 0; i < updatedLyrics.length - 1; i++) {
        updatedLyrics[i].end = updatedLyrics[i + 1].start;
      }
      isInternalUpdate.current = true;
      setLyrics(updatedLyrics);
      setRawLRC(formatLyricsToLRC(updatedLyrics));
      setSyncState('idle');
      return;
    }
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
    
    updatedLyrics.sort((a, b) => {
      if (a.start < 0 && b.start < 0) return 0;
      if (a.start < 0) return 1;
      if (b.start < 0) return -1;
      return a.start - b.start;
    });
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

  const updateLyricLine = (id: string, updates: Partial<LyricLine>) => {
    const updatedLyrics = lyrics.map(l => 
      l.id === id ? { ...l, ...updates } : l
    );
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
  }, [sound, position, syncState, isPlaying, pauseOnEnd, rewindAmount, onePressSync]);

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
    Clipboard.setStringAsync(content);
    triggerHaptic('success');
    
    setCopyFeedback(type === 'lyrics' ? 'Lyrics copied!' : 'Duration copied!');
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setCopyFeedback(null);
    }, 2000);
  };


  return (
    <DropZone onAudioDrop={handleAudioDrop} onLrcDrop={handleLrcDrop}>
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      
      {/* Audio Controls - Hidden in Desktop Mode */}
      {!showDesktopLayout && (
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
      )}

      {/* Mode Toggle Pill - Hidden in Desktop Mode */}
      {!showDesktopLayout && (
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
      )}

      {/* Content Area */}
      {showDesktopLayout ? (
        <View style={styles.desktopLayout}>
          <View style={[styles.desktopEditor, { borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 }}>
              <TouchableOpacity onPress={handleReset} style={{ padding: 4 }}>
                <Trash2 color="#ff4444" size={24} />
              </TouchableOpacity>
              <View style={{ flex: 1, height: 40, justifyContent: 'center' }}>
                <ModeTogglePill 
                  currentMode={editorMode} 
                  onModeChange={setEditorMode} 
                  theme={theme}
                  availableModes={['raw', 'sync']}
                />
              </View>
              <TouchableOpacity 
                onPress={() => {
                  setShareStep('options');
                  setShowShareModal(true);
                }}
                style={{ padding: 4 }}
              >
                <Share color={theme.tint} size={24} />
              </TouchableOpacity>
            </View>
            <EditorContent editorMode={editorMode} lyrics={lyrics} theme={theme} expandedLines={expandedLines} rhythmMode={rhythmMode} currentLineIndex={currentLineIndex} position={position} historyIndex={historyIndex} history={history} rawLRC={rawLRC} playerScrollRef={playerScrollRef} lineHeights={lineHeights} positionSV={positionSV} TutorialView={TutorialView} handleToggleExpand={handleToggleExpand} setRhythmMode={setRhythmMode} handleEditLine={handleEditLine} deleteLyricLine={deleteLyricLine} onSliderValueChange={onSliderValueChange} handleSyllableSync={handleSyllableSync} onUpdateLine={updateLyricLine} applyOffset={applyOffset} undo={undo} redo={redo} handleRawLRCChange={handleRawLRCChange} />
          </View>
          <View style={styles.desktopRightColumn}>
            <View style={[styles.desktopPlayer, { borderColor: theme.border }]}>
              <EditorContent editorMode="play" lyrics={lyrics} theme={theme} expandedLines={expandedLines} rhythmMode={rhythmMode} currentLineIndex={currentLineIndex} position={position} historyIndex={historyIndex} history={history} rawLRC={rawLRC} playerScrollRef={playerScrollRef} lineHeights={lineHeights} positionSV={positionSV} TutorialView={TutorialView} handleToggleExpand={handleToggleExpand} setRhythmMode={setRhythmMode} handleEditLine={handleEditLine} deleteLyricLine={deleteLyricLine} onSliderValueChange={onSliderValueChange} handleSyllableSync={handleSyllableSync} onUpdateLine={updateLyricLine} applyOffset={applyOffset} undo={undo} redo={redo} handleRawLRCChange={handleRawLRCChange} />
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
          <EditorContent editorMode={editorMode} lyrics={lyrics} theme={theme} expandedLines={expandedLines} rhythmMode={rhythmMode} currentLineIndex={currentLineIndex} position={position} historyIndex={historyIndex} history={history} rawLRC={rawLRC} playerScrollRef={playerScrollRef} lineHeights={lineHeights} positionSV={positionSV} TutorialView={TutorialView} handleToggleExpand={handleToggleExpand} setRhythmMode={setRhythmMode} handleEditLine={handleEditLine} deleteLyricLine={deleteLyricLine} onSliderValueChange={onSliderValueChange} handleSyllableSync={handleSyllableSync} onUpdateLine={updateLyricLine} applyOffset={applyOffset} undo={undo} redo={redo} handleRawLRCChange={handleRawLRCChange} />
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
            <BlurView intensity={70} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="none" />
          )}
          <View style={[
            styles.modalContent, 
            { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 },
            enableFancyAnimations && { backgroundColor: theme.background + 'CC' }
          ]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingLineId ? 'Edit Lyric' : 'Enter Lyric Text'}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowTextInput(false);
                setSyncState('idle');
                setEditingLineId(null);
              }}>
                <X color={theme.text} size={24} />
              </TouchableOpacity>
            </View>
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
            <BlurView intensity={70} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="none" />
          )}
          <View style={[
            styles.modalContent, 
            { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 },
            enableFancyAnimations && { backgroundColor: theme.background + 'CC' }
          ]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share & Export</Text>
              <TouchableOpacity onPress={() => {
                setShowShareModal(false);
                setShareStep('options');
              }}>
                <X color={theme.text} size={24} />
              </TouchableOpacity>
            </View>

            {shareStep === 'options' ? (
              <>
                <TouchableOpacity 
                  style={[
                    styles.shareOption, 
                    { borderColor: theme.border },
                    hasEnhancedFeatures && { opacity: 0.5 }
                  ]}
                  onPress={() => {
                    if (hasEnhancedFeatures) {
                      import('react-native').then(({ Alert }) => {
                        Alert.alert('Not Supported', 'LRCLIB does not support speaker tags or background vocals. Please use LRC export instead.');
                      });
                    } else {
                      setShareStep('lrclib');
                    }
                  }}
                >
                  <CloudUpload color={hasEnhancedFeatures ? theme.secondaryText : theme.tint} size={28} />
                  <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                    <Text style={[styles.shareOptionTitle, hasEnhancedFeatures && { color: theme.secondaryText }]}>Upload to LRCLIB</Text>
                    <Text style={[styles.shareOptionDesc, { color: theme.secondaryText }]}>
                      {hasEnhancedFeatures ? 'Disabled: Contains speaker/bg tags' : 'Submit your lyrics to the public database.'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.shareOption, { borderColor: theme.border }]}
                  onPress={() => setShareStep('export')}
                >
                  <FileDown color={theme.tint} size={28} />
                  <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                    <Text style={styles.shareOptionTitle}>Export File</Text>
                    <Text style={[styles.shareOptionDesc, { color: theme.secondaryText }]}>
                      Save as LRC, SRT, or VTT format.
                    </Text>
                  </View>
                </TouchableOpacity>

                {hasEnhancedFeatures && (
                  <View style={{ 
                    backgroundColor: theme.tint + '10', 
                    padding: 12, 
                    borderRadius: 12, 
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <Info size={16} color={theme.tint} />
                    <Text style={{ color: theme.tint, fontSize: 12, fontWeight: '600', flex: 1 }}>
                      This song uses speaker/bg tags which are only fully supported in LRC export.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.border, marginTop: 10 }]}
                  onPress={() => setShowShareModal(false)}
                >
                  <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : shareStep === 'export' ? (
              <>
                <View style={[styles.modalHeader, { backgroundColor: 'transparent' }]}>
                  <TouchableOpacity onPress={() => setShareStep('options')}>
                    <ChevronLeft color={theme.tint} size={24} />
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>Export Format</Text>
                  <View style={{ width: 24, backgroundColor: 'transparent' }} />
                </View>
                
                <Text style={[styles.modalSubtitle, { color: theme.secondaryText, marginBottom: 20 }]}>
                  Choose a format to export your lyrics:
                </Text>
                
                <TouchableOpacity 
                  style={[styles.shareOption, { borderColor: selectedExportFormat === 'lrc' ? theme.tint : theme.border, borderWidth: selectedExportFormat === 'lrc' ? 2 : 1 }]}
                  onPress={() => setSelectedExportFormat('lrc')}
                >
                  <View style={{ backgroundColor: 'transparent' }}>
                    <Text style={styles.shareOptionTitle}>LRC Format</Text>
                    <Text style={[styles.shareOptionDesc, { color: theme.secondaryText }]}>
                      {hasEnhancedFeatures ? 'Full support for speaker/bg tags' : 'Enhanced lyrics with word-level sync'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.shareOption, { borderColor: selectedExportFormat === 'srt' ? theme.tint : theme.border, borderWidth: selectedExportFormat === 'srt' ? 2 : 1 }]}
                  onPress={() => setSelectedExportFormat('srt')}
                >
                  <View style={{ backgroundColor: 'transparent' }}>
                    <Text style={styles.shareOptionTitle}>SRT Format</Text>
                    <Text style={[styles.shareOptionDesc, { color: theme.secondaryText }]}>
                      {hasEnhancedFeatures ? 'Warning: Speaker/bg tags will be stripped' : 'Standard subtitle format'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.shareOption, { borderColor: selectedExportFormat === 'vtt' ? theme.tint : theme.border, borderWidth: selectedExportFormat === 'vtt' ? 2 : 1 }]}
                  onPress={() => setSelectedExportFormat('vtt')}
                >
                  <View style={{ backgroundColor: 'transparent' }}>
                    <Text style={styles.shareOptionTitle}>VTT Format</Text>
                    <Text style={[styles.shareOptionDesc, { color: theme.secondaryText }]}>
                      {hasEnhancedFeatures ? 'Warning: Speaker/bg tags will be stripped' : 'Web video subtitle format'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: theme.border, marginRight: 10 }]}
                    onPress={() => setShowShareModal(false)}
                  >
                    <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: theme.tint, flex: 1 }]}
                    onPress={handleExport}
                  >
                    <Text style={[styles.modalButtonText, { color: theme.background }]}>
                      Export {selectedExportFormat.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                </View>
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
            <BlurView intensity={70} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="none" />
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
            <BlurView intensity={70} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="none" />
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
            <BlurView intensity={70} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="none" />
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
            <BlurView intensity={70} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} experimentalBlurMethod="none" />
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
    </DropZone>
  );
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
    backgroundColor: 'rgba(0,0,0,0.4)', // Slightly more transparent for better blur visibility
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    // @ts-ignore - Web only
    backdropFilter: 'blur(20px)',
    // @ts-ignore - Web only
    WebkitBackdropFilter: 'blur(20px)',
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
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    width: '100%',
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
    // @ts-ignore - Web only
    outlineStyle: 'none',
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
    // @ts-ignore - Web only
    backdropFilter: 'blur(20px)',
    // @ts-ignore - Web only
    WebkitBackdropFilter: 'blur(20px)',
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
