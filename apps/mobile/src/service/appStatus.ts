import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { AppStatusResponse } from '../../../../packages/shared/contracts/app-status';
import { getApiBaseUrl } from '../api/client';

export type AppStatus = { status: 'ok' | 'server' } | { status: 'maintenance'; until: string | null }
  | { status: 'update_required'; storeUrl: string };

export async function getAppStatus(signal: AbortSignal): Promise<AppStatus> {
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/app-status?platform=${platform}&version=${encodeURIComponent(version)}`, { signal, headers: { Accept: 'application/json' } });
    if (response.ok) return { status: 'ok' };
    // Older servers without the status endpoint still serve the public app.
    if (response.status === 404) return { status: 'ok' };
    const data = await response.json().catch(() => null) as AppStatusResponse | null;
    if (response.status === 503) return { status: 'maintenance', until: data?.status === 'maintenance' && typeof data.until === 'string' ? data.until : null };
    if (response.status === 426 && data?.status === 'update_required' && typeof data.store_url === 'string' && /^https:\/\//i.test(data.store_url)) {
      return { status: 'update_required', storeUrl: data.store_url };
    }
  } catch {
    // The connectivity observer independently distinguishes a lost connection.
  }
  return { status: 'server' };
}

export function maintenanceMessage(until: string | null) {
  if (!until || !Number.isFinite(Date.parse(until))) return undefined;
  const when = new Date(until);
  const timeZone = 'Europe/Moscow';
  const clock = new Intl.DateTimeFormat('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit' }).format(when);
  const dateFormat = new Intl.DateTimeFormat('ru-RU', { timeZone, day: 'numeric', month: 'long' });
  const date = dateFormat.format(when) === dateFormat.format(new Date()) ? '' : `${dateFormat.format(when)} в `;
  return `Вернёмся ${date ? date : 'к '}${clock} по Москве. Купленные eSIM работают как обычно`;
}
