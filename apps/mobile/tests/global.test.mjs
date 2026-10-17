import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getGlobalBundle } from '../src/catalog/global.ts';
import { getTariffHeading } from '../src/tariffs/countryTitle.ts';
import { getDefaultDuration, getDefaultTariff, getTariffsForDuration } from '../src/tariffs/tariffs.ts';

const bundle = (id, code, name) => ({ id, country_iso2: code, display_name: name, image_url: null, min_price_amount: 3939, min_price_currency: 'RUB' });

test('world tab uses the XG ID from any catalog category', () => {
  const global = bundle('global-sdk-id', 'XG', 'Глобальный пакет');
  assert.equal(getGlobalBundle([{ title: 'Азия', esims: [bundle('ae', 'AE', 'ОАЭ')] }, { title: 'Популярное', esims: [global] }]), global);
});

test('missing global bundle never falls back to a country or a region', () => {
  assert.equal(getGlobalBundle([{ title: 'Европа', esims: [bundle('eu', 'XE', 'Европа'), bundle('fr', 'FR', 'Франция')] }]), null);
  assert.equal(getGlobalBundle([]), null);
});

test('global heading describes the world without declining the package name', () => {
  assert.deepEqual(getTariffHeading(bundle('world', 'XG', 'Глобальный пакет')), { prefix: 'Интернет во', label: 'всём мире' });
  assert.deepEqual(getTariffHeading(bundle('tr', 'TR', 'Турция')), { prefix: 'Интернет в', label: 'Турции' });
});

test('global plans use only actual durations and choose the matching package', () => {
  const plans = [30, 90, 180, 365].map((days, i) => ({
    id: `world-${days}`, display_name: `Глобальный пакет ${days} дней`,
    price_amount_minor: [3939, 6499, 10049, 19489][i], price_currency: 'RUB',
    data_amount: { amount: [10, 20, 40, 80][i], unit: 'GB' }, duration: { amount: days, unit: 'day' },
    is_profitable_badge: false, is_unlimited: false,
  }));
  const initial = getTariffsForDuration(plans, getDefaultDuration(plans));
  assert.equal(getDefaultTariff(initial).id, 'world-30');
  assert.equal(getDefaultTariff(initial).price_amount_minor, 3939);
  const annual = getTariffsForDuration(plans, 'day:365');
  assert.equal(getDefaultTariff(annual).data_amount.amount, 80);
  assert.equal(getDefaultTariff(annual).price_amount_minor, 19489);
  assert.deepEqual(getTariffsForDuration(plans, 'day:15'), []);
});
