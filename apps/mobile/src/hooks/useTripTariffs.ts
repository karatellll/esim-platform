import { useEffect, useState } from 'react';
import type { CatalogEsim, CatalogTariff } from '../../../../packages/shared/contracts/catalog';
import { getCatalogTariffs } from '../api/catalog';

export type TripTariffs = Record<string, { status: 'ready'; tariffs: CatalogTariff[] } | { status: 'error'; message: string }>;
export function useTripTariffs(items: readonly CatalogEsim[], enabled: boolean) {
  const [data, setData] = useState<TripTariffs>({});
  const [attempt, setAttempt] = useState(0);
  const ids = [...new Set(items.filter(item => !item.id.startsWith('unavailable:')).map(item => item.id))].sort().join(',');
  useEffect(() => {
    if (!enabled || !ids) return;
    const abort = new AbortController();
    const targets = ids.split(',');
    // Reset retry errors, preserving successful prices and every selected country.
    setData(previous => Object.fromEntries(Object.entries(previous).filter(([id, value]) => targets.includes(id) && value.status === 'ready')));
    targets.forEach(id => {
      getCatalogTariffs(id, abort.signal).then(response => {
        if (!abort.signal.aborted && response.data.esim.id === id) setData(previous => ({ ...previous, [id]: { status: 'ready', tariffs: response.data.tariffs } }));
      }).catch(error => {
        if (!abort.signal.aborted) setData(previous => ({ ...previous, [id]: { status: 'error', message: error instanceof Error ? error.message : 'Не удалось загрузить цены' } }));
      });
    });
    return () => abort.abort();
  }, [ids, enabled, attempt]);
  // Automatic retry after connectivity returns, without losing the itinerary.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const retry = () => setAttempt(value => value + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);
  return { data, reload: () => setAttempt(value => value + 1) };
}
