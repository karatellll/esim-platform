import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url), root = path.resolve(import.meta.dirname, '../src');
const country = { id: 'tr', country_iso2: 'TR', display_name: 'Турция', image_url: null, min_price_amount: 290, min_price_currency: 'RUB' };
const tariff = { id: '5gb', display_name: '5 ГБ', price_amount_minor: 890, price_currency: 'RUB', data_amount: { amount: 5, unit: 'GB' }, duration: { amount: 15, unit: 'day' }, is_unlimited: false, is_profitable_badge: false };
const base = { country, tariff, amount: 890, currency: 'RUB', price_source: 'provider', ordering_available: true, quote_id: 'quote', expires_at: null, existing_order_id: null, promotion: null };

function app({ summary = async () => ({ data: base }), create = async () => ({ data: { id: 'order' } }), tariffsByEsim = {}, categories = [], signedIn = true, platform = 'web', orders = [] } = {}) {
  const cache = new Map(), calls = [], navigations = [];
  const keyboardEvents = new Map();
  const host = type => React.forwardRef((props, ref) => React.createElement(type, { ...props, ref, ...(typeof props.style === 'function' ? { style: props.style({ pressed: false }) } : {}) }, props.children));
  const View = host('View'), Pressable = host('Pressable'), Input = host('Input');
  const flatten = s => Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean).map(flatten)) : s ?? {};
  const stylesheet = { create: s => s, flatten, absoluteFill: { position: 'absolute', inset: 0 } };
  const mocks = {
    'react-native': { ActivityIndicator: 'ActivityIndicator', View: host('NativeView'), Pressable: host('NativePressable'), Keyboard: {
      dismiss() {}, isVisible: () => false,
      addListener(event, listener) { keyboardEvents.set(event, listener); return { remove: () => keyboardEvents.delete(event) }; },
    }, KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: p => p.visible ? React.createElement('Modal', p, p.children) : null, Platform: { OS: platform }, useWindowDimensions: () => ({ width: 375, height: 812 }) },
    'expo-image': { Image: 'Image' },
    'react-native-svg': { __esModule: true, default: 'Svg', Circle: 'Circle' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    '@react-native-safe-area-context': {},
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 48, bottom: 34, left: 0, right: 0 }) },
    '@react-navigation/native': { useFocusEffect: f => React.useEffect(f, [f]), useNavigation: () => navigation, useRoute: () => ({}) },
    '/ui/Surface': { View, Pressable }, '/ui/ScrollView': { ScrollView: host('ScrollView') },
    '/ui/design': { StyleSheet: stylesheet, fonts: { text: 'System', display: 'System' } },
    '/ui/Text': { Text: 'Text', TextInput: Input },
    '/components/CountryFlag': { CountryFlag: 'CountryFlag' },
    '/tab-bar/TabBarMaterial': { TabBarMaterial: 'TabBarMaterial' },
    '/tab-bar/useTabBarAccessibility': { useTabBarAccessibility: () => ({ reduceTransparency: false }) },
    './Skeleton': { SkeletonBlock: 'SkeletonBlock', SkeletonGroup: 'SkeletonGroup' },
    '/components/SkeletonLayouts': { TariffSkeleton: 'TariffSkeleton' },
    '/hooks/useCatalogCategories': { useCatalogCategories: () => ({ state: { status: 'ready', categories } }) },
    '/hooks/useCatalogTariffs': { useCatalogTariffs: id => ({ state: { status: 'ready', data: tariffsByEsim[id] } }) },
    '/hooks/useSkeletonGate': { useSkeletonGate: () => ({ visible: false, timedOut: false }) },
    '/hooks/useUserOrders': { useUserOrders: () => ({ state: { status: 'ready', dates: {}, response: {
      data: orders, meta: { has_more: false, next_cursor: null },
    } } }) },
    '/auth/AuthProvider': { useAuth: () => ({ user: signedIn ? { id: 'user', email: 'test@example.com' } : null, accessToken: signedIn ? 'local-test' : null, loading: false }) },
    '/api/auth': { AuthApiError: class extends Error {} },
    '/api/checkout': { CheckoutApiError: class extends Error {}, getCheckoutSummary: async (body, signal) => { calls.push(body); return summary(body, signal); }, createCheckoutOrder: async body => { calls.push(body); return create(body); } },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const m = { exports: {} }; cache.set(file, m);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const local = name => {
      for (const [key, value] of Object.entries(mocks)) if (name === key || (key.startsWith('/') && name.endsWith(key))) return value;
      if (/\.(svg|png|jpg)$/.test(name)) return name;
      if (name.startsWith('.')) { const f = path.resolve(path.dirname(file), name); return load([f + '.tsx', f + '.ts'].find(fs.existsSync)); }
      return require(name);
    };
    new Function('require', 'module', 'exports', code)(local, m, m.exports);
    return m.exports;
  }
  const navigation = { goBack() { navigations.push('back'); }, isFocused: () => true, navigate: (...args) => navigations.push(args),
    replace: (...args) => navigations.push(args), push: (...args) => navigations.push(args) };
  const props = { route: { params: { country, tariff } }, navigation };
  const node = (r, id, type) => r.root.findAll(n => n.type === type && n.props.testID === id)[0];
  const mount = async (file, props) => {
    const Component = load(root + file)[path.basename(file, '.tsx')];
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(Component, props), { createNodeMock: () => ({ focus() {}, scrollTo() {} }) });
    });
    return renderer;
  };
  return { mount, calls, navigations, props, node, keyboardEvents };
}

