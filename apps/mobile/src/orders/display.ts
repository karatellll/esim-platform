import type { OrderListItem } from '../../../../packages/shared/contracts/checkout';
import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';

export function orderStateLabel(order: Pick<OrderListItem, 'state' | 'esim_status'>): string {
  if (order.state === 'delivered') {
    return ({ issued: 'Готова к установке', installed: 'Установлена', activated: 'Активирована', active: 'В сети', depleted: 'Трафик закончился', expired: 'Срок истёк' } as Record<string, string>)[order.esim_status ?? ''] ?? 'eSIM выдана';
  }
  return ({ pending_payment: 'Ожидает оплаты', paid: 'Оплачено — готовим eSIM', provisioning: 'Готовим eSIM', failed: 'Заказ не выполнен', cancelled: 'Заказ отменён' } as Record<string, string>)[order.state] ?? 'Уточняем состояние';
}

export const orderPrice = (order: Pick<OrderListItem, 'total_amount_minor' | 'total_currency'>) => new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: order.total_currency, minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(order.total_amount_minor);

export function orderCountry(order: OrderListItem): CatalogEsim {
  return { id: order.esim.id, display_name: order.esim.name, image_url: order.esim.image, country_iso2: null, min_price_amount: null, min_price_currency: null };
}

export function orderDataLabel(order: OrderListItem): string {
  const amount = order.tariff.data_amount;
  if (amount.amount === 0) return 'Пакет eSIM';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(amount.amount)} ${amount.unit === 'GB' ? 'ГБ' : amount.unit === 'MB' ? 'МБ' : amount.unit}`;
}
