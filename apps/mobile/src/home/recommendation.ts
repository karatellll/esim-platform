import type { CatalogTariff } from '../../../../packages/shared/contracts/catalog';

export type TripPreferences = { preferredDurationDays?: number; preferredDataGb?: number };

export function tariffDays(tariff: CatalogTariff): number | null {
  const unit = tariff.duration.unit.toLowerCase();
  const scale = ({ day: 1, days: 1, hour: 1 / 24, hours: 1 / 24, week: 7, weeks: 7, month: 30, months: 30 } as Record<string, number>)[unit];
  return scale && tariff.duration.amount > 0 ? tariff.duration.amount * scale : null;
}

export function tariffGigabytes(tariff: CatalogTariff): number | null {
  if (tariff.is_unlimited) return Infinity;
  const scale = ({ MB: 0.001, GB: 1, TB: 1000 } as Record<string, number>)[tariff.data_amount.unit.toUpperCase()];
  return scale && tariff.data_amount.amount > 0 ? tariff.data_amount.amount * scale : null;
}

// A local rule, not an AI response: match both limits, then prefer the lowest
// price in one currency. Never compare monetary amounts across currencies.
export function recommendTariff(tariffs: readonly CatalogTariff[], preferences: TripPreferences): CatalogTariff | null {
  const { preferredDurationDays: days, preferredDataGb: gigabytes } = preferences;
  if (!days && !gigabytes) return null;
  const matches = tariffs.filter((tariff) => {
    const duration = tariffDays(tariff);
    const volume = tariffGigabytes(tariff);
    return (!days || (duration !== null && duration >= days))
      && (!gigabytes || (volume !== null && volume >= gigabytes));
  });
  if (!matches.length) return null;
  const currency = matches[0].price_currency;
  if (matches.some((tariff) => tariff.price_currency !== currency)) return null;
  return [...matches].sort((a, b) => a.price_amount_minor - b.price_amount_minor
    || (tariffGigabytes(a) ?? Infinity) - (tariffGigabytes(b) ?? Infinity))[0];
}

export function getPricePerGigabyte(tariffs: readonly CatalogTariff[]): { amount: number; currency: string } | null {
  const prices = tariffs.flatMap((tariff) => {
    const gb = tariffGigabytes(tariff);
    return gb && Number.isFinite(gb) ? [{ amount: tariff.price_amount_minor / gb, currency: tariff.price_currency }] : [];
  });
  if (!prices.length || prices.some((price) => price.currency !== prices[0].currency)) return null;
  return prices.reduce((lowest, price) => price.amount < lowest.amount ? price : lowest);
}
