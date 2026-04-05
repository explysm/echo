import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Platform,
  Modal,
  LayoutRectangle,
  useWindowDimensions,
  StatusBar as RNStatusBar
} from 'react-native';
import Animated, { 
  FadeIn
} from 'react-native-reanimated';
import { 
  Music, 
  Layers, 
  PlusCircle, 
  Share2, 
  Settings as SettingsIcon,
  X,
  ChevronRight,
  Sparkles
} from 'lucide-react-native';
import { useTheme } from '@/components/Themed';
import { useAppSettings } from '@/context/AppSettingsContext';
import { BlurView } from 'expo-blur';

interface TutorialContextType {
  registerLayout: (key: string, layout: LayoutRectangle) => void;
  layouts: Record<string, LayoutRectangle>;
  isVisible: boolean;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  setVisible: (visible: boolean) => void;
  steps: TutorialStep[];
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const [isVisible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const theme = useTheme();

  const registerLayout = useCallback((key: string, layout: LayoutRectangle) => {
    setLayouts(prev => ({ ...prev, [key]: layout }));
  }, []);

  const steps: TutorialStep[] = [
    {
      title: "Welcome to Echo",
      description: "Echo is a minimalist lyric editor designed for syncing and publishing lyrics to LRCLIB. Let's take a quick tour!",
      icon: <Sparkles size={48} color={theme.tint} />,
    },
    {
      title: "Load Music",
      description: "Start by loading an MP3 file from your device. Echo will try to extract metadata automatically.",
      icon: <Music size={40} color={theme.tint} />,
      targetKey: 'audio_controls'
    },
    {
      title: "Seek & Nudge",
      description: "Use the nudge buttons to fine-tune your position by seconds or half-seconds. Perfect for precise syncing.",
      icon: <ChevronRight size={40} color={theme.tint} />,
      targetKey: 'nudge_controls'
    },
    {
      title: "Editor Modes",
      description: "Switch between RAW (text editing), SYNC (timing), and PLAY (live preview) modes.",
      icon: <Layers size={40} color={theme.tint} />,
      targetKey: 'mode_toggle'
    },
    {
      title: "Global Offset",
      description: "In SYNC mode, you can shift all timestamps forward or backward to fix sync issues across the entire track.",
      mode: 'sync',
      icon: <PlusCircle size={40} color={theme.tint} />,
      targetKey: 'offset_controls'
    },
    {
      title: "Syncing Lyrics",
      description: "In SYNC mode, use the floating '+' button to capture start and end times for each line as the music plays.",
      mode: 'sync',
      icon: <PlusCircle size={40} color={theme.tint} />,
      targetKey: 'fab_sync'
    },
    {
      title: "Advanced LRC Features",
      description: "Use 'v1: text' or 'v2: text' for speaker colors, and '[bg: text]' at the end of a line for background vocals. (LRC export only)",
      icon: <Layers size={40} color={theme.tint} />,
      mode: 'raw'
    },
    {
      title: "Share & Publish",
      description: "Once finished, export your LRC file or publish directly to LRCLIB using the share button.",
      icon: <Share2 size={40} color={theme.tint} />,
      targetKey: 'share_button'
    },
    {
      title: "Customization",
      description: "Head over to Settings to customize themes, accent colors, and editor behavior.",
      icon: <SettingsIcon size={40} color={theme.tint} />,
      targetKey: 'settings_tab'
    }
  ];

  return (
    <TutorialContext.Provider value={{ registerLayout, layouts, isVisible, setVisible, currentStep, setCurrentStep, steps }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) throw new Error('useTutorial must be used within TutorialProvider');
  return context;
}

export function TutorialView({ children, targetKey, style, ...props }: any) {
  const { registerLayout } = useTutorial();
  const ref = useRef<View>(null);

  const measure = () => {
    if (Platform.OS === 'web') {
      const node = ref.current as unknown as HTMLElement;
      if (node?.getBoundingClientRect) {
        const rect = node.getBoundingClientRect();
        registerLayout(targetKey, { 
          x: rect.left + window.scrollX, 
          y: rect.top + window.scrollY, 
          width: rect.width, 
          height: rect.height 
        });
      }
    } else {
      // Small delay to ensure layout is stable
      setTimeout(() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            // Apply a small vertical offset (2px) for Android as requested
            const verticalOffset = Platform.OS === 'android' ? 2 : 0;
            registerLayout(targetKey, { x, y: y + verticalOffset, width, height });
          }
        });
      }, 100);
    }
  };

  return (
    <View 
      ref={ref} 
      onLayout={measure} 
      style={style} 
      {...props}
    >
      {children}
    </View>
  );
}

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  mode?: 'raw' | 'sync' | 'play';
  targetKey?: string;
}

