import httpx
from pydantic import BaseModel, Field, ValidationError

from app.config import Settings
from app.models import (
    CatalogCategoriesResponse, CatalogCategory, CatalogEsim, CatalogMeta,
    CatalogTariff, CatalogTariffsData, CatalogTariffsResponse, TariffDataAmount, TariffDuration,
)
from app.provider import CatalogError, provider_request, require_provider_success
from app.sdk import CatalogTokenManager


# Verified against GET /v1/sdk/esims on 15 October 2026.
class SDKCatalogItem(BaseModel):
    id: str = Field(min_length=1)
    country: str | None = None
    name: str = Field(min_length=1)
    image_url: str | None = None
    min_price_amount: int | None = Field(default=None, ge=0, strict=True)
    min_price_currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")


class SDKCatalogGroup(BaseModel):
    title: str = Field(min_length=1)
    items: list[SDKCatalogItem]


class SDKCatalogResponse(BaseModel):
    data: list[SDKCatalogGroup]
    meta: CatalogMeta | None = None


class SDKTariff(BaseModel):
    id: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    price_amount_minor: int = Field(ge=0, strict=True)
    price_currency: str = Field(pattern=r"^[A-Z]{3}$")
    data_amount: TariffDataAmount
    duration: TariffDuration
    is_profitable_badge: bool = False


class SDKTariffsData(BaseModel):
    esim: SDKCatalogItem
    tariffs: list[SDKTariff]


class SDKTariffsResponse(BaseModel):
    data: SDKTariffsData


class CatalogService:
    def __init__(self, client: httpx.AsyncClient, settings: Settings):
        self.client = client
        self.settings = settings
        self.tokens = CatalogTokenManager(client, settings)

    async def _request_sdk(self, path: str, token: str) -> httpx.Response:
        return await provider_request(
            self.client,
            "GET",
            path,
            headers={
                "Authorization": f"Bearer {token}",
                "X-Publishable-Key": self.settings.esim_publishable_key.get_secret_value().strip(),
                "Accept": "application/json",
            },
        )

    async def _get_sdk(self, path: str) -> httpx.Response:
        token = await self.tokens.get_token()
        response = await self._request_sdk(path, token)
        if response.status_code == 401:
            try:
                error = response.json().get("error", {})
                code = error.get("code") if isinstance(error, dict) else None
            except (ValueError, AttributeError):
                code = None
            if isinstance(code, str) and code in {"token_expired", "token_revoked", "invalid_token"}:
                # Refresh once. Concurrent requests reuse the replacement token.
                token = await self.tokens.get_token(rejected_token=token)
                response = await self._request_sdk(path, token)
        return response

    async def get_categories(self) -> CatalogCategoriesResponse:
        response = await self._get_sdk("/v1/sdk/esims")
        require_provider_success(response)

        try:
            catalog = SDKCatalogResponse.model_validate(response.json())
        except (ValueError, ValidationError) as error:
            raise CatalogError(502, "invalid_catalog_response", "Не удалось обработать каталог. Попробуйте позже.") from error

        return CatalogCategoriesResponse(
            data=[
                CatalogCategory(
                    title=group.title,
                    esims=[
                        CatalogEsim(
                            id=item.id,
                            country_iso2=item.country,
                            display_name=item.name,
                            image_url=item.image_url,
                            min_price_amount=item.min_price_amount,
                            min_price_currency=item.min_price_currency,
                        )
                        for item in group.items
                    ],
                )
                for group in catalog.data
            ],
            meta=catalog.meta,
        )

    async def get_tariffs(self, esim_id: str) -> CatalogTariffsResponse:
        response = await self._get_sdk(f"/v1/sdk/esims/{esim_id}/tariffs")
        if response.status_code == 404:
            raise CatalogError(404, "tariffs_not_found", "Направление не найдено. Вернитесь к списку стран.")
        require_provider_success(response)
        try:
            data = SDKTariffsResponse.model_validate(response.json()).data
            if data.esim.id != esim_id:
                raise ValueError("Mismatched destination")
        except (ValueError, ValidationError) as error:
            raise CatalogError(502, "invalid_tariffs_response", "Не удалось обработать тарифы. Попробуйте позже.") from error

        return CatalogTariffsResponse(data=CatalogTariffsData(
            esim=CatalogEsim(
                id=data.esim.id,
                country_iso2=data.esim.country,
                display_name=data.esim.name,
                image_url=data.esim.image_url,
                min_price_amount=data.esim.min_price_amount,
                min_price_currency=data.esim.min_price_currency,
            ),
            tariffs=[CatalogTariff(
                **tariff.model_dump(),
                # Verified SDK uses zero MB plus an explicit unlimited name.
                # A missing/zero allowance alone is not enough to promise unlimited data.
                is_unlimited=tariff.data_amount.amount == 0 and any(
                    marker in tariff.display_name.casefold() for marker in ("безлимит", "unlimited")
                ),
            ) for tariff in data.tariffs],
        ))
