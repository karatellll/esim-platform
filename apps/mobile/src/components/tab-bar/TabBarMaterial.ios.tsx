import { BlurView } from 'expo-blur';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { StyleSheet, View } from 'react-native';
import { colors, tabBarLayout } from '../../theme';
import type { TabBarMaterialProps } from './TabBarMaterial';

function getLiquidGlass() {
  const native = requireOptionalNativeModule<{
    isGlassEffectAPIAvailable: boolean;
    isLiquidGlassAvailable: boolean;
  }>('ExpoGlassEffect');
  if (!native?.isGlassEffectAPIAvailable || !native.isLiquidGlassAvailable) return null;
  const { GlassView } = require('expo-glass-effect') as typeof import('expo-glass-effect');
  return GlassView;
}

const LiquidGlass = getLiquidGlass();

export function TabBarMaterial({ reduceTransparency, selected = false, borderRadius = tabBarLayout.borderRadius }: TabBarMaterialProps) {
  if (reduceTransparency) {
    return <View pointerEvents="none" testID={selected ? 'tab-selection-opaque' : 'tab-material-opaque'}
      style={[StyleSheet.absoluteFill, { backgroundColor: selected ? colors.selectedFloatingTab : colors.tabBar }]} />;
  }
  if (selected) {
    return <>
      <BlurView pointerEvents="none" testID="tab-selection-blur" tint="systemThinMaterialDark"
        intensity={85} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
    </>;
  }
  if (LiquidGlass) {
    return <>
      {/* Liquid Glass controls its own blur. Soften the backdrop underneath it. */}
      <BlurView pointerEvents="none" testID="tab-material-glass-backdrop" tint="systemUltraThinMaterialDark"
        intensity={50} style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]} />
      <LiquidGlass pointerEvents="none" testID="tab-material-liquid-glass"
        glassEffectStyle="regular" colorScheme="dark"
        tintColor="rgba(20,20,22,0.28)"
        style={[StyleSheet.absoluteFill, { borderRadius }]} />
    </>;
  }
  return <BlurView pointerEvents="none" testID="tab-material-blur"
    tint="systemUltraThinMaterialDark" intensity={100} style={StyleSheet.absoluteFill} />;
}
