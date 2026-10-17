import asyncio
import json
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.catalog import CatalogService

TOKEN = "sk_test_catalog_transport_only"
PUBLISHABLE_KEY = "pk_test_catalog_transport_only"
CLIENT_TOKEN = "client_token_test_only"
PAYLOAD = {
    "data": [{
        "title": "Популярное",
        "items": [{
            "id": "1594055e-edd8-4018-98cd-04566e617f71",
            "country": "AE",
            "name": "ОАЭ",
            "image_url": None,
            "min_price_amount": 199,
            "min_price_currency": "RUB",
            "private_provider_field": TOKEN,
        }],
    }],
    "meta": {"has_more": False},
    "private_provider_field": TOKEN,
}


def token_payload(token=CLIENT_TOKEN, expires_at=None):
    return {"data": {
        "token": token,
        "jti": "not-forwarded",
        "expires_at": expires_at or (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
    }}


def make_settings(token=TOKEN, publishable_key=PUBLISHABLE_KEY):
    return Settings(_env_file=None, esim_partner_token=token, esim_publishable_key=publishable_key)


def make_app(handler, token=TOKEN, publishable_key=PUBLISHABLE_KEY, issue_handler=None):
    def dispatch(request):
        if request.url.path == "/v1/partner/client-tokens":
            if issue_handler:
                return issue_handler(request)
            return httpx.Response(200, json=token_payload())
        return handler(request)

    return create_app(
        make_settings(token, publishable_key),
        provider_transport=httpx.MockTransport(dispatch),
    )


def test_categories_use_server_token_and_return_only_catalog_fields():
    calls = []

    def handler(request):
        calls.append(request)
        assert request.method == "GET"
        assert request.url.path == "/v1/sdk/esims"
        assert request.headers["Authorization"] == f"Bearer {CLIENT_TOKEN}"
        assert request.headers["X-Publishable-Key"] == PUBLISHABLE_KEY
        return httpx.Response(200, json=PAYLOAD)

    with TestClient(make_app(handler)) as client:
        response = client.get("/api/catalog/categories")

    assert len(calls) == 1
    assert response.status_code == 200
    assert response.json()["data"][0]["esims"][0]["display_name"] == "ОАЭ"
    assert response.json()["meta"]["has_more"] is False
    assert response.json()["data"][0]["esims"][0]["min_price_amount"] == 199
    assert response.json()["data"][0]["esims"][0]["min_price_currency"] == "RUB"
    assert TOKEN not in response.text
    assert CLIENT_TOKEN not in response.text
    assert PUBLISHABLE_KEY not in response.text
    assert "private_provider_field" not in response.text


def test_missing_token_does_not_contact_provider():
    def handler(request):
        pytest.fail("Provider must not be contacted without a token")

    with TestClient(make_app(handler, token="")) as client:
        assert client.get("/health").json() == {"status": "ok", "catalog_configured": False}
        response = client.get("/api/catalog/categories")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "catalog_not_configured"


@pytest.mark.parametrize("status,expected_code,expected_status", [
    (401, "provider_auth_failed", 502),
    (403, "provider_auth_failed", 502),
    (404, "provider_error", 502),
    (500, "provider_error", 502),
    (429, "provider_rate_limited", 503),
    (302, "provider_error", 502),
])
def test_provider_errors_and_redirects_are_not_forwarded(status, expected_code, expected_status):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(status, json={"error": TOKEN}, headers={"Location": "https://different.example/catalog"})

    with TestClient(make_app(handler)) as client:
        response = client.get("/api/catalog/categories")

    assert len(calls) == 1
    assert response.status_code == expected_status
    assert response.json()["error"]["code"] == expected_code
    assert TOKEN not in response.text


@pytest.mark.parametrize("exception,expected_code,expected_status", [
    (httpx.ReadTimeout, "catalog_timeout", 504),
    (httpx.ConnectError, "catalog_unavailable", 502),
])
def test_transport_failures_have_retryable_public_errors(exception, expected_code, expected_status):
    def handler(request):
        raise exception(TOKEN, request=request)

    with TestClient(make_app(handler)) as client:
        response = client.get("/api/catalog/categories")

    assert response.status_code == expected_status
    assert response.json()["error"]["code"] == expected_code
    assert TOKEN not in response.text


@pytest.mark.parametrize("body", [
    b"not JSON",
    b'{"data":"wrong"}',
    b'{"data":[{"title":"Broken","items":[{"id":"x"}]}]}',
    b'{"data":null}',
])
def test_malformed_provider_data_does_not_reach_the_application(body):
    with TestClient(make_app(lambda request: httpx.Response(200, content=body))) as client:
        response = client.get("/api/catalog/categories")

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "invalid_catalog_response"


def test_empty_catalog_is_a_successful_response():
    with TestClient(make_app(lambda request: httpx.Response(200, json={"data": []}))) as client:
        response = client.get("/api/catalog/categories")

    assert response.status_code == 200
    assert response.json()["data"] == []


def test_browser_origin_is_allowed_without_exposing_credentials():
    with TestClient(make_app(lambda request: httpx.Response(200, json=PAYLOAD))) as client:
        allowed = client.get("/api/catalog/categories", headers={"Origin": "http://localhost:8081"})
        denied = client.get("/api/catalog/categories", headers={"Origin": "https://unrelated.example"})

    assert allowed.headers["Access-Control-Allow-Origin"] == "http://localhost:8081"
    assert "Access-Control-Allow-Credentials" not in allowed.headers
    assert "Access-Control-Allow-Origin" not in denied.headers


def test_missing_publishable_key_does_not_issue_a_token():
    def fail(request):
        pytest.fail("Provider must not be contacted without both keys")

    with TestClient(make_app(fail, publishable_key="", issue_handler=fail)) as client:
        assert client.get("/health").json()["catalog_configured"] is False
        assert client.get("/api/catalog/categories").status_code == 503


@pytest.mark.parametrize("body", [{"error": {"code": []}}, {"error": None}, [], "broken"])
def test_malformed_auth_error_is_sanitized_without_refresh(body):
    issues = []

    def issue(request):
        issues.append(request)
        return httpx.Response(200, json=token_payload())

    with TestClient(make_app(lambda r: httpx.Response(401, json=body), issue_handler=issue)) as client:
        response = client.get("/api/catalog/categories")
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "provider_auth_failed"
    assert len(issues) == 1


def test_token_issuance_uses_partner_key_and_stable_server_identity_once(caplog):
    issues = []

    def issue(request):
        issues.append(request)
        assert request.method == "POST"
        assert request.headers["Authorization"] == f"Bearer {TOKEN}"
        assert "X-Publishable-Key" not in request.headers
        assert json.loads(request.content) == {"external_user_id": "tursim-catalog"}
        from uuid import UUID
        UUID(request.headers["Idempotency-Key"])
        return httpx.Response(201, json=token_payload())

    with TestClient(make_app(lambda r: httpx.Response(200, json=PAYLOAD), issue_handler=issue)) as client:
        assert client.get("/api/catalog/categories?external_user_id=another-user").status_code == 200
        assert client.get("/api/catalog/categories").status_code == 200

    assert len(issues) == 1
    assert all(secret not in caplog.text for secret in (TOKEN, CLIENT_TOKEN, PUBLISHABLE_KEY))


@pytest.mark.parametrize("code", ["token_expired", "token_revoked", "invalid_token"])
def test_rejected_token_is_replaced_and_catalog_retried_once(code):
    issues, reads = [], []

    def issue(request):
        issues.append(request)
        return httpx.Response(200, json=token_payload(f"client-{len(issues)}"))

    def read(request):
        reads.append(request)
        if len(reads) == 1:
            return httpx.Response(401, json={"error": {"code": code}})
        assert request.headers["Authorization"] == "Bearer client-2"
        return httpx.Response(200, json=PAYLOAD)

    with TestClient(make_app(read, issue_handler=issue)) as client:
        response = client.get("/api/catalog/categories")
        assert response.status_code == 200
        assert client.get("/api/catalog/categories").status_code == 200

    assert len(issues) == 2
    assert issues[0].headers["Idempotency-Key"] != issues[1].headers["Idempotency-Key"]
    assert len(reads) == 3


def test_repeated_expiration_does_not_loop():
    issues, reads = [], []

    def issue(request):
        issues.append(request)
        return httpx.Response(200, json=token_payload(f"client-{len(issues)}"))

    def read(request):
        reads.append(request)
        return httpx.Response(401, json={"error": {"code": "token_expired", "title": TOKEN}})

    with TestClient(make_app(read, issue_handler=issue)) as client:
        response = client.get("/api/catalog/categories")
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "provider_auth_failed"
    assert TOKEN not in response.text
    assert len(issues) == len(reads) == 2


def test_expiring_token_is_refreshed_before_catalog_request(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr("app.sdk.monotonic", lambda: clock[0])
    issues, reads = [], []

    def issue(request):
        issues.append(request)
        return httpx.Response(200, json=token_payload(f"client-{len(issues)}"))

    def read(request):
        reads.append(request.headers["Authorization"])
        return httpx.Response(200, json=PAYLOAD)

    with TestClient(make_app(read, issue_handler=issue)) as client:
        assert client.get("/api/catalog/categories").status_code == 200
        clock[0] += 3550  # A one-hour token enters its last minute.
        assert client.get("/api/catalog/categories").status_code == 200
    assert len(issues) == 2
    assert reads == ["Bearer client-1", "Bearer client-2"]


def test_concurrent_catalog_reads_and_refresh_share_one_issuance():
    async def scenario():
        issues = []

        async def handler(request):
            if request.method == "POST":
                issues.append(request)
                await asyncio.sleep(0)  # Let other callers contend for the token lock.
                return httpx.Response(200, json=token_payload(f"client-{len(issues)}"))
            assert request.url.path == "/v1/sdk/esims"
            return httpx.Response(200, json=PAYLOAD)

        async with httpx.AsyncClient(base_url="https://provider.example", transport=httpx.MockTransport(handler)) as client:
            service = CatalogService(client, make_settings())
            results = await asyncio.gather(*(service.get_categories() for _ in range(10)))
            assert all(result.data[0].title == "Популярное" for result in results)
            assert len(issues) == 1
            tokens = await asyncio.gather(*(service.tokens.get_token(rejected_token="client-1") for _ in range(10)))
            assert tokens == ["client-2"] * 10
            assert len(issues) == 2

    asyncio.run(scenario())


@pytest.mark.parametrize("failure", ["timeout", "server_error"])
def test_uncertain_issuance_reuses_idempotency_key_on_retry(failure):
    issues = []

    def issue(request):
        issues.append(request)
        if len(issues) == 1:
            if failure == "timeout":
                raise httpx.ReadTimeout(TOKEN, request=request)
            return httpx.Response(500, json={"error": TOKEN})
        return httpx.Response(200, json=token_payload())

    with TestClient(make_app(lambda r: httpx.Response(200, json=PAYLOAD), issue_handler=issue)) as client:
        response = client.get("/api/catalog/categories")
        assert response.status_code in (502, 504)
        assert TOKEN not in response.text
        assert client.get("/api/catalog/categories").status_code == 200
    assert len(issues) == 2
    assert issues[0].headers["Idempotency-Key"] == issues[1].headers["Idempotency-Key"]


@pytest.mark.parametrize("body", [
    {"data": {"token": "secret"}},
    {"data": {"token": "", "expires_at": "2099-01-01T00:00:00Z"}},
    {"data": {"token": "secret", "expires_at": "2000-01-01T00:00:00Z"}},
    {"data": {"token": "secret", "expires_at": "2099-01-01T00:00:00"}},
    {"data": {"token": "secret", "expires_at": "bad-date"}},
    {"data": None},
])
def test_malformed_token_response_never_reaches_sdk(body):
    def fail(request):
        pytest.fail("SDK must not be called without a usable token")

    with TestClient(make_app(fail, issue_handler=lambda r: httpx.Response(200, json=body))) as client:
        response = client.get("/api/catalog/categories")
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "invalid_token_response"
    assert "secret" not in response.text


@pytest.mark.parametrize("status,expected", [(401, 502), (403, 502), (429, 503), (500, 502), (302, 502)])
def test_issuance_errors_do_not_call_sdk_or_follow_redirects(status, expected):
    issues = []

    def issue(request):
        issues.append(request)
        return httpx.Response(status, json={"error": TOKEN}, headers={"Location": "https://unrelated.example"})

    def fail(request):
        pytest.fail("SDK must not be called after failed issuance")

    with TestClient(make_app(fail, issue_handler=issue)) as client:
        response = client.get("/api/catalog/categories")
    assert response.status_code == expected
    assert TOKEN not in response.text
    assert len(issues) == 1


@pytest.mark.parametrize("price_fields", [
    {},
    {"min_price_amount": None, "min_price_currency": None},
    {"min_price_amount": 0, "min_price_currency": "RUB"},
    {"min_price_amount": 1299, "min_price_currency": "USD"},
])
def test_catalog_preserves_optional_price_and_currency(price_fields):
    payload = {"data": [{"title": "Азия", "items": [{"id": "ae", "name": "ОАЭ", **price_fields}]}]}
    with TestClient(make_app(lambda r: httpx.Response(200, json=payload))) as client:
        response = client.get("/api/catalog/categories")
    assert response.status_code == 200
    item = response.json()["data"][0]["esims"][0]
    assert item["min_price_amount"] == price_fields.get("min_price_amount")
    assert item["min_price_currency"] == price_fields.get("min_price_currency")


@pytest.mark.parametrize("price_fields", [
    {"min_price_amount": -1},
    {"min_price_amount": True},
    {"min_price_amount": "199"},
    {"min_price_amount": 1.5},
    {"min_price_currency": "not-a-currency"},
])
def test_malformed_price_is_not_forwarded(price_fields):
    payload = {"data": [{"title": "Азия", "items": [{"id": "ae", "name": "ОАЭ", **price_fields}]}]}
    with TestClient(make_app(lambda r: httpx.Response(200, json=payload))) as client:
        response = client.get("/api/catalog/categories")
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "invalid_catalog_response"


ESIM_ID = PAYLOAD['data'][0]['items'][0]['id']
TARIFFS_PAYLOAD = {
    'data': {
        'esim': PAYLOAD['data'][0]['items'][0],
        'tariffs': [{
            'id': 'plan-5gb', 'display_name': 'ОАЭ 5ГБ / 15дн',
            'price_amount_minor': 1169, 'price_currency': 'RUB',
            'data_amount': {'amount': 5, 'unit': 'GB'},
            'duration': {'amount': 15, 'unit': 'day'},
            'is_profitable_badge': True, 'private_field': TOKEN,
        }, {
            'id': 'plan-unlimited', 'display_name': 'ОАЭ Безлимит / 15дн',
            'price_amount_minor': 1819, 'price_currency': 'RUB',
            'data_amount': {'amount': 0, 'unit': 'MB'},
            'duration': {'amount': 15, 'unit': 'day'},
            'is_profitable_badge': False,
        }],
    }, 'request_id': 'not-forwarded',
}


def test_tariffs_use_selected_sdk_id_and_reuse_catalog_token():
    reads, issues = [], []

    def issue(request):
        issues.append(request)
        return httpx.Response(200, json=token_payload())

    def read(request):
        reads.append(request.url.path)
        assert request.headers['Authorization'] == f'Bearer {CLIENT_TOKEN}'
        assert request.headers['X-Publishable-Key'] == PUBLISHABLE_KEY
        return httpx.Response(200, json=PAYLOAD if request.url.path == '/v1/sdk/esims' else TARIFFS_PAYLOAD)

    with TestClient(make_app(read, issue_handler=issue)) as client:
        assert client.get('/api/catalog/categories').status_code == 200
        response = client.get(f'/api/catalog/esims/{ESIM_ID}/tariffs')
    assert response.status_code == 200
    data = response.json()['data']
    assert data['esim']['country_iso2'] == 'AE'
    assert data['tariffs'][0]['price_amount_minor'] == 1169
    assert data['tariffs'][0]['is_profitable_badge'] is True
    assert data['tariffs'][0]['is_unlimited'] is False
    assert data['tariffs'][1]['is_unlimited'] is True
    assert TOKEN not in response.text
    assert 'private_field' not in response.text
    assert 'request_id' not in response.text
    assert reads == ['/v1/sdk/esims', f'/v1/sdk/esims/{ESIM_ID}/tariffs']
    assert len(issues) == 1


def test_tariffs_refresh_expired_token_before_retrying_same_destination():
    reads, issues = [], []

    def issue(request):
        issues.append(request)
        return httpx.Response(200, json=token_payload(f'client-{len(issues)}'))

    def read(request):
        reads.append(request.url.path)
        if len(reads) == 1:
            return httpx.Response(401, json={'error': {'code': 'token_expired'}})
        assert request.headers['Authorization'] == 'Bearer client-2'
        return httpx.Response(200, json=TARIFFS_PAYLOAD)

    with TestClient(make_app(read, issue_handler=issue)) as client:
        response = client.get(f'/api/catalog/esims/{ESIM_ID}/tariffs')
    assert response.status_code == 200
    assert reads == [f'/v1/sdk/esims/{ESIM_ID}/tariffs'] * 2
    assert len(issues) == 2


def test_unknown_destination_returns_sanitized_not_found():
    with TestClient(make_app(lambda r: httpx.Response(404, json={'error': TOKEN}))) as client:
        response = client.get(f'/api/catalog/esims/{ESIM_ID}/tariffs')
    assert response.status_code == 404
    assert response.json()['error']['code'] == 'tariffs_not_found'
    assert TOKEN not in response.text


def test_invalid_destination_id_never_contacts_provider():
    def fail(request):
        pytest.fail('Invalid destination must not reach the provider')

    with TestClient(make_app(fail, issue_handler=fail)) as client:
        assert client.get('/api/catalog/esims/not-an-id/tariffs').status_code == 422


def test_country_without_tariffs_is_a_successful_empty_list():
    body = {'data': {'esim': PAYLOAD['data'][0]['items'][0], 'tariffs': []}}
    with TestClient(make_app(lambda r: httpx.Response(200, json=body))) as client:
        response = client.get(f'/api/catalog/esims/{ESIM_ID}/tariffs')
    assert response.status_code == 200
    assert response.json()['data']['tariffs'] == []


@pytest.mark.parametrize('change', ['wrong_id', 'missing_price', 'negative_price', 'zero_duration', 'bad_data', 'zero_without_unlimited_name'])
def test_tariff_validation_and_unlimited_classification(change):
    from copy import deepcopy
    body = deepcopy(TARIFFS_PAYLOAD)
    tariff = body['data']['tariffs'][0]
    if change == 'wrong_id': body['data']['esim']['id'] = 'another-id'
    elif change == 'missing_price': del tariff['price_amount_minor']
    elif change == 'negative_price': tariff['price_amount_minor'] = -1
    elif change == 'zero_duration': tariff['duration']['amount'] = 0
    elif change == 'bad_data': tariff['data_amount']['amount'] = -1
    else: tariff['data_amount']['amount'] = 0
    with TestClient(make_app(lambda r: httpx.Response(200, json=body))) as client:
        response = client.get(f'/api/catalog/esims/{ESIM_ID}/tariffs')
    if change == 'zero_without_unlimited_name':
        assert response.status_code == 200
        assert response.json()['data']['tariffs'][0]['is_unlimited'] is False
    else:
        assert response.status_code == 502
        assert response.json()['error']['code'] == 'invalid_tariffs_response'
