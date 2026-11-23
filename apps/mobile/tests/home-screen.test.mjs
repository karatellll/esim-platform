import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import ts from 'typescript';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const country = { id: 'turkey', country_iso2: 'TR', display_name: 'Турция', image_url: null, min_price_amount: 700, min_price_currency: 'RUB' };
const popularCountries = [country, ...[['AE', 'ОАЭ'], ['TH', 'Таиланд'], ['GE', 'Грузия'], ['JP', 'Япония']].map(([code, name]) => ({ ...country, id: code, country_iso2: code, display_name: name }))];
const bundle = { ...country, id: 'world', country_iso2: 'XG', display_name: 'Весь мир' };
const regions = [
  { title: 'Европа', esims: [popularCountries[0], popularCountries[3], { ...country, id: 'tr-duplicate' }, { ...bundle, country_iso2: 'XE' }] },
  { title: 'Азия', esims: [popularCountries[0], popularCountries[1], popularCountries[2], popularCountries[4]] },
  { title: 'Африка', esims: [{ ...country, id: 'EG', country_iso2: 'EG', display_name: 'Египет' }] },
];

class ApiRequestError extends Error {
  constructor(status) {
    super('Тарифы недоступны');
    this.status = status;
  }
}

async function mount(state, requestTariffs) {
  const navigations = [];
  let retries = 0;
  const cache = new Map();
  const host = type => props => React.createElement(type, {
    ...props, style: typeof props.style === 'function' ? props.style({ pressed: false }) : props.style,
  }, props.children);
  const mocks = {
    'react-native': { Platform: { OS: 'web' }, useWindowDimensions: () => ({ width: 375, height: 812 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ left: 0, right: 0, top: 48, bottom: 34 }) },
    '@react-navigation/native': {
      useNavigation: () => ({ navigate: (...args) => navigations.push(args) }),
      useFocusEffect: effect => React.useEffect(effect, [effect]),
    },
    'expo-image': { Image: 'Image' },
    '/ui/design': { fonts: { display: 'System', text: 'System', accent: 'InterTightBlack' }, StyleSheet: { create: s => s } },
    '/ui/Surface': { View: host('View'), Pressable: host('Pressable') },
    '/ui/Text': { Text: 'Text' },
    '/ui/ScrollView': { ScrollView: host('ScrollView') },
    '/components/Skeleton': { SkeletonBlock: 'SkeletonBlock', SkeletonGroup: 'SkeletonGroup' },
    '/hooks/useCatalogCategories': { useCatalogCategories: () => ({ state, reload: () => { retries++; } }) },
    '/service/connectivity': { useOnline: () => true },
    ...(requestTariffs ? {
      '/api/catalog': { getCatalogTariffs: requestTariffs },
      '/api/client': { ApiRequestError },
    } : {
      '/hooks/useCatalogTariffs': { useCatalogTariffs: id => ({ state: { status: 'ready', data: { esim: { id }, tariffs: [{ price_amount_minor: 701, price_currency: 'RUB', data_amount: { amount: 2, unit: 'GB' }, is_unlimited: false }] } } }) },
    }),
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const localRequire = name => {
      for (const [key, value] of Object.entries(mocks)) if (name === key || (key.startsWith('/') && name.endsWith(key))) return value;
      if (/\.(svg|png)$/.test(name)) return name;
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name);
        return load([target + '.tsx', target + '.ts'].find(fs.existsSync));
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
    return module.exports;
  }
  const { HomeScreen } = load(path.resolve(import.meta.dirname, '../src/screens/HomeScreen.tsx'));
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(HomeScreen)); });
  const node = id => renderer.root.findAll(n => typeof n.type === 'string' && n.props.testID === id)[0];
  return { renderer, node, navigations, retries: () => retries, press: id => act(() => node(id).props.onPress()) };
}

