import { Platform } from 'react-native';

import type { MeResponse, RefreshRequest, SendCodeResponse, SessionResponse } from '../../../../packages/shared/contracts/auth';
import { getApiBaseUrl } from './client';

export const sessionClient = Platform.OS === 'web' ? 'web' : 'native';

export class AuthApiError extends Error {
  constructor(message: string, public status: number, public retryAfterSeconds = 0) {
    super(message);
    this.name = 'AuthApiError';
  }
}

export async function authRequest<T>(path: string, body?: unknown, accessToken?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(getApiBaseUrl() + path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: Platform.OS === 'web' ? 'include' : 'omit',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 204) return undefined as T;
    const data = await response.json() as { error?: { message?: string; retry_after_seconds?: number } };
    if (!response.ok) throw new AuthApiError(data.error?.message || 'Не удалось выполнить вход. Попробуйте ещё раз.', response.status, data.error?.retry_after_seconds || 0);
    return data as T;
  } catch (error) {
    if (error instanceof AuthApiError) throw error;
    throw new AuthApiError(controller.signal.aborted ? 'Сервер не ответил вовремя. Попробуйте ещё раз.' : 'Не удалось связаться с сервером. Проверьте подключение.', 0);
  } finally {
    clearTimeout(timeout);
  }
}

export const sendEmailCode = (email: string) => authRequest<SendCodeResponse>('/api/auth/email/send-code', { email });
export const verifyEmailCode = (challengeId: string, code: string) => authRequest<SessionResponse>('/api/auth/email/verify', { challenge_id: challengeId, code, client: sessionClient });
export const refreshAuth = (refreshToken?: string | null) => authRequest<SessionResponse>('/api/auth/refresh', { client: sessionClient, ...(refreshToken ? { refresh_token: refreshToken } : {}) } satisfies RefreshRequest);
export const logoutAuth = (accessToken: string | null, refreshToken?: string | null) => authRequest<void>('/api/auth/logout', { client: sessionClient, ...(refreshToken ? { refresh_token: refreshToken } : {}) } satisfies RefreshRequest, accessToken || undefined);
export const fetchMe = (accessToken: string) => authRequest<MeResponse>('/api/me', undefined, accessToken);

export const updateProfile = (accessToken: string, display_name: string, avatar: string | null) => authRequest<MeResponse>('/api/me/profile', { display_name, avatar }, accessToken);
