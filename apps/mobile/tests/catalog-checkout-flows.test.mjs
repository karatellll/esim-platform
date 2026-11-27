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
const modalOpening = [{ toValue: 0, duration: 300 }, { toValue: 1, duration: 230 }];

function assertGlassClose(button) {
  assert.equal(button.findByType('TabBarMaterial').props.borderRadius, 20);
  assert.equal(button.findByType('Image').props.source, '../../assets/checkout/close.svg');
}

function app({ summary = async () => ({ data: base }), create = async () => ({ data: { id: 'order' } }), tariffsByEsim = {}, categories = [], signedIn = true, platform = 'web', orders = [], orderStatusById = {}, modules = {} } = {}) {
  const cache = new Map(), calls = [], navigations = [];
  const animations = [], scrollCalls = [];
  const keyboardEvents = new Map();
  const host = type => React.forwardRef((props, ref) => React.createElement(type, { ...props, ref, ...(typeof props.style === 'function' ? { style: props.style({ pressed: false }) } : {}) }, props.children));
  const View = host('View'), Pressable = host('Pressable'), Input = host('Input');
  const flatten = s => Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean).map(flatten)) : s ?? {};
  const stylesheet = { create: s => s, flatten, absoluteFill: { position: 'absolute', inset: 0 } };
  const Animated = {
    Value: class {
      constructor(value) { this.value = value; }
      setValue(value) { this.value = value; }
      interpolate(config) { return config; }
      stopAnimation() {}
    },
    timing: (value, { toValue, duration }) => ({
      start(done) { animations.push({ toValue, duration }); value.setValue(toValue); done?.({ finished: true }); },
    }),
    loop: animation => ({ start: animation.start, stop: () => animations.push('loop stopped') }),
  };
  const mocks = {
    'react-native': { ActivityIndicator: 'ActivityIndicator', View: host('NativeView'), Pressable: host('NativePressable'), Animated,
      BackHandler: { addEventListener: () => ({ remove() {} }) },
      Easing: { out: easing => easing, cubic: x => x ** 3, linear: x => x },
      PanResponder: { create: panHandlers => ({ panHandlers }) },
      Keyboard: {
      dismiss() {}, isVisible: () => false,
      addListener(event, listener) { keyboardEvents.set(event, listener); return { remove: () => keyboardEvents.delete(event) }; },
    }, KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: p => p.visible ? React.createElement('Modal', p, p.children) : null, Platform: { OS: platform }, useWindowDimensions: () => ({ width: 375, height: 812 }) },
    'expo-image': { Image: 'Image' },
    'react-native-svg': { __esModule: true, default: 'Svg', Circle: 'Circle' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    '@react-native-safe-area-context': {},
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 48, bottom: 34, left: 0, right: 0 }) },
    '@react-navigation/native': { useFocusEffect: f => React.useEffect(f, [f]), useNavigation: () => navigation, useRoute: () => ({}) },
    '/ui/Surface': { View, Pressable, AnimatedView: View }, '/ui/ScrollView': { ScrollView: host('ScrollView') },
    '/ui/design': { StyleSheet: stylesheet, fonts: { text: 'System', display: 'System' } },
    '/ui/Text': { Text: 'Text', TextInput: Input },
    '/components/CountryFlag': { CountryFlag: 'CountryFlag' },
    '/tab-bar/TabBarMaterial': { TabBarMaterial: 'TabBarMaterial' },
    '/tab-bar/useTabBarAccessibility': { useTabBarAccessibility: () => ({ reduceTransparency: false }) },
    './Skeleton': { SkeletonBlock: 'SkeletonBlock', SkeletonGroup: 'SkeletonGroup' },
    '/components/SkeletonLayouts': { TariffSkeleton: 'TariffSkeleton' },
    '/hooks/useCatalogCategories': { useCatalogCategories: () => ({ state: { status: 'ready', categories } }) },
    '/hooks/useCatalogTariffs': { useCatalogTariffs: id => ({
      state: tariffsByEsim[id] === null ? { status: 'loading' } : { status: 'ready', data: tariffsByEsim[id] },
    }) },
    '/hooks/useSkeletonGate': { useSkeletonGate: () => ({ visible: false, timedOut: false }) },
    '/hooks/useUserOrders': { useUserOrders: () => ({ state: { status: 'ready', dates: {}, response: {
      data: orders, meta: { has_more: false, next_cursor: null },
    } } }) },
    '/hooks/useOrderStatus': { useOrderStatus: id => orderStatusById[id] ?? { order: null, loading: true, error: null } },
    '/auth/AuthProvider': { useAuth: () => ({ user: signedIn ? { id: 'user', email: 'test@example.com' } : null, accessToken: signedIn ? 'local-test' : null, loading: false }) },
    '/api/auth': { AuthApiError: class extends Error {} },
    '/api/checkout': { CheckoutApiError: class extends Error {}, getCheckoutSummary: async (body, signal) => { calls.push(body); return summary(body, signal); }, createCheckoutOrder: async body => { calls.push(body); return create(body); } },
    ...modules,
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
      renderer = TestRenderer.create(React.createElement(Component, props), {
        createNodeMock: () => ({ focus() {}, scrollTo: options => scrollCalls.push(options) }),
      });
    });
    return renderer;
  };
  return { mount, calls, navigations, props, node, keyboardEvents, animations, scrollCalls };
}

