import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BlurTargetView } from 'expo-blur';
import { createRef, useRef, type RefObject } from 'react';
import { View } from 'react-native';

import { FloatingTabBar } from '../components/FloatingTabBar';
import { EmptyScreen } from '../screens/EmptyScreen';
import { CountriesScreen } from '../screens/CountriesScreen';
import { CountryTariffsScreen } from '../screens/CountryTariffsScreen';
import { RegionTariffsScreen } from '../screens/RegionTariffsScreen';
import { ProfileGuestScreen } from '../screens/ProfileGuestScreen';
import type { RootStackParamList } from './stack';
import { colors } from '../theme';
import { type RootTabParamList, tabs } from './tabs';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const isFocused = useIsFocused();
  // Each mounted tab has its own target; returning to a tab restores the right background.
  const blurTargets = useRef(new Map<string, RefObject<View | null>>());
  const getBlurTarget = (key: string) => {
    let target = blurTargets.current.get(key);
    if (!target) {
      target = createRef<View>();
      blurTargets.current.set(key, target);
    }
    return target;
  };

  return (
    <Tab.Navigator
      initialRouteName="Search"
      backBehavior="history"
      tabBar={(props) => <FloatingTabBar {...props} isFocused={isFocused} blurTarget={getBlurTarget(props.state.routes[props.state.index].key)} />}
      screenLayout={({ children, route }) => (
        <BlurTargetView ref={getBlurTarget(route.key)} style={{ flex: 1 }}>{children}</BlurTargetView>
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        animation: 'none',
      }}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.name === 'Countries' ? CountriesScreen : tab.name === 'Profile' ? ProfileGuestScreen : EmptyScreen}
          options={{ title: tab.label }}
        />
      ))}
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="Main" component={MainTabs} />
    <Stack.Screen name="CountryTariffs" component={CountryTariffsScreen} />
    <Stack.Screen name="RegionTariffs" component={RegionTariffsScreen} />
  </Stack.Navigator>;
}
