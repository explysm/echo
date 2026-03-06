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
} from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  useSharedValue 
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
} from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Text, View, useTheme } from '@/components/Themed';
import { useAppSettings } from '@/context/AppSettingsContext';
import {
  LyricLine,
  formatLyricsToLRC,
  parseLRCToLyrics,
  publishLyrics,
} from '@/lib/lrclib';

// Memoized Sync Line to prevent re-renders on every playback tick
const SyncLyricLine = memo(({ 
  line, 
  isActive, 
  onPress, 
  onDelete, 
  onSeek, 
  theme 
}: { 
  line: LyricLine, 
  isActive: boolean, 
  onPress: (line: LyricLine) => void, 
  onDelete: (id: string) => void, 
  onSeek: (time: number) => void,
  theme: any 
}) => {
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.lyricLine, 
        { borderBottomColor: theme.border },
        pressed && { backgroundColor: theme.border },
        isActive && { backgroundColor: theme.tint + '15' }
      ]}
      onPress={() => onPress(line)}
    >
      <View style={styles.lyricLineInfo}>
        <TouchableOpacity onPress={() => onSeek(line.start)}>
          <Text style={[styles.lyricTimestamp, { color: theme.tint }]}>
            [{formatTime(line.start)}]
          </Text>
        </TouchableOpacity>
        <Text style={[
          styles.lyricText,
          { color: theme.text },
          isActive && { fontWeight: 'bold', color: theme.tint }
        ]}>
          {line.text}
        </Text>
      </View>
      <TouchableOpacity onPress={() => onDelete(line.id)} style={{ padding: 10 }}>
        <Trash2 color="#ff4444" size={18} />
      </TouchableOpacity>
    </Pressable>
  );
}, (prev, next) => {
  return prev.isActive === next.isActive && 
         prev.line.id === next.line.id &&
         prev.line.text === next.line.text && 
         prev.line.start === next.line.start;
});

// Animated Sub-component for Player
function AnimatedLyricLine({ 
  text, 
  isActive, 
  theme 
}: { 
  text: string, 
  isActive: boolean, 
  theme: any 
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.05 : 1, { damping: 15, stiffness: 100 });
    opacity.value = withTiming(isActive ? 1 : 0.6, { duration: 300 });
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
    color: isActive ? theme.tint : theme.secondaryText,
  }));

  return (
    <Animated.Text style={[styles.playerLine, animatedStyle]}>
      {text}
    </Animated.Text>
  );
}

