import type { CatalogCategory, CatalogEsim } from '../../../../packages/shared/contracts/catalog';

export function getGlobalBundle(categories: readonly CatalogCategory[]): CatalogEsim | null {
  for (const category of categories) {
    const bundle = category.esims.find((esim) => esim.country_iso2?.toUpperCase() === 'XG');
    if (bundle) return bundle;
  }
  return null;
}
