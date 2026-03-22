import React, { useState, useCallback } from 'react';
import { StyleSheet, Platform, Pressable } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  useSharedValue,
  withTiming 
} from 'react-native-reanimated';
import { Upload, Music, FileText } from 'lucide-react-native';
import { Text, View, useTheme } from './Themed';

interface DropZoneProps {
  onAudioDrop: (file: File) => void;
  onLrcDrop: (file: File) => void;
  children: React.ReactNode;
}

const ACCEPTED_AUDIO = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma', '.opus'];
const ACCEPTED_LRC = ['.lrc'];

export default function DropZone({ onAudioDrop, onLrcDrop, children }: DropZoneProps) {
  const theme = useTheme();
  const [isDragging, setIsDragging] = useState(false);
  const [dragFileType, setDragFileType] = useState<'audio' | 'lrc' | null>(null);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            const ext = '.' + file.name.split('.').pop()?.toLowerCase();
            if (ACCEPTED_AUDIO.includes(ext)) {
              setDragFileType('audio');
              setIsDragging(true);
              scale.value = withSpring(1.02);
              opacity.value = withTiming(1, { duration: 200 });
              return;
            } else if (ACCEPTED_LRC.includes(ext)) {
              setDragFileType('lrc');
              setIsDragging(true);
              scale.value = withSpring(1.02);
              opacity.value = withTiming(1, { duration: 200 });
              return;
            }
          }
        }
      }
    }
    setIsDragging(false);
    setDragFileType(null);
  }, [scale, opacity]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragFileType(null);
    scale.value = withSpring(1);
    opacity.value = withTiming(0, { duration: 200 });
  }, [scale, opacity]);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragFileType(null);
    scale.value = withSpring(1);
    opacity.value = withTiming(0, { duration: 200 });

    if (e.dataTransfer?.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (ACCEPTED_AUDIO.includes(ext)) {
          onAudioDrop(file);
          return;
        } else if (ACCEPTED_LRC.includes(ext)) {
          onLrcDrop(file);
          return;
        }
      }
    }
  }, [onAudioDrop, onLrcDrop, scale, opacity]);

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      window.addEventListener('dragover', handleDragOver);
      window.addEventListener('dragleave', handleDragLeave);
      window.addEventListener('drop', handleDrop);
      
      return () => {
        window.removeEventListener('dragover', handleDragOver);
        window.removeEventListener('dragleave', handleDragLeave);
        window.removeEventListener('drop', handleDrop);
      };
    }
  }, [handleDragOver, handleDragLeave, handleDrop]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      {children}
      {isDragging && (
        <Animated.View 
          style={[
            styles.overlay, 
            overlayStyle
          ]}>
          <Animated.View style={[styles.dropContent, animatedStyle]}>
            <View style={[
              styles.iconContainer, 
              { backgroundColor: theme.tint }
            ]}>
              {dragFileType === 'audio' ? (
                <Music size={48} color="#fff" />
              ) : (
                <FileText size={48} color="#fff" />
              )}
            </View>
            <Text style={[styles.dropText, { color: '#ffffff' }]}>
              Drop {dragFileType === 'audio' ? 'audio file' : 'LRC file'} here
            </Text>
            <Text style={[styles.dropSubtext, { color: '#cccccc' }]}>
              {dragFileType === 'audio' 
                ? 'MP3, WAV, OGG, M4A, FLAC, AAC supported'
                : 'LRC lyrics file'
              }
            </Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dropContent: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  dropText: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  dropSubtext: {
    fontSize: 14,
  },
});
