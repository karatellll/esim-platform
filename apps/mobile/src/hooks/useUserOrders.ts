import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import type { OrderData, OrdersEnvelope } from '../../../../packages/shared/contracts/checkout';
import { getUserOrders, CheckoutApiError } from '../api/checkout';
import { useAuth } from '../auth/AuthProvider';
import { prefetchOfflineOrders, readOfflineOrder, readOfflineOrders, saveOfflineOrders } from '../orders/offlineOrders';
import type { OrderDates } from '../orders/myEsims';
import { useOnline } from '../service/connectivity';

type State = { status: 'loading' | 'signed-out' } | { status: 'error'; message: string }
  | { status: 'ready'; owner: string; response: OrdersEnvelope; dates: Record<string, OrderDates>; loadingMore: boolean; error?: string };

export function useUserOrders() {
  const auth = useAuth();
  const online = useOnline();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const owner = auth.user?.id ?? (!online ? auth.offlineUserId : null);
  const active = useRef<AbortController | null>(null);
  const more = useRef(false);
  const recordDates = useCallback((ownerId: string, order: OrderData, signal: AbortSignal) => {
    if (signal.aborted || (!order.activated_at && !order.expires_at)) return;
    setState(previous => previous.status === 'ready' && previous.owner === ownerId
      ? { ...previous, dates: { ...previous.dates, [order.id]: { activated_at: order.activated_at, expires_at: order.expires_at } } }
      : previous);
  }, []);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    const userId = owner;
    if (!userId) { setState({ status: auth.loading ? 'loading' : 'signed-out' }); return; }
    if (!online) {
      void readOfflineOrders(userId).then(response => {
        if (controller.signal.aborted) return;
        setState(response ? { status: 'ready', owner: userId, response, dates: {}, loadingMore: false }
          : { status: 'error', message: 'Нужна сеть, чтобы загрузить покупки.' });
        response?.data.forEach(async item => {
          const saved = await readOfflineOrder(userId, item.id);
          if (saved) recordDates(userId, saved, controller.signal);
        });
      });
      return () => controller.abort();
    }
    if (!auth.accessToken) { setState({ status: auth.loading ? 'loading' : 'signed-out' }); return; }
    const token = auth.accessToken;
    active.current = controller;
    setState(previous => previous.status === 'ready' && previous.owner === userId ? previous : { status: 'loading' });
    getUserOrders(token, controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      setState(previous => ({ status: 'ready', owner: userId, response, loadingMore: false,
        dates: previous.status === 'ready' && previous.owner === userId ? previous.dates : {} }));
      saveOfflineOrders(userId, response);
      void prefetchOfflineOrders(userId, response, token, controller.signal, order => recordDates(userId, order, controller.signal));
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : 'Не удалось загрузить покупки.';
        setState(previous => previous.status === 'ready' && previous.owner === userId
          ? { ...previous, error: message } : { status: 'error', message });
        if (error instanceof CheckoutApiError && error.status === 401) void auth.retryRestore().catch(() => {});
      }
    });
    return () => { controller.abort(); active.current = null; };
  }, [auth.accessToken, auth.loading, auth.retryRestore, attempt, online, owner, recordDates]));

  const loadMore = async () => {
    if (!online || more.current || state.status !== 'ready' || state.owner !== owner || !state.response.meta.has_more || !state.response.meta.next_cursor || !active.current || !auth.accessToken || !auth.user) return;
    const controller = active.current;
    const token = auth.accessToken;
    const userId = auth.user.id;
    more.current = true;
    setState(previous => previous.status === 'ready' && previous.owner === userId
      ? { ...previous, loadingMore: true, error: undefined } : previous);
    try {
      const page = await getUserOrders(token, controller.signal, state.response.meta.next_cursor);
      if (controller.signal.aborted) return;
      const response = { meta: page.meta, data: [...new Map([...state.response.data, ...page.data].map(order => [order.id, order])).values()] };
      setState(previous => previous.status === 'ready' && previous.owner === userId
        ? { ...previous, response, loadingMore: false } : previous);
      saveOfflineOrders(userId, response);
      void prefetchOfflineOrders(userId, page, token, controller.signal, order => recordDates(userId, order, controller.signal));
    } catch (error) {
      if (!controller.signal.aborted) setState((previous) => previous.status !== 'ready' ? previous : { ...previous, loadingMore: false, error: error instanceof Error ? error.message : 'Не удалось загрузить следующие заказы.' });
    } finally { more.current = false; }
  };
  const visibleState: State = state.status === 'ready' && state.owner !== owner ? { status: 'loading' } : state;
  return { state: visibleState, reload: () => setAttempt((value) => value + 1), loadMore };
}
