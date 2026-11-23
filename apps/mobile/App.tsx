import { useFonts } from 'expo-font';
import { DarkTheme, getPathFromState, NavigationContainer, useNavigationContainerRef, type LinkingOptions } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import type { RootStackParamList } from './src/navigation/stack';
import { ServiceGate } from './src/service/ServiceGate';
import { useOnline } from './src/service/connectivity';
import { colors } from './src/theme';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.tabBar,
    text: colors.text,
    border: colors.tabBar,
  },
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['tursim://'],
  config: {
    initialRouteName: 'Main',
    screens: {
      Main: { screens: { Search: '', Countries: 'countries', MyEsims: 'my-esims', Savings: 'savings', Profile: 'profile' } },
      Help: 'help',
      OrderStatus: { path: 'orders/:orderId', parse: { orderId: value => value.toLowerCase() } },
      TariffLink: 'tariffs/:esimId',
      NotFound: '*',
    },
  },
  getPathFromState(state, options) {
    const active = state.routes[state.index ?? state.routes.length - 1];
    const params = active?.params as { country?: { id: string }; bundle?: { id: string } } | undefined;
    const esimId = active?.name === 'CountryTariffs' ? params?.country?.id : active?.name === 'WorldTariffs' ? params?.bundle?.id : undefined;
    return esimId ? `/tariffs/${encodeURIComponent(esimId)}` : getPathFromState(state, options);
  },
};

function RestoreOnReconnect() {
  const { retryRestore } = useAuth();
  const online = useOnline();
  const wasOffline = useRef(false);
  useEffect(() => {
    if (online && wasOffline.current) void retryRestore().catch(() => {});
    wasOffline.current = !online;
  }, [online, retryRestore]);
  return null;
}

function Navigation() {
  const auth = useAuth();
  const ref = useNavigationContainerRef<RootStackParamList>();
  const [ready, setReady] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const syncRoute = () => setSupportOpen(ref.getRootState()?.routes.some(route => route.name === 'Help') ?? false);

  useEffect(() => {
    if (ready && auth.expired) {
      ref.navigate('SessionExpired');
      auth.acknowledgeExpiry();
    }
  }, [auth, ready, ref]);

  return <ServiceGate supportOpen={supportOpen} onSupport={() => { if (ref.isReady()) ref.navigate('Help'); }}
    onEsims={() => {
      if (!ref.isReady()) return false;
      ref.navigate('Main', { screen: 'MyEsims' });
      return true;
    }}>
    <RestoreOnReconnect />
    <NavigationContainer ref={ref} theme={theme} linking={linking} onStateChange={syncRoute}
      onReady={() => { setReady(true); syncRoute(); }}>
      <AppNavigator />
    </NavigationContainer>
  </ServiceGate>;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ InterTightBlack: require('./assets/fonts/InterTight-Black.ttf') });
  if (!fontsLoaded && !fontError) return null;
  if (__DEV__ && Platform.OS === 'web' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('visual') === 'installation') {
    const { InstallationPreview } = require('./qa/InstallationPreview');
    return <InstallationPreview />;
  }
  if (__DEV__ && Platform.OS === 'web' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('visual') === 'my-esims') {
    const { MyEsimsPreview } = require('./qa/MyEsimsPreview');
    return <MyEsimsPreview />;
  }
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
