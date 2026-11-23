import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Platform } from 'react-native';

export type TabLayout = { x: number; width: number };

// Tuned damped spring, not a claim about Apple's private UITabBar coefficients.
export const tabIndicatorSpring = {
  stiffness: 420,
  damping: 36,
  mass: 1,
  overshootClamping: false,
  restDisplacementThreshold: 0.1,
  restSpeedThreshold: 0.1,
  useNativeDriver: Platform.OS !== 'web',
  isInteraction: false,
} as const;

export function useTabBarIndicator(routeKey: string, layout: TabLayout | undefined, reduceMotion: boolean, isFocused: boolean) {
  const translateX = useRef(new Animated.Value(0)).current;
  const previousRouteKey = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (!layout) return;
    const changedTab = previousRouteKey.current !== routeKey;
    const initialized = previousRouteKey.current !== null;
    previousRouteKey.current = routeKey;
    if (!initialized || reduceMotion || !changedTab || !isFocused) {
      translateX.stopAnimation();
      translateX.setValue(layout.x);
      setReady(true);
      return;
    }
    // Animated.spring replaces the previous spring and carries its velocity.
    // Only translation animates: layout/width never require a JS frame loop.
    Animated.spring(translateX, { ...tabIndicatorSpring, toValue: layout.x }).start();
  }, [layout, routeKey, reduceMotion, isFocused, translateX]);

  useEffect(() => () => translateX.stopAnimation(), [translateX]);
  return { translateX, ready };
}
