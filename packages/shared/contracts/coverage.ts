// Own API, authenticated through the user's verified email session.
export interface CoverageRequest { country_iso2: string }
export interface CoverageSubscription { country_iso2: string; status: 'pending' | 'sending' | 'notified' | 'failed' | 'cancelled' }
export interface CoverageSubscriptions { data: CoverageSubscription[] }
