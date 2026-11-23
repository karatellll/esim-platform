import { Image } from 'expo-image';
import type { tabs } from '../../navigation/tabs';

export function TabBarIcon({ tab, focused }: { tab: (typeof tabs)[number]; focused: boolean }) {
  return <Image source={focused ? tab.activeIcon : tab.icon}
    style={{ width: tab.iconWidth, height: tab.iconHeight }}
    contentFit="contain" transition={0} accessible={false} />;
}
