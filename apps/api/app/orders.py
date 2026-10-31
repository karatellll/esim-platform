from collections import OrderedDict
from datetime import datetime, timezone
from decimal import Decimal
import json
import re
import time
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from pydantic import ValidationError

from app.auth import AuthError
from app.config import Settings
from app.models import CatalogEsim, CatalogTariff
from app.order_models import CheckoutSummary, OrderEnvelope, OrdersEnvelope, ProviderSummaryEnvelope
from app.order_store import OrderStore
from app.provider import CatalogError
from app.sdk import CatalogTokenManager


def decimal(value):
    return Decimal(str(value))


class OrdersService:
    def __init__(self, client: httpx.AsyncClient, settings: Settings, clock=None):
        self.client, self.settings = client, settings
        self.clock = clock or time.time
        self.store = OrderStore(settings.orders_database_path)
        self.tokens = OrderedDict()
        return_url = settings.esim_payment_return_url
        if return_url:
            parsed = urlsplit(return_url.replace("{order_id}", "00000000-0000-0000-0000-000000000000"))
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or return_url.count("{order_id}") > 1:
                raise ValueError("ESIM_PAYMENT_RETURN_URL must be an absolute HTTPS URL with at most one {order_id}")

    def manager(self, user_id):
        key = str(user_id)
        manager = self.tokens.get(key)
        if manager is None:
            # Stable, opaque account identity; never the catalog reader or email.
            user_settings = self.settings.model_copy(update={"esim_catalog_external_user_id": f"tursim-user:{key}"})
            manager = CatalogTokenManager(self.client, user_settings)
            self.tokens[key] = manager
            if len(self.tokens) > 512:
                self.tokens.popitem(last=False)
        else:
            self.tokens.move_to_end(key)
        return manager

    async def sdk(self, user_id, method, path, **kwargs):
        manager = self.manager(user_id)
        extra_headers = kwargs.pop("headers", {})
        try:
            token = await manager.get_token()
            for attempt in range(2):
                response = await self.client.request(method, path, headers={
                    "Authorization": f"Bearer {token}",
                    "X-Publishable-Key": self.settings.esim_publishable_key.get_secret_value().strip(),
                    "Accept": "application/json",
                    **extra_headers,
                }, **kwargs)
                if response.status_code != 401 or attempt:
                    return response
                try:
                    code = response.json().get("error", {}).get("code")
                except (ValueError, AttributeError):
                    code = None
                if code not in {"token_expired", "token_revoked", "invalid_token"}:
                    return response
                token = await manager.get_token(rejected_token=token)
        except (httpx.TimeoutException, CatalogError) as error:
            status = 504 if isinstance(error, httpx.TimeoutException) or getattr(error, "status_code", None) == 504 else 502
            raise AuthError(status, "orders_unavailable", "Сервис заказов не ответил. Попробуйте ещё раз.") from None
        except httpx.RequestError:
            raise AuthError(502, "orders_unavailable", "Не удалось связаться с сервисом заказов.") from None

    @staticmethod
    def failure(response):
        try:
            code = response.json().get("error", {}).get("code")
        except (ValueError, AttributeError):
            code = None
        if code in {"plan_not_found", "tariff_not_found"}:
            raise AuthError(409, "tariff_unavailable", "Этот тариф больше недоступен. Выберите другой.")
        if code == "request_in_progress":
            raise AuthError(409, "order_in_progress", "Заказ ещё создаётся. Повторите проверку через несколько секунд.")
        if code in {"idempotency_conflict", "idempotency_key_reused"}:
            raise AuthError(409, "order_unconfirmed", "Не удалось проверить повтор заказа. Проверьте «Мои eSIM» или обратитесь в поддержку.")
        if response.status_code == 404:
            raise AuthError(404, "order_not_found", "Заказ не найден.")
        if response.status_code == 429:
            raise AuthError(429, "orders_rate_limited", "Подождите перед повторной проверкой.", 10)
        raise AuthError(502, "orders_unavailable", "Не удалось обработать заказ. Попробуйте ещё раз.")

    async def provider_summary(self, user_id, esim_id, tariff_id):
        response = await self.sdk(user_id, "POST", "/v1/sdk/orders/summary", json={"ids": [str(tariff_id)]})
        if response.status_code != 200:
            self.failure(response)
        try:
            result = ProviderSummaryEnvelope.model_validate(response.json()).data
            item = result.items[0]
            if str(item.id) != str(tariff_id) or item.esim.id != str(esim_id) or result.total_currency != item.price_currency:
                raise ValueError("Mismatched checkout selection")
            if decimal(result.total_amount_minor) != decimal(item.price_amount_minor):
                raise ValueError("Mismatched single-item total")
            unlimited = item.data_amount.amount == 0 and any(marker in item.display_name.casefold() for marker in ("unlimited", "безлимит"))
            tariff = CatalogTariff(**item.model_dump(exclude={"esim", "id"}), id=str(item.id), is_unlimited=unlimited)
            country = CatalogEsim(id=item.esim.id, country_iso2=item.esim.country, display_name=item.esim.name,
                                  image_url=item.esim.image_url, network=item.esim.network, photo_url=item.esim.photo_url,
                                  min_price_amount=item.esim.min_price_amount, min_price_currency=item.esim.min_price_currency)
            return CheckoutSummary(country=country, tariff=tariff, amount=result.total_amount_minor,
                                   currency=result.total_currency, price_source="provider", ordering_available=True)
        except (ValueError, ValidationError, TypeError):
            raise AuthError(502, "invalid_checkout_response", "Не удалось проверить стоимость заказа.") from None

    @staticmethod
    def snapshot(summary):
        return summary.model_dump(mode="json", exclude={"quote_id", "expires_at", "existing_order_id"})

    @staticmethod
    def fingerprint(snapshot):
        tariff = snapshot["tariff"]
        return (snapshot["country"]["id"], tariff["id"], tariff["data_amount"], tariff["duration"], decimal(snapshot["amount"]), snapshot["currency"])

    async def summary(self, user_id, esim_id, tariff_id):
        user_id = str(user_id)
        unresolved = self.store.unresolved(user_id, str(tariff_id))
        if unresolved and unresolved["provider_order_id"]:
            previous = await self.get(user_id, unresolved["provider_order_id"])
            if previous.state in {"delivered", "failed", "cancelled"}:
                unresolved = None
        if unresolved:
            result = CheckoutSummary.model_validate(json.loads(unresolved["snapshot"]))
            if result.country.id != str(esim_id):
                raise AuthError(409, "order_in_progress", "Сначала проверьте предыдущий заказ.")
            result.quote_id = UUID(unresolved["id"])
            result.expires_at = datetime.fromtimestamp(unresolved["expires_at"], timezone.utc)
            result.existing_order_id = UUID(unresolved["provider_order_id"]) if unresolved["provider_order_id"] else None
            return result
        result = await self.provider_summary(user_id, esim_id, tariff_id)
        quote_id, expires = self.store.quote(user_id, str(esim_id), str(tariff_id), json.dumps(self.snapshot(result), sort_keys=True), int(self.clock()))
        result.quote_id = UUID(quote_id)
        result.expires_at = datetime.fromtimestamp(expires, timezone.utc)
        return result

    def payment_url(self, url):
        if not url:
            return None
        try:
            parts = urlsplit(url)
            if parts.scheme == "https" and parts.hostname in self.settings.esim_payment_allowed_hosts and not parts.username and not parts.password and parts.port in (None, 443):
                return url
        except ValueError:
            pass
        return None

    def normalize(self, raw, user_id, order_id):
        try:
            order = OrderEnvelope.model_validate(raw).data
            if str(order.id) != str(order_id):
                raise ValueError("Mismatched order")
            if order.payment.currency != order.total_currency or decimal(order.payment.amount_minor) != decimal(order.total_amount_minor):
                raise ValueError("Mismatched payment")
            expected = self.store.expected(str(order_id), str(user_id))
            if expected:
                if str(order.esim.id) != expected["country"]["id"] or len(order.items) != 1 or str(order.items[0].storefront_plan_id) != expected["tariff"]["id"] or str(order.tariff.id) != expected["tariff"]["id"]:
                    raise ValueError("Mismatched purchased selection")
                order.price_changed = decimal(order.total_amount_minor) != decimal(expected["amount"]) or order.total_currency != expected["currency"]
            order.payment.url = self.payment_url(order.payment.url) if order.state == "pending_payment" and order.payment.state == "pending" else None
            if order.payment.expires_at and order.payment.expires_at.timestamp() <= self.clock():
                order.payment.url = None
            if order.state != "delivered" or order.payment.state != "captured":
                order.provision = None
            elif order.provision:
                qr = urlsplit(order.provision.qr_code_url)
                if qr.scheme != "https" or not qr.hostname or qr.username or qr.password or (order.provision.qr_code_url_expires and order.provision.qr_code_url_expires.timestamp() <= self.clock()):
                    order.provision.qr_code_url = ""
            return order
        except (ValueError, TypeError, ValidationError):
            raise AuthError(502, "invalid_order_response", "Не удалось проверить данные заказа. Повторите проверку.") from None

    async def get(self, user_id, order_id):
        self.store.require_owner(str(order_id), str(user_id))
        response = await self.sdk(user_id, "GET", f"/v1/sdk/orders/{order_id}")
        if response.status_code != 200:
            self.failure(response)
        try:
            raw = response.json()
        except ValueError:
            raise AuthError(502, "invalid_order_response", "Не удалось проверить данные заказа.") from None
        return self.normalize(raw, user_id, order_id)

    async def create(self, user_id, quote_id):
        user_id, quote_id = str(user_id), str(quote_id)
        quote = self.store.get_quote(quote_id, user_id)
        previous = self.store.attempt(quote_id, user_id)
        if previous and previous["provider_order_id"]:
            return await self.get(user_id, previous["provider_order_id"])
        if previous is None:
            if quote["expires_at"] <= int(self.clock()):
                raise AuthError(409, "quote_expired", "Обновите стоимость заказа и подтвердите её ещё раз.")
            current = await self.provider_summary(user_id, quote["esim_id"], quote["tariff_id"])
            if self.fingerprint(self.snapshot(current)) != self.fingerprint(json.loads(quote["snapshot"])):
                raise AuthError(409, "price_changed", "Стоимость или параметры тарифа изменились. Проверьте новый расчёт.")
        payload = {"ids": [quote["tariff_id"]]}
        if self.settings.esim_payment_return_url:
            payload["return_url"] = self.settings.esim_payment_return_url
        attempt = self.store.claim(quote, payload, int(self.clock()))
        if attempt["provider_order_id"]:
            return await self.get(user_id, attempt["provider_order_id"])
        finished = False
        try:
            response = await self.sdk(user_id, "POST", "/v1/sdk/orders", headers={"Idempotency-Key": attempt["provider_key"]}, json=json.loads(attempt["payload"]))
            if response.status_code == 201:
                raw = response.json()
                order_id = str(UUID(raw["data"]["id"]))
                # Persist identity before parsing optional fields or replying.
                self.store.finish(attempt, "created", int(self.clock()), order_id)
                finished = True
                return self.normalize(raw, user_id, order_id)
            if response.status_code == 402:
                detail = response.json().get("error", {}).get("detail", "")
                match = re.search(r"\border_id=([0-9a-fA-F-]{36})\b", detail)
                if match:
                    order_id = str(UUID(match.group(1)))
                    self.store.finish(attempt, "created", int(self.clock()), order_id)
                    finished = True
                    return await self.get(user_id, order_id)
                raise AuthError(502, "order_unconfirmed", "Банк отклонил оплату. Повторите проверку заказа.")
            # 422 means this key was already used. It does not prove that no
            # order exists, so never replace it with a fresh purchase intent.
            state = "uncertain" if response.status_code >= 500 or response.status_code in (409, 422, 429) else "rejected"
            self.store.finish(attempt, state, int(self.clock()))
            finished = True
            self.failure(response)
        except (ValueError, TypeError, KeyError, AttributeError):
            raise AuthError(502, "order_unconfirmed", "Заказ ещё не подтверждён. Повторите проверку: новый заказ не будет создан.") from None
        finally:
            if not finished:
                self.store.finish(attempt, "uncertain", int(self.clock()))

    async def list(self, user_id, cursor=None, limit=50):
        params = {"limit": limit}
        if cursor:
            params["cursor"] = cursor
        response = await self.sdk(user_id, "GET", "/v1/sdk/orders", params=params)
        if response.status_code != 200:
            self.failure(response)
        try:
            result = OrdersEnvelope.model_validate(response.json())
            self.store.own_many([str(item.id) for item in result.data], str(user_id), int(self.clock()))
            return result
        except (ValueError, TypeError, ValidationError):
            raise AuthError(502, "invalid_orders_response", "Не удалось загрузить покупки. Попробуйте ещё раз.") from None

    async def qr_image(self, user_id, order_id):
        # Resolve a fresh signed URL through the user's order. The caller never
        # supplies a URL, and SDK/partner credentials are not sent to storage.
        order = await self.get(user_id, order_id)
        url = order.provision.qr_code_url if order.provision else None
        if not url:
            raise AuthError(409, "qr_not_ready", "QR-код ещё готовится. Обновите данные заказа.")
        try:
            async with self.client.stream("GET", url, headers={"Accept": "image/png,image/jpeg,image/webp"}) as response:
                if response.status_code != 200:
                    raise AuthError(502, "qr_unavailable", "Не удалось загрузить QR-код. Обновите данные заказа.")
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > 2 * 1024 * 1024:
                        raise AuthError(502, "invalid_qr_response", "Не удалось проверить изображение QR-кода.")
            data = bytes(body)
            if data.startswith(b'\x89PNG\r\n\x1a\n'):
                return data, "image/png", "png"
            if data.startswith(b'\xff\xd8\xff'):
                return data, "image/jpeg", "jpg"
            if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
                return data, "image/webp", "webp"
            raise AuthError(502, "invalid_qr_response", "Не удалось проверить изображение QR-кода.")
        except httpx.RequestError:
            raise AuthError(502, "qr_unavailable", "Не удалось загрузить QR-код. Повторите попытку.") from None
