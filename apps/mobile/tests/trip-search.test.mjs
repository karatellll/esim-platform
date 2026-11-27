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
const esim = (code, name) => ({ id: code, country_iso2: code, display_name: name, image_url: null, min_price_amount: 390, min_price_currency: 'RUB' });
const italy = esim('IT', 'Италия');
const france = esim('FR', 'Франция');
const spain = esim('ES', 'Испания');
const turkey = { ...esim('TR', 'Турция'), network: 'Turkcell' };
const europe = esim('XE', 'Европа (регион)');
const world = esim('XG', 'Весь мир');
const categories = [
  { title: 'Европа', esims: [europe, italy, france, spain] },
  { title: 'Другие', esims: [turkey, world] },
];
const tariff = (id, gb, days, price) => ({
  id, display_name: id, data_amount: { amount: gb, unit: 'GB' },
  duration: { amount: days, unit: 'days' }, price_amount_minor: price, price_currency: 'RUB',
  is_unlimited: gb === 0, is_profitable_badge: false,
});
const turkey5 = tariff('turkey-5', 5, 7, 690);
const italy5 = tariff('italy-5', 5, 7, 390);
const europe5 = tariff('europe-5', 5, 7, 890);
const europe15 = tariff('europe-15-days', 10, 15, 1400);
const ready = (...tariffs) => ({ status: 'ready', tariffs });
const prices = {
  IT: ready(italy5),
  FR: ready(tariff('france-5', 5, 7, 410)),
  ES: ready(tariff('spain-5', 5, 7, 390)),
  TR: ready(tariff('turkey-1-day', 5, 1, 100), turkey5, tariff('turkey-10', 10, 7, 1490), tariff('turkey-unlimited', 0, 7, 2990)),
  XE: ready(europe5, europe15),
  XG: ready(tariff('world-5', 5, 7, 1290), tariff('world-15-days', 10, 15, 1900)),
};

async function mount(initialPrices = prices, catalogCategories = categories, platform = 'web') {
  let data = initialPrices;
  let catalogState = catalogCategories ? { status: 'ready', categories: catalogCategories } : { status: 'loading' };
  let requests = [];
  let retries = 0;
  let inputFocuses = 0;
  const navigations = [];
  const cache = new Map();
  const listeners = new Map();
  const navigation = {
    navigate: (...args) => navigations.push(args), goBack: () => navigations.push(['back']), isFocused: () => true,
    addListener: (event, listener) => { listeners.set(event, listener); return () => listeners.delete(event); },
  };
  const host = type => props => React.createElement(type, {
    ...props, style: typeof props.style === 'function' ? props.style({ pressed: false }) : props.style,
  }, props.children);
  const mocks = {
    'react-native': { Platform: { OS: platform }, View: host('View'), Keyboard: { dismiss() {}, addListener: () => ({ remove() {} }) }, KeyboardAvoidingView: host('KeyboardAvoidingView') },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) },
    '@react-navigation/native': { useFocusEffect: React.useEffect },
    'expo-image': { Image: 'Image' },
    '/ui/design': { StyleSheet: { create: styles => styles } },
    '/ui/Surface': { View: host('View'), Pressable: host('Pressable') },
    '/ui/Text': { Text: 'Text', TextInput: 'TextInput' },
    '/ui/ScrollView': { ScrollView: host('ScrollView') },
    '/components/GlassActionButton': { GlassActionButton: host('GlassActionButton') },
    './Skeleton': { SkeletonBlock: 'SkeletonBlock', SkeletonGroup: 'SkeletonGroup' },
    '/auth/AuthProvider': { useAuth: () => ({ accessToken: null }) },
    '/api/coverage': { coverageSubscription() { throw new Error('Signed-out request'); } },
    '/hooks/useUserOrders': { useUserOrders: () => ({ state: { status: 'signed-out' } }) },
    '/hooks/useCatalogCategories': { useCatalogCategories: () => ({ state: catalogState }) },
    '/hooks/useTripTariffs': { useTripTariffs: (targets, enabled) => {
      if (enabled) requests = targets.map(target => target.id);
      return { data, reload: () => { retries++; } };
    } },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const localRequire = name => {
      for (const [key, value] of Object.entries(mocks)) if (name === key || (key.startsWith('/') && name.endsWith(key))) return value;
      if (/\.(svg|png)$/.test(name)) return name;
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name);
        return load([target + '.tsx', target + '.ts'].find(fs.existsSync));
      }
      return require(name);
    };
    const hermesIntl = Object.create(Intl, { PluralRules: { value: undefined } });
    new Function('require', 'module', 'exports', 'Intl', code)(localRequire, module, module.exports, hermesIntl);
    return module.exports;
  }
  const { TripSearchScreen } = load(path.resolve(import.meta.dirname, '../src/screens/TripSearchScreen.tsx'));
  let renderer;
  const render = () => React.createElement(TripSearchScreen, { navigation });
  await act(() => {
    renderer = TestRenderer.create(render(), {
      createNodeMock: element => element.type === 'TextInput' ? { focus: () => { inputFocuses++; } } : null,
    });
  });
  const node = id => renderer.root.findAll(n => typeof n.type === 'string' && n.props.testID === id)[0];
  return {
    node, navigations, requests: () => requests, retries: () => retries,
    inputFocuses: () => inputFocuses,
    transitionEnd: closing => act(() => listeners.get('transitionEnd')?.({ data: { closing } })),
    press: id => act(() => node(id).props.onPress()),
    query: text => act(() => node('trip-query').props.onChangeText(text)),
    update: next => act(() => { data = next; renderer.update(render()); }),
    updateCatalog: next => act(() => { catalogState = next; renderer.update(render()); }),
    close: () => act(() => renderer.unmount()),
    offerIds: () => renderer.root.findAll(n => n.type === 'Pressable' && n.props.testID?.startsWith('trip-offer-')).map(n => n.props.testID),
  };
}

