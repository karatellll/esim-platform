import { WorldTariffsScreen } from '../screens/WorldTariffsScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { FloatingTabBar } from '../components/FloatingTabBar';
import { MyEsimsScreen } from '../screens/MyEsimsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { CountriesScreen } from '../screens/CountriesScreen';
import { CountryTariffsScreen } from '../screens/CountryTariffsScreen';
import { RegionTariffsScreen } from '../screens/RegionTariffsScreen';
import { SavingsScreen } from '../screens/SavingsScreen';
import { EmailSignInScreen } from '../screens/EmailSignInScreen';
import { EmailCodeScreen } from '../screens/EmailCodeScreen';
import { LoyaltyScreen } from '../screens/LoyaltyScreen';
import { HelpScreen } from '../screens/HelpScreen';
import { ProfileEditScreen } from '../screens/ProfileEditScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { OrderStatusScreen } from '../screens/OrderStatusScreen';
import type { RootStackParamList } from './stack';
import { colors } from '../theme';
import { type RootTabParamList, tabs } from './tabs';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const isFocused = useIsFocused();

  return (
    <Tab.Navigator
      initialRouteName="Search"
      backBehavior="history"
      tabBar={(props) => <FloatingTabBar {...props} isFocused={isFocused} />}
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
          component={tab.name === 'Search' ? HomeScreen : tab.name === 'Countries' ? CountriesScreen : tab.name === 'Profile' ? ProfileScreen : tab.name === 'Savings' ? SavingsScreen : MyEsimsScreen}
          options={{ title: tab.label }}
        />
      ))}
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="Main" component={MainTabs} />
    <Stack.Screen name="Loyalty" component={LoyaltyScreen} />
    <Stack.Screen name="Help" component={HelpScreen} />
    <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
    <Stack.Screen name="EmailSignIn" component={EmailSignInScreen} options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
    <Stack.Screen name="EmailCode" component={EmailCodeScreen} options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
    <Stack.Screen name="WorldTariffs" component={WorldTariffsScreen} />
    <Stack.Screen name="CountryTariffs" component={CountryTariffsScreen} />
    <Stack.Screen name="RegionTariffs" component={RegionTariffsScreen} />
    <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
    <Stack.Screen name="OrderStatus" component={OrderStatusScreen} />
  </Stack.Navigator>;
}
