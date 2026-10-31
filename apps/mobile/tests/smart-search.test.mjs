import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planTrip, searchCountries, searchableCountries, toggleTripCountry, findRegions } from '../src/home/smartSearch.ts';
import { getTripPreferences, recommendTariff } from '../src/home/recommendation.ts';
const esim = (code, price = 100, name = code) => ({ id: code, country_iso2: code, display_name: name, min_price_amount: price, min_price_currency: 'RUB', image_url: null });
const [it, fr, es, de, be, th, us, tr] = ['IT','FR','ES','DE','BE','TH','US','TR'].map(code => esim(code));
const europe = { title: 'Европа', esims: [it, fr, es, de, be, esim('XE', 700, 'Европа (регион)')] };
const asia = { title: 'Азия', esims: [th, tr, esim('XA', 400, 'Азия (регион)')] };
const world = { title: 'Весь мир', esims: [esim('XG', 1500)] };
const categories = [europe, asia, world];

test('one country always selects its standalone tariff', () => assert.equal(planTrip([it], categories).primary.esim.id, 'IT'));
test('same region takes priority over cheaper separate eSIMs', () => {
 const result = planTrip([it, fr, es], categories);
 assert.equal(result.primary.esim.id, 'XE');
 assert.equal(result.alternative.length, 3);
 assert.equal(result.separateMoreExpensive, false);
});
test('five countries in one region still select a single regional eSIM', () => assert.equal(planTrip([it, fr, es, de, be], categories).primary.esim.id, 'XE'));
for (const codes of [[it,fr,es,th], [it,fr,th,tr,us], [it,th,us]]) {
 test(`mixed route ${codes.map(c => c.id)} selects world`, () => assert.equal(planTrip(codes, categories).primary.esim.id, 'XG'));
}
test('removing an outlier immediately changes world to Europe', () => {
 assert.equal(planTrip([it,fr,th],categories).primary.esim.id,'XG');
 assert.equal(planTrip(toggleTripCountry([it,fr,th],th),categories).primary.esim.id,'XE');
});
test('a region plus a single can be the cheapest alternative', () => {
 const cheapEurope = { ...europe, esims: europe.esims.map(e => e.id === 'XE' ? { ...e, min_price_amount: 150 } : e) };
 const result = planTrip([it,fr,es,th], [cheapEurope,asia,world]);
 assert.equal(result.alternative.length,2);
 assert.deepEqual(result.alternative.map(item => item.esim.id), ['XE','TH']);
});
test('more expensive separate plans are a sentence, not an alternative', () => {
 const cheapEurope = { ...europe, esims: europe.esims.map(e => e.id === 'XE' ? { ...e, min_price_amount: 90 } : e) };
 const result = planTrip([it,fr], [cheapEurope]);
 assert.equal(result.alternative,null); assert.equal(result.separateMoreExpensive,true);
});
test('ties between overlapping regions use price', () => {
 const bothA = { title:'Первый', esims:[it,tr,esim('XE',500)] };
 const bothB = { title:'Второй', esims:[it,tr,esim('XA',200)] };
 assert.equal(planTrip([it,tr],[bothA,bothB]).primary.esim.id,'XA');
});
test('sixth selection is refused, removal at the limit works', () => {
 const five=[it,fr,es,de,be]; assert.equal(toggleTripCountry(five,th).length,5);
 assert.equal(toggleTripCountry(five,it).length,4);
});
test('Russia and unsupported countries do not affect the usable itinerary', () => {
 const result=planTrip([it,fr,esim('RU'),{...esim('KP'),id:'unavailable:KP'}],categories);
 assert.equal(result.primary.esim.id,'XE'); assert.equal(result.ignored.length,2);
});
const supported=[esim('TR',100,'Турция'),esim('GB',100,'Великобритания'),esim('AE',100,'ОАЭ'),esim('TH',100,'Таиланд')];
for (const [query, code] of [['турц','TR'],['турцыя','TR'],['Туриця','TR'],['Англия','GB'],['Эмираты','AE'],['Пхукет','TH'],['nehwbz','TR'],['Turkey','TR'],['UAE','AE'],['Thailand','TH']]) {
 test(`search ${query} maps to ${code}`, () => assert.ok(searchCountries(supported,query).some(match => match.country.country_iso2 === code)));
}
test('known unsupported countries differ from nonsense', () => {
 const all=searchableCountries(supported);
 assert.equal(searchCountries(all,'Северная Корея')[0].country.id,'unavailable:KP');
 assert.deepEqual(searchCountries(all,'абракадабра123'),[]);
});
test('regions are selected as a whole', () => assert.equal(findRegions(categories,'Europe')[0].title,'Европа'));
test('more than a month selects a 30 day package', () => assert.equal(getTripPreferences(31,3).preferredDurationDays,30));
test('heavy use prefers an available unlimited plan', () => {
 const tariff=(id,unlimited,price)=>({id,display_name:id,is_unlimited:unlimited,price_amount_minor:price,price_currency:'RUB',duration:{amount:30,unit:'day'},data_amount:{amount:100,unit:'GB'}});
 assert.equal(recommendTariff([tariff('limited',false,200),tariff('unlimited',true,900)],{preferredDurationDays:30,preferredDataGb:30,preferUnlimited:true}).id,'unlimited');
});