test('opening search shows skeletons until destinations load and preserves a query typed meanwhile', async () => {
  const app = await mount(prices, null, 'ios');
  try {
    assert.ok(app.node('trip-region-rail-skeleton'));
    assert.ok(app.node('trip-countries-skeleton'));
    assert.equal(app.node('trip-region-rail'), undefined);
    await app.query('Италия');
    assert.equal(app.node('trip-region-rail-skeleton'), undefined);
    assert.ok(app.node('trip-countries-skeleton'));
    assert.equal(app.node('trip-query-results'), undefined);
    await app.updateCatalog({ status: 'ready', categories });
    assert.equal(app.node('trip-destinations-loading'), undefined);
    assert.equal(app.node('trip-query').props.value, 'Италия');
    assert.ok(app.node('trip-country-IT'));
    await app.press('trip-clear');
    assert.ok(app.node('trip-region-rail'));
  } finally { await app.close(); }
});

test('iOS opens the destination keyboard only after the opening transition', async () => {
  const app = await mount(prices, categories, 'ios');
  try {
    assert.equal(app.node('trip-query').props.autoFocus, false);
    assert.equal(app.inputFocuses(), 0);
    await app.transitionEnd(true);
    assert.equal(app.inputFocuses(), 0);
    await app.transitionEnd(false);
    assert.equal(app.inputFocuses(), 1);
  } finally { await app.close(); }
});

