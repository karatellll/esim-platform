import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../theme';
import { StyleSheet } from '../ui/design';
import { Pressable, View } from '../ui/Surface';
import { TabBarMaterial } from './tab-bar/TabBarMaterial';
import { useTabBarAccessibility } from './tab-bar/useTabBarAccessibility';

const actions = {
  back: { label: 'Назад', source: require('../../assets/mvp/caa7b.svg') },
  share: { label: 'Поделиться', source: require('../../assets/mvp/f4b30.svg') },
};

type Props = {
  action: keyof typeof actions;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  caption?: ReactNode;
  disabled?: boolean;
  busy?: boolean;
};

export function GlassActionButton({ action, onPress, accessibilityLabel, testID, style, caption, disabled, busy }: Props) {
  const { reduceTransparency } = useTabBarAccessibility();
  const { label, source } = actions[action];
  const surface = <>
    <TabBarMaterial reduceTransparency={reduceTransparency} borderRadius={20} />
    <View pointerEvents="none" style={styles.stroke} />
    {busy ? <ActivityIndicator color={colors.text} size="small" />
      : <Image source={source} style={styles.icon} contentFit="contain" accessible={false} />}
  </>;

  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ disabled: !!disabled, busy: !!busy }} disabled={disabled} testID={testID}
    style={({ pressed }) => [!caption && styles.circle, style, disabled ? styles.disabled : pressed && styles.pressed]}>
    {caption ? <><View pointerEvents="none" style={styles.circle}>{surface}</View>{caption}</> : surface}
  </Pressable>;
}

const styles = StyleSheet.create({
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stroke: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(244,244,247,0.12)' },
  icon: { width: 20, height: 20 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
});
