import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useState } from 'react';
import { Animated, Platform, StyleSheet, View as NativeView } from 'react-native';
import { Pressable } from '../ui/Surface';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabs } from '../navigation/tabs';
import { colors, getTabBarBottom, tabBarLayout } from '../theme';
import { fonts } from '../ui/design';
import { Text } from '../ui/Text';
import { TabBarIcon } from './tab-bar/TabBarIcon';
import { TabBarMaterial } from './tab-bar/TabBarMaterial';
import { TabBarSelection } from './tab-bar/TabBarSelection';
import { useTabBarAccessibility } from './tab-bar/useTabBarAccessibility';
import { useTabBarIndicator, type TabLayout } from './tab-bar/useTabBarIndicator';

export function FloatingTabBar({ state, navigation, isFocused }: BottomTabBarProps & { isFocused: boolean }) {
  const insets = useSafeAreaInsets();
  const [layouts, setLayouts] = useState<Record<string, TabLayout>>({});
  const activeRouteKey = state.routes[state.index].key;
  const activeLayout = layouts[activeRouteKey];
  const { reduceMotion, reduceTransparency } = useTabBarAccessibility();
  const indicator = useTabBarIndicator(activeRouteKey, activeLayout, reduceMotion, isFocused);

  return <NativeView pointerEvents="box-none" style={[
    styles.container,
    {
      bottom: getTabBarBottom(insets.bottom, Platform.OS === 'web'),
      left: insets.left + tabBarLayout.horizontalMargin,
      right: insets.right + tabBarLayout.horizontalMargin,
    },
  ]}>
    <NativeView role="tablist" accessibilityLabel="Основная навигация" style={styles.bar} testID="tab-bar">
      <TabBarMaterial reduceTransparency={reduceTransparency} />
      {indicator.ready && activeLayout && <Animated.View pointerEvents="none" accessible={false} testID="tab-active-background" style={[
        styles.activeBackground,
        { width: activeLayout.width, transform: [{ translateX: indicator.translateX }] },
      ]}>
        <TabBarSelection reduceTransparency={reduceTransparency} />
      </Animated.View>}
      {state.routes.map((route, index) => {
        const tab = tabs.find(item => item.name === route.name)!;
        const focused = state.index === index;
        return <Pressable
          key={route.key}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: focused }}
          aria-selected={focused}
          accessibilityShowsLargeContentViewer
          accessibilityLargeContentTitle={tab.label}
          testID={`tab-${tab.testId}`}
          onPress={() => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          }}
          onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          onLayout={({ nativeEvent: { layout } }) => {
            if (layout.width <= 0 || layout.height <= 0) return;
            setLayouts(current => current[route.key]?.x === layout.x && current[route.key]?.width === layout.width
              ? current : { ...current, [route.key]: { x: layout.x, width: layout.width } });
          }}
          style={({ pressed }) => [styles.item, pressed && styles.pressedItem]}
        >
          <TabBarIcon tab={tab} focused={focused} />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.3}
            style={[styles.label, focused && styles.selectedLabel]}>{tab.label}</Text>
        </Pressable>;
      })}
      <NativeView pointerEvents="none" accessible={false} style={styles.outline} />
    </NativeView>
  </NativeView>;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', zIndex: 10,
    borderRadius: tabBarLayout.borderRadius,
    boxShadow: '0px 10px 30px rgba(18,15,36,0.1)',
  },
  bar: {
    width: '100%', height: tabBarLayout.height, padding: tabBarLayout.padding,
    borderRadius: tabBarLayout.borderRadius, overflow: 'hidden',
    borderCurve: 'continuous', backgroundColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', gap: 2,
  },
  item: {
    flex: 1, minWidth: 0, height: tabBarLayout.itemHeight,
    paddingHorizontal: 8, borderRadius: tabBarLayout.itemRadius,
    alignItems: 'center', justifyContent: 'center', gap: tabBarLayout.labelGap,
  },
  activeBackground: {
    position: 'absolute', left: 0, top: tabBarLayout.padding,
    height: tabBarLayout.itemHeight, borderRadius: tabBarLayout.itemRadius,
    borderCurve: 'continuous', overflow: 'visible', backgroundColor: 'transparent',
  },
  outline: {
    ...StyleSheet.absoluteFill,
    borderRadius: tabBarLayout.borderRadius, borderCurve: 'continuous',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  pressedItem: { opacity: 0.72 },
  label: {
    width: 68, maxWidth: 68, flexShrink: 0, textAlign: 'center',
    color: colors.mutedText, fontFamily: fonts.text, fontWeight: '500',
    fontSize: tabBarLayout.fontSize, lineHeight: tabBarLayout.lineHeight, letterSpacing: tabBarLayout.letterSpacing, includeFontPadding: false,
  },
  selectedLabel: { color: colors.accent },
});
