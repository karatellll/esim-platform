import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchCountries, highlightCountryName } from '../src/catalog/countrySearch.ts';
const countries = [{ id: 'lt', country_iso2: 'LT', display_name: 'Литва' }, { id: 'it', country_iso2: 'IT', display_name: 'Италия' }, { id: 'de', country_iso2: 'DE', display_name: 'Германия' }];

test('country sheet filters by substring and ISO, sorts names and resets with whitespace', () => {
  assert.deepEqual(searchCountries(countries, ' ИТ ').map(c => c.id), ['it', 'lt']);
  assert.deepEqual(searchCountries(countries, 'de').map(c => c.id), ['de']);
  assert.deepEqual(searchCountries(countries, '   ').map(c => c.id), ['de', 'it', 'lt']);
  assert.deepEqual(searchCountries(countries, 'нет такой страны'), []);
  assert.deepEqual(countries.map(c => c.id), ['lt', 'it', 'de']);
});

test('highlight preserves display text, handles repeated matches, ё and ISO-only matches', () => {
  assert.deepEqual(highlightCountryName('Италия', 'ит'), [{ text: 'Ит', match: true }, { text: 'алия', match: false }]);
  assert.equal(highlightCountryName('Мамама', 'ма').filter(p => p.match).length, 3);
  assert.deepEqual(highlightCountryName('Острова Зелёного Мыса', 'зеленого').filter(p => p.match), [{ text: 'Зелёного', match: true }]);
  assert.deepEqual(highlightCountryName('Италия', 'IT'), [{ text: 'Италия', match: false }]);
  assert.deepEqual(highlightCountryName('Италия', ''), [{ text: 'Италия', match: false }]);
});
