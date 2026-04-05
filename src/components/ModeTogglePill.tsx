import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, Platform } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  useSharedValue 
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useAppSettings } from '@/context/AppSettingsContext';

// Helper to get contrast color
const getContrastColor = (hex: string) => {
  if (!hex || hex.includes('NaN')) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
};

interface ModeTogglePillProps {
  currentMode: 'raw' | 'sync' | 'play';
  onModeChange: (mode: 'raw' | 'sync' | 'play') => void;
  theme: any;
  availableModes?: ('raw' | 'sync' | 'play')[];
}

export const ModeTogglePill = memo(({ 
  currentMode, 
  onModeChange, 
  theme,
  availableModes = ['raw', 'sync', 'play']
}: ModeTogglePillProps) => {
  const { enableFancyAnimations, colorScheme } = useAppSettings();
  const modes = availableModes;
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

const styles = StyleSheet.create({
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
});
