import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';

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
