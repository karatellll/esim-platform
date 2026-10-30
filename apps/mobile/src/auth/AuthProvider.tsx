import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import type { AuthUser, SessionResponse } from '../../../../packages/shared/contracts/auth';
import { AuthApiError, logoutAuth, refreshAuth, sessionClient, verifyEmailCode } from '../api/auth';
import { loadRefreshToken, saveRefreshToken } from './sessionStorage';

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  restoreError: string | null;
  retryRestore: () => Promise<void>;
  signIn: (challengeId: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const sessionRef = useRef<SessionResponse | null>(null);
  const pendingRefresh = useRef<Promise<void> | null>(null);
  const signingOut = useRef(false);

  const accept = useCallback(async (next: SessionResponse) => {
    if (sessionClient === 'native') {
      if (!next.refresh_token) throw new Error('Не удалось сохранить вход. Попробуйте ещё раз.');
      await saveRefreshToken(next.refresh_token);
    }
    sessionRef.current = next;
    setSession(next);
    setRestoreError(null);
  }, []);

  const restore = useCallback((): Promise<void> => {
    if (pendingRefresh.current) return pendingRefresh.current;
    if (signingOut.current) return Promise.resolve();
    const work = (async () => {
      try {
        const token = await loadRefreshToken();
        if (sessionClient === 'native' && !token) return;
        await accept(await refreshAuth(token));
      } catch (error) {
        if (error instanceof AuthApiError && error.status === 401) {
          await saveRefreshToken(null);
          sessionRef.current = null;
          setSession(null);
          setRestoreError(null);
        } else {
          setRestoreError(error instanceof Error ? error.message : 'Не удалось восстановить вход.');
          throw error;
        }
      } finally {
        setLoading(false);
      }
    })();
    pendingRefresh.current = work;
    void work.finally(() => { pendingRefresh.current = null; }).catch(() => {});
    return work;
  }, [accept]);

  useEffect(() => { void restore().catch(() => {}); }, [restore]);
  useEffect(() => {
    if (!session) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const renew = async () => {
      try { await restore(); }
      catch { if (!stopped) timer = setTimeout(renew, 60_000); }
    };
    timer = setTimeout(renew, Math.max(10_000, (session.expires_in - 30) * 1000));
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void restore().catch(() => {});
    });
    return () => { stopped = true; clearTimeout(timer); listener.remove(); };
  }, [session, restore]);

  const signIn = useCallback(async (challengeId: string, code: string) => {
    // Finish any startup restoration before accepting a new login.
    await pendingRefresh.current?.catch(() => {});
    const next = await verifyEmailCode(challengeId, code);
    try { await accept(next); }
    catch (error) {
      await logoutAuth(next.access_token, next.refresh_token).catch(() => {});
      throw error;
    }
  }, [accept]);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      await pendingRefresh.current?.catch(() => {});
      const token = await loadRefreshToken();
      await logoutAuth(sessionRef.current?.access_token || null, token);
      await saveRefreshToken(null);
      sessionRef.current = null;
      setSession(null);
      setRestoreError(null);
    } finally { signingOut.current = false; }
  }, []);

  return <AuthContext.Provider value={{ user: session?.user || null, accessToken: session?.access_token || null, loading, restoreError, retryRestore: restore, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is missing');
  return context;
}