test('checkout anchors its header and pay button and shows invalid email beside the field', async () => {
  const a = app({ signedIn: false, platform: 'ios' });
  const renderer = await a.mount('/screens/CheckoutScreen.tsx', a.props);
  const node = (id, type) => a.node(renderer, id, type);
  const avoiding = renderer.root.findByType('KeyboardAvoidingView');
  assert.equal(avoiding.props.style.at(-1).paddingTop, 56);
  assert.equal(avoiding.props.behavior, 'padding');
  const body = node('checkout-scroll', 'ScrollView');
  assert.equal(body.findAllByProps({ accessibilityLabel: 'Оформление' }).length, 0);
  assert.equal(body.findAllByProps({ testID: 'checkout-submit' }).length, 0);
  const footer = node('checkout-footer', 'View');
  assert.equal(footer.props.style.at(-1).paddingBottom, 42);

  await act(() => a.keyboardEvents.get('keyboardWillShow')());
  assert.equal(footer.props.style.at(-1).paddingBottom, 12);
  await act(() => node('checkout-submit', 'Pressable').props.onPress());
  const field = node('checkout-email-group', 'View');
  assert.equal(field.findByProps({ testID: 'checkout-email-error' }).props.children, 'Введите корректный адрес электронной почты.');
  assert.equal(node('checkout-error', 'Text'), undefined);
  assert.equal(a.calls.length, 1);

  await act(() => node('checkout-email', 'Input').props.onChangeText('valid@example.com'));
  assert.equal(field.findAllByProps({ testID: 'checkout-email-error' }).length, 0);
  await act(() => a.keyboardEvents.get('keyboardWillHide')());
  assert.equal(footer.props.style.at(-1).paddingBottom, 42);
  await act(() => renderer.unmount());
  assert.equal(a.keyboardEvents.size, 0);
});

