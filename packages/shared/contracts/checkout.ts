import type { CatalogEsim, CatalogTariff } from './catalog';

// Our API DTOs. Provider schemas verified from doc.json on 21 October 2026.
export interface CheckoutSelection {
  esim_id: string;
  tariff_id: string;
  promo_code?: string;
}

// A confirmed quote adjustment, never a client-side discount calculation.
// The verified SDK contract has no redemption: promotion is null and a code
// returns promo_unavailable. The applied Figma view requires this server field.
export interface CheckoutPromotion {
  code: string;
  subtotal_amount: number;
  discount_amount: number;
}

export interface CheckoutSummaryResponse {
  data: {
    country: CatalogEsim;
    tariff: CatalogTariff;
    amount: number;
    currency: string;
    price_source: 'catalog' | 'provider';
    ordering_available: boolean;
    quote_id: string | null;
    expires_at: string | null;
    existing_order_id: string | null;
    promotion: CheckoutPromotion | null;
  };
}

export interface CheckoutOrderRequest { quote_id: string }

export interface OrderListItem {
  id: string;
  order_number: number;
  state: string;
  total_amount_minor: number;
  total_currency: string;
  esim: { id: string; name: string; image: string | null };
  tariff: { id: string; data_amount: CatalogTariff['data_amount']; duration: CatalogTariff['duration'] };
  remaining: CatalogTariff['data_amount'] | null;
  esim_status: string | null;
  created_at: string;
}

export interface OrderData extends OrderListItem {
  items: Array<{ id: string; storefront_plan_id: string; display_name: string; price_amount_minor: number; price_currency: string;
    data_amount: CatalogTariff['data_amount']; duration: CatalogTariff['duration'] }>;
  payment: { state: string; amount_minor: number; currency: string; url: string | null; expires_at: string | null; failure_code: string | null };
  provision: { state: string; iccid: string; activation_code: string; smdp_address: string; matching_id: string;
    qr_code_url: string; qr_code_url_expires: string | null } | null;
  activated_at: string | null;
  expires_at: string | null;
  price_changed: boolean;
}

export interface OrderEnvelope { data: OrderData }
export interface OrdersEnvelope { data: OrderListItem[]; meta: { has_more: boolean; next_cursor: string | null } }

// GET /api/orders/{id}/qr: authenticated binary PNG/JPEG/WebP response,
// Cache-Control: no-store. The activation image is not a JSON DTO.
