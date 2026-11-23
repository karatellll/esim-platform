export type AppStatusResponse =
  | { status: 'ok' }
  | { status: 'maintenance'; until: string | null }
  | { status: 'update_required'; store_url: string };