test('the countries catalog opens trip search, shows rectangular flags and links to world tariffs', async () => {
  const turkey = { ...country, image_url: 'https://example.com/tr.png' };
  const france = { ...country, id: 'fr', country_iso2: 'FR', display_name: 'Франция', image_url: 'https://example.com/fr.png' };
  const georgia = { ...country, id: 'ge', country_iso2: 'GE', display_name: 'Грузия' };
  const europe = { ...country, id: 'europe', country_iso2: 'XE', display_name: 'Европа (регион)' };
  const world = { ...country, id: 'world', country_iso2: 'XG', display_name: 'Весь мир' };
  const region = { title: 'Европа', esims: [europe, turkey, france, georgia] };
  const a = app({ categories: [region, { title: 'Весь мир', esims: [world] }], tariffsByEsim: {
    [world.id]: { esim: world, tariffs: [tariff] },
  } });
  const screen = await a.mount('/screens/CountriesScreen.tsx');
  const node = (id, type = 'Pressable') => a.node(screen, id, type);
  assert.ok(node('category-countries'));
  assert.ok(node('category-regions'));
  assert.equal(node('category-world'), undefined);
  assert.equal(node('directions-heading-text', 'Text'), undefined);
  for (const id of ['tr', 'fr', 'ge']) {
    const flag = node(`catalog-esim-${id}`).findByType('Image');
    assert.equal(flag.props.source, `../../assets/flags/${id}.png`);
    assert.deepEqual(flag.props.style, { width: 41, height: 32 });
    assert.equal(flag.props.contentFit, 'fill');
    const flagContainer = Object.assign({}, ...flag.parent.props.style.filter(Boolean));
    assert.equal(flagContainer.width, 41);
    assert.equal(flagContainer.height, 32);
    assert.equal(flagContainer.borderRadius, 12);
    assert.equal(flagContainer.overflow, 'hidden');
  }
  await act(() => node('catalog-esim-fr').findByType('Image').props.onError());
  const remoteFlag = node('catalog-esim-fr').findByType('Image');
  assert.deepEqual(remoteFlag.props.source, { uri: france.image_url });
  await act(() => remoteFlag.props.onError());
  assert.ok(node('catalog-esim-fr').findAllByType('Text').some(text => text.props.children === 'FR'));

  const banner = node('global-esim-button');
  const [worldImage, overlay] = banner.findAllByType('Image');
  assert.match(worldImage.props.source, /world\.png$/);
  assert.match(overlay.props.source, /world-overlay\.png$/);
  await act(() => banner.props.onPress());
  assert.deepEqual(a.navigations.at(-1), ['WorldTariffs', { bundle: world }]);
  const worldScreen = await a.mount('/screens/WorldTariffsScreen.tsx', { route: { params: a.navigations.at(-1)[1] }, navigation: a.props.navigation });
  assert.ok(a.node(worldScreen, 'world-tariff-5gb', 'Pressable'));
  const worldButton = id => a.node(worldScreen, id, 'Pressable');
  assert.equal(worldButton('world-back').findByType('TabBarMaterial').props.borderRadius, 20);
  assert.equal(worldButton('world-share').findByType('TabBarMaterial').props.borderRadius, 20);
  await act(async () => worldButton('world-share').props.onPress());
  assert.ok(worldScreen.root.findAllByType('Text').some(text => String(text.props.children).startsWith('Весь мир — 5 ГБ')));
  await act(() => worldButton('world-buy').props.onPress());
  assert.deepEqual(a.navigations.at(-1), ['Checkout', { country: world, tariff }]);
  await act(() => worldButton('world-back').props.onPress());
  assert.equal(a.navigations.at(-1), 'back');

  const search = node('directions-search');
  assert.equal(search.props.accessibilityRole, 'button');
  await act(() => search.props.onPress());
  assert.deepEqual(a.navigations.at(-1), ['TripSearch']);
  await act(() => node('catalog-esim-tr').props.onPress());
  assert.deepEqual(a.navigations.at(-1), ['CountryTariffs', { country: turkey }]);
  await act(() => node('category-regions').props.onPress());
  assert.equal(node('directions-search'), undefined);
  assert.equal(node('global-esim-button'), undefined);
  await act(() => node('region-Европа').props.onPress());
  assert.deepEqual(a.navigations.at(-1), ['RegionTariffs', { category: region }]);
  await act(() => { worldScreen.unmount(); screen.unmount(); });
});

