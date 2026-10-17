import logging
from contextlib import asynccontextmanager
from uuid import UUID

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.catalog import CatalogService
from app.config import Settings
from app.models import CatalogCategoriesResponse, CatalogTariffsResponse
from app.provider import CatalogError

logger = logging.getLogger(__name__)


def create_app(
    settings: Settings | None = None,
    provider_transport: httpx.AsyncBaseTransport | None = None,
) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        async with httpx.AsyncClient(
            base_url=str(settings.esim_provider_base_url),
            timeout=settings.esim_request_timeout_seconds,
            follow_redirects=False,
            transport=provider_transport,
        ) as client:
            application.state.catalog = CatalogService(client, settings)
            if not catalog_configured():
                logger.warning("Provider keys are not configured; catalog will return 503")
            yield

    def catalog_configured() -> bool:
        return bool(settings.esim_partner_token.get_secret_value().strip() and settings.esim_publishable_key.get_secret_value().strip())

    application = FastAPI(title="ТурСим API", version="0.1.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.api_cors_origins,
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["Accept"],
    )

    @application.exception_handler(CatalogError)
    async def catalog_error_handler(request: Request, error: CatalogError):
        logger.warning("Catalog request failed: %s", error.code)
        return JSONResponse(
            status_code=error.status_code,
            content={"error": {"code": error.code, "message": error.message}},
            headers={"Cache-Control": "no-store"},
        )

    @application.get("/health", tags=["health"])
    async def health():
        return {
            "status": "ok",
            "catalog_configured": catalog_configured(),
        }

    @application.get(
        "/api/catalog/categories",
        response_model=CatalogCategoriesResponse,
        tags=["catalog"],
        summary="Категории и страны из SDK-каталога",
        description="Сервер получает ClientToken и загружает GET /v1/sdk/esims; ключи и токен клиенту не передаются.",
    )
    async def categories(request: Request) -> CatalogCategoriesResponse:
        return await request.app.state.catalog.get_categories()

    @application.get(
        "/api/catalog/esims/{esim_id}/tariffs",
        response_model=CatalogTariffsResponse,
        tags=["catalog"],
        summary="Тарифы выбранного направления из SDK",
    )
    async def tariffs(esim_id: UUID, request: Request) -> CatalogTariffsResponse:
        return await request.app.state.catalog.get_tariffs(str(esim_id))

    return application


app = create_app()
