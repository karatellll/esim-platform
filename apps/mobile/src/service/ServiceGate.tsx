import * as Network from 'expo-network';
import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, StyleSheet, View } from 'react-native';

import { OfflineBanner, ServiceState } from '../components/ServiceState';
import { getAppStatus, maintenanceMessage, type AppStatus } from './appStatus';
import { ConnectivityContext } from './connectivity';
import { colors } from '../theme';

function useConnection() {
  const browser = Platform.OS === 'web' && typeof window !== 'undefined';
  const [online, setOnline] = useState<boolean | null>(() => browser ? window.navigator.onLine : null);
  const refresh = useCallback(async () => {
    if (browser) { setOnline(window.navigator.onLine); return; }
    try {
      const state = await Network.getNetworkStateAsync();
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    } catch { setOnline(true); }
  }, [browser]);

  useEffect(() => {
    if (browser) {
      window.addEventListener('online', refresh);
      window.addEventListener('offline', refresh);
      return () => { window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh); };
    }
    const listener = Network.addNetworkStateListener(state => setOnline(state.isConnected !== false && state.isInternetReachable !== false));
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    void refresh();
    return () => { listener.remove(); foreground.remove(); };
  }, [browser, refresh]);

  return { online, refresh };
}

export function ServiceGate({ children, supportOpen, onSupport, onEsims }: PropsWithChildren<{
  supportOpen: boolean; onSupport: () => void; onEsims: () => boolean;
}>) {
  const { online, refresh } = useConnection();
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [started, setStarted] = useState(false);
  const [offlineOverride, setOfflineOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    if (online !== true || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const next = await getAppStatus(controller.signal);
    clearTimeout(timeout);
    if (request.current !== controller) return;
    request.current = null;
    setStatus(previous => previous?.status === 'ok' && next.status === 'server' ? previous : next);
    if (next.status === 'ok') setStarted(true);
    setBusy(false);
  }, [online]);

  useEffect(() => {
    if (online !== true) { setBusy(false); return; }
    void check();
    const interval = setInterval(() => { void check(); }, 30_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    return () => {
      clearInterval(interval);
      listener.remove();
      request.current?.abort();
      request.current = null;
    };
  }, [check, online]);

  const goToEsims = () => { if (onEsims()) setOfflineOverride(true); };
  const support = { label: 'Написать в поддержку', onPress: onSupport };
  let block = null;
  if (status?.status === 'update_required') {
    const url = status.storeUrl;
    block = <ServiceState kind="update" primary={{
      label: Platform.OS === 'ios' ? 'Обновить в App Store' : 'Обновить в Google Play',
      onPress: () => { void Linking.openURL(url).catch(() => {}); },
    }} />;
  } else if (!supportOpen) {
    if (!started && online === false && !offlineOverride) {
      block = <ServiceState kind="offline" primary={{ label: 'Повторить', onPress: () => { void refresh(); } }}
        secondary={{ label: 'Мои eSIM', onPress: goToEsims }} />;
    } else if (status?.status === 'maintenance') {
      block = <ServiceState kind="maintenance" secondary={support} description={maintenanceMessage(status.until)} />;
    } else if (online !== false && status?.status === 'server') {
      block = <ServiceState kind="server" primary={{ label: 'Повторить', onPress: () => { void check(); }, disabled: busy }} secondary={support} />;
    } else if (!started && online !== false && !status) {
      block = <View style={styles.startup} accessibilityLabel="Проверяем доступность сервиса">
        <ActivityIndicator color={colors.text} />
      </View>;
    }
  }

  return <ConnectivityContext.Provider value={online}>
    <View style={styles.root}>
      <View style={styles.root} pointerEvents={block ? 'none' : 'auto'} accessibilityElementsHidden={!!block} importantForAccessibility={block ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {block ? <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>{block}</View>
        : online === false && (started || offlineOverride) ? <OfflineBanner /> : null}
    </View>
  </ConnectivityContext.Provider>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  startup: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
