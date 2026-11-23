import type { OrderData, OrderListItem } from '../../../../packages/shared/contracts/checkout';

export type OrderDates = Pick<OrderData, 'activated_at' | 'expires_at'>;
export type DisplayOrder = OrderListItem & Partial<OrderDates>;

const day = 86_400_000;
const timestamp = (value: string | null | undefined) => value ? Date.parse(value) : NaN;
const isDaily = (order: DisplayOrder) => /^days?$/i.test(order.tariff.duration.unit);

export function groupOrders(orders: readonly DisplayOrder[], now = Date.now()) {
  const active: DisplayOrder[] = [];
  const waiting: DisplayOrder[] = [];
  const history: DisplayOrder[] = [];
  const other: DisplayOrder[] = [];
  for (const order of orders) {
    if (order.state !== 'delivered') other.push(order);
    else if (order.esim_status === 'expired' || order.esim_status === 'depleted' || timestamp(order.expires_at) <= now) history.push(order);
    else if (order.esim_status === 'active' || order.esim_status === 'activated' || Number.isFinite(timestamp(order.activated_at))) active.push(order);
    else if (order.esim_status === 'issued' || order.esim_status === 'installed' || !order.esim_status) waiting.push(order);
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
