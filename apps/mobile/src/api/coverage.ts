import type { CoverageSubscription, CoverageSubscriptions } from '../../../../packages/shared/contracts/coverage';
import { getApiBaseUrl } from './client';
export async function coverageSubscription(accessToken: string, code?: string, cancel = false): Promise<CoverageSubscriptions | CoverageSubscription> {
  const response = await fetch(`${getApiBaseUrl()}/api/me/coverage-subscriptions${cancel ? '/cancel' : ''}`, {
    method: code ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, ...(code ? { 'Content-Type': 'application/json' } : {}) },
    body: code ? JSON.stringify({ country_iso2: code }) : undefined,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? 'Не удалось сохранить заявку. Повторите попытку.');
  return body;
}
