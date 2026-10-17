import httpx


class CatalogError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message


async def provider_request(client: httpx.AsyncClient, method: str, path: str, **kwargs) -> httpx.Response:
    try:
        return await client.request(method, path, **kwargs)
    except httpx.TimeoutException as error:
        raise CatalogError(504, "catalog_timeout", "Каталог не ответил вовремя. Попробуйте ещё раз.") from error
    except httpx.RequestError as error:
        raise CatalogError(502, "catalog_unavailable", "Не удалось загрузить каталог. Попробуйте ещё раз.") from error


def require_provider_success(response: httpx.Response, statuses: tuple[int, ...] = (200,)) -> None:
    if response.status_code in statuses:
        return
    if response.status_code in (401, 403):
        raise CatalogError(502, "provider_auth_failed", "Каталог временно недоступен.")
    if response.status_code == 429:
        raise CatalogError(503, "provider_rate_limited", "Попробуйте загрузить каталог немного позже.")
    raise CatalogError(502, "provider_error", "Не удалось загрузить каталог. Попробуйте ещё раз.")
