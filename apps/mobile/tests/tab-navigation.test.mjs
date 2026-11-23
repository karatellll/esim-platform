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

async function mount({ platform = 'web', reduceMotion = false, liquidGlass = false } = {}) {
  const cache = new Map(), navigations = [], events = [], animations = [], listeners = new Map();
  let blocked = false;
  const host = type => props => React.createElement(type, { ...props, style: typeof props.style === 'function' ? props.style({ pressed: false }) : props.style }, props.children);
  class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } stopAnimation() {} }
  const mocks = {
    'expo-image': { Image: 'Image' },
    'liquid-glass-react': { default: 'LiquidGlass' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'expo-blur': { BlurView: 'BlurView' },
    'expo-modules-core': { requireOptionalNativeModule: () => liquidGlass ? { isGlassEffectAPIAvailable: true, isLiquidGlassAvailable: true } : null },
    'expo-glass-effect': { GlassView: 'GlassView' },
    'react-native': {
      Platform: { OS: platform, Version: platform === 'ios' ? '27.0' : 35 },
      View: host('View'), Pressable: host('Pressable'),
      StyleSheet: { create: styles => styles, absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } },
      AccessibilityInfo: {
        isReduceMotionEnabled: async () => reduceMotion,
        isReduceTransparencyEnabled: async () => false,
        addEventListener: (name, callback) => { listeners.set(name, callback); return { remove() { listeners.delete(name); } }; },
      },
      Animated: { Value, View: host('AnimatedView'), spring: (value, config) => ({ start() { animations.push(config); value.setValue(config.toValue); }, stop() {} }) },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 48, bottom: 34, left: 0, right: 0 }) },
    '/ui/Surface': { View: host('View'), Pressable: host('Pressable'), AnimatedView: host('AnimatedView') },
    '/ui/design': { fonts: { text: 'System' }, StyleSheet: { create: styles => styles, absoluteFill: { position: 'absolute', inset: 0 } } },
    '/ui/Text': { Text: 'Text' },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const localRequire = name => {
      for (const [key, value] of Object.entries(mocks)) if (name === key || (key.startsWith('/') && name.endsWith(key))) return value;
      if (name.endsWith('.svg')) return name;
      if (name.endsWith('.css')) return {};
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name);
        return load([target + `.${platform}.tsx`, target + `.${platform}.ts`, target + '.tsx', target + '.ts'].find(fs.existsSync));
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
    return module.exports;
  }
  const { tabs } = load(path.resolve(import.meta.dirname, '../src/navigation/tabs.ts'));
  const { FloatingTabBar } = load(path.resolve(import.meta.dirname, '../src/components/FloatingTabBar.tsx'));
  const routes = tabs.map(tab => ({ key: tab.name, name: tab.name, ...(tab.name === 'Countries' ? { params: { section: 'regions' } } : {}) }));
  const navigation = { emit: event => { events.push(event); return { defaultPrevented: blocked }; }, navigate: (...args) => navigations.push(args) };
  let renderer;
  const render = (index, isFocused = true) => React.createElement(FloatingTabBar, { state: { index, routes }, navigation, isFocused });
  await act(async () => { renderer = TestRenderer.create(render(0)); });
  const node = id => renderer.root.findAll(n => typeof n.type === 'string' && n.props.testID === id)[0];
  return { renderer, tabs, node, navigations, events, animations, listeners, block: value => { blocked = value; }, update: (index, focused) => act(() => renderer.update(render(index, focused))) };
}

