import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

import { AppState } from 'react-native';
import type { CatalogCategory } from '../../../../packages/shared/contracts/catalog';
import { getCatalogCategories } from '../api/catalog';
import { ApiRequestError } from '../api/client';
import { useOnline } from '../service/connectivity';

export type CatalogState =
  | { status: 'loading' }
  | { status: 'ready'; categories: CatalogCategory[] }
  | { status: 'error'; message: string; httpStatus?: number };

export function useCatalogCategories() {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const online = useOnline();

  useFocusEffect(useCallback(() => {
    if (!online) {
      setState(previous => previous.status === 'ready' ? previous : { status: 'error', message: 'Нет сети' });
      return;
    }
    const controller = new AbortController();
    setState((previous) => previous.status === 'ready' ? previous : { status: 'loading' });

    getCatalogCategories(controller.signal)
      .then((catalog) => {
        if (!controller.signal.aborted) setState({ status: 'ready', categories: catalog.data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState((previous) => previous.status === 'ready' ? previous : {
            status: 'error', message: error instanceof Error ? error.message : 'Не удалось загрузить направления.',
            httpStatus: error instanceof ApiRequestError ? error.status : undefined,
          });
        }
      });

    return () => controller.abort();
  }, [attempt, online]));

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (state.status !== 'error' || !online) return;
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') reload(); });
    return () => subscription.remove();
  }, [state.status, reload, online]);
  return { state, reload };
}
