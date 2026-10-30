import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appleInstallationUrl, manualDetails, supportsQuickInstall, trafficDisplay } from '../src/orders/installation.ts';

const order = (extra = {}) => ({ state: 'delivered', payment: { state: 'captured' },
  tariff: { data_amount: { amount: 5, unit: 'GB' } }, remaining: null, items: [{ display_name: '5 ГБ' }],
  provision: { activation_code: 'LPA:1$smdp.example$TEST-CODE', smdp_address: '', matching_id: '' }, ...extra });

test('manual activation uses Matching ID rather than the whole LPA string', () => {
  assert.deepEqual(manualDetails(order()), { address: 'smdp.example', matchingId: 'TEST-CODE', lpa: 'LPA:1$smdp.example$TEST-CODE' });
  assert.equal(manualDetails(order({ provision: { activation_code: 'LPA:1$old.example$OLD', smdp_address: 'actual.example', matching_id: 'ACTUAL' } })).matchingId, 'ACTUAL');
  assert.equal(manualDetails(order({ provision: null })).matchingId, '');
});

test('quick install passes the complete activation data to the fixed Apple host', () => {
  const url = new URL(appleInstallationUrl(order()));
  assert.equal(url.hostname, 'esimsetup.apple.com');
  assert.equal(url.searchParams.get('carddata'), 'LPA:1$smdp.example$TEST-CODE');
  assert.equal(appleInstallationUrl(order({ state: 'pending_payment' })), null);
  assert.equal(appleInstallationUrl(order({ payment: { state: 'refunded' } })), null);
  assert.equal(appleInstallationUrl(order({ provision: { activation_code: 'https://foreign.example' } })), null);
  assert.equal(appleInstallationUrl(order({ provision: { activation_code: 'LPA:1$host.example$bad\ncode' } })), null);
});

test('quick install is offered only to a supported iPhone', () => {
  assert.equal(supportsQuickInstall('ios', '17.4'), true);
  assert.equal(supportsQuickInstall('ios', '17.3'), false);
  assert.equal(supportsQuickInstall('ios', '18.0', '', true), false);
  assert.equal(supportsQuickInstall('android', 35), false);
  assert.equal(supportsQuickInstall('web', 0, 'Mozilla iPhone CPU iPhone OS 17_4 like Mac OS X'), true);
  assert.equal(supportsQuickInstall('web', 0, 'Mozilla Windows NT Chrome'), false);
});

test('missing usage is explicitly unknown, while observed zero is exhausted', () => {
  const unknown = trafficDisplay(order());
  assert.equal(unknown.observed, false);
  assert.equal(unknown.legend, 'Остаток уточняется');
  const empty = trafficDisplay(order({ remaining: { amount: 0, unit: 'GB' } }));
  assert.equal(empty.observed, true);
  assert.equal(empty.amount, '0');
  assert.equal(empty.ratio, 0);
});

test('traffic ring compares compatible units and clamps only its visual fraction', () => {
  const half = trafficDisplay(order({ remaining: { amount: 2500, unit: 'MB' } }));
  assert.equal(half.ratio, 0.5);
  assert.equal(half.legend, '2,5 из 5 ГБ');
  assert.equal(trafficDisplay(order({ remaining: { amount: 8, unit: 'GB' } })).ratio, 1);
  assert.equal(trafficDisplay(order({ remaining: { amount: 10, unit: 'unknown' } })).observed, false);
});
