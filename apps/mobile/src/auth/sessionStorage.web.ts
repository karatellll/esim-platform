// Web refresh credentials are stored by the API in an HttpOnly cookie.
// Access tokens stay in memory; never store authentication tokens in localStorage.
export const loadRefreshToken = async (): Promise<string | null> => null;
export const saveRefreshToken = async (_token: string | null): Promise<void> => {};
// Only remember that a sign-in occurred so an expired cookie can be
// distinguished from a first visit. Storage contains neither an ID nor a token.
const signedInKey = 'tursim.was-signed-in';
export async function loadOfflineUser() {
  try { return localStorage.getItem(signedInKey); } catch { return null; }
}
export async function saveOfflineUser(id: string | null) {
  try {
    if (id) localStorage.setItem(signedInKey, '1');
    else localStorage.removeItem(signedInKey);
  } catch { /* Browser storage is optional. */ }
}
