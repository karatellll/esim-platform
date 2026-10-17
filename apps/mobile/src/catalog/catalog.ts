import type { CatalogCategory, CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { getCatalogPrice } from './prices';

export type CountrySection = { letter: string; countries: CatalogEsim[] };

// Verified provider codes for global/regional bundles. XK is Kosovo and stays a country.
const bundleCodes = new Set(['XG', 'XS', 'XA', 'XM', 'XC', 'XE', 'XB', 'XN', 'XL']);

export function getCountries(categories: readonly CatalogCategory[]): CatalogEsim[] {
  const countries = new Map<string, CatalogEsim>();
  for (const category of categories) {
    for (const esim of category.esims) {
      const code = esim.country_iso2?.toUpperCase();
      if (!code || !/^[A-Z]{2}$/.test(code) || bundleCodes.has(code)) continue;
      const existing = countries.get(code);
      const price = getCatalogPrice(esim);
      const existingPrice = existing ? getCatalogPrice(existing) : null;
      if (!existing || (price && (!existingPrice
        || (price.currency === existingPrice.currency && price.amount < existingPrice.amount)))) {
        countries.set(code, esim);
      }
    }
  }
  return [...countries.values()].sort((a, b) => a.display_name.localeCompare(b.display_name, 'ru', { sensitivity: 'base' }));
}

export function getCountrySections(categories: readonly CatalogCategory[], query: string): CountrySection[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('ru');
  const sections = new Map<string, CatalogEsim[]>();
  for (const country of getCountries(categories)) {
    if (normalizedQuery && !`${country.display_name} ${country.country_iso2}`.toLocaleLowerCase('ru').includes(normalizedQuery)) continue;
    const firstLetter = country.display_name.trim().charAt(0).toLocaleUpperCase('ru');
    const letter = firstLetter === 'Ё' ? 'Е' : firstLetter;
    const group = sections.get(letter) ?? [];
    group.push(country);
    sections.set(letter, group);
  }
  return [...sections].map(([letter, countries]) => ({ letter, countries }));
}

export function countLabel(count: number): string {
  const remainder = count % 100;
  const last = count % 10;
  const word = remainder >= 11 && remainder <= 14 ? 'стран' : last === 1 ? 'страна' : last >= 2 && last <= 4 ? 'страны' : 'стран';
  return `${count} ${word}`;
}