test('catalog photos show local images while loading and after a provider image fails', async () => {
  const photoUrl = 'https://example.com/missing-photo.webp';
  const algeria = { ...country, id: 'algeria', country_iso2: 'DZ', display_name: 'Алжир', photo_url: photoUrl };
  const africa = { ...country, id: 'africa', country_iso2: 'XB', display_name: 'Африка (регион)', photo_url: photoUrl };
  const category = { title: 'Африка', esims: [africa] };
  const a = app({ tariffsByEsim: {
    [algeria.id]: { esim: { ...algeria, photo_url: null }, tariffs: [] },
    [africa.id]: { esim: { ...africa, photo_url: null }, tariffs: [] },
  } });
  const { navigation } = a.props;
  const cases = [
    ['/screens/CountryTariffsScreen.tsx', { route: { params: { country: algeria } }, navigation }, 'countries/DZ.jpg'],
    ['/screens/RegionTariffsScreen.tsx', { route: { params: { category } }, navigation }, 'countries/AFRICA.jpg'],
    ['/components/CatalogRegions.tsx', { categories: [category], onSelectCategory() {} }, 'countries/AFRICA.jpg'],
  ];

  for (const [screen, props, fallbackFile] of cases) {
    const renderer = await a.mount(screen, props);
    const images = () => renderer.root.findAllByType('Image');
    const remote = images().find(image => image.props.source?.uri === photoUrl);
    assert.ok(remote, screen);
    assert.ok(remote.props.placeholder.endsWith(fallbackFile), screen);
    await act(() => remote.props.onError());
    assert.ok(images().some(image => typeof image.props.source === 'string' && image.props.source.endsWith(fallbackFile)), screen);
    assert.ok(images().every(image => image.props.source?.uri !== photoUrl), screen);
    await act(() => renderer.unmount());
  }
});

test('iOS uses bundled photos for Europe and both Americas in the catalog and region tariffs', async () => {
  const cases = [
    ['Европа', 'Европа', 'XE', 'regions/europe.jpg'],
    ['Северная Америка', 'Северная Америка', 'XN', 'countries/NORTH_AMERICA.jpg'],
    ['Южная Америка', 'Латинская Америка', 'XL', 'countries/SOUTH_AMERICA.jpg'],
  ];
  for (const [title, name, code, file] of cases) {
    const bundle = { ...country, id: code, country_iso2: code, display_name: name, photo_url: 'https://example.com/catalog-photo.webp' };
    const category = { title, esims: [bundle] };
    const a = app({ platform: 'ios', tariffsByEsim: {
      [code]: { esim: { ...bundle, photo_url: 'https://example.com/tariffs-photo.webp' }, tariffs: [] },
    } });
    const catalog = await a.mount('/components/CatalogRegions.tsx', { categories: [category], onSelectCategory() {} });
    const tariffs = await a.mount('/screens/RegionTariffsScreen.tsx', { route: { params: { category } }, navigation: a.props.navigation });
    try {
      const card = a.node(catalog, 'region-' + title, 'NativePressable');
      assert.equal(card.props.style[0].overflow, 'hidden');
      for (const view of [card, tariffs.root]) {
        const sources = view.findAllByType('Image').map(image => image.props.source);
        assert.ok(sources.some(source => typeof source === 'string' && source.endsWith(file)), title);
        assert.ok(sources.every(source => !source?.uri), title);
      }
    } finally {
      await act(() => { catalog.unmount(); tariffs.unmount(); });
    }
  }
});

test('country tariffs show selected local photos even when the provider supplies another photo', async () => {
  const photoUrl = 'https://example.com/provider-photo.webp';
  for (const code of ['BY', 'GE', 'KN', 'LC', 'NE']) {
    const destination = { ...country, id: code, country_iso2: code, photo_url: photoUrl };
    const a = app({ tariffsByEsim: { [code]: { esim: destination, tariffs: [] } } });
    const renderer = await a.mount('/screens/CountryTariffsScreen.tsx', {
      route: { params: { country: destination } },
      navigation: a.props.navigation,
    });
    const sources = renderer.root.findAllByType('Image').map(image => image.props.source);
    assert.ok(sources.some(source => typeof source === 'string' && source.endsWith(`countries/${code}.jpg`)), code);
    assert.ok(sources.every(source => source?.uri !== photoUrl), code);
    await act(() => renderer.unmount());
  }
});

