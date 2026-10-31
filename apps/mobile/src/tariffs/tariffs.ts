import type { CatalogTariff } from '../../../../packages/shared/contracts/catalog';

export type Duration = CatalogTariff['duration'];
export const durationKey = (duration: Duration): string => `${duration.unit}:${duration.amount}`;

function plural(amount: number, one: string, few: string, many: string): string {
  const value = Math.abs(amount) % 100;
  const last = value % 10;
  return value >= 11 && value <= 14 ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many;
}

export function formatDuration(duration: Duration): string {
  const labels: Record<string, [string, string, string]> = {
    day: ['день', 'дня', 'дней'], days: ['день', 'дня', 'дней'],
    hour: ['час', 'часа', 'часов'], hours: ['час', 'часа', 'часов'],
    week: ['неделя', 'недели', 'недель'], month: ['месяц', 'месяца', 'месяцев'],
  };
  const forms = labels[duration.unit.toLowerCase()];
  return `${duration.amount} ${forms ? plural(duration.amount, ...forms) : duration.unit}`;
}

export function getDurations(tariffs: readonly CatalogTariff[]): Duration[] {
  const durations = new Map(tariffs.map((tariff) => [durationKey(tariff.duration), tariff.duration]));
  const weights: Record<string, number> = { hour: 1, hours: 1, day: 24, days: 24, week: 168, month: 720 };
  return [...durations.values()].sort((a, b) => (weights[a.unit] ?? Infinity) * a.amount - (weights[b.unit] ?? Infinity) * b.amount || a.unit.localeCompare(b.unit));
}

export function getDefaultDuration(tariffs: readonly CatalogTariff[]): string | null {
  const durations = getDurations(tariffs);
  const preferred = durations.find((duration) => duration.amount === 15 && ['day', 'days'].includes(duration.unit));
  return preferred ? durationKey(preferred) : durations[0] ? durationKey(durations[0]) : null;
}

function volume(tariff: CatalogTariff): number {
  if (tariff.is_unlimited) return Infinity;
  const multipliers: Record<string, number> = { MB: 1, GB: 1000, TB: 1_000_000 };
  return tariff.data_amount.amount * (multipliers[tariff.data_amount.unit.toUpperCase()] ?? 1);
}

// Compare the cost per GB with the smallest package for the same duration and
// currency. This is volume savings, never a checkout promotion or crossed price.
export function getTariffSavings(tariff: CatalogTariff, tariffs: readonly CatalogTariff[]): number | null {
  const knownVolume = (item: CatalogTariff) => !item.is_unlimited
    && ['MB', 'GB', 'TB'].includes(item.data_amount.unit.toUpperCase())
    && item.data_amount.amount > 0 && Number.isFinite(item.price_amount_minor) && item.price_amount_minor > 0;
  if (!knownVolume(tariff)) return null;
  const comparable = tariffs.filter(item => knownVolume(item) && item.price_currency === tariff.price_currency && durationKey(item.duration) === durationKey(tariff.duration))
    .sort((a, b) => volume(a) - volume(b) || a.price_amount_minor - b.price_amount_minor);
  const base = comparable[0];
  if (!base || volume(tariff) <= volume(base)) return null;
  const savings = Math.round((1 - (tariff.price_amount_minor / volume(tariff)) / (base.price_amount_minor / volume(base))) * 100);
  return savings > 0 && savings < 100 ? savings : null;
}

export function getTariffsForDuration(tariffs: readonly CatalogTariff[], key: string | null): CatalogTariff[] {
  return tariffs.filter((tariff) => durationKey(tariff.duration) === key)
    .sort((a, b) => volume(a) - volume(b) || a.price_currency.localeCompare(b.price_currency) || a.price_amount_minor - b.price_amount_minor);
}

export function getDefaultTariff(tariffs: readonly CatalogTariff[]): CatalogTariff | null {
  return tariffs.find((tariff) => tariff.is_profitable_badge)
    ?? tariffs.find((tariff) => !tariff.is_unlimited && volume(tariff) === 5000)
    ?? tariffs[0] ?? null;
}

export function formatDataAmount(tariff: CatalogTariff): string {
  if (tariff.is_unlimited) return 'Безлимит';
  const unit = ({ MB: 'МБ', GB: 'ГБ', TB: 'ТБ' } as Record<string, string>)[tariff.data_amount.unit.toUpperCase()] ?? tariff.data_amount.unit;
  if (tariff.data_amount.amount === 0) return tariff.display_name;
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(tariff.data_amount.amount)} ${unit}`;
}

export function formatTariffPrice(tariff: CatalogTariff): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: tariff.price_currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(tariff.price_amount_minor);
}
