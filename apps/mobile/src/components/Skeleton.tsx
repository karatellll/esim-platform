import { createContext, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, type StyleProp, type ViewStyle } from 'react-native';
import { View, AnimatedView } from '../ui/Surface';
import { StyleSheet } from '../ui/design';
import { LinearGradient } from 'expo-linear-gradient';

const progress = new Animated.Value(0);
Animated.loop(Animated.timing(progress, { toValue: 1, duration: 1400, useNativeDriver: true, isInteraction: false })).start();
const MotionContext = createContext(false);

export function SkeletonGroup({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return <MotionContext.Provider value={reduced}><View style={style}>{children}</View></MotionContext.Provider>;
}

export function SkeletonBlock({ style, circle = false }: { style: ViewStyle; circle?: boolean }) {
  const reduced = useContext(MotionContext);
  const [width, setWidth] = useState(0);
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!reduced) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.625, duration: 700, useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, reduced]);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-width, width] });
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.block, style, circle && styles.circle]}>
    {reduced ? <AnimatedView pointerEvents="none" style={[StyleSheet.absoluteFill, styles.base, { opacity: pulse }]} /> : <>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.base]} />
      {width > 0 && <AnimatedView pointerEvents="none" style={[styles.shimmer, { width: Math.max(32, width * 0.45), transform: [{ translateX }] }]}>
        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </AnimatedView>}
    </>}
  </View>;
}

const styles = StyleSheet.create({ block: { overflow: 'hidden', backgroundColor: '#262629', borderRadius: 8 }, base: { backgroundColor: 'rgba(255,255,255,0.08)' }, shimmer: { position: 'absolute', top: 0, bottom: 0 } , circle: { borderRadius: 999 } });