test('checkout retries an unconfirmed price without creating an order', async () => {
  let attempts = 0;
  const a = app({ summary: async () => {
    if (++attempts === 1) throw new Error('provider price unavailable');
    return { data: base };
  } });
  const renderer = await a.mount('/screens/CheckoutScreen.tsx', a.props);
  assert.ok(a.node(renderer, 'checkout-price-check-failed', 'View'));
  const submit = () => a.node(renderer, 'checkout-submit', 'Pressable');
  assert.equal(submit().findByType('Text').props.children, 'Повторить');
  await act(async () => { await submit().props.onPress(); });
  assert.equal(a.node(renderer, 'checkout-price-check-failed', 'View'), undefined);
  assert.equal(submit().findByType('Text').props.children.replace(/\s/g, ' '), 'Оплатить · 890 ₽');
  assert.deepEqual(a.calls, [
    { esim_id: country.id, tariff_id: tariff.id },
    { esim_id: country.id, tariff_id: tariff.id },
  ]);
  await act(() => renderer.unmount());
});

test('the region uses the country purchase bar and checks out the newly selected tariff', async () => {
  const region = { ...country, id: 'europe', country_iso2: 'XE', display_name: 'Европа (регион)' };
  const longerTariff = { ...tariff, id: '10gb', price_amount_minor: 1909, data_amount: { amount: 10, unit: 'GB' }, duration: { amount: 30, unit: 'day' } };
  const a = app({ tariffsByEsim: {
    [country.id]: { esim: country, tariffs: [tariff] },
    [region.id]: { esim: region, tariffs: [tariff, longerTariff] },
  } });
  const { navigation } = a.props;
  const countryScreen = await a.mount('/screens/CountryTariffsScreen.tsx', { route: { params: { country } }, navigation });
  const regionScreen = await a.mount('/screens/RegionTariffsScreen.tsx', {
    route: { params: { category: { title: 'Европа', esims: [region] } } }, navigation,
  });
  for (const [screen, prefix] of [[countryScreen, 'tariffs'], [regionScreen, 'region']]) {
    for (const action of ['back', 'share']) {
      const button = a.node(screen, `${prefix}-${action}`, 'Pressable');
      assert.equal(button.findByType('TabBarMaterial').props.borderRadius, 20);
      const icon = action === 'back' ? 'caa7b.svg' : 'f4b30.svg';
      assert.ok(button.findByType('Image').props.source.endsWith(icon));
    }
  }
  const countryBar = a.node(countryScreen, 'tariff-purchase', 'View');
  const regionBar = a.node(regionScreen, 'region-purchase', 'View');
  assert.deepEqual(regionBar.props.style, countryBar.props.style);
  const buy = a.node(regionScreen, 'region-buy', 'Pressable');
  assert.deepEqual(buy.props.style, a.node(countryScreen, 'tariff-buy', 'Pressable').props.style);
  assert.equal(buy.findByType('Text').props.children, 'Купить');
  const price = () => regionBar.findByProps({ testID: 'selected-tariff-price' }).props.children.replace(/\s/g, ' ');
  const details = () => regionBar.findByProps({ testID: 'selected-tariff-details' }).props.children.join('');
  assert.equal(price(), '890 ₽');
  assert.equal(details(), '5 ГБ · 15 дней');

  await act(() => a.node(regionScreen, 'region-duration-day:30', 'Pressable').props.onPress());
  assert.equal(price(), '1 909 ₽');
  assert.equal(details(), '10 ГБ · 30 дней');
  await act(() => buy.props.onPress());
  assert.deepEqual(a.navigations.at(-1), ['Checkout', { country: region, tariff: longerTariff }]);
  await act(() => { countryScreen.unmount(); regionScreen.unmount(); });
});

