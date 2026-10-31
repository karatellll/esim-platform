import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';
import { Pressable, View, AnimatedView } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabs } from '../navigation/tabs';
import { colors, getTabBarBottom, tabBarLayout } from '../theme';

export function FloatingTabBar({ state, navigation, isFocused }: BottomTabBarProps & { isFocused: boolean }) {
  const insets = useSafeAreaInsets();
  // Figma 64:3349: 988 - 911 - 64 = 13 pt below the bar.
  const bottom = getTabBarBottom(insets.bottom, Platform.OS === 'web');
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const [indicatorReady, setIndicatorReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;
  const initialized = useRef(false);
  const previousRouteKey = useRef<string | null>(null);
  const activeRouteKey = state.routes[state.index].key;
  const activeLayout = layouts[activeRouteKey];

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    }, () => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useLayoutEffect(() => {
    if (!activeLayout) return;
    const changedTab = previousRouteKey.current !== activeRouteKey;
    previousRouteKey.current = activeRouteKey;
    // Returning from a stack screen or measuring the same tab must never slide the indicator.
    if (!initialized.current || reduceMotion || !changedTab || !isFocused) {
      indicatorX.setValue(activeLayout.x);
      indicatorWidth.setValue(activeLayout.width);
      initialized.current = true;
      setIndicatorReady(true);
      return;
    }

    const config = { duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false };
    const animation = Animated.parallel([
      Animated.timing(indicatorX, { ...config, toValue: activeLayout.x }),
      Animated.timing(indicatorWidth, { ...config, toValue: activeLayout.width }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [activeLayout, activeRouteKey, indicatorWidth, indicatorX, isFocused, reduceMotion]);

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[
          styles.container,
          {
            bottom,
            left: Math.max(insets.left, tabBarLayout.horizontalMargin),
            right: Math.max(insets.right, tabBarLayout.horizontalMargin),
          },
        ]}
      >
        <View style={styles.bar} testID="tab-bar">
          <AnimatedView
            pointerEvents="none"
            accessible={false}
            testID="tab-active-background"
            style={[styles.activeBackground, { opacity: indicatorReady ? 1 : 0, width: indicatorWidth, transform: [{ translateX: indicatorX }] }]}
          />
          {state.routes.map((route, index) => {
            const tab = tabs.find((item) => item.name === route.name)!;
            const focused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: focused }}
                aria-selected={focused}
                testID={`tab-${tab.testId}`}
                onPress={onPress}
                onLayout={({ nativeEvent: { layout } }) => {
                  // Detached/hidden screens can report zero-sized buttons; retain the last valid geometry.
                  if (layout.width <= 0 || layout.height <= 0) return;
                  const key = route.key;
                  setLayouts((current) => current[key]?.x === layout.x && current[key]?.width === layout.width
                    ? current
                    : { ...current, [key]: { x: layout.x, width: layout.width } });
                }}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                style={({ pressed }) => [
                  styles.item,
                  focused && !indicatorReady && styles.selectedItem,
                  pressed && styles.pressedItem,
                ]}
              >
                <Image
                  source={focused ? tab.activeIcon : tab.icon}
                  style={styles.icon}
                  contentFit="contain"
                  transition={0}
                  accessible={false}
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={[styles.label, focused && styles.selectedLabel]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  bar: {
    width: '100%',
    height: tabBarLayout.height,
    padding: tabBarLayout.padding,
    borderRadius: tabBarLayout.borderRadius, borderCurve: 'continuous',
    backgroundColor: colors.tabBar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
    boxShadow: '0px -2px 10px rgba(0, 0, 0, 0.4)',
  },
  item: {
    paddingHorizontal: 8,
    flex: 1,
    minWidth: 0,
    height: tabBarLayout.itemHeight,
    borderRadius: tabBarLayout.itemRadius, borderCurve: 'continuous',
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tabBarLayout.labelGap,
  },
  selectedItem: {
    backgroundColor: colors.selectedTab,
  },
  activeBackground: {
    position: 'absolute',
    left: 0,
    top: tabBarLayout.padding,
    height: tabBarLayout.itemHeight,
    borderRadius: tabBarLayout.itemRadius, borderCurve: 'continuous',
    backgroundColor: colors.selectedTab,
  },
  pressedItem: {
    opacity: 0.8,
  },
  icon: {
    width: tabBarLayout.iconSize,
    height: tabBarLayout.iconSize,
  },
  label: {
    color: colors.mutedText,
    fontFamily: fonts.text,
    fontWeight: '500',
    fontSize: tabBarLayout.fontSize,
    lineHeight: tabBarLayout.lineHeight,
    letterSpacing: tabBarLayout.letterSpacing,
    includeFontPadding: false,
  },
  selectedLabel: {
    color: colors.accent,
  },
});
