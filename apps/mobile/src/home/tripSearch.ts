import type { CatalogCategory, CatalogEsim, CatalogTariff } from '../../../../packages/shared/contracts/catalog';
import { getGlobalBundle } from '../catalog/global';
import { getRegionBundle } from '../catalog/regions';
import { getTripPreferences, recommendTariff, tariffDays, tariffGigabytes } from './recommendation';
import { isCountry } from './smartSearch';

export type TripDestination =
  | { kind: 'countries'; countries: readonly CatalogEsim[] }
  | { kind: 'region'; category: CatalogCategory; esim: CatalogEsim }
  | { kind: 'world'; esim: CatalogEsim };

export type TripTarget = Exclude<TripDestination, { kind: 'countries' }> | { kind: 'country'; esim: CatalogEsim };
export type TripOffer = { target: TripTarget; tariff: CatalogTariff; recommended: boolean };

export function regionCountryCodes(category: CatalogCategory) {
  return new Set(category.esims.filter(isCountry).map(country => country.country_iso2!.toUpperCase()));
}

export function getTripTargets(destination: TripDestination | null, categories: readonly CatalogCategory[]): TripTarget[] {
  if (!destination) return [];
  if (destination.kind !== 'countries') return [destination];

  const { countries } = destination;
  const individual = countries.map(esim => ({ kind: 'country' as const, esim }));
  if (countries.length < 2) return individual;

  const regions = categories.flatMap(category => {
    const esim = getRegionBundle(category);
    const codes = regionCountryCodes(category);
    return esim && countries.every(country => codes.has(country.country_iso2?.toUpperCase() ?? ''))
      ? [{ kind: 'region' as const, category, esim }] : [];
  });
  const world = getGlobalBundle(categories);
  return [...new Map(regions.map(target => [target.esim.id, target])).values(),
    ...(world ? [{ kind: 'world' as const, esim: world }] : []), ...individual];
}

export function getTripDurations(tariffs: readonly CatalogTariff[]): number[] {
  return [...new Set(tariffs.map(tariffDays).filter(days => days !== null))].sort((a, b) => a - b);
}

const volume = (tariff: CatalogTariff) => tariffGigabytes(tariff) ?? 0;
const comparePrice = (a: CatalogTariff, b: CatalogTariff) =>
  a.price_currency.localeCompare(b.price_currency) || a.price_amount_minor - b.price_amount_minor;

export function getTripPackages(tariffs: readonly CatalogTariff[], requestedDays: number, weeklyGb: number, exact: boolean) {
  const durations = getTripDurations(tariffs).filter(duration => exact ? duration === requestedDays : duration >= requestedDays);
  const preferences = exact
    ? { preferredDurationDays: requestedDays, preferredDataGb: Math.ceil(requestedDays / 7 * weeklyGb + 1) }
    : getTripPreferences(requestedDays, weeklyGb);
  const preferredGb = preferences.preferredDataGb ?? 0;
  const days = durations.find(duration => tariffs.some(tariff => tariffDays(tariff) === duration && volume(tariff) >= preferredGb))
    ?? durations[0];
  if (days === undefined) return { packages: [], fits: false };

  const byVolume = new Map<number, CatalogTariff>();
  for (const tariff of tariffs.filter(item => tariffDays(item) === days).sort(comparePrice)) {
    const gb = volume(tariff);
    if (!byVolume.has(gb)) byVolume.set(gb, tariff);
  }

  const options = [...byVolume.values()];
  const sorted = [...options].sort((a, b) => volume(a) - volume(b));
  const best = recommendTariff(options, preferences)
    ?? sorted.find(item => volume(item) >= preferredGb)
    ?? sorted.at(-1)!;
  const upgrades = sorted.filter(item => item !== best && !item.is_unlimited && volume(item) > volume(best));
  const unlimited = sorted.find(item => item !== best && item.is_unlimited);
  const alternatives = [...upgrades.slice(0, unlimited ? 1 : 2), ...(unlimited ? [unlimited] : [])];
  const smaller = sorted.filter(item => item !== best && !alternatives.includes(item) && volume(item) < volume(best)).reverse();
  return {
    packages: [best, ...alternatives, ...smaller].slice(0, 3),
    fits: volume(best) >= preferredGb,
  };
}

export function findBestBundle(offers: readonly TripOffer[]) {
  if (offers.length < 2) return null;
  return offers.find(offer => offers.every(other => offer === other
    || (offer.tariff.price_currency === other.tariff.price_currency
      && tariffDays(offer.tariff) === tariffDays(other.tariff)
      && volume(offer.tariff) >= volume(other.tariff)
      && offer.tariff.price_amount_minor < other.tariff.price_amount_minor))) ?? null;
}
