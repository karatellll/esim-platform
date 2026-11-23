import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import { colors } from '../../theme';

export type TabBarMaterialProps = { reduceTransparency: boolean; selected?: boolean; borderRadius?: number };

export function TabBarMaterial({ reduceTransparency, selected = false }: TabBarMaterialProps) {
  if (reduceTransparency || Platform.OS === 'android') {
    return <View pointerEvents="none" testID={selected ? 'tab-selection-opaque' : 'tab-material-opaque'}
      style={[StyleSheet.absoluteFill, { backgroundColor: selected ? colors.selectedFloatingTab : colors.tabBar }]} />;
  }
  return <BlurView pointerEvents="none" testID={selected ? 'tab-selection-blur' : 'tab-material-blur'}
    tint={selected ? 'regular' : 'dark'} intensity={selected ? 45 : 85}
    style={StyleSheet.absoluteFill} />;
}
