// Web refresh credentials are stored by the API in an HttpOnly cookie.
// Access tokens stay in memory; never store authentication tokens in localStorage.
export const loadRefreshToken = async (): Promise<string | null> => null;
export const saveRefreshToken = async (_token: string | null): Promise<void> => {};
