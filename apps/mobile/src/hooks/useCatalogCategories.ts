import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import type { CatalogCategory } from '../../../../packages/shared/contracts/catalog';
import { getCatalogCategories } from '../api/catalog';

export type CatalogState =
  | { status: 'loading' }
  | { status: 'ready'; categories: CatalogCategory[] }
  | { status: 'error'; message: string };

export function useCatalogCategories() {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    getCatalogCategories(controller.signal)
      .then((catalog) => {
        if (!controller.signal.aborted) setState({ status: 'ready', categories: catalog.data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Не удалось загрузить направления.',
          });
        }
      });

    return () => controller.abort();
  }, [attempt]));

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, reload };
}
