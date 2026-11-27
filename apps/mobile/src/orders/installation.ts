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

export function installationState(status: string | null): string {
  return ({ issued: 'ждёт установки', installed: 'установлена', activated: 'активирована', active: 'в сети', depleted: 'трафик исчерпан', expired: 'срок истёк' } as Record<string, string>)[status ?? ''] ?? 'eSIM выдана';
}
