import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { OrderData } from '../../../../packages/shared/contracts/checkout';
import { CheckoutApiError, getOrder } from '../api/checkout';
import { useAuth } from '../auth/AuthProvider';

export function useOrderStatus(orderId: string) {
  const auth = useAuth();
  const [state, setState] = useState<{ order: OrderData | null; loading: boolean; error: string | null }>({ order: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const displayed = useRef('');
  useFocusEffect(useCallback(() => {
    const token = auth.accessToken;
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
        setState({ order: response.data, loading: false, error: null });
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
        setState((previous) => ({ ...previous, loading: false, error: error instanceof Error ? error.message : 'Не удалось проверить заказ.' }));
        if (error instanceof CheckoutApiError && error.status === 401) void auth.retryRestore().catch(() => {});
        else if (!(error instanceof CheckoutApiError && error.status === 404) && ++errors < 6) schedule(10_000);
      } finally { running = false; }
    };
    const identity = `${auth.user?.id ?? ''}:${orderId}`;
    const keepOrder = displayed.current === identity;
    displayed.current = identity;
    setState(previous => ({ order: keepOrder ? previous.order : null, loading: true, error: null }));
    void load();
    const listener = AppState.addEventListener('change', (next) => { if (next === 'active') void load(); else clearTimeout(timer); });
    const focus = () => { if (visible()) void load(); };
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', focus);
    return () => {
      controller.abort(); clearTimeout(timer); listener.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', focus);
    };
  }, [orderId, auth.user?.id, auth.accessToken, auth.loading, auth.retryRestore, attempt]));
  return { ...state, reload: () => setAttempt((value) => value + 1) };
}
