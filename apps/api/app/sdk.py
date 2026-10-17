import asyncio
from datetime import datetime, timezone
from time import monotonic
from uuid import uuid4

import httpx
from pydantic import AwareDatetime, BaseModel, Field, SecretStr, ValidationError

from app.config import Settings
from app.provider import CatalogError, provider_request, require_provider_success


class ClientTokenData(BaseModel):
    token: SecretStr = Field(min_length=1)
    expires_at: AwareDatetime


class ClientTokenResponse(BaseModel):
    data: ClientTokenData


class CatalogTokenManager:
    """In-memory credential for catalog reads only; never a user/order session."""

    def __init__(self, client: httpx.AsyncClient, settings: Settings):
        self.client = client
        self.settings = settings
        self._token: SecretStr | None = None
        self._refresh_at = 0.0
        self._lock = asyncio.Lock()
        self._pending_idempotency_key: str | None = None

    async def get_token(self, rejected_token: str | None = None) -> str:
        if not self.settings.esim_partner_token.get_secret_value().strip() or not self.settings.esim_publishable_key.get_secret_value().strip():
            raise CatalogError(503, "catalog_not_configured", "Каталог временно недоступен.")

        async with self._lock:
            current = self._token.get_secret_value() if self._token else None
            if current and monotonic() < self._refresh_at and current != rejected_token:
                return current

            # Keep the same key after a timeout or failure: issuance might already have succeeded.
            if self._pending_idempotency_key is None:
                self._pending_idempotency_key = str(uuid4())
            response = await provider_request(
                self.client,
                "POST",
                "/v1/partner/client-tokens",
                headers={
                    "Authorization": f"Bearer {self.settings.esim_partner_token.get_secret_value().strip()}",
                    "Idempotency-Key": self._pending_idempotency_key,
                    "Accept": "application/json",
                },
                json={"external_user_id": self.settings.esim_catalog_external_user_id.strip()},
            )
            require_provider_success(response, (200, 201))
            try:
                data = ClientTokenResponse.model_validate(response.json()).data
                remaining = (data.expires_at - datetime.now(timezone.utc)).total_seconds()
                if remaining <= 0 or not data.token.get_secret_value().strip():
                    raise ValueError("Unusable token")
            except (ValueError, ValidationError) as error:
                self._pending_idempotency_key = None
                raise CatalogError(502, "invalid_token_response", "Не удалось открыть каталог. Попробуйте позже.") from error

            self._token = data.token
            self._refresh_at = monotonic() + remaining - min(60, remaining * 0.1)
            self._pending_idempotency_key = None
            return data.token.get_secret_value()
