import type { OrderData } from '../../../../packages/shared/contracts/checkout';

export type InstallationMethod = 'quick' | 'qr' | 'manual';

export function manualDetails(order: OrderData) {
  const provision = order.provision;
  const lpa = provision?.activation_code?.trim() ?? '';
  const parts = lpa.startsWith('LPA:1$') ? lpa.split('$') : [];
  const address = provision?.smdp_address?.trim() || parts[1] || '';
  const matchingId = provision?.matching_id?.trim() || parts[2] || '';
  return { address, matchingId, lpa };
}

export function appleInstallationUrl(order: OrderData): string | null {
  if (order.state !== 'delivered' || order.payment.state !== 'captured') return null;
  const details = manualDetails(order);
  const lpa = details.lpa || (details.address && details.matchingId ? `LPA:1$${details.address}$${details.matchingId}` : '');
  if (!/^LPA:1\$[a-z0-9.-]+\$[^\s$]+(?:\$[^\s]*)?$/i.test(lpa)) return null;
  return `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(lpa)}`;
}

export function supportsQuickInstall(platform: string, version: string | number, userAgent = '', isPad = false): boolean {
  const match = platform === 'web' ? /iPhone.*?OS (\d+)[_.](\d+)/i.exec(userAgent) : null;
  if (platform !== 'ios' && !match) return false;
  if (isPad) return false;
  const [major, minor = 0] = match ? [Number(match[1]), Number(match[2])] : String(version).split('.').map(Number);
  return major > 17 || (major === 17 && minor >= 4);
}

const units: Record<string, number> = { GB: 1000, MB: 1, KB: 0.001 };
const label: Record<string, string> = { GB: 'ГБ', MB: 'МБ', KB: 'КБ' };
const number = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);

export function trafficDisplay(order: OrderData) {
  const total = order.tariff.data_amount;
  const remaining = order.remaining;
  const unlimited = total.amount === 0 && order.items.some(item => /безлимит|unlimited/i.test(item.display_name));
  const factor = units[remaining?.unit ?? ''] && units[total.unit] ? units[remaining!.unit] / units[total.unit] : remaining?.unit === total.unit ? 1 : null;
  const observed = remaining !== null && factor !== null ? remaining.amount * factor : null;
  const amount = observed === null ? total.amount : observed;
  return {
    amount: unlimited ? '∞' : amount > 0 || observed === 0 ? number(amount) : '—',
    unit: label[total.unit] ?? total.unit,
    // With no usage observation the ring describes the purchased allowance;
    // its legend explicitly says that the remaining traffic is unknown.
    ratio: observed === null ? 1 : total.amount > 0 ? Math.max(0, Math.min(1, observed / total.amount)) : 0,
    observed: observed !== null,
    legend: unlimited ? 'Безлимитный пакет' : observed === null ? 'Остаток уточняется' : `${number(observed)} из ${number(total.amount)} ${label[total.unit] ?? total.unit}`,
  };
}

export function installationState(order: OrderData): string {
  return ({ issued: 'ждёт установки', installed: 'установлена', activated: 'активирована', active: 'в сети', depleted: 'трафик исчерпан', expired: 'срок истёк' } as Record<string, string>)[order.esim_status ?? ''] ?? 'eSIM выдана';
}
