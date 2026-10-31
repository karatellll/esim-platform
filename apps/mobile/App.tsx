import { useFonts } from 'expo-font';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/auth/AuthProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
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

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ InterTightBlack: require('./assets/fonts/InterTight-Black.ttf') });
  if (!fontsLoaded && !fontError) return null;
  if (__DEV__ && Platform.OS === 'web' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('visual') === 'installation') {
    const { InstallationPreview } = require('./qa/InstallationPreview');
    return <InstallationPreview />;
  }
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
      <NavigationContainer theme={theme}>
        <AppNavigator />
      </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
