"""Local DTOs and provider response models verified against doc.json (21 Oct)."""
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.catalog import SDKCatalogItem, SDKTariff
from app.models import CatalogEsim, CatalogTariff, TariffDataAmount, TariffDuration

Money = Annotated[float, Field(ge=0, strict=True, allow_inf_nan=False)]
Currency = Annotated[str, Field(pattern=r"^[A-Z]{3}$")]


class CheckoutSelection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    esim_id: UUID
    tariff_id: UUID
    promo_code: str | None = Field(default=None, max_length=64)


class CheckoutSummary(BaseModel):
    country: CatalogEsim
    tariff: CatalogTariff
    amount: Money
    currency: Currency
    price_source: Literal["catalog", "provider"]
    ordering_available: bool
    quote_id: UUID | None = None
    expires_at: AwareDatetime | None = None
    existing_order_id: UUID | None = None


class CheckoutSummaryResponse(BaseModel):
    data: CheckoutSummary


class CheckoutOrderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    quote_id: UUID


class ProviderSummaryItem(SDKTariff):
    id: UUID
    esim: SDKCatalogItem


class ProviderSummaryData(BaseModel):
    items: list[ProviderSummaryItem] = Field(min_length=1, max_length=1)
    total_amount_minor: Money
    total_currency: Currency


class ProviderSummaryEnvelope(BaseModel):
    data: ProviderSummaryData


class OrderEsim(BaseModel):
    id: UUID
    name: str = Field(min_length=1)
    image: str | None = None


class OrderTariff(BaseModel):
    id: UUID
    data_amount: TariffDataAmount
    duration: TariffDuration


class OrderItem(BaseModel):
    id: UUID
    storefront_plan_id: UUID
    display_name: str
    price_amount_minor: Money
    price_currency: Currency
    data_amount: TariffDataAmount
    duration: TariffDuration


class OrderPayment(BaseModel):
    state: str = Field(min_length=1, max_length=64)
    amount_minor: Money
    currency: Currency
    url: str | None = None
    expires_at: AwareDatetime | None = None
    failure_code: str | None = None


class OrderProvision(BaseModel):
    state: str
    iccid: str = ""
    activation_code: str = ""
    smdp_address: str = ""
    matching_id: str = ""
    qr_code_url: str = ""
    qr_code_url_expires: AwareDatetime | None = None


class OrderListItem(BaseModel):
    id: UUID
    order_number: int
    state: str = Field(min_length=1, max_length=64)
    total_amount_minor: Money
    total_currency: Currency
    esim: OrderEsim
    tariff: OrderTariff
    remaining: TariffDataAmount | None = None
    esim_status: str | None = None
    created_at: AwareDatetime


class OrderData(OrderListItem):
    items: list[OrderItem] = Field(min_length=1)
    payment: OrderPayment
    provision: OrderProvision | None = None
    activated_at: AwareDatetime | None = None
    expires_at: AwareDatetime | None = None
    price_changed: bool = False


class OrderEnvelope(BaseModel):
    data: OrderData


class OrdersMeta(BaseModel):
    has_more: bool
    next_cursor: str | None = None


class OrdersEnvelope(BaseModel):
    data: list[OrderListItem]
    meta: OrdersMeta