test('iOS uses a native lime background for the discount and profitable tariff badges', async () => {
  const first = { ...tariff, id: '1gb', data_amount: { amount: 1, unit: 'GB' }, price_amount_minor: 259 };
  const discounted = { ...first, id: '3gb', data_amount: { amount: 3, unit: 'GB' }, price_amount_minor: 609 };
  const profitable = { ...first, id: 'unlimited', is_unlimited: true, is_profitable_badge: true };
  const a = app({ platform: 'ios', tariffsByEsim: {
    [country.id]: { esim: country, tariffs: [first, discounted, profitable] },
  } });
  const screen = await a.mount('/screens/CountryTariffsScreen.tsx', { route: { params: { country } }, navigation: a.props.navigation });
  try {
    assert.equal(a.node(screen, 'tariff-1gb', 'Pressable').findAllByType('NativeView').length, 0);
    for (const [id, label, text] of [
      ['3gb', 'На 22% дешевле за ГБ, чем минимальный пакет', '−22%'],
      ['unlimited', 'Выгодный пакет', 'Выгодно'],
    ]) {
      const badge = a.node(screen, 'tariff-' + id, 'Pressable').findByType('NativeView');
      assert.equal(badge.props.accessibilityLabel, label);
      assert.equal(badge.props.style.backgroundColor, '#CCF53D');
      assert.equal(badge.findByType('Text').props.children, text);
    }
  } finally {
    await act(() => screen.unmount());
  }
});

test('a rejected promotion keeps the price and returning to checkout still allows purchase', async () => {
  const a = app({ summary: async body => { if (body.promo_code) throw new Error('Промокоды пока недоступны. Продолжите без промокода.'); return { data: base }; } });
  const r = await a.mount('/screens/CheckoutScreen.tsx', a.props);
  await act(() => a.node(r, 'checkout-promo-toggle', 'Pressable').props.onPress());
  await act(() => a.node(r, 'checkout-promo-input', 'Input').props.onChangeText('summer'));
  await act(async () => a.node(r, 'checkout-promo-apply', 'Pressable').props.onPress());
  assert.equal(a.calls[1].promo_code, 'SUMMER');
  assert.match(a.node(r, 'checkout-promo-error', 'Text').props.children, /недоступны/);
  const promoBack = a.node(r, 'promo-back', 'Pressable');
  assert.equal(promoBack.findByType('TabBarMaterial').props.borderRadius, 20);
  await act(() => promoBack.props.onPress());
  assert.equal(a.node(r, 'checkout-promo-error', 'Text'), undefined);
  assert.match(a.node(r, 'checkout-price', 'Text').props.children, /890/);
  await act(async () => a.node(r, 'checkout-submit', 'Pressable').props.onPress());
  assert.deepEqual(a.calls.at(-1), { quote_id: 'quote' });
  assert.equal(a.navigations.at(-1)[0], 'OrderStatus');
  await act(() => r.unmount());
});

test('only a confirmed summary can show the applied state; removal reloads the full price', async () => {
  const a = app({ summary: async body => ({ data: body.promo_code ? { ...base, amount: 801, promotion: { code: 'SUMMER', subtotal_amount: 890, discount_amount: 89 } } : base }) });
  const r = await a.mount('/screens/CheckoutScreen.tsx', a.props);
  await act(() => a.node(r, 'checkout-promo-toggle', 'Pressable').props.onPress());
  await act(() => a.node(r, 'checkout-promo-input', 'Input').props.onChangeText('SUMMER'));
  await act(async () => a.node(r, 'checkout-promo-apply', 'Pressable').props.onPress());
  assert.ok(a.node(r, 'checkout-breakdown', 'View'));
  assert.equal(a.node(r, 'promo-sheet', 'View'), undefined);
  assert.match(a.node(r, 'checkout-submit', 'Pressable').findByType('Text').props.children, /801/);
  assert.equal(a.calls.length, 2, 'applying a quote must not silently replace it with another quote');
  await act(async () => a.node(r, 'checkout-promo-remove', 'Pressable').props.onPress());
  assert.equal(a.calls.at(-1).promo_code, undefined);
  assert.equal(a.node(r, 'checkout-breakdown', 'View'), undefined);
  assert.match(a.node(r, 'checkout-submit', 'Pressable').findByType('Text').props.children, /890/);
  await act(() => r.unmount());
});

