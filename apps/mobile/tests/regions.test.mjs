import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRegionBundle, getRegionHeadingPrefix, orderRegionCountries, regionBundleName } from '../src/catalog/regions.ts';

const esim = (id, code, name, price = 139) => ({
  id, country_iso2: code, display_name: name, min_price_amount: price,
  min_price_currency: 'RUB', image_url: null,
});

test('Europe uses its regional eSIM instead of a cheaper country or the Balkans', () => {
  const europe = esim('europe-sdk-id', 'XE', 'Европа (регион)', 139);
  const category = { title: 'Европа', esims: [esim('fr', 'FR', 'Франция', 89), esim('balkans', 'XB', 'Балканы'), europe] };
  assert.equal(getRegionBundle(category), europe);
  assert.equal(regionBundleName(getRegionBundle(category)), 'Европа');
});

test('Asia selects the whole-region bundle among several subregions', () => {
  const asia = esim('asia-sdk-id', 'XS', 'Азия (регион)', 309);
  assert.equal(getRegionBundle({ title: 'Азия', esims: [esim('ae', 'AE', 'ОАЭ'), esim('middle-east', 'XM', 'Ближний Восток'), asia, esim('sea', 'XA', 'Юго-Восточная Азия')] }), asia);
});

test('a single differently named bundle preserves the actual package name', () => {
  const latin = esim('latin-sdk-id', 'XL', 'Латинская Америка');
  assert.equal(getRegionBundle({ title: 'Южная Америка', esims: [esim('ar', 'AR', 'Аргентина'), latin] }), latin);
  assert.equal(regionBundleName(latin), 'Латинская Америка');
});

test('categories without a region never substitute a country or global package', () => {
  assert.equal(getRegionBundle({ title: 'Африка', esims: [esim('eg', 'EG', 'Египет')] }), null);
  assert.equal(getRegionBundle({ title: 'Океания', esims: [] }), null);
  assert.equal(getRegionBundle({ title: 'Популярное', esims: [esim('world', 'XG', 'Глобальный пакет')] }), null);
});

test('ambiguous regional bundles require a name match', () => {
  assert.equal(getRegionBundle({ title: 'Другие', esims: [esim('balkans', 'XB', 'Балканы'), esim('east', 'XM', 'Ближний Восток')] }), null);
});

test('country chips use Figma order only for countries actually returned by API', () => {
  const countries = [esim('be', 'BE', 'Бельгия'), esim('fr', 'FR', 'Франция'), esim('de', 'DE', 'Германия'), esim('ad', 'AD', 'Андорра')];
  assert.deepEqual(orderRegionCountries(countries, 'Европа').map((country) => country.country_iso2), ['FR', 'DE', 'BE', 'AD']);
  assert.deepEqual(countries.map((country) => country.country_iso2), ['BE', 'FR', 'DE', 'AD']);
});

test('headings adapt to category names without inventing geographic names', () => {
  assert.equal(getRegionHeadingPrefix('Европа'), 'Вся');
  assert.equal(getRegionHeadingPrefix('Северная Америка'), 'Вся');
  assert.equal(getRegionHeadingPrefix('Ближний Восток'), 'Весь');
  assert.equal(getRegionHeadingPrefix('Балканы'), 'Все');
  assert.equal(getRegionHeadingPrefix('Популярное'), '');
});