test('both authorization sheets close with the glass cross', async () => {
  const a = app({ platform: 'ios' });
  let closed = 0;
  for (const variant of ['email', 'code']) {
    const screen = await a.mount('/components/AuthLayout.tsx', { variant, onBack() { closed++; }, subtitle: '' });
    const close = a.node(screen, 'auth-back', 'Pressable');
    assertGlassClose(close);
    await act(() => close.props.onPress());
    await act(() => screen.unmount());
  }
  assert.equal(closed, 2);
});

test('checkout anchors its header and pay button and shows invalid email beside the field', async () => {
  const a = app({ signedIn: false, platform: 'ios' });
  const renderer = await a.mount('/screens/CheckoutScreen.tsx', a.props);
  const node = (id, type) => a.node(renderer, id, type);
  const sheet = node('checkout-sheet', 'View');
  assertGlassClose(node('checkout-close', 'Pressable'));
  await act(() => sheet.props.onLayout({ nativeEvent: { layout: { height: 700, y: 112 } } }));
  await act(() => sheet.props.onLayout({ nativeEvent: { layout: { height: 680, y: 132 } } }));
  assert.deepEqual(a.animations, modalOpening);
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

test('the countries catalog keeps trip search above the list, shows rectangular flags and links to world tariffs', async () => {
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
  const worldPhoto = worldScreen.root.findAllByType('Image').find(image => image.props.source === '../../assets/world/hero.jpg');
  assert.equal(worldPhoto?.props.contentFit, 'cover');
  const worldButton = id => a.node(worldScreen, id, 'Pressable');
  assert.equal(worldButton('world-back').findByType('TabBarMaterial').props.borderRadius, 20);
  assert.equal(worldButton('world-share').findByType('TabBarMaterial').props.borderRadius, 20);
  await act(async () => worldButton('world-share').props.onPress());
  assert.ok(worldScreen.root.findAllByType('Text').some(text => String(text.props.children).startsWith('Весь мир — 5 ГБ')));
  const shareDialog = worldScreen.root.findByType('Modal');
  assert.equal(shareDialog.props.animationType, 'none');
  await act(() => shareDialog.props.onShow());
  assert.deepEqual(a.animations, modalOpening);
  const shareClose = shareDialog.findAllByType('Pressable').find(button => button.props.accessibilityLabel === 'Закрыть');
  assertGlassClose(shareClose);
  await act(() => shareClose.props.onPress());
  assert.equal(worldScreen.root.findAllByType('Modal').length, 0);
  await act(() => worldButton('world-buy').props.onPress());
  assert.deepEqual(a.navigations.at(-1), ['Checkout', { country: world, tariff }]);
  await act(() => worldButton('world-back').props.onPress());
  assert.equal(a.navigations.at(-1), 'back');

  const search = node('directions-search');
  const catalogScroll = node('directions-scroll', 'ScrollView');
  assert.equal(catalogScroll.findAllByProps({ testID: 'directions-search' }).length, 0);
  assert.ok(catalogScroll.findAllByProps({ testID: 'directions-categories' }).length > 0);
  const viewport = node('directions-viewport', 'NativeView');
  assert.equal(viewport.findByType('ScrollView'), catalogScroll);
  assert.equal(viewport.props.style.overflow, 'hidden');
  assert.equal(viewport.props.style.borderTopLeftRadius, 16);
  assert.equal(viewport.props.style.borderTopRightRadius, 16);
  assert.equal(search.props.accessibilityRole, 'button');
  await act(() => search.props.onPress());
  assert.deepEqual(a.navigations.at(-1), ['TripSearch']);
  await act(() => node('catalog-esim-tr').props.onPress());
  assert.deepEqual(a.navigations.at(-1), ['CountryTariffs', { country: turkey }]);
  const gridBeforeSwitch = node('directions-scroll', 'ScrollView').props.contentContainerStyle;
  const artworkBeforeSwitch = banner.findAllByType('Image').map(image => image.props.style);
  await act(() => node('category-regions').props.onPress());
  assert.deepEqual(node('directions-scroll', 'ScrollView').props.contentContainerStyle, gridBeforeSwitch);
  assert.deepEqual(node('global-esim-button').findAllByType('Image').map(image => image.props.style), artworkBeforeSwitch);
  assert.deepEqual(a.scrollCalls, []);
  assert.equal(node('directions-heading-text', 'Text'), undefined);
  assert.equal(node('directions-search').props.accessibilityLabel, search.props.accessibilityLabel);
  await act(() => node('directions-search').props.onPress());
  assert.deepEqual(a.navigations.at(-1), ['TripSearch']);
  const regionBanner = node('global-esim-button');
  assert.equal(regionBanner.props.style[0].height, 120);
  assert.equal(node('region-Весь мир'), undefined);
  const regionCard = node('region-Европа');
  assert.equal(regionCard.props.style[0].height, 150);
  assert.equal(regionCard.props.style[0].width, '100%');
  const regionalFlag = regionCard.findAllByType('Image').find(image => image.props.source === '../../assets/flags/fr.png');
  assert.deepEqual(regionalFlag.parent.props.style[1], {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  });
  await act(() => regionCard.props.onPress());
  assert.deepEqual(a.navigations.at(-1), ['RegionTariffs', { category: region }]);
  await act(() => { worldScreen.unmount(); screen.unmount(); });
});

test('iOS uses the same bundled photo in the catalog and region tariffs before and after loading', async () => {
  const cases = [
    ['Европа', 'Европа', 'XE', 'regions/europe.jpg'],
    ['Азия', 'Азия', 'XS', 'regions/asia.png'],
    ['Африка', 'Африка', 'XB', 'countries/AFRICA.jpg'],
    ['Северная Америка', 'Северная Америка', 'XN', 'countries/NORTH_AMERICA.jpg'],
    ['Южная Америка', 'Латинская Америка', 'XL', 'countries/SOUTH_AMERICA.jpg'],
    ['Балканы', 'Балканы', 'XA', 'photos/earth.jpg'],
  ];
  for (const [title, name, code, file] of cases) {
    const bundle = { ...country, id: code, country_iso2: code, display_name: name, photo_url: 'https://example.com/catalog-photo.webp' };
    const category = { title, esims: [bundle] };
    const tariffsByEsim = { [code]: null };
    const a = app({ platform: 'ios', tariffsByEsim });
    const catalog = await a.mount('/components/CatalogRegions.tsx', { categories: [category], onSelectCategory() {} });
    const props = { route: { params: { category } }, navigation: a.props.navigation };
    const tariffs = await a.mount('/screens/RegionTariffsScreen.tsx', props);
    const assertPhoto = view => {
      const sources = view.findAllByType('Image').map(image => image.props.source);
      assert.ok(sources.some(source => typeof source === 'string' && source.endsWith(file)), title);
      assert.ok(sources.every(source => !source?.uri), title);
    };
    try {
      const card = a.node(catalog, 'region-' + title, 'NativePressable');
      assert.equal(card.props.style[0].overflow, 'hidden');
      assertPhoto(card);
      assertPhoto(tariffs.root);
      tariffsByEsim[code] = { esim: { ...bundle, photo_url: 'https://example.com/tariffs-photo.webp' }, tariffs: [] };
      await act(() => tariffs.update(React.createElement(tariffs.root.type, props)));
      assertPhoto(tariffs.root);
    } finally {
      await act(() => { catalog.unmount(); tariffs.unmount(); });
    }
  }
});

test('country tariffs keep the same bundled photo before and after tariffs load', async () => {
  const photoUrl = 'https://example.com/provider-photo.webp';
  for (const code of ['BY', 'DZ', 'GE', 'GH', 'KN', 'LC', 'NE', 'TH', 'TR', 'FM']) {
    const destination = { ...country, id: code, country_iso2: code, photo_url: photoUrl };
    const tariffsByEsim = { [code]: null };
    const a = app({ platform: 'ios', tariffsByEsim });
    const props = {
      route: { params: { country: destination } },
      navigation: a.props.navigation,
    };
    const renderer = await a.mount('/screens/CountryTariffsScreen.tsx', props);
    const expectedFile = code === 'TR' ? 'photos/turkey.jpg' : code === 'FM' ? 'photos/earth.jpg' : `countries/${code}.jpg`;
    const assertPhoto = () => {
      const sources = renderer.root.findAllByType('Image').map(image => image.props.source);
      assert.ok(sources.some(source => typeof source === 'string' && source.endsWith(expectedFile)), code);
      assert.ok(sources.every(source => !source?.uri && !String(source).endsWith('turkey-hero.png')), code);
    };
    try {
      assertPhoto();
      tariffsByEsim[code] = { esim: destination, tariffs: [] };
      await act(() => renderer.update(React.createElement(renderer.root.type, props)));
      assertPhoto();
    } finally {
      await act(() => renderer.unmount());
    }
  }
});

test('opening Ghana ignores previously loaded Gibraltar details and keeps the local Ghana photo', async () => {
  const gibraltarPhoto = 'https://example.com/gibraltar.webp';
  const ghana = { ...country, id: 'ghana', country_iso2: 'GH', display_name: 'Гана', photo_url: gibraltarPhoto };
  const gibraltar = { ...country, id: 'gibraltar', country_iso2: 'GI', display_name: 'Гибралтар', photo_url: gibraltarPhoto };
  const tariffsByEsim = { [ghana.id]: { esim: gibraltar, tariffs: [tariff] } };
  const a = app({ platform: 'ios', tariffsByEsim });
  const props = { route: { params: { country: ghana } }, navigation: a.props.navigation };
  const screen = await a.mount('/screens/CountryTariffsScreen.tsx', props);
  const checkPhoto = () => {
    const images = screen.root.findAllByType('Image').map(image => image.props.source);
    assert.ok(images.some(source => typeof source === 'string' && source.endsWith('countries/GH.jpg')));
    assert.ok(images.every(source => !source?.uri && !String(source).endsWith('countries/GI.jpg')));
  };
  try {
    checkPhoto();
    assert.equal(a.node(screen, 'tariff-5gb', 'Pressable'), undefined);
    tariffsByEsim[ghana.id] = { esim: ghana, tariffs: [tariff] };
    await act(() => screen.update(React.createElement(screen.root.type, props)));
    checkPhoto();
    assert.ok(a.node(screen, 'tariff-5gb', 'Pressable'));
  } finally {
    await act(() => screen.unmount());
  }
});

test('checkout retries an unconfirmed price without creating an order', async () => {
  let attempts = 0;
  const a = app({ summary: async () => {
    if (++attempts === 1) throw new Error('provider price unavailable');
    return { data: { ...base, amount: 889.5 } };
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

test('tariff pages preselect the search result and let the user buy another package', async () => {
  const region = { ...country, id: 'europe', country_iso2: 'XE', display_name: 'Европа (регион)' };
  const category = { title: 'Европа', esims: [country, region] };
  const world = { ...country, id: 'world', country_iso2: 'XG', display_name: 'Весь мир' };
  const recommendation = { ...tariff, id: '10gb', data_amount: { amount: 10, unit: 'GB' }, duration: { amount: 30, unit: 'day' } };
  const alternative = { ...recommendation, id: '3gb', data_amount: { amount: 3, unit: 'GB' } };
  const tariffsByEsim = Object.fromEntries([country, region, world].map(esim => [esim.id, { esim, tariffs: [tariff, alternative, recommendation] }]));
  const a = app({ tariffsByEsim });
  for (const [screen, params, optionPrefix, durationPrefix, buyId, esim] of [
    ['CountryTariffs', { country }, 'tariff-', 'duration-', 'tariff-buy', country],
    ['RegionTariffs', { category }, 'region-tariff-', 'region-duration-', 'region-buy', region],
    ['WorldTariffs', { bundle: world }, 'world-tariff-', 'world-duration-', 'world-buy', world],
  ]) {
    const route = { params: { ...params, initialTariffId: recommendation.id, recommendedTariffId: recommendation.id } };
    const renderer = await a.mount(`/screens/${screen}Screen.tsx`, { route, navigation: a.props.navigation });
    const button = id => a.node(renderer, id, 'Pressable');
    const recommended = () => button(optionPrefix + recommendation.id);
    const other = () => button(optionPrefix + alternative.id);
    const hint = () => a.node(renderer, 'tariff-recommendation-hint', 'View');
    try {
      assert.equal(button(durationPrefix + 'day:30').props.accessibilityState.selected, true);
      assert.equal(recommended().props.accessibilityState.selected, true);
      assert.equal(recommended().findByProps({ testID: 'tariff-recommendation-icon' }).props.accessible, false);
      assert.equal(hint().findByType('Text').props.children, 'Подходящий тариф по запросу');
      await act(() => other().props.onPress());
      assert.equal(other().props.accessibilityState.selected, true);
      assert.equal(other().findAllByProps({ testID: 'tariff-recommendation-icon' }).length, 0);
      assert.equal(recommended().props.accessibilityState.selected, false);
      assert.ok(hint());
      await act(() => button(buyId).props.onPress());
      assert.deepEqual(a.navigations.at(-1), ['Checkout', { country: esim, tariff: alternative }]);
      await act(() => button(durationPrefix + 'day:15').props.onPress());
      assert.equal(button(optionPrefix + tariff.id).props.accessibilityState.selected, true);
      assert.equal(hint(), undefined);
    } finally {
      await act(() => renderer.unmount());
    }
  }
});

test('the region uses the country purchase bar and checks out the newly selected tariff', async () => {
  const region = { ...country, id: 'europe', country_iso2: 'XE', display_name: 'Европа (регион)' };
  const longerTariff = { ...tariff, id: '10gb', price_amount_minor: 1908.5, data_amount: { amount: 10, unit: 'GB' }, duration: { amount: 30, unit: 'day' } };
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
  assert.equal(a.node(countryScreen, 'tariff-recommendation-icon', 'Image'), undefined);
  assert.equal(a.node(countryScreen, 'tariff-recommendation-hint', 'View'), undefined);
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
  const selectedPackage = a.node(regionScreen, 'region-tariff-10gb', 'Pressable');
  assert.ok(selectedPackage.findAllByType('Text').some(text => String(text.props.children).replace(/\s/g, ' ') === '191 ₽ за ГБ'));
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
  assertGlassClose(promoBack);
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

test('swiping away a pending promotion aborts it and ignores its eventual reply', async () => {
  let signal, resolve;
  let closed = 0;
  const a = app(); const r = await a.mount('/components/PromoCodeSheet.tsx', { onClose() { closed++; }, onApply: (_, s) => { signal = s; return new Promise(r => resolve = r); } });
  await act(() => r.root.findByType('Modal').props.onShow());
  await act(() => a.node(r, 'checkout-promo-input', 'Input').props.onChangeText('SUMMER'));
  await act(() => a.node(r, 'checkout-promo-apply', 'Pressable').props.onPress());
  assert.equal(a.node(r, 'checkout-promo-apply', 'Pressable').props.disabled, true);
  const drag = a.node(r, 'promo-sheet', 'View').findAllByType('View').find(node => node.props.onPanResponderRelease);
  await act(() => drag.props.onPanResponderRelease(null, { dy: 110, vy: 0.3 }));
  assert.equal(signal.aborted, true);
  await act(async () => resolve());
  assert.equal(closed, 1);
  await act(() => r.unmount());
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

test('the country sheet fades a fixed backdrop and closes after a downward swipe', async () => {
  const a = app();
  let closed = 0;
  const r = await a.mount('/components/CatalogCountrySheet.tsx', {
    countries: [country], title: 'Страны каталога', subtitle: '', onClose: () => { closed++; },
    onSupport() {}, onSelectCountry() {},
  });
  const modal = r.root.findByType('Modal');
  const sheet = a.node(r, 'catalog-country-sheet', 'View');
  assertGlassClose(a.node(r, 'catalog-country-sheet-close', 'Pressable'));
  const drag = a.node(r, 'catalog-country-sheet-drag', 'View').props;
  const backdrop = modal.findAllByType('View').find(node => node.props.style?.[1]?.backgroundColor === 'rgba(0,0,0,0.6)');
  const offset = sheet.props.style[1].transform[0].translateY;
  const opacity = backdrop.props.style[2].opacity;
  assert.equal(modal.props.animationType, 'none');
  assert.equal(backdrop.props.style[2].transform, undefined);
  assert.equal(opacity.value, 0);
  await act(() => modal.props.onShow());
  assert.deepEqual(a.animations, modalOpening);
  assert.equal(offset.value, 0);
  assert.equal(opacity.value, 1);
  assert.equal(drag.onMoveShouldSetPanResponderCapture(null, { dx: 30, dy: 15, numberActiveTouches: 1 }), false);
  assert.equal(drag.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: 15, numberActiveTouches: 1 }), true);
  await act(() => drag.onPanResponderGrant());
  await act(() => drag.onPanResponderMove(null, { dy: 40 }));
  assert.equal(offset.value, 55);
  assert.ok(opacity.value < 1);
  await act(() => drag.onPanResponderRelease(null, { dy: 40, vy: 0.1 }));
  assert.equal(closed, 0);
  assert.equal(offset.value, 0);
  assert.equal(opacity.value, 1);
  await act(() => drag.onPanResponderRelease(null, { dy: 110, vy: 0.1 }));
  assert.equal(closed, 1);
  assert.equal(opacity.value, 0);
  await act(() => r.unmount());
});

test('iOS sheets claim header touches and dismiss on a downward pull from the top of their content', async () => {
  const a = app({ platform: 'ios' });
  let closed = 0;
  const screen = await a.mount('/components/CatalogCountrySheet.tsx', {
    countries: [country], title: 'Страны каталога', subtitle: '', onClose: () => { closed++; },
    onSupport() {}, onSelectCountry() {},
  });
  try {
    await act(() => screen.root.findByType('Modal').props.onShow());
    const header = a.node(screen, 'catalog-country-sheet-drag', 'View').props;
    const touch = { nativeEvent: { touches: [{}] } };
    assert.equal(header.collapsable, false);
    assert.equal(header.onStartShouldSetPanResponder(touch), true);
    await act(() => header.onPanResponderGrant());
    await act(() => header.onPanResponderRelease(touch, { dx: 125, dy: 100, vy: 0.9 }));
    assert.equal(closed, 0);

    const scroll = screen.root.findByType('ScrollView').props;
    const event = y => ({ nativeEvent: { contentOffset: { y }, contentInset: { top: 12 } } });
    assert.equal(scroll.alwaysBounceVertical, true);
    await act(() => scroll.onScrollBeginDrag(event(80)));
    await act(() => scroll.onScrollEndDrag(event(-65)));
    assert.equal(closed, 0);
    await act(() => scroll.onScrollBeginDrag(event(-12)));
    await act(() => scroll.onScrollEndDrag(event(-30)));
    assert.equal(closed, 0);
    await act(() => scroll.onScrollBeginDrag(event(-12)));
    await act(() => scroll.onScrollEndDrag(event(-65)));
    assert.equal(closed, 1);
  } finally {
    await act(() => screen.unmount());
  }
});

test('My eSIMs opens the QR over the list and opens details from the order card', async () => {
  const order = (id, name, status, state = 'delivered') => ({
    id, order_number: 1000, state, esim_status: status, esim: { id, name, image: null }, tariff,
    total_amount_minor: 889.5, total_currency: 'RUB', remaining: { amount: 3.2, unit: 'GB' },
    created_at: '2026-07-10T10:00:00Z',
  });
  const orders = [
    order('tr', 'Турция', 'activated'), order('ae', 'ОАЭ', 'active'),
    { ...order('ge', 'Грузия', 'activated'), remaining: tariff.data_amount },
    order('jp', 'Япония', 'expired'), order('am', 'Армения', 'depleted'), order('pay', 'Франция', null, 'pending_payment'),
    order('it', 'Италия', 'installed'),
  ];
  const orderStatusById = {};
  const a = app({ orders, orderStatusById });
  const screen = await a.mount('/screens/MyEsimsScreen.tsx');
  const node = (id, type = 'Pressable') => a.node(screen, id, type);
  try {
    const carousel = node('my-esims-carousel', 'ScrollView');
    assert.equal(carousel.props.horizontal, true);
    assert.equal(carousel.props.pagingEnabled, true);
    assert.equal(carousel.props.style.scrollPaddingLeft, 12);
    assert.ok(node('my-esims-order-pay').findAllByType('Text').some(text => String(text.props.children).replace(/\s/g, ' ') === '890 ₽'));
    for (const id of ['tr', 'ae']) {
      const card = node(`my-esims-active-${id}`, 'View');
      assert.equal(card.findAllByType('Text').some(text => text.props.children === 'в сети'), false);
    }
    assert.equal(node('my-esims-page-1').props.accessibilityState.selected, true);
    await act(() => carousel.props.onScroll({ nativeEvent: { contentOffset: { x: 335 } } }));
    assert.equal(node('my-esims-page-2').props.accessibilityState.selected, true);
    await act(() => node('my-esims-page-1').props.onPress());
    assert.equal(node('my-esims-page-1').props.accessibilityState.selected, true);

    await act(() => node('my-esims-install-ge').props.onPress());
    assert.deepEqual(a.navigations, []);
    assert.equal(node('my-esims-active-ge', 'View'), undefined);
    assert.ok(node('my-esims-scroll', 'ScrollView'));
    assert.equal(node('installation-tab-qr').props.accessibilityState.selected, true);
    assert.equal(node('installation-refresh').props.disabled, true);
    assert.equal(node('installation-qr-image', 'Image'), undefined);
    const qrUrl = 'https://example.com/installation.png';
    orderStatusById.ge = { order: { ...orders[2], payment: { state: 'captured' }, provision: { qr_code_url: qrUrl } }, loading: false, error: null };
    await act(() => screen.update(React.createElement(screen.root.type)));
    assert.deepEqual(node('installation-qr-image', 'Image').props.source, { uri: qrUrl });
    for (const [action, source] of [['share', '../../assets/mvp/f4b30.svg'], ['save', '../../assets/installation/download.svg']]) {
      const icon = node(`installation-${action}`).findByType('Image');
      assert.equal(icon.props.source, source);
      assert.deepEqual(icon.props.style, { width: 20, height: 20 });
    }
    await act(() => node('installation-tab-quick').props.onPress());
    const toggle = () => node('installation-instructions');
    const installationScroll = node('installation-scroll', 'ScrollView');
    assert.equal(installationScroll.findAllByProps({ testID: 'installation-instructions' }).length, 0);
    await act(() => toggle().props.onPress());
    assert.equal(toggle().findByType('Text').props.children, 'Свернуть инструкцию');
    const instruction = node('installation-instruction-content', 'View');
    await act(() => instruction.props.onLayout({ nativeEvent: { layout: { y: 432 } } }));
    assert.deepEqual(a.scrollCalls.at(-1), { y: 418, animated: true });
    await act(() => toggle().props.onPress());
    assert.equal(node('installation-instruction-content', 'View'), undefined);
    assert.equal(toggle().findByType('Text').props.children, 'Подробная инструкция');
    await act(() => node('installation-close').props.onPress());
    assert.equal(node('installation-qr-image', 'Image'), undefined);
    assert.equal(node('my-esims-install-it'), undefined);

    for (const [button, params] of [
      ['details-ae', { orderId: 'ae', details: true }],
      ['top-up-tr', { orderId: 'tr', details: true, openTopUp: true }],
      ['details-ge', { orderId: 'ge', details: true }],
      ['details-it', { orderId: 'it', details: true }],
      ['history-jp', { orderId: 'jp', details: true }],
      ['order-pay', { orderId: 'pay', details: true }],
    ]) {
      await act(() => node('my-esims-' + button).props.onPress());
      assert.deepEqual(a.navigations.at(-1), ['OrderStatus', params]);
    }
    assert.ok(node('my-esims-history-am'));
    assert.equal(node('my-esims-add'), undefined);
  } finally {
    await act(() => screen.unmount());
  }
});

test('on iOS and Android the active eSIM carousel snaps horizontally in both directions', async () => {
  const orders = ['tr', 'ae'].map((id, index) => ({
    id, esim: { id, name: id, image: null }, order_number: index + 1, state: 'delivered', esim_status: 'active',
    tariff, remaining: null, created_at: '2026-07-10T10:00:00Z',
  }));
  for (const platform of ['ios', 'android']) {
    const a = app({ orders, platform });
    const screen = await a.mount('/screens/MyEsimsScreen.tsx');
    const carousel = a.node(screen, 'my-esims-carousel', 'ScrollView');
    const selected = page => a.node(screen, `my-esims-page-${page}`, 'Pressable').props.accessibilityState.selected;
    try {
      assert.equal(a.node(screen, 'my-esims-scroll', 'ScrollView').props.nestedScrollEnabled, true);
      assert.equal(carousel.props.horizontal, true);
      assert.equal(carousel.props.nestedScrollEnabled, true);
      assert.equal(carousel.props.directionalLockEnabled, true);
      assert.deepEqual(carousel.props.snapToOffsets, [0, 335]);
      assert.equal(selected(1), true);
      await act(() => carousel.props.onScroll({ nativeEvent: { contentOffset: { x: 335 } } }));
      assert.equal(selected(2), true);
      await act(() => carousel.props.onScroll({ nativeEvent: { contentOffset: { x: 0 } } }));
      assert.equal(selected(1), true);
    } finally {
      await act(() => screen.unmount());
    }
  }
});

test('opening details skips the payment check while a pending payment can still be opened', async () => {
  const orderStatusById = {};
  const a = app({ orderStatusById });
  const props = { route: { params: { orderId: 'order', details: true } }, navigation: a.props.navigation };
  const screen = await a.mount('/screens/OrderStatusScreen.tsx', props);
  const node = (id, type) => a.node(screen, id, type);
  try {
    assert.ok(node('order-details-loading', 'ActivityIndicator'));
    assert.equal(node('order-state', 'Text'), undefined);
    const order = { id: 'order', order_number: 1000, esim: { id: country.id, name: country.display_name, image: null },
      tariff, esim_status: 'activated', remaining: tariff.data_amount, total_amount_minor: 890, total_currency: 'RUB' };
    orderStatusById.order = { order: { ...order, state: 'delivered', payment: { state: 'captured' } }, loading: false, error: null };
    await act(() => screen.update(React.createElement(screen.root.type, props)));
    assert.ok(screen.root.findAllByType('Text').some(text => text.props.children === country.display_name));
    assert.ok(screen.root.findAllByType('Text').some(text => text.props.children === 'Готова к установке'));
    assert.equal(node('order-state', 'Text'), undefined);
    let checks = 0;
    orderStatusById.order = { order: { ...order, state: 'pending_payment', payment: { state: 'pending', url: 'https://example.com/pay' } }, loading: false, error: null, reload: () => { checks++; } };
    await act(() => screen.update(React.createElement(screen.root.type, props)));
    assert.equal(node('order-state', 'Text').props.children, 'Ожидаем оплату');
    assert.ok(node('order-payment-spinner', 'View'));
    assert.deepEqual(a.animations.at(-1), { toValue: 1, duration: 1000 });
    const pay = node('order-open-payment', 'Pressable');
    const refresh = node('order-refresh', 'Pressable');
    assert.equal(refresh.props.style[0], pay.props.style[0]);
    assert.equal(refresh.props.style[0].height, 56);
    assert.equal(refresh.findByType('Text').props.children, 'Проверить оплату');
    await act(() => refresh.props.onPress());
    assert.equal(checks, 1);
    assert.equal(node('order-my-esims', 'Pressable'), undefined);
    props.navigation.canGoBack = () => true;
    await act(() => node('order-back', 'Pressable').props.onPress());
    assert.equal(a.navigations.at(-1), 'back');
    props.navigation.canGoBack = () => false;
    await act(() => node('order-back', 'Pressable').props.onPress());
    assert.deepEqual(a.navigations.at(-1), ['Main', { screen: 'MyEsims' }]);
  } finally {
    await act(() => screen.unmount());
  }
  assert.equal(a.animations.at(-1), 'loop stopped');
});

test('the iOS avatar picker loads a bounded original and prepares a square before saving', async () => {
  const calls = [];
  let finishLoad;
  const loading = new Promise(resolve => { finishLoad = resolve; });
  const image = { width: 640, height: 1280, scale: 1, release: () => calls.push('release-source') };
  const render = { saveAsync: async options => { calls.push(['encode', options]); return { base64: 'image-data' }; }, release: () => calls.push('release-render') };
  const context = { crop: options => calls.push(['crop', options]), resize: options => calls.push(['resize', options]),
    renderAsync: async () => render, release: () => calls.push('release-context') };
  const Image = Object.assign(props => React.createElement('Image', props), {
    loadAsync: (source, options) => { calls.push(['load', source, options]); return loading; },
  });
  const a = app({ platform: 'ios', modules: {
    'expo-image': { Image },
    'expo-image-picker': {
      UIImagePickerPreferredAssetRepresentationMode: { Current: 'current' },
      launchImageLibraryAsync: async options => { calls.push(['pick', options]); return { canceled: false, assets: [{ uri: 'file:///photo.heic' }] }; },
    },
    'expo-image-manipulator': { ImageManipulator: { manipulate: source => { assert.equal(source, image); return context; } }, SaveFormat: { JPEG: 'jpeg' } },
    '/auth/AuthProvider': { useAuth: () => ({ user: { email: 'test@example.com' }, saveProfile: async (...args) => { calls.push(['save', ...args]); } }) },
  } });
  const screen = await a.mount('/screens/ProfileEditScreen.tsx', a.props);
  const buttons = () => screen.root.findAllByType('Pressable');
  const photo = () => buttons().find(button => button.props.accessibilityLabel === 'Выбрать фото');
  const save = () => buttons().find(button => button.findAllByType('Text').some(text => text.props.children === 'Сохранить'));
  try {
    let selection;
    await act(async () => { selection = photo().props.onPress(); });
    assert.deepEqual(calls, [
      ['pick', { mediaTypes: ['images'], allowsEditing: false, quality: 1, preferredAssetRepresentationMode: 'current' }],
      ['load', { uri: 'file:///photo.heic' }, { maxWidth: 1280, maxHeight: 1280 }],
    ]);
    assert.equal(save().props.disabled, true);
    assert.ok(screen.root.findAllByType('Text').some(text => text.props.children === 'Готовим фото…'));
    await act(() => photo().props.onPress());
    assert.equal(calls.filter(([kind]) => kind === 'pick').length, 1);
    await act(async () => { finishLoad(image); await selection; });
    assert.deepEqual(calls.slice(2), [
      ['crop', { originX: 0, originY: 320, width: 640, height: 640 }], ['resize', { width: 320 }],
      ['encode', { compress: 0.65, format: 'jpeg', base64: true }], 'release-render', 'release-context', 'release-source',
    ]);
    assert.equal(save().props.disabled, false);
    assert.deepEqual(photo().findByType('Image').props.source, { uri: 'data:image/jpeg;base64,image-data' });
    await act(() => save().props.onPress());
    assert.deepEqual(calls.at(-1), ['save', 'test', 'data:image/jpeg;base64,image-data']);
  } finally { await act(() => screen.unmount()); }
});

test('the purchased eSIM shows the catalog network and the receipt on its own row', async () => {
  const order = { id: 'purchased', order_number: 10001, esim: { id: country.id, name: country.display_name, image: null },
    state: 'delivered', esim_status: 'installed', tariff, remaining: tariff.data_amount, total_amount_minor: 169, total_currency: 'RUB',
    payment: { state: 'captured' }, provision: null };
  const a = app({ orderStatusById: { [order.id]: { order, loading: false, error: null } }, tariffsByEsim: {
    [country.id]: { esim: { ...country, network: 'Turkcell · 5G' }, tariffs: [tariff] },
  } });
  const screen = await a.mount('/screens/OrderStatusScreen.tsx', { route: { params: { orderId: order.id } }, navigation: a.props.navigation });
  const node = (id, type) => a.node(screen, id, type);
  try {
    const text = screen.root.findAllByType('Text');
    assert.equal(text.find(item => item.props.children === 'Готово — eSIM').props.numberOfLines, 1);
    assert.ok(text.some(item => item.props.children === 'Turkcell · 5G'));
    assert.ok(text.some(item => item.props.children === 'ждёт поездки'));
    const payment = node('purchased-payment-summary', 'View');
    assert.equal(payment.findByType('Text').props.children.join('').replace(/\s/g, ' '), 'Оплачено 169 ₽. Заказ № 10001');
    assert.equal(payment.findAllByType('Image').length, 0);
    assert.equal(node('purchased-cashback', 'View'), undefined);
    assert.ok(screen.root.findAllByType('Image').some(image => image.props.source === '../../assets/installation/wifi.svg'));
    await act(() => node('purchased-install', 'Pressable').props.onPress());
    assert.ok(node('installation-sheet', 'View'));
    await act(() => node('installation-close', 'Pressable').props.onPress());
    await act(() => node('purchased-later', 'Pressable').props.onPress());
    assert.deepEqual(a.navigations.at(-1), ['Main', { screen: 'MyEsims' }]);
  } finally {
    await act(() => screen.unmount());
  }
});