test('closing a pending promotion aborts it and ignores its eventual reply', async () => {
  let signal, resolve;
  const a = app(); const r = await a.mount('/components/PromoCodeSheet.tsx', { onClose() {}, onApply: (_, s) => { signal = s; return new Promise(r => resolve = r); } });
  await act(() => a.node(r, 'checkout-promo-input', 'Input').props.onChangeText('SUMMER'));
  await act(() => a.node(r, 'checkout-promo-apply', 'Pressable').props.onPress());
  assert.equal(a.node(r, 'checkout-promo-apply', 'Pressable').props.disabled, true);
  await act(() => r.unmount());
  assert.equal(signal.aborted, true);
  await act(async () => resolve());
});

test('country chips open the searchable list before navigating from a region or the world', async () => {
  const france = { ...country, id: 'fr', country_iso2: 'FR', display_name: 'Франция' };
  const italy = { ...country, id: 'it', country_iso2: 'IT', display_name: 'Италия' };
  const europe = { ...country, id: 'europe', country_iso2: 'XE', display_name: 'Европа (регион)' };
  const world = { ...country, id: 'world', country_iso2: 'XG', display_name: 'Весь мир' };
  const category = { title: 'Европа', esims: [europe, france, italy] };
  const a = app({
    categories: [category],
    tariffsByEsim: {
      [europe.id]: { esim: europe, tariffs: [tariff] },
      [world.id]: { esim: world, tariffs: [tariff] },
    },
  });

  for (const [prefix, screen, params] of [
    ['region', 'RegionTariffs', { category }],
    ['world', 'WorldTariffs', { bundle: world }],
  ]) {
    const renderer = await a.mount(`/screens/${screen}Screen.tsx`, { route: { params }, navigation: a.props.navigation });
    const node = (id, type) => a.node(renderer, id, type);
    const beforeTap = a.navigations.length;
    await act(() => node(`${prefix}-country-chip-FR`, 'Pressable').props.onPress());
    assert.equal(a.navigations.length, beforeTap);
    const sheet = `${prefix}-country-sheet`;
    await act(() => node(`${sheet}-search`, 'Input').props.onChangeText('Италия'));
    assert.equal(node(`${sheet}-country-FR`, 'Pressable'), undefined);
    await act(() => node(`${sheet}-country-IT`, 'Pressable').props.onPress());
    assert.deepEqual(a.navigations.at(-1), ['CountryTariffs', { country: italy }]);
    assert.equal(node(`${sheet}-search`, 'Input'), undefined);
    await act(() => renderer.unmount());
  }
});

