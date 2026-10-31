import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import type { CatalogTariffsResponse } from '../../../../packages/shared/contracts/catalog';
import { getCatalogTariffs } from '../api/catalog';

export type TariffsState =
  | { status: 'loading' }
  | { status: 'ready'; data: CatalogTariffsResponse['data'] }
  | { status: 'error'; message: string };

export function useCatalogTariffs(esimId: string | null) {
  const [state, setState] = useState<TariffsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    setState((previous) => previous.status === 'ready' && previous.data.esim.id === esimId ? previous : { status: 'loading' });
    if (!esimId) return () => controller.abort();
    getCatalogTariffs(esimId, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data: response.data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState((previous) => previous.status === 'ready' ? previous : { status: 'error', message: error instanceof Error ? error.message : 'Не удалось загрузить тарифы.' });
      });
    return () => controller.abort();
  }, [esimId, attempt]));
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, reload };
}
