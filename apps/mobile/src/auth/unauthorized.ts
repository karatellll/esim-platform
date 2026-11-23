const listeners = new Set<(token: string) => void>();

export function onUnauthorized(listener: (token: string) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function reportUnauthorized(token: string | null | undefined) {
  if (token) for (const listener of listeners) listener(token);
}