test('country sheet paints the search field on mount and searches, clears and opens a destination', async () => {
  const a = app({ platform: 'ios' }), selected = [], support = [];
  const r = await a.mount('/components/CatalogCountrySheet.tsx', { countries: [country, { ...country, id: 'it', country_iso2: 'IT', display_name: 'Италия', network: 'TIM · 5G' }], title: 'Страны каталога', subtitle: 'Покрытие уточняется', onClose() {}, onSupport: () => support.push(true), onSelectCountry: c => selected.push(c.id) });
  const fieldStyle = () => Object.assign({}, ...a.node(r, 'catalog-country-sheet-search-field', 'NativeView').props.style);
  assert.equal(fieldStyle().backgroundColor, '#2A2A2E');
  assert.equal(fieldStyle().borderColor, 'transparent');
  await act(() => a.node(r, 'catalog-country-sheet-search', 'Input').props.onFocus());
  assert.equal(fieldStyle().backgroundColor, '#2A2A2E');
  assert.equal(fieldStyle().borderColor, '#4D5CFF');
  await act(() => a.node(r, 'catalog-country-sheet-search', 'Input').props.onChangeText('ит'));
  assert.ok(a.node(r, 'catalog-country-sheet-country-IT', 'Pressable'));
  assert.equal(a.node(r, 'catalog-country-sheet-country-TR', 'Pressable'), undefined);
  await act(() => a.node(r, 'catalog-country-sheet-country-IT', 'Pressable').props.onPress());
  assert.deepEqual(selected, ['it']);
  await act(() => a.node(r, 'catalog-country-sheet-search', 'Input').props.onChangeText('нет страны'));
  assert.equal(a.node(r, 'catalog-country-sheet-list', 'View'), undefined);
  await act(() => a.node(r, 'catalog-country-sheet-contact', 'Pressable').props.onPress());
  assert.deepEqual(support, [true]);
  await act(() => a.node(r, 'catalog-country-sheet-clear', 'Pressable').props.onPress());
  assert.ok(a.node(r, 'catalog-country-sheet-country-TR', 'Pressable'));
  await act(() => r.unmount());
});

test('My eSIMs snaps between active cards and routes installation, top-up and trip history to the selected order', async () => {
  const order = (id, name, status, state = 'delivered') => ({
    id, order_number: 1000, state, esim_status: status, esim: { id, name, image: null }, tariff,
    total_amount_minor: 890, total_currency: 'RUB', remaining: { amount: 3.2, unit: 'GB' },
    created_at: '2026-07-10T10:00:00Z',
  });
  const orders = [
    order('tr', 'Турция', 'activated'), order('ae', 'ОАЭ', 'active'), order('ge', 'Грузия', 'issued'),
    order('jp', 'Япония', 'expired'), order('am', 'Армения', 'depleted'), order('pay', 'Франция', null, 'pending_payment'),
  ];
  const a = app({ orders });
  const screen = await a.mount('/screens/MyEsimsScreen.tsx');
  const node = (id, type = 'Pressable') => a.node(screen, id, type);
  try {
    const carousel = node('my-esims-carousel', 'ScrollView');
    assert.equal(carousel.props.horizontal, true);
    assert.equal(carousel.props.snapToInterval, 335);
    for (const id of ['tr', 'ae']) {
      const card = node(`my-esims-active-${id}`, 'View');
      assert.equal(card.findAllByType('Text').some(text => text.props.children === 'в сети'), false);
    }
    assert.equal(node('my-esims-page-1').props.accessibilityState.selected, true);
    await act(() => carousel.props.onScroll({ nativeEvent: { contentOffset: { x: 335 } } }));
    assert.equal(node('my-esims-page-2').props.accessibilityState.selected, true);
    await act(() => node('my-esims-page-1').props.onPress());
    assert.equal(node('my-esims-page-1').props.accessibilityState.selected, true);

    for (const [button, params] of [
      ['details-ae', { orderId: 'ae', details: true }],
      ['top-up-tr', { orderId: 'tr', details: true, openTopUp: true }],
      ['install-ge', { orderId: 'ge', details: true, openInstallation: true }],
      ['history-jp', { orderId: 'jp', details: true }],
      ['order-pay', { orderId: 'pay', details: true }],
    ]) {
      await act(() => node('my-esims-' + button).props.onPress());
      assert.deepEqual(a.navigations.at(-1), ['OrderStatus', params]);
    }
    assert.ok(node('my-esims-history-am'));
    await act(() => node('my-esims-add').props.onPress());
    assert.deepEqual(a.navigations.at(-1), ['Countries']);
  } finally {
    await act(() => screen.unmount());
  }
});
