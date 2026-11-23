import type { CatalogState } from '../hooks/useCatalogCategories';
import { useSkeletonGate } from '../hooks/useSkeletonGate';
import { LoadFailure } from './ServiceState';
import { CountryRowsSkeleton } from './SkeletonLayouts';

export function CatalogStatus({ state, onRetry, title = 'Страны не загрузились' }: {
  state: CatalogState; onRetry: () => void; title?: string;
}) {
  const gate = useSkeletonGate(state.status === 'loading');
  if (state.status === 'ready') return null;
  if (state.status === 'error' || gate.timedOut) {
    return <LoadFailure title={title} top={56} testID="catalog-error" onRetry={() => { gate.restart(); onRetry(); }} />;
  }
  return gate.visible ? <CountryRowsSkeleton count={5} /> : null;
}
