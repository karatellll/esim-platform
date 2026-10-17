import { LinearGradient } from 'expo-linear-gradient';
import type { CSSProperties } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { tabBarLayout } from '../theme';
import type { TabBarBackdropProps } from './TabBarBackdrop';

const fadeHeight = tabBarLayout.backdropFadeHeight;

export function TabBarBackdrop({ bottom }: TabBarBackdropProps) {
  const height = bottom + tabBarLayout.height;
  const blurStyle: CSSProperties = {
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    maskImage: `linear-gradient(to bottom, transparent 0px, rgba(0,0,0,0.2) ${fadeHeight * 0.45}px, black ${fadeHeight}px)`,
    WebkitMaskImage: `linear-gradient(to bottom, transparent 0px, rgba(0,0,0,0.2) ${fadeHeight * 0.45}px, black ${fadeHeight}px)`,
  };

  return (
    <View pointerEvents="none" accessible={false} style={[styles.container, { height }]} testID="tab-bar-backdrop">
      <View style={[StyleSheet.absoluteFill, blurStyle as ViewStyle]} testID="tab-bar-backdrop-blur" />
      <LinearGradient
        colors={['rgba(20,20,22,0)', 'rgba(20,20,22,0.35)', 'rgba(20,20,22,0.85)', '#141416']}
        locations={[0, fadeHeight / height, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { position: 'absolute', bottom: 0, left: 0, right: 0, overflow: 'hidden' } });
