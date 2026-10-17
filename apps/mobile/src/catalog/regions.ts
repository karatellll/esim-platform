import type { CatalogCategory, CatalogEsim } from '../../../../packages/shared/contracts/catalog';

const regionalCodes = new Set(['XS', 'XA', 'XM', 'XC', 'XE', 'XB', 'XN', 'XL']);
const normalize = (name: string): string => name.replace(/\s*\(регион\)\s*/gi, '').trim().toLocaleLowerCase('ru');

export function getRegionBundle(category: CatalogCategory): CatalogEsim | null {
  const bundles = category.esims.filter((esim) => regionalCodes.has(esim.country_iso2?.toUpperCase() ?? ''));
  const exact = bundles.find((esim) => normalize(esim.display_name) === normalize(category.title));
  // Never pick an arbitrary country or global eSIM for a regional category.
  return exact ?? (bundles.length === 1 ? bundles[0] : null);
}

export function regionBundleName(bundle: CatalogEsim): string {
  return bundle.display_name.replace(/\s*\(регион\)\s*/gi, '').trim();
}

export function getRegionHeadingPrefix(title: string): string {
  if (/(азия|европа|африка|океания|америка)$/i.test(title.trim())) return 'Вся';
  if (/^(ближний восток|кавказ|снг)$/i.test(title.trim())) return 'Весь';
  if (/^балканы$/i.test(title.trim())) return 'Все';
  return '';
}

export function orderRegionCountries(countries: readonly CatalogEsim[], title: string): CatalogEsim[] {
  const preferred: Record<string, string[]> = {
    'европа': ['FR', 'IT', 'DE', 'ES', 'BE'],
    'азия': ['JP', 'TH', 'TR', 'CN', 'KR'],
  };
  const order = preferred[normalize(title)] ?? [];
  return [...countries].sort((a, b) => {
    const aIndex = order.indexOf(a.country_iso2?.toUpperCase() ?? '');
    const bIndex = order.indexOf(b.country_iso2?.toUpperCase() ?? '');
    return (aIndex < 0 ? order.length : aIndex) - (bIndex < 0 ? order.length : bIndex)
      || a.display_name.localeCompare(b.display_name, 'ru');
  });
}
