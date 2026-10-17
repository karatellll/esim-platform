import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';

export type CatalogPrice = { amount: number; currency: string };
type PricedEsim = Pick<CatalogEsim, 'min_price_amount' | 'min_price_currency'>;

export function getCatalogPrice(esim: PricedEsim): CatalogPrice | null {
  const amount = esim.min_price_amount;
  const currency = esim.min_price_currency;
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0
    || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return null;
  return { amount, currency };
}

export function getMinimumCatalogPrice(esims: readonly PricedEsim[]): CatalogPrice | null {
  let minimum: CatalogPrice | null = null;
  for (const esim of esims) {
    const price = getCatalogPrice(esim);
    if (!price) continue;
    // Amounts in different currencies cannot be compared without exchange rates.
    if (minimum && minimum.currency !== price.currency) return null;
    if (!minimum || price.amount < minimum.amount) minimum = price;
  }
  return minimum;
}

export function formatCatalogPrice(price: CatalogPrice | null): string {
  if (!price) return '—';
  // SDK min_price_amount is displayed directly; no conversion to minor units is applied.
  const formatted = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: price.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price.amount);
  return `от ${formatted}`;
}