test('the three questions preserve and edit answers, rank a regional trip, and open the chosen tariff page', async () => {
  const app = await mount({});
  try {
    assert.ok(app.node('trip-step-1'));
    assert.equal(app.node('trip-next'), undefined);
    await app.query('ита');
    assert.ok(app.node('trip-suggestion-XE'));
    await app.press('trip-country-IT');
    await app.query('париж');
    await app.press('trip-country-FR');
    await app.query('Испания');
    await app.press('trip-country-ES');
    await app.press('trip-next');
    await app.press('trip-duration-week');
    assert.ok(app.node('trip-step-3'));
    assert.deepEqual(app.requests(), []);
    await app.press('trip-usage-normal');
    assert.ok(app.node('trip-results-loading'));
    assert.deepEqual(app.requests(), ['XE', 'XG', 'IT', 'FR', 'ES']);

    await app.update(prices);
    assert.deepEqual(app.offerIds(), ['trip-offer-europe-5', 'trip-offer-world-5', 'trip-offer-italy-5', 'trip-offer-france-5', 'trip-offer-spain-5']);
    assert.ok(app.node('trip-best-price'));
    await app.press('trip-edit-duration');
    await app.press('trip-duration-fortnight');
    assert.ok(app.node('trip-edit-usage'));
    assert.deepEqual(app.offerIds(), ['trip-offer-europe-15-days', 'trip-offer-world-15-days']);
    await app.press('trip-edit-where');
    await app.press('trip-remove-ES');
    await app.press('trip-back');
    assert.deepEqual(app.requests(), ['XE', 'XG', 'IT', 'FR', 'ES']);
    await app.press('trip-offer-europe-15-days');
    assert.deepEqual(app.navigations, [['RegionTariffs', { category: categories[0], initialTariffId: europe15.id, recommendedTariffId: europe15.id }]]);
  } finally { await app.close(); }
});

test('one country ranks suitable traffic, retries without losing answers and shows only available unknown-date filters', async () => {
  const app = await mount({ TR: { status: 'error', message: 'offline' } });
  try {
    await app.press('trip-country-TR');
    await app.press('trip-next');
    await app.press('trip-duration-unknown');
    await app.press('trip-usage-normal');
    assert.ok(app.node('trip-results-error'));
    await app.press('trip-results-retry');
    assert.equal(app.retries(), 1);
    await app.update(prices);
    assert.deepEqual(app.offerIds(), ['trip-offer-turkey-5', 'trip-offer-turkey-10', 'trip-offer-turkey-unlimited']);
    assert.equal(app.node('trip-heading').props.children, 'Нашли 3 варианта');
    assert.ok(app.node('trip-recommended-badge'));
    assert.equal(app.node('trip-recommended-badge').findAllByType('Image').length, 0);
    assert.ok(app.node('trip-filter-1'));
    assert.equal(app.node('trip-filter-30'), undefined);
    await app.press('trip-filter-1');
    assert.deepEqual(app.offerIds(), ['trip-offer-turkey-1-day']);
    assert.equal(app.node('trip-heading').props.children, 'Нашли 1 вариант');
    await app.press('trip-filter-7');
    await app.press('trip-offer-turkey-5');
    assert.deepEqual(app.navigations.at(-1), ['CountryTariffs', { country: turkey, initialTariffId: turkey5.id, recommendedTariffId: turkey5.id }]);
    await app.press('trip-offer-turkey-10');
    assert.deepEqual(app.navigations.at(-1), ['CountryTariffs', { country: turkey, initialTariffId: 'turkey-10', recommendedTariffId: turkey5.id }]);
  } finally { await app.close(); }
});

test('Russia can be added by country name and opens the tariff found in the catalog', async () => {
  const russia = { ...esim('RU', 'Россия'), id: 'russia-catalog-id' };
  const packageRu = tariff('russia-week', 5, 7, 390);
  const app = await mount({ [russia.id]: ready(packageRu) });
  try {
    await app.query('Россия');
    assert.equal(app.node('trip-country-RU').props.disabled, true);
    await app.updateCatalog({ status: 'ready', categories: [...categories, { title: 'СНГ', esims: [russia] }] });
    await app.query('Москва');
    assert.equal(app.node('trip-country-RU'), undefined);
    await app.query('Россия');
    assert.equal(app.node('trip-country-RU').props.disabled, false);
    await app.press('trip-country-RU');
    assert.ok(app.node('trip-remove-RU'));
    await app.press('trip-next');
    await app.press('trip-duration-week');
    await app.press('trip-usage-essential');
    assert.deepEqual(app.requests(), [russia.id]);
    await app.press('trip-offer-russia-week');
    assert.deepEqual(app.navigations.at(-1), ['CountryTariffs', { country: russia, initialTariffId: packageRu.id, recommendedTariffId: packageRu.id }]);
  } finally { await app.close(); }
});

