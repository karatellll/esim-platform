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

function app({ summary = async () => ({ data: base }), create = async () => ({ data: { id: 'order' } }) } = {}) {
  const cache = new Map(), calls = [], navigations = [];
  const host = type => React.forwardRef((props, ref) => React.createElement(type, { ...props, ref, ...(typeof props.style === 'function' ? { style: props.style({ pressed: false }) } : {}) }, props.children));
  const View = host('View'), Pressable = host('Pressable'), Input = host('Input');
  const flatten = s => Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean).map(flatten)) : s ?? {};
  const stylesheet = { create: s => s, flatten, absoluteFill: { position: 'absolute', inset: 0 } };
  const mocks = {
    'react-native': { ActivityIndicator: 'ActivityIndicator', Keyboard: { dismiss() {} }, KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: p => p.visible ? React.createElement('Modal', p, p.children) : null, Platform: { OS: 'web' }, useWindowDimensions: () => ({ width: 375, height: 812 }) },
    'expo-image': { Image: 'Image' },
    '@react-native-safe-area-context': {},
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 48, bottom: 34, left: 0, right: 0 }) },
    '@react-navigation/native': { useFocusEffect: f => React.useEffect(f, [f]) },
    '/ui/Surface': { View, Pressable }, '/ui/ScrollView': { ScrollView: host('ScrollView') },
    '/ui/design': { StyleSheet: stylesheet, fonts: { text: 'System', display: 'System' } },
    '/ui/Text': { Text: 'Text', TextInput: Input },
    '/components/CountryFlag': { CountryFlag: 'CountryFlag' },
    '/auth/AuthProvider': { useAuth: () => ({ user: { id: 'user', email: 'test@example.com' }, accessToken: 'local-test', loading: false }) },
    '/api/auth': { AuthApiError: class extends Error {} },
    '/api/checkout': { CheckoutApiError: class extends Error {}, getCheckoutSummary: async (body, signal) => { calls.push(body); return summary(body, signal); }, createCheckoutOrder: async body => { calls.push(body); return create(body); } },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const m = { exports: {} }; cache.set(file, m);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const local = name => {
      for (const [key, value] of Object.entries(mocks)) if (name === key || (key.startsWith('/') && name.endsWith(key))) return value;
      if (/\.(svg|png)$/.test(name)) return name;
      if (name.startsWith('.')) { const f = path.resolve(path.dirname(file), name); return load([f + '.tsx', f + '.ts'].find(fs.existsSync)); }
      return require(name);
    };
    new Function('require', 'module', 'exports', code)(local, m, m.exports);
    return m.exports;
  }
  const navigation = { goBack() { navigations.push('back'); }, isFocused: () => true, navigate: (...args) => navigations.push(args), replace: (...args) => navigations.push(args) };
  const props = { route: { params: { country, tariff } }, navigation };
  const node = (r, id, type) => r.root.findAll(n => n.type === type && n.props.testID === id)[0];
  const mount = async (file, props) => { let r; await act(async () => { r = TestRenderer.create(React.createElement(load(root + file)[file.includes('CheckoutScreen') ? 'CheckoutScreen' : file.includes('PromoCodeSheet') ? 'PromoCodeSheet' : 'CatalogCountrySheet'], props), { createNodeMock: () => ({ focus() {} }) }); }); return r; };
  return { mount, calls, navigations, props, node };
}

test('a rejected promotion keeps the price and returning to checkout still allows purchase', async () => {
  const a = app({ summary: async body => { if (body.promo_code) throw new Error('Промокоды пока недоступны. Продолжите без промокода.'); return { data: base }; } });
  const r = await a.mount('/screens/CheckoutScreen.tsx', a.props);
  await act(() => a.node(r, 'checkout-promo-toggle', 'Pressable').props.onPress());
  await act(() => a.node(r, 'checkout-promo-input', 'Input').props.onChangeText('summer'));
  await act(async () => a.node(r, 'checkout-promo-apply', 'Pressable').props.onPress());
  assert.equal(a.calls[1].promo_code, 'SUMMER');
  assert.match(a.node(r, 'checkout-promo-error', 'Text').props.children, /недоступны/);
  await act(() => a.node(r, 'promo-back', 'Pressable').props.onPress());
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

test('country sheet searches, clears, handles missing countries and opens a real destination', async () => {
  const a = app(), selected = [], support = [];
  const r = await a.mount('/components/CatalogCountrySheet.tsx', { countries: [country, { ...country, id: 'it', country_iso2: 'IT', display_name: 'Италия', network: 'TIM · 5G' }], title: 'Страны каталога', subtitle: 'Покрытие уточняется', onClose() {}, onSupport: () => support.push(true), onSelectCountry: c => selected.push(c.id) });
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
