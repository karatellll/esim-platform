import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';

const normalize = (text: string) => text.toLocaleLowerCase('ru').replace(/ё/g, 'е');

export function searchCountries(countries: readonly CatalogEsim[], query: string) {
  const needle = normalize(query.trim());
  return [...countries].filter(country => !needle || normalize(`${country.display_name} ${country.country_iso2 ?? ''}`).includes(needle))
    .sort((a, b) => a.display_name.localeCompare(b.display_name, 'ru', { sensitivity: 'base' }));
}

export function highlightCountryName(name: string, query: string): { text: string; match: boolean }[] {
  const needle = normalize(query.trim());
  if (!needle) return [{ text: name, match: false }];
  const haystack = normalize(name);
  const result: { text: string; match: boolean }[] = [];
  let cursor = 0;
  for (let start = haystack.indexOf(needle); start >= 0; start = haystack.indexOf(needle, cursor)) {
    if (start > cursor) result.push({ text: name.slice(cursor, start), match: false });
    cursor = start + needle.length;
    result.push({ text: name.slice(start, cursor), match: true });
  }
  if (cursor < name.length) result.push({ text: name.slice(cursor), match: false });
  return result;
}
