import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { tabBarLayout } from '../theme';

export type TabBarBackdropProps = { bottom: number; blurTarget: RefObject<View | null> };

export function TabBarBackdrop({ bottom, blurTarget }: TabBarBackdropProps) {
  const height = bottom + tabBarLayout.height;
  const fadeEnd = tabBarLayout.backdropFadeHeight / height;

  return (
    <View pointerEvents="none" accessible={false} style={[styles.container, { height }]} testID="tab-bar-backdrop">
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={<LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.2)', '#000', '#000']}
          locations={[0, fadeEnd * 0.45, fadeEnd, 1]}
          style={StyleSheet.absoluteFill}
        />}
      >
        <BlurView blurTarget={blurTarget} blurMethod="dimezisBlurView" intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      </MaskedView>
      <LinearGradient
        colors={['rgba(20,20,22,0)', 'rgba(20,20,22,0.35)', 'rgba(20,20,22,0.85)', '#141416']}
        locations={[0, fadeEnd, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { position: 'absolute', bottom: 0, left: 0, right: 0, overflow: 'hidden' } });
