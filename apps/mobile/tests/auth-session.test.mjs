import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

class AuthApiError extends Error {
  constructor(status, code) {
    super('Не удалось восстановить вход');
    this.status = status;
    this.code = code;
  }
}

const session = { user: { id: 'user-id' }, access_token: 'access', refresh_token: 'next', expires_in: 900 };

async function mount({ refreshAuth, saveRefreshToken }) {
  let auth;
  let onAppState;
  const confirmed = [];
  const appState = { currentState: 'active', addEventListener(_event, callback) {
    onAppState = callback;
    return { remove() { onAppState = undefined; } };
  } };
  const mocks = {
    react: React,
    'react/jsx-runtime': await import('react/jsx-runtime'),
    'react-native': { AppState: appState },
    '../api/auth': { AuthApiError, refreshAuth, sessionClient: 'native', confirmNativeRefresh: async token => { confirmed.push(token); } },
    './sessionStorage': { loadOfflineUser: async () => session.user.id, loadRefreshToken: async () => 'saved', saveRefreshToken, saveOfflineUser: async () => {} },
    './unauthorized': { onUnauthorized: () => () => {} },
    '../orders/offlineOrders': {},
  };
  const source = readFileSync(new URL('../src/auth/AuthProvider.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => mocks[name], module, module.exports);
  const { AuthProvider, useAuth } = module.exports;
  function Account() { auth = useAuth(); return null; }
  let screen;
  await act(async () => { screen = TestRenderer.create(React.createElement(AuthProvider, null, React.createElement(Account))); });
  return { auth: () => auth, confirmed, activate: () => act(() => onAppState?.('active')), close: () => act(() => screen.unmount()) };
}

test('native refresh confirms the successor after SecureStore writes it and skips a second refresh on resume', async () => {
  let release;
  const saved = new Promise(resolve => { release = resolve; });
  const calls = [];
  const app = await mount({ refreshAuth: async token => { calls.push(token); return session; }, saveRefreshToken: () => saved });
  try {
    assert.deepEqual(calls, ['saved']);
    assert.deepEqual(app.confirmed, []);
    await act(async () => { release(); });
    assert.deepEqual(app.confirmed, ['next']);
    assert.equal(app.auth().user.id, session.user.id);
    await app.activate();
    assert.deepEqual(calls, ['saved']);
  } finally { await app.close(); }
});

test('an authentication error without confirmed expiry preserves the current account', async () => {
  let error;
  const writes = [];
  const app = await mount({ refreshAuth: async () => { if (error) throw error; return session; }, saveRefreshToken: async token => { writes.push(token); } });
  try {
    error = new AuthApiError(401);
    await act(async () => { await assert.rejects(app.auth().retryRestore(), error); });
    assert.equal(app.auth().user.id, session.user.id);
    assert.deepEqual(writes, ['next']);
    error = new AuthApiError(401, 'session_expired');
    await act(() => app.auth().retryRestore());
    assert.equal(app.auth().user, null);
    assert.equal(app.auth().expired, true);
    assert.deepEqual(writes, ['next', null]);
  } finally { await app.close(); }
});
