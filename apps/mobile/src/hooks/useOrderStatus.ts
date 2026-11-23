import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { OrderData } from '../../../../packages/shared/contracts/checkout';
import { CheckoutApiError, getOrder } from '../api/checkout';
import { useAuth } from '../auth/AuthProvider';
import { readOfflineOrder, saveOfflineOrder } from '../orders/offlineOrders';
import { useOnline } from '../service/connectivity';

export function useOrderStatus(orderId: string) {
  const auth = useAuth();
  const online = useOnline();
  const owner = auth.user?.id ?? (!online ? auth.offlineUserId : null);
  const [state, setState] = useState<{ order: OrderData | null; owner?: string | null; loading: boolean; error: string | null; notFound?: boolean }>({ order: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const displayed = useRef('');
  useFocusEffect(useCallback(() => {
    const token = auth.accessToken;
    if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(orderId)) {
      setState({ order: null, loading: false, error: null, notFound: true });
      return;
    }
    if (!online && owner) {
      const controller = new AbortController();
      void readOfflineOrder(owner, orderId).then(order => {
        if (!controller.signal.aborted) setState({ order, owner, loading: false, error: order ? null : 'Детали заказа ещё не сохранены. Подключитесь к интернету.' });
      });
      return () => controller.abort();
    }
    if (!token) { setState({ order: null, loading: auth.loading, error: auth.loading ? null : 'Войдите в аккаунт, чтобы посмотреть заказ.' }); return; }
    const controller = new AbortController();
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let errors = 0;
    const visible = () => (AppState.currentState === 'active' || AppState.currentState === 'unknown')
      && !(Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden);
    const schedule = (delay: number) => { clearTimeout(timer); if (!controller.signal.aborted) timer = setTimeout(() => void load(), delay); };
    const load = async () => {
      if (running || controller.signal.aborted || !visible()) return;
      running = true;
      clearTimeout(timer);
      try {
        const response = await getOrder(orderId, token, controller.signal);
        if (controller.signal.aborted) return;
        errors = 0;
        setState({ order: response.data, owner, loading: false, error: null });
        if (owner) void saveOfflineOrder(owner, response.data, token, controller.signal);
        const partialDelivery = response.data.state === 'delivered' && response.data.payment.state === 'captured' && (!response.data.provision?.activation_code || !response.data.provision?.qr_code_url);
        if (['pending_payment', 'paid', 'provisioning'].includes(response.data.state) || partialDelivery) schedule(5000);
        else if (response.data.state === 'delivered' && response.data.provision?.qr_code_url_expires) {
          // Signed QR URLs expire. Refresh while this screen is visible so the
          // installation image does not silently become unusable after 5 min.
          const expires = Date.parse(response.data.provision.qr_code_url_expires);
          if (Number.isFinite(expires)) schedule(Math.max(5000, expires - Date.now() - 15_000));
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        const notFound = error instanceof CheckoutApiError && error.status === 404;
        setState((previous) => ({ ...previous, loading: false, notFound, error: error instanceof Error ? error.message : 'Не удалось проверить заказ.' }));
        if (error instanceof CheckoutApiError && error.status === 401) void auth.retryRestore().catch(() => {});
        else if (!(error instanceof CheckoutApiError && error.status === 404) && ++errors < 6) schedule(10_000);
      } finally { running = false; }
    };
    const identity = `${owner ?? ''}:${orderId}`;
    const keepOrder = displayed.current === identity;
    displayed.current = identity;
    setState(previous => ({ order: keepOrder ? previous.order : null, owner, loading: true, error: null }));
    void load();
    const listener = AppState.addEventListener('change', (next) => { if (next === 'active') void load(); else clearTimeout(timer); });
    const focus = () => { if (visible()) void load(); };
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', focus);
    return () => {
      controller.abort(); clearTimeout(timer); listener.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', focus);
    };
  }, [orderId, owner, auth.accessToken, auth.loading, auth.retryRestore, attempt, online]));
  return { ...state, order: state.owner === owner && state.order?.id === orderId ? state.order : null,
    reload: () => setAttempt((value) => value + 1) };
}
