import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { View } from '../ui/Surface';
import { StyleSheet } from '../ui/design';

import { type RootTabParamList, tabs } from '../navigation/tabs';
import { colors } from '../theme';

export function EmptyScreen({ route }: BottomTabScreenProps<RootTabParamList>) {
  const tab = tabs.find((item) => item.name === route.name)!;

  return <View style={styles.screen} testID={`screen-${tab.testId}`} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
