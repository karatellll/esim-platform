import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import type { SavingsBalance } from '../../../../packages/shared/contracts/savings';
import { requestApi } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useOnline } from '../service/connectivity';

type State = { status: 'loading' | 'error' } | { status: 'ready'; amount: number };

export function useSavingsBalance() {
  const { accessToken, user } = useAuth();
  const online = useOnline();
  const [result, setResult] = useState<{ owner: string; state: State } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const owner = user?.id;
  useFocusEffect(useCallback(() => {
    if (!owner || !accessToken) return;
    if (!online) {
      setResult(previous => previous?.owner === owner && previous.state.status === 'ready' ? previous : { owner, state: { status: 'error' } });
      return;
    }
    const controller = new AbortController();
    setResult({ owner, state: { status: 'loading' } });
    requestApi<SavingsBalance>('/api/me/savings', controller.signal, accessToken)
      .then(data => {
        if (!controller.signal.aborted) setResult({ owner, state: Number.isFinite(data.amount_rub)
          ? { status: 'ready', amount: data.amount_rub } : { status: 'error' } });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ owner, state: { status: 'error' } });
      });
    return () => controller.abort();
  }, [owner, accessToken, attempt, online]));

  const state: State = result && result.owner === owner ? result.state : { status: 'loading' };
  return { state, reload: () => setAttempt(value => value + 1) };
}