// Memoized Mode Toggle
const ModeTogglePill = memo(({ 
  currentMode, 
  onModeChange, 
  theme 
}: { 
  currentMode: string, 
  onModeChange: (mode: 'raw' | 'sync' | 'play') => void, 
  theme: any 
}) => {
  return (
    <View style={[styles.pill, { backgroundColor: theme.border }]}>
      {(['raw', 'sync', 'play'] as const).map((mode) => (
        <TouchableOpacity
          key={mode}
          style={[
            styles.pillSegment,
            currentMode === mode && { backgroundColor: theme.tint }
          ]}
          onPress={() => onModeChange(mode)}
        >
          <Text 
            style={[
              styles.pillText, 
              { color: currentMode === mode ? theme.background : theme.secondaryText }
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
  const { colorScheme, userAgent, pauseOnEnd, rewindAmount, useRemoteSolver, solverUrl, solverKey } = useAppSettings();
  const theme = useTheme();

  // Storage Keys for Auto-save
  const EDITOR_STORAGE_KEYS = useMemo(() => ({
    RAW_LRC: '@echo_editor_raw_lrc',
    TRACK: '@echo_editor_track',
    ARTIST: '@echo_editor_artist',
    ALBUM: '@echo_editor_album',
  }), []);

  // Audio state
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioFile, setAudioFile] = useState<{ uri: string; name: string } | null>(null);

  // Lyrics state
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [rawLRC, setRawLRC] = useState('');
  const [editorMode, setEditorMode] = useState<'raw' | 'sync' | 'play'>('raw');

  // Metadata state
  const [trackName, setTrackName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [albumName, setAlbumName] = useState('');

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
        const [lrc, track, artist, album] = await Promise.all([
          AsyncStorage.getItem(EDITOR_STORAGE_KEYS.RAW_LRC),
          AsyncStorage.getItem(EDITOR_STORAGE_KEYS.TRACK),
          AsyncStorage.getItem(EDITOR_STORAGE_KEYS.ARTIST),
          AsyncStorage.getItem(EDITOR_STORAGE_KEYS.ALBUM),
        ]);
        if (lrc) setRawLRC(lrc);
        if (track) setTrackName(track);
        if (artist) setArtistName(artist);
        if (album) setAlbumName(album);
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
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
      setIsPlaying(status.isPlaying);
    }
  };

  const parseMetadataFromFilename = (filename: string) => {
    // Remove extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    
    // Try "Artist - Title" pattern
    const parts = nameWithoutExt.split(" - ");
    if (parts.length >= 2) {
      setArtistName(parts[0].trim());
      setTrackName(parts.slice(1).join(" - ").trim());
    } else {
      setTrackName(nameWithoutExt);
    }
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
    }
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
    setLyrics(updatedLyrics);
    setRawLRC(formatLyricsToLRC(updatedLyrics));
    
    setPendingText('');
    setShowTextInput(false);
    setSyncState('idle');
    setCurrentLineStart(null);
    setEditingLineId(null);
  };

  const deleteLyricLine = (id: string) => {
    const updatedLyrics = lyrics.filter((l) => l.id !== id);
    setLyrics(updatedLyrics);
    setRawLRC(formatLyricsToLRC(updatedLyrics));
  };

  const handleRawLRCChange = (text: string) => {
    setRawLRC(text);
  };

  useEffect(() => {
    if (editorMode !== 'raw') {
      setLyrics(parseLRCToLyrics(rawLRC));
    }
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
      setShareStep('options');
      setIsPublishing(false);
      setPublishStatus('');

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

  const handlePublish = async () => {
    const trimmedTrack = trackName.trim();
    const trimmedArtist = artistName.trim();
    const trimmedAlbum = albumName.trim();

    if (!trimmedTrack || !trimmedArtist) {
      Alert.alert('Metadata Required', 'Please enter at least Track Name and Artist Name.');
      return;
    }

    setIsPublishing(true);
    setPublishStatus('Initializing...');
    abortControllerRef.current = new AbortController();

    try {
      console.log('Attempting to publish:', { trimmedTrack, trimmedArtist, duration });
      await publishLyrics(
        trimmedTrack,
        trimmedArtist,
        trimmedAlbum,
        duration,
        rawLRC,
        userAgent,
        useRemoteSolver,
        solverUrl,
        solverKey,
        (msg) => {
          console.log('Publish Progress:', msg);
          setPublishStatus(msg);
        },
        abortControllerRef.current.signal
      );
      console.log('Publish successful!');
      Alert.alert('Success', 'Lyrics published to LRCLIB!');
      setShowShareModal(false);
      setPublishStatus('');
    } catch (error: any) {
      if (error.message === 'Publish aborted' || error.message === 'Solver aborted') {
        console.log('Publishing was cancelled by user.');
      } else {
        console.error('Final Catch in handlePublish:', error);
        Alert.alert('Publish Error', error.message || 'An unknown error occurred.');
        setPublishStatus(`Error: ${error.message}`);
      }
    } finally {
      setIsPublishing(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelPublish = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setShowShareModal(false);
    setIsPublishing(false);
    setPublishStatus('');
  };


  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      
      {/* Audio Controls */}
      <View style={styles.audioControls}>
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
        </View>
      </View>

      {/* Mode Toggle Pill */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity onPress={handleReset} style={{ padding: 4 }}>
          <Trash2 color="#ff4444" size={24} />
        </TouchableOpacity>
        <ModeTogglePill 
          currentMode={editorMode} 
          onModeChange={setEditorMode} 
          theme={theme} 
        />
        <TouchableOpacity onPress={() => {
          setShareStep('options');
          setShowShareModal(true);
        }}>
          <Share color={theme.tint} size={24} />
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <View style={[styles.contentArea, { borderColor: theme.border }]}>
        {editorMode === 'sync' ? (
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <View style={styles.offsetRow}>
              <Text style={[styles.offsetLabel, { color: theme.secondaryText }]}>Global Offset:</Text>
              <TouchableOpacity style={[styles.offsetButton, { borderColor: theme.border }]} onPress={() => applyOffset(-100)}>
                <Text style={{ color: theme.tint, fontSize: 12 }}>-100ms</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.offsetButton, { borderColor: theme.border }]} onPress={() => applyOffset(100)}>
                <Text style={{ color: theme.tint, fontSize: 12 }}>+100ms</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={lyrics}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <SyncLyricLine
                line={item}
                isActive={currentLineIndex === index}
                onPress={handleEditLine}
                onDelete={deleteLyricLine}
                onSeek={onSliderValueChange}
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
        ) : editorMode === 'raw' ? (
          <TextInput
            style={[styles.rawInput, { color: theme.text }]}
            multiline
            value={rawLRC}
            onChangeText={handleRawLRCChange}
            placeholder="Paste raw LRC or plain text here..."
            placeholderTextColor={theme.secondaryText}
          />
        ) : (
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
                  {lyrics.map((line, index) => (
                    <View 
                      key={line.id}
                      onLayout={(e) => {
                        lineHeights.current[index] = e.nativeEvent.layout.height;
                      }}
                      style={{ alignItems: 'center', width: '100%' }}
                    >
                      <AnimatedLyricLine 
                        text={line.text} 
                        isActive={currentLineIndex === index} 
                        theme={theme}
                      />
                    </View>
                  ))}
                  <View style={{ height: 400 }} />
                </ScrollView>
             )}
          </View>
        )}
      </View>

      {/* FAB */}
      {editorMode === 'sync' && sound && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.tint }]}
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
      )}

      {/* Text Input Modal for FAB Sync & Editing */}
      <Modal visible={showTextInput} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}>
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
          <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}>
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
                
                {isPublishing && (
                  <View style={[styles.statusLog, { backgroundColor: theme.border }]}>
                    <Text style={[styles.statusText, { color: theme.text }]}>
                      {publishStatus}
                    </Text>
                  </View>
                )}
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: theme.border, marginRight: 10 }]}
                    onPress={handleCancelPublish}
                  >
                    <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: theme.tint, flex: 1 }]}
                    onPress={handlePublish}
                    disabled={isPublishing}
                  >
                    <Text style={[styles.modalButtonText, { color: theme.background }]}>
                      {isPublishing ? 'Publishing...' : 'Publish'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  audioControls: {
    marginBottom: 20,
    gap: 10,
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
  },
  pillText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  offsetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginBottom: 5,
    backgroundColor: 'transparent',
  },
  offsetLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  offsetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
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
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lyricLineInfo: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
    backgroundColor: 'transparent',
  },
  lyricTimestamp: {
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
    fontSize: 14,
  },
  lyricText: {
    flex: 1,
    fontSize: 15,
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
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
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
  statusLog: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'SpaceMono',
  },
});
