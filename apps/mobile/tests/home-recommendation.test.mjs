import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTripPreferences, recommendTariff } from '../src/home/recommendation.ts';

const plan = (id, gb, days, price, currency = 'RUB') => ({
  id, display_name: id, data_amount: { amount: gb, unit: 'GB' },
  duration: { amount: days, unit: 'day' }, price_amount_minor: price,
  price_currency: currency, is_unlimited: false, is_profitable_badge: false,
});

test('two weeks estimates 7GB, not 8GB, for the three selected uses in Figma', () => {
  assert.deepEqual(getTripPreferences(15, 0.5 + 0.5 + 2), { preferredDurationDays: 15, preferredDataGb: 7 });
});

test('optional preferences stay optional; usage alone uses a two-week trip', () => {
  assert.deepEqual(getTripPreferences(null, null), { preferredDurationDays: undefined, preferredDataGb: undefined });
  assert.deepEqual(getTripPreferences(null, 3), { preferredDurationDays: 15, preferredDataGb: 7 });
  assert.deepEqual(getTripPreferences(7, null), { preferredDurationDays: 7, preferredDataGb: undefined });
});

test('recommendation selects a real package satisfying both duration and volume', () => {
  const plans = [plan('too-short', 10, 7, 200), plan('too-small', 5, 15, 300), plan('match', 10, 15, 900), plan('larger', 20, 30, 1200)];
  assert.equal(recommendTariff(plans, getTripPreferences(15, 3))?.id, 'match');
  assert.equal(recommendTariff(plans, getTripPreferences(30, 5)), null);
});

test('no invented recommendation when there is no matching package or mixed currencies', () => {
  assert.equal(recommendTariff([], getTripPreferences(15, 3)), null);
  assert.equal(recommendTariff([plan('ruble', 10, 15, 900), plan('dollar', 10, 15, 10, 'USD')], getTripPreferences(15, 3)), null);
});

test('monthly estimates include the full month and the spare gigabyte', () => {
  assert.equal(getTripPreferences(30, 3).preferredDataGb, 14);
  assert.equal(getTripPreferences(7, 1).preferredDataGb, 2);
});