test('an unmatched route keeps world first and single-country prices after a partial failure', async () => {
  const app = await mount({ ...prices, IT: { status: 'error', message: 'unavailable' } });
  try {
    await app.press('trip-country-TR');
    await app.query('Италия');
    await app.press('trip-country-IT');
    await app.press('trip-next');
    await app.press('trip-duration-week');
    await app.press('trip-usage-normal');
    assert.deepEqual(app.requests(), ['XG', 'TR', 'IT']);
    assert.deepEqual(app.offerIds(), ['trip-offer-world-5', 'trip-offer-turkey-5']);
    assert.ok(app.node('trip-results-partial-error'));
    assert.equal(app.node('trip-best-price'), undefined);
    await app.press('trip-offer-world-5');
    assert.deepEqual(app.navigations.at(-1), ['WorldTariffs', { bundle: world, initialTariffId: 'world-5', recommendedTariffId: 'world-5' }]);
  } finally { await app.close(); }
});

test('a typo offers the known country and world, and a quick region goes directly to the duration question', async () => {
  const app = await mount();
  try {
    await app.query('весь');
    assert.equal(app.node('trip-suggestion-XG').props.style.some(style => style?.borderTopWidth > 0), false);
    await app.query('мальдвы');
    assert.ok(app.node('trip-country-MV'));
    assert.equal(app.node('trip-country-MV').props.disabled, true);
    assert.ok(app.node('trip-suggestion-XG').props.style.some(style => style?.borderTopWidth > 0));
    await app.press('trip-notify-MV');
    assert.deepEqual(app.navigations, [['EmailSignIn']]);
    await app.press('trip-clear');
    await app.press('trip-quick-XE');
    assert.ok(app.node('trip-step-2'));
    assert.match(app.node('trip-edit-where').props.accessibilityLabel, /Европа/);
    await app.press('trip-duration-week');
    await app.press('trip-usage-essential');
    assert.deepEqual(app.requests(), ['XE']);
    assert.deepEqual(app.offerIds(), ['trip-offer-europe-5']);
  } finally { await app.close(); }
});

test('the search shows regions beyond the three illustrated tiles and lets users browse countries without a bundle', async () => {
  const regionalCategories = [
    { title: 'Европа', esims: [europe, turkey] },
    { title: 'Азия', esims: [esim('XS', 'Азия (регион)'), turkey] },
    { title: 'Кавказ', esims: [esim('XC', 'Кавказ (регион)'), turkey] },
    { title: 'Ближний Восток', esims: [esim('XM', 'Ближний Восток (регион)'), turkey] },
    { title: 'Африка', esims: [esim('ZA', 'ЮАР')] },
    { title: 'Популярное', esims: [turkey, world] },
  ];
  const app = await mount(prices, regionalCategories);
  try {
    for (const id of ['world', 'XE', 'XS', 'XC', 'XM', 'Африка']) {
      assert.ok(app.node(`trip-quick-${id}`));
    }
    assert.equal(app.node('trip-quick-Популярное'), undefined);
    await app.query('Турция');
    for (const id of ['XE', 'XS', 'XC', 'XM']) assert.ok(app.node(`trip-suggestion-${id}`));
    assert.ok(app.node('trip-country-TR').findAllByType('Image')
      .some(image => image.props.source === '../../assets/flags/tr.png'));
    await app.query('Africa');
    await app.press('trip-suggestion-Африка');
    assert.deepEqual(app.navigations, [['RegionTariffs', { category: regionalCategories[4] }]]);
  } finally { await app.close(); }
});
