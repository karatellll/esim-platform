from pydantic import BaseModel, Field


class CatalogEsim(BaseModel):
    id: str = Field(min_length=1)
    country_iso2: str | None = None
    display_name: str = Field(min_length=1)
    image_url: str | None = None
    min_price_amount: float | None = Field(default=None, ge=0, strict=True, allow_inf_nan=False)
    min_price_currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")


class CatalogCategory(BaseModel):
    title: str = Field(min_length=1)
    esims: list[CatalogEsim]


class CatalogMeta(BaseModel):
    has_more: bool = False
    next_cursor: str | None = None
    total: int | None = Field(default=None, ge=0)


class CatalogCategoriesResponse(BaseModel):
    data: list[CatalogCategory]
    meta: CatalogMeta | None = None


class TariffDataAmount(BaseModel):
    amount: float = Field(ge=0, allow_inf_nan=False, strict=True)
    unit: str = Field(min_length=1, max_length=16)


class TariffDuration(BaseModel):
    amount: int = Field(gt=0, strict=True)
    unit: str = Field(min_length=1, max_length=16)


class CatalogTariff(BaseModel):
    id: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    price_amount_minor: float = Field(ge=0, strict=True, allow_inf_nan=False)
    price_currency: str = Field(pattern=r"^[A-Z]{3}$")
    data_amount: TariffDataAmount
    duration: TariffDuration
    is_profitable_badge: bool = False
    is_unlimited: bool


class CatalogTariffsData(BaseModel):
    esim: CatalogEsim
    tariffs: list[CatalogTariff]


class CatalogTariffsResponse(BaseModel):
    data: CatalogTariffsData
