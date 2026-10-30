import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import type { OrdersEnvelope } from '../../../../packages/shared/contracts/checkout';
import { getUserOrders, CheckoutApiError } from '../api/checkout';
import { useAuth } from '../auth/AuthProvider';

type State = { status: 'loading' | 'signed-out' } | { status: 'error'; message: string }
  | { status: 'ready'; response: OrdersEnvelope; loadingMore: boolean; error?: string };

export function useUserOrders() {
  const auth = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const active = useRef<AbortController | null>(null);
  const more = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!auth.accessToken) { setState({ status: auth.loading ? 'loading' : 'signed-out' }); return; }
    const controller = new AbortController();
    active.current = controller;
    setState({ status: 'loading' });
    getUserOrders(auth.accessToken, controller.signal).then((response) => {
      if (!controller.signal.aborted) setState({ status: 'ready', response, loadingMore: false });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Не удалось загрузить покупки.' });
        if (error instanceof CheckoutApiError && error.status === 401) void auth.retryRestore().catch(() => {});
      }
    });
    return () => { controller.abort(); active.current = null; };
  }, [auth.accessToken, auth.loading, auth.retryRestore, attempt]));

  const loadMore = async () => {
    if (more.current || state.status !== 'ready' || !state.response.meta.has_more || !state.response.meta.next_cursor || !active.current || !auth.accessToken) return;
    const controller = active.current;
    more.current = true;
    setState({ ...state, loadingMore: true, error: undefined });
    try {
      const page = await getUserOrders(auth.accessToken, controller.signal, state.response.meta.next_cursor);
      if (!controller.signal.aborted) setState((previous) => previous.status !== 'ready' ? previous : {
        status: 'ready', loadingMore: false, response: { meta: page.meta, data: [...new Map([...previous.response.data, ...page.data].map((order) => [order.id, order])).values()] },
      });
    } catch (error) {
      if (!controller.signal.aborted) setState((previous) => previous.status !== 'ready' ? previous : { ...previous, loadingMore: false, error: error instanceof Error ? error.message : 'Не удалось загрузить следующие заказы.' });
    } finally { more.current = false; }
  };
  return { state, reload: () => setAttempt((value) => value + 1), loadMore };
}
