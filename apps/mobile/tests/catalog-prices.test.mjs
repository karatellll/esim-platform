import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatCatalogPrice, getCatalogPrice, getMinimumCatalogPrice } from '../src/catalog/prices.ts';

const esim = (amount, currency = 'RUB') => ({ min_price_amount: amount, min_price_currency: currency });

test('SDK amount is displayed directly with its currency', () => {
  assert.equal(formatCatalogPrice(getCatalogPrice(esim(199))).replace(/\s/g, ' '), 'от 199 ₽');
  assert.match(formatCatalogPrice(getCatalogPrice(esim(199, 'USD'))), /199/);
  assert.doesNotMatch(formatCatalogPrice(getCatalogPrice(esim(199, 'USD'))), /₽/);
});

test('zero is a valid minimum price', () => {
  assert.equal(formatCatalogPrice(getCatalogPrice(esim(0))).replace(/\s/g, ' '), 'от 0 ₽');
});

test('absent or malformed amounts never become a zero price', () => {
  for (const amount of [null, undefined, NaN, Infinity, -1, '199', true, 1.5]) {
    assert.equal(getCatalogPrice(esim(amount)), null);
  }
  assert.equal(formatCatalogPrice(null), '—');
});

test('price requires a currency', () => {
  for (const currency of [null, undefined, '', 'rub', 'invalid']) {
    assert.equal(getCatalogPrice({ min_price_amount: 199, min_price_currency: currency }), null);
  }
});

test('category minimum comes from priced destinations including regional bundles', () => {
  assert.deepEqual(getMinimumCatalogPrice([esim(399), esim(null), esim(199), esim(309)]), { amount: 199, currency: 'RUB' });
  assert.deepEqual(getMinimumCatalogPrice([esim(399), esim(0)]), { amount: 0, currency: 'RUB' });
});

test('amounts in different currencies are never compared', () => {
  assert.equal(getMinimumCatalogPrice([esim(399), esim(5, 'USD')]), null);
});

test('category with no prices has no invented price', () => {
  assert.equal(getMinimumCatalogPrice([]), null);
  assert.equal(getMinimumCatalogPrice([esim(null)]), null);
});