test('all five tabs share the updated design and reflect the actual selected route', async () => {
  const app = await mount();
  try {
    for (let selected = 0; selected < app.tabs.length; selected++) {
      await app.update(selected);
      for (const [index, tab] of app.tabs.entries()) {
        const button = app.node('tab-' + tab.testId);
        assert.equal(button.props.accessibilityState.selected, index === selected);
        const icon = button.findByType('Image');
        assert.match(icon.props.source, /assets\/(home-v3|tab-bar-v3)\//);
        assert.equal(icon.props.source, index === selected ? tab.activeIcon : tab.icon);
      }
    }
  } finally { await act(() => app.renderer.unmount()); }
});

test('tab presses keep route params, respect navigation cancellation and preserve long presses', async () => {
  const app = await mount();
  try {
    await act(() => app.node('tab-search').props.onPress());
    assert.equal(app.navigations.length, 0, 'pressing the active tab must not recreate its route');
    await act(() => app.node('tab-countries').props.onPress());
    assert.deepEqual(app.navigations.at(-1), ['Countries', { section: 'regions' }]);
    app.block(true);
    await act(() => app.node('tab-esims').props.onPress());
    assert.equal(app.navigations.length, 1, 'cancelled tabPress must not navigate');
    await act(() => app.node('tab-profile').props.onLongPress());
    assert.deepEqual(app.events.at(-1), { type: 'tabLongPress', target: 'Profile' });
  } finally { await act(() => app.renderer.unmount()); }
});

test('returning from a stack screen does not trigger a false tab-switch animation', async () => {
  const app = await mount();
  try {
    for (const [index, tab] of app.tabs.entries()) {
      await act(() => app.node('tab-' + tab.testId).props.onLayout({ nativeEvent: { layout: { x: 6 + index * 68, width: 66, height: 52 } } }));
    }
    assert.equal(app.animations.length, 0);
    await app.update(1);
    assert.equal(app.animations.length, 1);
    assert.equal(app.animations[0].useNativeDriver, false, 'web uses its JS animation driver');
    assert.ok(app.animations[0].stiffness > 0 && app.animations[0].damping > 0);
    await app.update(1, false);
    await app.update(1, true);
    assert.equal(app.animations.length, 1);
  } finally { await act(() => app.renderer.unmount()); }
});

test('Reduce Motion keeps selection changes immediate and never starts a spring', async () => {
  const app = await mount({ reduceMotion: true });
  try {
    for (const [index, tab] of app.tabs.entries()) {
      await act(() => app.node('tab-' + tab.testId).props.onLayout({ nativeEvent: { layout: { x: 6 + index * 66, width: 64, height: 52 } } }));
    }
    await app.update(4);
    assert.equal(app.animations.length, 0);
    const indicator = app.node('tab-active-background');
    assert.equal(indicator.props.style[1].transform[0].translateX.value, 270);
    assert.equal(typeof indicator.props.style[1].width, 'number');
  } finally { await act(() => app.renderer.unmount()); }
});

test('iOS uses the shared tab icons and keeps native glass and spring transitions', async () => {
  const app = await mount({ platform: 'ios', liquidGlass: true });
  try {
    assert.equal(app.renderer.root.findByType('GlassView').props.glassEffectStyle, 'regular');
    for (const [index, tab] of app.tabs.entries()) {
      assert.equal(app.node('tab-' + tab.testId).findByType('Image').props.source,
        index === 0 ? tab.activeIcon : tab.icon);
    }
    for (const [index, tab] of app.tabs.entries()) {
      await act(() => app.node('tab-' + tab.testId).props.onLayout({ nativeEvent: { layout: { x: 6 + index * 66, width: 64, height: 52 } } }));
    }
    await app.update(1);
    assert.equal(app.animations[0].useNativeDriver, true, 'iOS runs the spring on the native driver');
    assert.ok(app.node('tab-selection-blur'));
    await act(() => app.listeners.get('reduceTransparencyChanged')(true));
    assert.equal(app.renderer.root.findAllByType('GlassView').length, 0);
    assert.ok(app.node('tab-material-opaque'));
    assert.ok(app.node('tab-selection-opaque'));
  } finally { await act(() => app.renderer.unmount()); }
  assert.equal(app.listeners.size, 0);
});

test('iOS without native glass uses blur and the shared tab icons', async () => {
  const app = await mount({ platform: 'ios' });
  try {
    assert.equal(app.renderer.root.findByType('BlurView').props.tint, 'systemUltraThinMaterialDark');
    assert.equal(app.node('tab-esims').findByType('Image').props.source, app.tabs[2].icon);
    await app.update(2);
    assert.equal(app.node('tab-esims').findByType('Image').props.source, app.tabs[2].activeIcon);
  } finally { await act(() => app.renderer.unmount()); }
});
