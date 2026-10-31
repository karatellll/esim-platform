import logging
from contextlib import asynccontextmanager
from uuid import UUID

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.responses import JSONResponse

from app.coverage import router as coverage_router
from app.support import router as support_router
from app.auth import AuthError, AuthService, router as auth_router
from app.catalog import CatalogService
from app.checkout import router as checkout_router
from app.config import Settings
from app.models import CatalogCategoriesResponse, CatalogTariffsResponse
from app.provider import CatalogError
from app.orders import OrdersService

logger = logging.getLogger(__name__)


def create_app(
    settings: Settings | None = None,
    provider_transport: httpx.AsyncBaseTransport | None = None,
    auth_mailer=None,
    auth_clock=None,
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
            application.state.orders = OrdersService(client, settings, clock=auth_clock)
            if not catalog_configured():
                logger.warning("Provider keys are not configured; catalog will return 503")
            yield

    def catalog_configured() -> bool:
        return bool(settings.esim_partner_token.get_secret_value().strip() and settings.esim_publishable_key.get_secret_value().strip())

    application = FastAPI(title="ТурСим API", version="0.1.0", lifespan=lifespan)
    application.state.auth = AuthService(settings, mailer=auth_mailer, clock=auth_clock)
    application.include_router(auth_router)
    application.include_router(support_router)
    application.include_router(coverage_router)
    application.include_router(checkout_router)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.api_cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Accept", "Content-Type", "Authorization"],
    )

    @application.exception_handler(AuthError)
    async def auth_error_handler(request: Request, error: AuthError):
        headers = {"Cache-Control": "no-store"}
        content = {"error": {"code": error.code, "message": error.message}}
        if error.retry_after:
            headers["Retry-After"] = str(error.retry_after)
            content["error"]["retry_after_seconds"] = error.retry_after
        return JSONResponse(status_code=error.status, content=content, headers=headers)

    @application.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, error: RequestValidationError):
        if request.url.path.startswith(("/api/checkout/", "/api/orders")):
            return JSONResponse(status_code=422, content={"error": {"code": "invalid_checkout_request", "message": "Проверьте данные заказа."}}, headers={"Cache-Control": "no-store"})
        if request.url.path.startswith(("/api/auth/", "/api/me/profile", "/api/me/coverage-subscriptions", "/api/support/")):
            # Default validation details echo request input, including verification codes.
            return JSONResponse(status_code=422, content={"error": {"code": "invalid_auth_request", "message": "Проверьте введённые данные."}}, headers={"Cache-Control": "no-store"})
        return await request_validation_exception_handler(request, error)

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
