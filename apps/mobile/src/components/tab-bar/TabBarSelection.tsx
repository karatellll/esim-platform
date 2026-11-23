import { StyleSheet, View } from 'react-native';
import { tabBarLayout } from '../../theme';
import { TabBarMaterial } from './TabBarMaterial';

export function TabBarSelection({ reduceTransparency }: { reduceTransparency: boolean }) {
  return <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, styles.surface]}>
    <TabBarMaterial selected reduceTransparency={reduceTransparency} />
  </View>;
}

const styles = StyleSheet.create({
  surface: { borderRadius: tabBarLayout.itemRadius, borderCurve: 'continuous', overflow: 'hidden' },
});