export default function TutorialOverlay({ onModeChange }: { onModeChange?: (mode: 'raw' | 'sync' | 'play') => void }) {
  const { 
    hasCompletedTutorial, 
    setHasCompletedTutorial, 
    alwaysShowTutorial,
    enableFancyAnimations,
    colorScheme
  } = useAppSettings();
  const { layouts, isVisible: visible, setVisible, currentStep, setCurrentStep, steps } = useTutorial();
  const theme = useTheme();
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!hasCompletedTutorial || alwaysShowTutorial) {
      setVisible(true);
    }
  }, [hasCompletedTutorial, alwaysShowTutorial]);

  useEffect(() => {
    const step = steps[currentStep];
    if (visible && step.mode && onModeChange) {
      onModeChange(step.mode);
    }
  }, [currentStep, visible]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    setVisible(false);
    setHasCompletedTutorial(true);
  };

  if (!visible) return null;

  const step = steps[currentStep];
  const highlight = step.targetKey ? layouts[step.targetKey] : undefined;
  const dimmerColor = colorScheme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';
  const contrastColor = getContrastColor(theme.tint);

  // Heuristic-based positioning logic for Echo
  let cardPosition: any = { justifyContent: 'center' };
  if (highlight) {
    if (highlight.y > height * 0.45) {
      cardPosition = { justifyContent: 'flex-start', paddingTop: Platform.OS === 'android' ? 60 : 40 };
    } else {
      cardPosition = { justifyContent: 'flex-end', paddingBottom: 120 };
    }
  }

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent={true}>
      <View style={[styles.overlay, cardPosition]}>
        {enableFancyAnimations && Platform.OS !== 'web' && (
          <BlurView 
            intensity={30} 
            tint={colorScheme === 'dark' ? 'dark' : 'light'} 
            style={StyleSheet.absoluteFill} 
          />
        )}
        
        {highlight ? (
          <>
            <View style={[styles.dimmer, { backgroundColor: dimmerColor, top: 0, left: 0, right: 0, height: highlight.y }]} />
            <View style={[styles.dimmer, { backgroundColor: dimmerColor, top: highlight.y + highlight.height, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.dimmer, { backgroundColor: dimmerColor, top: highlight.y, left: 0, width: highlight.x, height: highlight.height }]} />
            <View style={[styles.dimmer, { backgroundColor: dimmerColor, top: highlight.y, left: highlight.x + highlight.width, right: 0, height: highlight.height }]} />
            
            <View 
              style={[
                styles.highlight, 
                { 
                  top: highlight.y - 2, 
                  left: highlight.x - 2, 
                  width: highlight.width + 4, 
                  height: highlight.height + 4,
                  borderRadius: step.targetKey === 'fab_sync' ? (highlight.width + 4) / 2 : 12,
                  borderColor: theme.tint,
                  borderWidth: 2,
                  shadowColor: theme.tint,
                  shadowOpacity: 0.5,
                  shadowRadius: 10,
                  elevation: 10,
                }
              ]} 
            />
          </>
        ) : (
          <View style={[styles.dimmer, { ...StyleSheet.absoluteFillObject, backgroundColor: dimmerColor }]} />
        )}

        <Animated.View 
          entering={FadeIn.duration(400)}
          key={`step-${currentStep}`}
          style={[
            styles.card, 
            { 
              backgroundColor: theme.background,
              borderColor: theme.border,
              borderWidth: 1,
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 20,
              elevation: 10,
            }
          ]}
        >
          <TouchableOpacity style={styles.closeButton} onPress={handleSkip}>
            <X size={20} color={theme.secondaryText} />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            {step.icon}
          </View>

          <Text style={[styles.title, { color: theme.text }]}>{step.title}</Text>
          <Text style={[styles.description, { color: theme.secondaryText }]}>
            {step.description}
          </Text>

          <View style={styles.footer}>
            <TouchableOpacity onPress={handleSkip}>
              <Text style={[styles.skipText, { color: theme.secondaryText }]}>Skip</Text>
            </TouchableOpacity>
            
            <View style={styles.dotContainer}>
              {steps.map((_, i) => (
                <View 
                  key={i} 
                  style={[
                    styles.dot, 
                    { backgroundColor: i === currentStep ? theme.tint : theme.border }
                  ]} 
                />
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.nextButton, { backgroundColor: theme.tint }]} 
              onPress={handleNext}
            >
              <Text style={[styles.nextButtonText, { color: contrastColor }]}>
                {currentStep === steps.length - 1 ? "Finish" : "Next"}
              </Text>
              {currentStep < steps.length - 1 && <ChevronRight size={18} color={contrastColor} />}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dimmer: {
    position: 'absolute',
  },
  highlight: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  card: {
    width: '85%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    gap: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  iconContainer: {
    padding: 20,
    borderRadius: 30,
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    backgroundColor: 'transparent',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dotContainer: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'transparent',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 4,
  },
  nextButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
