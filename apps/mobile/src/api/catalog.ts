import type { CatalogCategoriesResponse, CatalogTariffsResponse } from '../../../../packages/shared/contracts/catalog';
import { requestApi } from './client';

export async function getCatalogCategories(signal: AbortSignal): Promise<CatalogCategoriesResponse> {
  const catalog = await requestApi<CatalogCategoriesResponse>('/api/catalog/categories', signal);
  if (!catalog || !Array.isArray(catalog.data)) throw new Error('Не удалось обработать каталог. Попробуйте позже.');
  return catalog;
}

export async function getCatalogTariffs(esimId: string, signal: AbortSignal): Promise<CatalogTariffsResponse> {
  const response = await requestApi<CatalogTariffsResponse>(`/api/catalog/esims/${encodeURIComponent(esimId)}/tariffs`, signal);
  if (!response?.data?.esim || !Array.isArray(response.data.tariffs)) {
    throw new Error('Не удалось обработать тарифы. Попробуйте позже.');
  }
  return response;
}
