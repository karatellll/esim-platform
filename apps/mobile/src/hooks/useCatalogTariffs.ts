import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import type { CatalogTariffsResponse } from '../../../../packages/shared/contracts/catalog';
import { getCatalogTariffs } from '../api/catalog';
import { ApiRequestError } from '../api/client';
import { useOnline } from '../service/connectivity';

export type TariffsState =
  | { status: 'loading' }
  | { status: 'ready'; data: CatalogTariffsResponse['data'] }
  | { status: 'error'; message: string; httpStatus?: number };

export function useCatalogTariffs(esimId: string | null, retryTransientError = false) {
  const [state, setState] = useState<TariffsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const online = useOnline();
  useFocusEffect(useCallback(() => {
    if (!online) {
      setState(previous => previous.status === 'ready' && previous.data.esim.id === esimId
        ? previous : { status: 'error', message: 'Нет сети' });
      return;
    }
    const controller = new AbortController();
    setState((previous) => previous.status === 'ready' && previous.data.esim.id === esimId ? previous : { status: 'loading' });
    if (!esimId) return () => controller.abort();
    const { signal } = controller;
    getCatalogTariffs(esimId, signal)
      .catch((error: unknown) => {
        if (retryTransientError && !signal.aborted && error instanceof ApiRequestError
          && (error.status === 502 || error.status === 504)) {
          return getCatalogTariffs(esimId, signal);
        }
        throw error;
      })
      .then((response) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data: response.data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState((previous) => previous.status === 'ready' ? previous : {
          status: 'error', message: error instanceof Error ? error.message : 'Не удалось загрузить тарифы.',
          httpStatus: error instanceof ApiRequestError ? error.status : undefined,
        });
      });
    return () => controller.abort();
  }, [esimId, attempt, online, retryTransientError]));
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, reload };
}
