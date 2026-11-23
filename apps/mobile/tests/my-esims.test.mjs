import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elapsedDuration, groupOrders, historyMonth } from '../src/orders/myEsims.ts';

const now = Date.parse('2026-11-22T12:00:00Z');
const order = (id, esim_status, fields = {}) => ({
  id, state: 'delivered', esim_status, created_at: '2026-07-01T12:00:00Z',
  tariff: { duration: { amount: 15, unit: 'day' } },
  ...fields,
});

test('eSIM groups follow delivery, activation, expiration and usage states', () => {
  const orders = [
    order('active', 'active'),
    order('activated', 'activated'),
    order('issued', 'issued'),
    order('null-status', null),
    order('installed', 'installed'),
    order('depleted', 'depleted', { activated_at: '2026-07-10T12:00:00Z' }),
    order('expired', 'expired', { activated_at: '2026-08-10T12:00:00Z' }),
    order('payment', null, { state: 'pending_payment' }),
    order('unknown', 'unrecognized'),
  ];
  const grouped = groupOrders(orders, now);
  assert.deepEqual(grouped.active.map(o => o.id), ['active', 'activated']);
  assert.deepEqual(grouped.waiting.map(o => o.id), ['issued', 'null-status', 'installed']);
  assert.deepEqual(grouped.history.map(o => o.id), ['expired', 'depleted']);
  assert.deepEqual(grouped.other.map(o => o.id), ['payment', 'unknown']);
  const activated = { ...orders[2], esim_status: 'activated' };
  assert.equal(groupOrders([activated], now).active[0].id, 'issued');
});

test('the duration ring and archive month use observed timestamps', () => {
  const active = order('active', 'active', {
    activated_at: '2026-11-17T12:00:00Z',
    expires_at: '2026-12-02T12:00:00Z',
  });
  assert.deepEqual(elapsedDuration(active, now), { ratio: 1 / 3, days: 5 });
  assert.equal(elapsedDuration(order('no-date', 'active'), now), null);
  assert.equal(historyMonth(order('old', 'expired', { activated_at: '2026-08-04T10:00:00Z' })), 'авг 2026');
  assert.equal(historyMonth(order('unknown-date', 'expired')), null);
  assert.equal(groupOrders([{ ...active, expires_at: '2026-11-21T12:00:00Z' }], now).history.length, 1);
});
