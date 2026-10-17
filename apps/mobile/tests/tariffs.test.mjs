import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countryLocative, countryPreposition } from '../src/tariffs/countryTitle.ts';
import { durationKey, formatDataAmount, formatDuration, formatTariffPrice, getDefaultDuration, getDefaultTariff, getDurations, getTariffsForDuration } from '../src/tariffs/tariffs.ts';

const plan = (id, amount, days, price = 199, extra = {}) => ({
  id, display_name: id, data_amount: { amount, unit: 'GB' }, duration: { amount: days, unit: 'day' },
  price_amount_minor: price, price_currency: 'RUB', is_profitable_badge: false, is_unlimited: false, ...extra,
});

test('duration options come only from actual plans, sorted and deduplicated', () => {
  const plans = [plan('a', 1, 30), plan('b', 5, 15), plan('c', 10, 15), plan('d', 1, 1)];
  assert.deepEqual(getDurations(plans).map(durationKey), ['day:1', 'day:15', 'day:30']);
  assert.equal(getDefaultDuration(plans), 'day:15');
  assert.equal(getDefaultDuration([plan('one', 1, 7)]), 'day:7');
  assert.equal(getDefaultDuration([]), null);
});

test('switching duration excludes every plan from the previous duration', () => {
  const plans = [plan('7days', 1, 7), plan('5gb', 5, 15), plan('1gb', 1, 15), plan('unlimited', 0, 15, 999, { is_unlimited: true })];
  assert.deepEqual(getTariffsForDuration(plans, 'day:15').map((item) => item.id), ['1gb', '5gb', 'unlimited']);
  assert.deepEqual(getTariffsForDuration(plans, 'day:7').map((item) => item.id), ['7days']);
});

test('default selection uses an API badge, then 5GB, then an existing plan', () => {
  const plans = [plan('1gb', 1, 15), plan('5gb', 5, 15), plan('profitable', 10, 15, 599, { is_profitable_badge: true })];
  assert.equal(getDefaultTariff(plans).id, 'profitable');
  assert.equal(getDefaultTariff(plans.slice(0, 2)).id, '5gb');
  assert.equal(getDefaultTariff(plans.slice(0, 1)).id, '1gb');
  assert.equal(getDefaultTariff([]), null);
});

test('allowance labels handle megabytes, gigabytes and explicit unlimited', () => {
  assert.equal(formatDataAmount(plan('one', 1, 7)), '1 ГБ');
  assert.equal(formatDataAmount(plan('half', 0.5, 1)), '0,5 ГБ');
  assert.equal(formatDataAmount(plan('mb', 500, 1, 199, { data_amount: { amount: 500, unit: 'MB' } })), '500 МБ');
  assert.equal(formatDataAmount(plan('unlimited', 0, 15, 199, { is_unlimited: true })), 'Безлимит');
  assert.equal(formatDataAmount(plan('unknown allowance', 0, 15)), 'unknown allowance');
});

test('durations use Russian plural forms and preserve units', () => {
  assert.equal(formatDuration({ amount: 1, unit: 'day' }), '1 день');
  assert.equal(formatDuration({ amount: 3, unit: 'day' }), '3 дня');
  assert.equal(formatDuration({ amount: 15, unit: 'day' }), '15 дней');
  assert.equal(formatDuration({ amount: 24, unit: 'hour' }), '24 часа');
});

test('selected plan price uses its own currency and catalog scale', () => {
  assert.equal(formatTariffPrice(plan('a', 5, 15, 1169)).replace(/\s/g, ' '), '1 169 ₽');
  assert.doesNotMatch(formatTariffPrice(plan('a', 1, 1, 10, { price_currency: 'USD' })), /₽/);
});

test('country heading adapts to Turkey, compounds and indeclinable names', () => {
  assert.equal(countryLocative('Турция'), 'Турции');
  assert.equal(countryLocative('Южная Корея'), 'Южной Корее');
  assert.equal(countryLocative('ОАЭ'), 'ОАЭ');
  assert.equal(countryLocative('Перу'), 'Перу');
  assert.equal(countryLocative('Новая Зеландия'), 'Новой Зеландии');
  assert.equal(countryPreposition('TR'), 'в');
  assert.equal(countryPreposition('FR'), 'во');
  assert.equal(countryPreposition('CY'), 'на');
});
