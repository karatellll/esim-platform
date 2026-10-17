// Application contract. Backend models: apps/api/app/models.py.
// JSON Schema / OpenAPI: generated alongside this file by `npm run contracts`.
// GET /api/catalog/categories normalizes SDK groups (items/country/name) on the server.
// Provider credentials and ClientToken never form part of the application response.
export interface CatalogEsim {
  id: string;
  // Provider also uses special codes for global/regional bundles; the country list excludes them.
  country_iso2: string | null;
  display_name: string;
  image_url: string | null;
  // Raw SDK value, passed through without rescaling.
  min_price_amount: number | null;
  min_price_currency: string | null;
}

export interface CatalogCategory {
  title: string;
  esims: CatalogEsim[];
}

export interface CatalogCategoriesResponse {
  data: CatalogCategory[];
  meta?: {
    has_more: boolean;
    next_cursor: string | null;
    total: number | null;
  } | null;
}

export interface CatalogTariff {
  id: string;
  display_name: string;
  // Raw SDK value; the current UI uses the same scale as catalog min_price_amount.
  price_amount_minor: number;
  price_currency: string;
  data_amount: { amount: number; unit: string };
  duration: { amount: number; unit: string };
  is_profitable_badge: boolean;
  is_unlimited: boolean;
}

export interface CatalogTariffsResponse {
  data: {
    esim: CatalogEsim;
    tariffs: CatalogTariff[];
  };
}
