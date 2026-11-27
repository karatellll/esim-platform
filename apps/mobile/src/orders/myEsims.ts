import type { OrderData, OrderListItem } from '../../../../packages/shared/contracts/checkout';

export type OrderDates = Pick<OrderData, 'activated_at' | 'expires_at'>;
export type DisplayOrder = OrderListItem & Partial<OrderDates>;

const day = 86_400_000;
const timestamp = (value: string | null | undefined) => value ? Date.parse(value) : NaN;
const isDaily = (order: DisplayOrder) => /^days?$/i.test(order.tariff.duration.unit);
const units: Record<string, number> = { GB: 1000, MB: 1, KB: 0.001 };
const unitLabels: Record<string, string> = { GB: 'ГБ', MB: 'МБ', KB: 'КБ' };
const formatAmount = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
type TrafficOrder = Pick<OrderListItem, 'tariff' | 'remaining'>;

function observedRemaining({ tariff, remaining }: TrafficOrder): number | null {
  if (!remaining || !Number.isFinite(remaining.amount) || remaining.amount < 0) return null;
  if (remaining.unit === tariff.data_amount.unit) return remaining.amount;
  const from = units[remaining.unit];
  const to = units[tariff.data_amount.unit];
  return typeof from === 'number' && typeof to === 'number' ? remaining.amount * (from / to) : null;
}

export function trafficDisplay(order: TrafficOrder & Partial<Pick<OrderData, 'items'>>) {
  const total = order.tariff.data_amount;
  const unlimited = total.amount === 0 && order.items?.some(item => /безлимит|unlimited/i.test(item.display_name));
  const observed = observedRemaining(order);
  const amount = observed ?? total.amount;
  const unit = unitLabels[total.unit] ?? total.unit;
  return {
    amount: unlimited ? '∞' : amount > 0 || observed === 0 ? formatAmount(amount) : '—',
    unit,
    // With no usage observation the ring describes the purchased allowance.
    ratio: observed === null ? 1 : total.amount > 0 ? Math.max(0, Math.min(1, observed / total.amount)) : 0,
    observed: observed !== null,
    legend: unlimited ? 'Безлимитный пакет' : observed === null ? 'Остаток уточняется' : `${formatAmount(observed)} из ${formatAmount(total.amount)} ${unit}`,
  };
}

export function esimDisplayStatus(order: DisplayOrder, now = Date.now()): string | null {
  const status = order.esim_status?.trim().toLowerCase() || null;
  if (status !== 'activated') return status;
  const remaining = observedRemaining(order);
  const total = order.tariff.data_amount.amount;
  const hasUsage = remaining !== null && total - remaining > total * Number.EPSILON;
  // Some orders report activation before the first network registration is visible.
  return timestamp(order.activated_at) <= now || hasUsage ? status : 'issued';
}

export function groupOrders(orders: readonly DisplayOrder[], now = Date.now()) {
  const active: DisplayOrder[] = [];
  const waiting: DisplayOrder[] = [];
  const history: DisplayOrder[] = [];
  const other: DisplayOrder[] = [];
  for (const order of orders) {
    const status = esimDisplayStatus(order, now);
    if (order.state !== 'delivered') other.push(order);
    else if (status === 'expired' || status === 'depleted' || timestamp(order.expires_at) <= now) history.push(order);
    else if (status === 'active' || status === 'activated' || timestamp(order.activated_at) <= now) active.push(order);
    else if (status === 'issued' || status === 'installed' || !status) waiting.push(order);
    else other.push(order);
  }
  history.sort((a, b) => historyTimestamp(b) - historyTimestamp(a));
  return { active, waiting, history, other };
}

export function elapsedDuration(order: DisplayOrder, now = Date.now()) {
  const started = timestamp(order.activated_at);
  const expires = timestamp(order.expires_at);
  const duration = order.tariff.duration.amount;
  const length = expires > started ? expires - started : isDaily(order) ? duration * day : NaN;
  if (!Number.isFinite(started) || !Number.isFinite(length) || length <= 0) return null;
  const ratio = Math.max(0, Math.min(1, (now - started) / length));
  return { ratio, days: isDaily(order) ? Math.min(duration, Math.floor(Math.max(0, now - started) / day)) : null };
}

function historyTimestamp(order: DisplayOrder) {
  return timestamp(order.activated_at) || timestamp(order.expires_at) || timestamp(order.created_at);
}

export function historyMonth(order: DisplayOrder) {
  const date = timestamp(order.activated_at) || timestamp(order.expires_at);
  return Number.isFinite(date)
    ? new Intl.DateTimeFormat('ru-RU', { month: 'short', year: 'numeric' }).format(date).replace(/\./g, '').replace(/\s+г$/, '')
    : null;
}