test('home opens the search, real world/region/country tariffs and savings; prices come from tariffs', async () => {
  const app = await mount({ status: 'ready', categories: [...regions, { title: 'Мир', esims: [bundle] }] });
  try {
    assert.match(app.node('home-price-TR').props.children.replace(/\s/g, ' '), /^от 351 ₽ за ГБ$/);
    await app.press('home-destination');
    assert.deepEqual(app.navigations.at(-1), ['TripSearch']);
    await app.press('home-world');
    assert.deepEqual(app.navigations.at(-1), ['WorldTariffs', { bundle }]);
    for (const [index, [key, count]] of [['europe', '2 страны'], ['asia', '4 страны'], ['africa', '1 страна']].entries()) {
      assert.equal(app.node('home-region-count-' + key).props.children, count);
      await app.press('home-region-' + key);
      assert.deepEqual(app.navigations.at(-1), ['RegionTariffs', { category: regions[index] }]);
    }
    assert.equal(app.node('home-region-caucasus'), undefined);
    assert.equal(app.node('home-region-africa').findAllByType('Image').length, 0);
    const thailandStyle = app.node('home-country-TH').props.style;
    for (const destination of popularCountries) {
      assert.deepEqual(app.node('home-country-' + destination.country_iso2).props.style, thailandStyle);
      await app.press('home-country-' + destination.country_iso2);
      assert.equal(app.navigations.at(-1)[0], 'CountryTariffs');
      assert.equal(app.navigations.at(-1)[1].country.id, destination.id);
    }
    const georgiaFlag = app.node('home-country-GE').findByType('Image');
    assert.match(georgiaFlag.props.source, /home-v3\/flag-ge\.svg$/);
    assert.deepEqual(georgiaFlag.props.style, { width: 41, height: 32 });
    const japanFlag = app.node('home-flag-JP');
    assert.equal(japanFlag.props.style.width, 41);
    assert.equal(japanFlag.props.style.height, 32);
    assert.equal(japanFlag.props.style.borderRadius, 12);
    assert.equal(japanFlag.props.style.overflow, 'hidden');
    await app.press('home-savings-banner');
    assert.deepEqual(app.navigations.at(-1), ['Savings']);
  } finally { await act(() => app.renderer.unmount()); }
});

test('an unavailable catalog leaves the new home usable without inventing prices or tariff IDs', async () => {
  const app = await mount({ status: 'error', message: 'Каталог недоступен' });
  try {
    assert.ok(app.node('home-savings-banner'));
    // The tariff hook cannot supply a price for a missing country.
    assert.equal(app.node('home-price-TR').props.children, '—');
    await app.press('home-world');
    assert.deepEqual(app.navigations.at(-1), ['WorldTariffs', { bundle: null }]);
    assert.equal(app.node('home-region-count-europe'), undefined);
    await app.press('home-region-europe');
    assert.deepEqual(app.navigations.at(-1), ['Countries', { section: 'regions' }]);
    await app.press('home-catalog-retry');
    assert.equal(app.retries(), 1);
  } finally { await act(() => app.renderer.unmount()); }
});

test('popular country cards show price skeletons while the catalog loads', async () => {
  const app = await mount({ status: 'loading' });
  try {
    for (const { country_iso2: code } of popularCountries) {
      assert.ok(app.node('home-country-' + code).findByType('SkeletonBlock'));
      assert.equal(app.node('home-price-' + code), undefined);
    }
  } finally { await act(() => app.renderer.unmount()); }
});

test('Japan and Thailand show a price per GB after retrying temporary tariff failures', async () => {
  const pending = new Map();
  const retries = new Set();
  const app = await mount({ status: 'ready', categories: regions }, async id => {
    if (id !== 'JP' && id !== 'TH') throw new ApiRequestError(404);
    if (!retries.has(id)) {
      retries.add(id);
      throw new ApiRequestError(id === 'JP' ? 504 : 502);
    }
    return new Promise(resolve => pending.set(id, resolve));
  });
  try {
    for (const [id, packagePrice, expected] of [['JP', 7059, 235], ['TH', 2599, 87]]) {
      const price = () => app.node('home-price-' + id).props.children.replace(/\s/g, ' ');
      assert.ok(app.node('home-country-' + id).findByType('SkeletonBlock'));
      assert.equal(app.node('home-price-' + id), undefined);
      await act(() => pending.get(id)({
        data: { esim: { id }, tariffs: [{
          price_amount_minor: packagePrice, price_currency: 'RUB', data_amount: { amount: 30, unit: 'GB' }, is_unlimited: false,
        }] },
      }));
      assert.equal(price(), `от ${expected} ₽ за ГБ`);
    }
  } finally { await act(() => app.renderer.unmount()); }
});
