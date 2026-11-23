import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);

function loadHook(name, platform, api, appState, useOnline = () => true) {
  const file = path.resolve(import.meta.dirname, `../src/hooks/${name}.ts`);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = name => {
    if (name === 'react-native') return { Platform: { OS: platform }, AppState: appState };
    if (name === '../api/catalog') return api;
    if (name === '../api/client') return { ApiRequestError: class extends Error {} };
    if (name === '../service/connectivity') return { useOnline };
    if (name === '@react-navigation/native') return { useFocusEffect: callback => React.useEffect(callback, [callback]) };
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports[name];
}

for (const platform of ['ios', 'android']) {
  test(`${platform}: opening the home search does not require browser event methods`, async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    // React Native aliases window to global, without DOM event methods.
    Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
    let renderer;
    try {
      assert.equal(typeof window.addEventListener, 'undefined');
      const useTripTariffs = loadHook('useTripTariffs', platform, {}, {});
      function HomeSearch() { useTripTariffs([], false); return null; }
      await act(() => { renderer = TestRenderer.create(React.createElement(HomeSearch)); });
    } finally {
      if (renderer) await act(() => renderer.unmount());
      if (previous) Object.defineProperty(globalThis, 'window', previous);
      else delete globalThis.window;
    }
  });

  test(`${platform}: an unavailable catalog stays recoverable and retries on app activation`, async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
    let renderer, state, onChange, calls = 0, removed = 0;
    try {
      const useCatalogCategories = loadHook('useCatalogCategories', platform, {
        getCatalogCategories: async () => {
          calls++;
          if (calls === 1) throw new Error('Server unavailable');
          return { data: [] };
        },
      }, {
        addEventListener(event, callback) {
          assert.equal(event, 'change'); onChange = callback;
          return { remove() { removed++; } };
        },
      });
      function Catalog() { state = useCatalogCategories().state; return null; }
      await act(async () => { renderer = TestRenderer.create(React.createElement(Catalog)); });
      assert.equal(state.status, 'error');
      await act(async () => onChange('active'));
      assert.equal(state.status, 'ready');
      assert.equal(calls, 2);
      assert.equal(removed, 1);
    } finally {
      if (renderer) await act(() => renderer.unmount());
      if (previous) Object.defineProperty(globalThis, 'window', previous);
      else delete globalThis.window;
    }
  });
}

test('web: startup offline, offline banner and reconnection preserve the running app', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const browser = new EventTarget();
  browser.navigator = { onLine: false };
  const removed = [];
  const remove = browser.removeEventListener.bind(browser);
  browser.removeEventListener = (event, listener) => { removed.push(event); remove(event, listener); };
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true });
  let renderer, calls = 0, openedEsims = 0;
  try {
    const context = React.createContext(true);
    const appState = { addEventListener() { return { remove() {} }; } };
    const useTripTariffs = loadHook('useTripTariffs', 'web', {
      getCatalogTariffs: async id => { calls++; return { data: { esim: { id }, tariffs: [] } }; },
    }, appState, () => React.useContext(context) !== false);
    const serviceFile = path.resolve(import.meta.dirname, '../src/service/ServiceGate.tsx');
    const code = ts.transpileModule(fs.readFileSync(serviceFile, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const module = { exports: {} };
    const localRequire = name => ({
      'expo-network': {},
      'react-native': { View: 'View', ActivityIndicator: 'ActivityIndicator', Platform: { OS: 'web' },
        AppState: appState, StyleSheet: { create: styles => styles, absoluteFill: {} } },
      '../components/ServiceState': { ServiceState: 'ServiceState', OfflineBanner: 'OfflineBanner' },
      './appStatus': { getAppStatus: async () => ({ status: 'ok' }) },
      './connectivity': { ConnectivityContext: context },
      '../theme': { colors: {} },
    })[name] ?? require(name);
    new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
    const { ServiceGate } = module.exports;
    function Search() { useTripTariffs([{ id: 'country' }], true); return null; }
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(ServiceGate, {
        supportOpen: false, onSupport() {}, onEsims() { openedEsims++; return true; },
      }, React.createElement(Search)));
    });
    assert.equal(renderer.root.findByType('ServiceState').props.kind, 'offline');
    assert.equal(calls, 0);
    await act(() => renderer.root.findByType('ServiceState').props.secondary.onPress());
    assert.equal(openedEsims, 1);
    assert.equal(renderer.root.findAllByType('OfflineBanner').length, 1);
    browser.navigator.onLine = true;
    await act(async () => browser.dispatchEvent(new Event('online')));
    assert.equal(calls, 1);
    assert.equal(renderer.root.findAllByType('OfflineBanner').length, 0);
    browser.navigator.onLine = false;
    await act(async () => browser.dispatchEvent(new Event('offline')));
    assert.equal(renderer.root.findAllByType('ServiceState').length, 0);
    assert.equal(renderer.root.findAllByType('OfflineBanner').length, 1);
    browser.navigator.onLine = true;
    await act(async () => browser.dispatchEvent(new Event('online')));
    assert.equal(calls, 2);
    await act(() => renderer.unmount());
    renderer = null;
    browser.dispatchEvent(new Event('online'));
    assert.equal(calls, 2);
    assert.deepEqual(removed, ['online', 'offline']);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  }
});
