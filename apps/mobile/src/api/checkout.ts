import type { CheckoutOrderRequest, CheckoutSelection, CheckoutSummaryResponse, OrderEnvelope, OrdersEnvelope } from '../../../../packages/shared/contracts/checkout';
import { getApiBaseUrl } from './client';

export class CheckoutApiError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); this.name = 'CheckoutApiError'; }
}

async function request<T>(path: string, body?: unknown, signal?: AbortSignal, accessToken?: string): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 65_000);
  try {
    const response = await fetch(getApiBaseUrl() + path, {
      method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new CheckoutApiError(result?.error?.message ?? 'Не удалось оформить заказ. Попробуйте позже.', response.status, result?.error?.code ?? 'checkout_error');
    return result as T;
  } catch (error) {
    if (signal?.aborted || error instanceof CheckoutApiError) throw error;
    throw new CheckoutApiError(controller.signal.aborted ? 'Сервер не ответил вовремя. Попробуйте ещё раз.' : 'Не удалось связаться с сервером. Проверьте подключение.', 0, 'network_error');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export const getCheckoutSummary = (selection: CheckoutSelection, signal: AbortSignal, accessToken?: string | null) => request<CheckoutSummaryResponse>('/api/checkout/summary', selection, signal, accessToken ?? undefined);
// A retry uses the same quote_id; its durable provider idempotency key stays on
// the server. Never replace a quote merely because creation timed out.
export const createCheckoutOrder = (selection: CheckoutOrderRequest, accessToken: string) => request<OrderEnvelope>('/api/orders', selection, undefined, accessToken);
export const getOrder = (id: string, accessToken: string, signal: AbortSignal) => request<OrderEnvelope>(`/api/orders/${encodeURIComponent(id)}`, undefined, signal, accessToken);
export const getUserOrders = (accessToken: string, signal: AbortSignal, cursor?: string | null) => request<OrdersEnvelope>(`/api/orders?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, undefined, signal, accessToken);

export async function getOrderQr(id: string, accessToken: string): Promise<Blob> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/orders/${encodeURIComponent(id)}/qr`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'image/png,image/jpeg,image/webp' },
      signal: controller.signal,
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new CheckoutApiError(result?.error?.message ?? 'Не удалось скачать QR-код. Обновите заказ.', response.status, result?.error?.code ?? 'qr_unavailable');
    }
    return await response.blob();
  } catch (error) {
    if (error instanceof CheckoutApiError) throw error;
    throw new CheckoutApiError('Не удалось скачать QR-код. Проверьте подключение и повторите попытку.', 0, 'qr_unavailable');
  } finally { clearTimeout(timeout); }
}
