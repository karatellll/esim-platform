import { useEffect, useRef, useState } from 'react';
import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { coverageSubscription } from '../api/coverage';
import { useAuth } from '../auth/AuthProvider';
import { useUserOrders } from '../hooks/useUserOrders';
import { useOnline } from '../service/connectivity';
import { colors } from '../theme';
import { StyleSheet } from '../ui/design';
import { Pressable, View } from '../ui/Surface';
import { Text } from '../ui/Text';
import { searchSurfaces } from './TripSearchUI';

export function TripSearchCoverage({ country, onSignIn }: { country: CatalogEsim; onSignIn: () => void }) {
  const auth = useAuth();
  const online = useOnline();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pendingSignIn = useRef(false);
  const { accessToken } = auth;
  const code = country.country_iso2;

  useEffect(() => {
    if (!accessToken || !online || !code) return;
    let active = true;
    const update = async () => {
      try {
        const result = await coverageSubscription(accessToken);
        if (!active || !('data' in result)) return;
        const exists = result.data.some(item => item.country_iso2 === code && ['pending', 'sending'].includes(item.status));
        if (pendingSignIn.current && !exists) {
          pendingSignIn.current = false;
          setBusy(true);
          await coverageSubscription(accessToken, code);
          if (!active) return;
          setMessage('Сообщим на почту, когда появятся тарифы');
          setSubscribed(true);
        } else {
          pendingSignIn.current = false;
          setSubscribed(exists);
        }
      } catch {
        if (active) {
          setSubscribed(false);
          setMessage('Не удалось загрузить уведомления');
        }
      } finally {
        if (active) setBusy(false);
      }
    };
    void update();
    return () => { active = false; };
  }, [accessToken, code, online]);

  const toggle = async () => {
    if (!code || !online || busy) return;
    if (!accessToken) {
      pendingSignIn.current = true;
      onSignIn();
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await coverageSubscription(accessToken, code, subscribed === true);
      setMessage(subscribed ? 'Уведомление отменено' : 'Сообщим на почту, когда появятся тарифы');
      setSubscribed(!subscribed);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить уведомление');
    } finally {
      setBusy(false);
    }
  };

  return <View style={styles.coverage}>
    <Pressable onPress={() => void toggle()} disabled={!online || busy || (!!accessToken && subscribed === null)}
      accessibilityRole="button" testID={`trip-notify-${code}`}>
      <Text style={styles.link}>{busy ? 'Сохраняем…' : subscribed && accessToken ? 'Отменить уведомление' : 'Уведомить о тарифах'}</Text>
    </Pressable>
    {!!message && <Text style={styles.caption} accessibilityLiveRegion="polite">{message}</Text>}
  </View>;
}

export function TripSearchExistingEsim({ country, onOpen }: { country: CatalogEsim; onOpen: (order: string) => void }) {
  const orders = useUserOrders();
  const existing = orders.state.status === 'ready' ? orders.state.response.data.find(order =>
    order.esim.id === country.id && ['active', 'installed'].includes(order.esim_status?.toLowerCase() ?? '')) : null;

  useEffect(() => {
    if (!existing && orders.state.status === 'ready' && orders.state.response.meta.has_more
      && !orders.state.loadingMore && !orders.state.error) void orders.loadMore();
  }, [existing, orders.state, orders.loadMore]);

  if (!existing) return null;
  return <Pressable accessibilityRole="button" style={styles.existing} onPress={() => onOpen(existing.id)} testID="trip-existing-esim">
    <Text style={styles.caption}>У вас уже есть eSIM для этой страны</Text>
    <Text style={styles.link}>Открыть мою eSIM</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  coverage: { marginHorizontal: 16, marginLeft: 69, marginBottom: 12, gap: 6 },
  existing: { gap: 6, padding: 16, borderRadius: 24, cornerSmoothing: 1, backgroundColor: searchSurfaces.panel },
  caption: { fontSize: 14, lineHeight: 20, color: colors.mutedText },
  link: { fontSize: 14, lineHeight: 20, color: colors.accent, fontWeight: '600' },
});
