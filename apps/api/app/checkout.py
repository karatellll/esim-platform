"""Checkout and user orders, verified against the supplied Swagger doc.json."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import AuthError, bearer, bearer_scheme, check_origin
from app.auth_models import AuthErrorResponse
from app.order_models import CheckoutOrderRequest, CheckoutSelection, CheckoutSummary, CheckoutSummaryResponse, OrderEnvelope, OrdersEnvelope

router = APIRouter(tags=["checkout"], responses={status: {"model": AuthErrorResponse} for status in (401, 403, 404, 409, 422, 429, 502, 503, 504)})


def user(request):
    check_origin(request)
    token = bearer(request)
    if not token:
        raise AuthError(401, "session_expired", "Для оформления войдите по почте.")
    return request.app.state.auth.me(token)


@router.post("/api/checkout/summary", response_model=CheckoutSummaryResponse,
             summary="Расчёт выбранного тарифа",
             description="После входа: персональный SDK orders/summary и серверная котировка на 5 минут. До входа: предварительная цена каталога без создания заказа.")
async def checkout_summary(body: CheckoutSelection, request: Request, response: Response):
    check_origin(request)
    response.headers["Cache-Control"] = "no-store"
    if body.promo_code and body.promo_code.strip():
        raise AuthError(422, "promo_unavailable", "Промокоды пока недоступны. Продолжите без промокода.")
    if bearer(request):
        account = user(request)
        return CheckoutSummaryResponse(data=await request.app.state.orders.summary(account.id, body.esim_id, body.tariff_id))
    result = await request.app.state.catalog.get_tariffs(str(body.esim_id))
    tariff = next((item for item in result.data.tariffs if item.id == str(body.tariff_id)), None)
    if tariff is None:
        raise AuthError(409, "tariff_unavailable", "Этот тариф больше недоступен. Выберите другой.")
    return CheckoutSummaryResponse(data=CheckoutSummary(country=result.data.esim, tariff=tariff,
        amount=tariff.price_amount_minor, currency=tariff.price_currency, price_source="catalog", ordering_available=False))


@router.post("/api/orders", status_code=201, response_model=OrderEnvelope,
             summary="Создать заказ и получить платёжную ссылку")
async def create_order(body: CheckoutOrderRequest, request: Request, response: Response,
                       credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)):
    account = user(request)
    response.headers["Cache-Control"] = "no-store"
    return OrderEnvelope(data=await request.app.state.orders.create(account.id, body.quote_id))


@router.get("/api/orders", response_model=OrdersEnvelope, summary="Заказы текущего пользователя")
async def list_orders(request: Request, response: Response, cursor: str | None = Query(default=None, max_length=1024),
                      limit: int = Query(default=50, ge=1, le=100),
                      credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)):
    account = user(request)
    response.headers["Cache-Control"] = "no-store"
    return await request.app.state.orders.list(account.id, cursor, limit)


@router.get("/api/orders/{order_id}", response_model=OrderEnvelope, summary="Состояние оплаты и выданная eSIM")
async def get_order(order_id: UUID, request: Request, response: Response,
                    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)):
    account = user(request)
    response.headers["Cache-Control"] = "no-store"
    return OrderEnvelope(data=await request.app.state.orders.get(account.id, order_id))


@router.get("/api/orders/{order_id}/qr", response_class=Response,
            summary="Скачать QR-код установки текущего пользователя",
            responses={200: {"content": {"image/png": {}, "image/jpeg": {}, "image/webp": {}}}})
async def get_order_qr(order_id: UUID, request: Request,
                       credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)):
    account = user(request)
    data, content_type, extension = await request.app.state.orders.qr_image(account.id, order_id)
    return Response(content=data, media_type=content_type, headers={
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Content-Disposition": f'attachment; filename="esim-qr.{extension}"',
    })
