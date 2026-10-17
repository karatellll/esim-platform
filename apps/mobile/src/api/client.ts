import Constants from 'expo-constants';
import { Platform } from 'react-native';



function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }

  const developmentHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (developmentHost) return `http://${developmentHost}:8000`;

  throw new Error('Не удалось подключиться к каталогу. Попробуйте позже.');
}

export async function requestApi<T>(path: string, signal: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  // A cold SDK catalog request includes token issuance; an expired token can add one retry.
  const timeout = setTimeout(abort, 65_000);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const body: unknown = await response.json();

    if (!response.ok) {
      const error = body as { error?: { message?: unknown } } | null;
      throw new Error(
        typeof error?.error?.message === 'string'
          ? error.error.message
          : 'Не удалось загрузить направления. Попробуйте ещё раз.'
      );
    }

    return body as T;
  } catch (error) {
    if (signal.aborted) throw error;
    if (controller.signal.aborted) {
      throw new Error('Каталог не ответил вовремя. Попробуйте ещё раз.');
    }
    if (error instanceof TypeError || error instanceof SyntaxError) {
      throw new Error('Не удалось загрузить направления. Попробуйте ещё раз.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}
