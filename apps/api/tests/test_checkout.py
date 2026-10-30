from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import asyncio
import json
import time
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

ESIM_ID = '1594055e-edd8-4018-98cd-04566e617f71'
TARIFF_ID = 'ebaa2a02-9cf6-490a-98d1-4c8dd06b0020'
ITEM_ID = 'b4391be4-9ec0-4b76-ad4c-895ee1d3710e'


class Provider:
    def __init__(self):
        self.requests, self.orders, self.keys = [], {}, {}
        self.amount = 1169
        self.tokens = {}
        self.timeout_once = False
        self.expired_once = False
        self.decline = False
        self.slow = False
        self.unsafe_url = False
        self.mismatch = False
        self.create_amount = None
        self.conflict = False
        self.qr_body = b'\x89PNG\r\n\x1a\n' + b'test-image'

    def item(self):
        return {'id': TARIFF_ID, 'display_name': '5 ГБ', 'price_amount_minor': self.amount, 'price_currency': 'RUB',
                'data_amount': {'amount': 5, 'unit': 'GB'}, 'duration': {'amount': 15, 'unit': 'day'}, 'is_profitable_badge': False,
                'esim': {'id': str(uuid4()) if self.mismatch else ESIM_ID, 'country': 'TR', 'name': 'Турция', 'image_url': None}}

    def order(self, order_id):
        record = self.orders[order_id]
        state = record.get('state', 'pending_payment')
        amount = record['amount']
        payment_state = record.get('payment_state', 'pending' if state == 'pending_payment' else 'captured')
        return {'data': {
            'id': order_id, 'order_number': 10001, 'state': state, 'created_at': datetime.now(timezone.utc).isoformat(),
            'total_amount_minor': amount, 'total_currency': 'RUB',
            'esim': {'id': ESIM_ID, 'name': 'Турция', 'image': None},
            'tariff': {'id': TARIFF_ID, 'data_amount': {'amount': 5, 'unit': 'GB'}, 'duration': {'amount': 15, 'unit': 'day'}},
            'items': [{'id': ITEM_ID, 'storefront_plan_id': TARIFF_ID, 'display_name': '5 ГБ', 'price_amount_minor': amount,
                       'price_currency': 'RUB', 'data_amount': {'amount': 5, 'unit': 'GB'}, 'duration': {'amount': 15, 'unit': 'day'}}],
            'payment': {'state': payment_state, 'amount_minor': amount, 'currency': 'RUB',
                        'url': ('https://untrusted.example/steal' if self.unsafe_url else 'https://payform.aurapay.tech/test-payment') if state == 'pending_payment' else None,
                        'expires_at': (datetime.now(timezone.utc) + timedelta(minutes=20)).isoformat() if state == 'pending_payment' else None,
                        'failure_code': 'card_declined' if payment_state == 'failed' else None},
            'provision': record.get('provision'), 'remaining': None, 'esim_status': record.get('esim_status'),
            'private_provider_field': 'never-return-this',
        }}

    async def dispatch(self, request):
        self.requests.append(request)
        if request.url.host == 'qr-storage.example':
            assert 'Authorization' not in request.headers
            assert 'X-Publishable-Key' not in request.headers
            return httpx.Response(200, content=self.qr_body, headers={'Content-Type': 'image/png'})
        path = request.url.path
        body = json.loads(request.content) if request.content else None
        if path == '/v1/partner/client-tokens':
            external = body['external_user_id']
            self.tokens[external] = self.tokens.get(external, 0) + 1
            return httpx.Response(200, json={'data': {'token': f'{external}|{self.tokens[external]}',
                'expires_at': (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()}})
        if path == f'/v1/sdk/esims/{ESIM_ID}/tariffs':
            item = self.item()
            return httpx.Response(200, json={'data': {'esim': item.pop('esim'), 'tariffs': [item]}})
        external = request.headers.get('Authorization', '').removeprefix('Bearer ').split('|')[0]
        if path == '/v1/sdk/orders/summary':
            assert body == {'ids': [TARIFF_ID]}
            return httpx.Response(200, json={'data': {'items': [self.item()], 'total_amount_minor': self.amount, 'total_currency': 'RUB'}})
        if path == '/v1/sdk/orders' and request.method == 'POST':
            key = request.headers['Idempotency-Key']
            assert body['ids'] == [TARIFF_ID]
            assert set(body) <= {'ids', 'return_url'}
            if self.conflict:
                return httpx.Response(422, json={'error': {'code': 'idempotency_conflict'}})
            if self.expired_once:
                self.expired_once = False
                return httpx.Response(401, json={'error': {'code': 'token_expired'}})
            if self.slow:
                await asyncio.sleep(0.15)
            if key not in self.keys:
                order_id = str(uuid4())
                self.keys[key] = order_id
                self.orders[order_id] = {'owner': external, 'amount': self.amount if self.create_amount is None else self.create_amount}
            order_id = self.keys[key]
            if self.timeout_once:
                self.timeout_once = False
                raise httpx.ReadTimeout('simulated uncertainty', request=request)
            if self.decline:
                self.orders[order_id].update(state='failed', payment_state='failed')
                return httpx.Response(402, json={'error': {'code': 'payment_declined', 'detail': f'order_id={order_id}'}})
            return httpx.Response(201, json=self.order(order_id))
        if path == '/v1/sdk/orders' and request.method == 'GET':
            items = []
            for order_id, record in self.orders.items():
                if record['owner'] == external:
                    value = self.order(order_id)['data']
                    items.append({k: v for k, v in value.items() if k not in {'payment', 'provision', 'items'}})
            return httpx.Response(200, json={'data': items, 'meta': {'has_more': False}})
        if path.startswith('/v1/sdk/orders/'):
            order_id = path.rsplit('/', 1)[-1]
            if order_id in self.orders and self.orders[order_id]['owner'] == external:
                return httpx.Response(200, json=self.order(order_id))
            return httpx.Response(404, json={'error': {'code': 'order_not_found'}})
        raise AssertionError(f'Unexpected provider request: {request.method} {path}')


@pytest.fixture
def checkout_env(tmp_path):
    provider, outbox, now = Provider(), [], [int(time.time())]
    settings = Settings(_env_file=None, esim_partner_token='sk_test_only', esim_publishable_key='pk_test_only',
                        auth_database_path=tmp_path / 'auth.sqlite3', orders_database_path=tmp_path / 'orders.sqlite3',
                        auth_otp_secret='checkout-test-secret-' * 3, smtp_username='sender@example.com', smtp_password='test-only', mail_from='sender@example.com')
    app = create_app(settings, provider_transport=httpx.MockTransport(provider.dispatch), auth_mailer=lambda email, code: outbox.append((email, code)), auth_clock=lambda: now[0])
    with TestClient(app) as client:
        yield client, provider, outbox, now, settings


def login(env, email='buyer@example.com'):
    client, _, outbox, _, _ = env
    challenge = client.post('/api/auth/email/send-code', json={'email': email}).json()
    result = client.post('/api/auth/email/verify', json={'challenge_id': challenge['challenge_id'], 'code': outbox[-1][1], 'client': 'native'})
    assert result.status_code == 200, result.text
    return {'Authorization': 'Bearer ' + result.json()['access_token']}, result.json()['user']['id']


def selection(**extra):
    return {'esim_id': ESIM_ID, 'tariff_id': TARIFF_ID, **extra}


def quote(client, headers):
    response = client.post('/api/checkout/summary', json=selection(), headers=headers)
    assert response.status_code == 200, response.text
    return response.json()['data']


def create(client, headers, quote_id):
    return client.post('/api/orders', json={'quote_id': quote_id}, headers=headers)


def test_guest_preview_is_read_only_catalog_price(checkout_env):
    client, provider, *_ = checkout_env
    data = quote(client, {})
    assert data['amount'] == 1169 and data['ordering_available'] is False
    assert data['quote_id'] is None and data['price_source'] == 'catalog'
    assert not any(r.url.path.startswith('/v1/sdk/orders') for r in provider.requests)


def test_personal_summary_and_payload_match_supplied_swagger(checkout_env):
    client, provider, *_ = checkout_env
    headers, user_id = login(checkout_env)
    data = quote(client, headers)
    assert data['ordering_available'] is True and data['quote_id'] and data['price_source'] == 'provider'
    issued = [json.loads(r.content)['external_user_id'] for r in provider.requests if r.url.path == '/v1/partner/client-tokens']
    assert issued == [f'tursim-user:{user_id}']
    assert 'tursim-catalog' not in issued


def test_order_creation_returns_payment_url_and_repeat_does_not_create_again(checkout_env):
    client, provider, *_ = checkout_env
    headers, _ = login(checkout_env)
    data = quote(client, headers)
    first = create(client, headers, data['quote_id'])
    second = create(client, headers, data['quote_id'])
    assert first.status_code == second.status_code == 201, first.text
    assert first.json()['data']['id'] == second.json()['data']['id']
    assert first.json()['data']['payment']['url'].startswith('https://payform.aurapay.tech/')
    assert len(provider.orders) == 1
    assert len([r for r in provider.requests if r.url.path == '/v1/sdk/orders' and r.method == 'POST']) == 1
    assert first.headers['cache-control'] == 'no-store'
    assert 'never-return-this' not in first.text


def test_uncertain_result_keeps_key_and_quote_even_after_restart(checkout_env):
    client, provider, _, now, settings = checkout_env
    headers, _ = login(checkout_env)
    data = quote(client, headers)
    provider.timeout_once = True
    assert create(client, headers, data['quote_id']).status_code == 504
    assert quote(client, headers)['quote_id'] == data['quote_id']
    # Configuration changes must not alter the payload of an uncertain attempt.
    changed_settings = settings.model_copy(update={'esim_payment_return_url': 'https://approved.example/return/{order_id}'})
    restarted = create_app(changed_settings, provider_transport=httpx.MockTransport(provider.dispatch), auth_clock=lambda: now[0])
    with TestClient(restarted) as other:
        result = create(other, headers, data['quote_id'])
    assert result.status_code == 201, result.text
    requests = [r for r in provider.requests if r.url.path == '/v1/sdk/orders' and r.method == 'POST']
    assert len(requests) == 2
    assert requests[0].headers['Idempotency-Key'] == requests[1].headers['Idempotency-Key']
    assert requests[0].content == requests[1].content
    assert len(provider.orders) == 1


def test_refreshing_expired_sdk_token_preserves_order_idempotency_header(checkout_env):
    client, provider, *_ = checkout_env
    headers, _ = login(checkout_env)
    data = quote(client, headers)
    provider.expired_once = True
    result = create(client, headers, data['quote_id'])
    assert result.status_code == 201, result.text
    requests = [r for r in provider.requests if r.url.path == '/v1/sdk/orders' and r.method == 'POST']
    assert len(requests) == 2 and requests[0].headers['Idempotency-Key'] == requests[1].headers['Idempotency-Key']
    assert requests[0].headers['Authorization'] != requests[1].headers['Authorization']
    assert len(provider.orders) == 1


def test_parallel_submit_creates_one_provider_order(checkout_env):
    client, provider, *_ = checkout_env
    headers, _ = login(checkout_env)
    data = quote(client, headers)
    provider.slow = True
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: create(client, headers, data['quote_id']), range(2)))
    assert sorted(r.status_code for r in responses) == [201, 409]
    assert len(provider.orders) == 1


def test_quote_and_order_are_bound_to_current_user(checkout_env):
    client, provider, *_ = checkout_env
    owner, _ = login(checkout_env)
    other, _ = login(checkout_env, 'other@example.com')
    data = quote(client, owner)
    assert create(client, other, data['quote_id']).status_code == 404
    result = create(client, owner, data['quote_id'])
    order_id = result.json()['data']['id']
    count = len(provider.requests)
    assert client.get('/api/orders/' + order_id, headers=other).status_code == 404
    assert len(provider.requests) == count
    assert client.get('/api/orders', headers=other).json()['data'] == []


def test_changed_price_or_expired_quote_does_not_create_order(checkout_env):
    client, provider, _, now, _ = checkout_env
    headers, _ = login(checkout_env)
    data = quote(client, headers)
    provider.amount = 1200
    result = create(client, headers, data['quote_id'])
    assert result.status_code == 409 and result.json()['error']['code'] == 'price_changed'
    fresh = quote(client, headers)
    now[0] += 301
    result = create(client, headers, fresh['quote_id'])
    assert result.status_code == 409 and result.json()['error']['code'] == 'quote_expired'
    assert provider.orders == {}


def test_price_race_after_authorization_is_reported_for_explicit_review(checkout_env):
    client, provider, *_ = checkout_env
    headers, _ = login(checkout_env)
    data = quote(client, headers)
    provider.create_amount = 1200
    result = create(client, headers, data['quote_id'])
    assert result.status_code == 201 and result.json()['data']['price_changed'] is True
    assert result.json()['data']['total_amount_minor'] == 1200


def test_payment_declined_order_is_recovered_without_reissue(checkout_env):
    client, provider, *_ = checkout_env
    headers, _ = login(checkout_env)
    data = quote(client, headers)
    provider.decline = True
    result = create(client, headers, data['quote_id'])
    assert result.status_code == 201, result.text
    assert result.json()['data']['state'] == 'failed'
    assert result.json()['data']['payment']['url'] is None
    assert len(provider.orders) == 1


def test_order_state_is_authoritative_and_cancelled_provision_is_hidden(checkout_env):
    client, provider, *_ = checkout_env
    headers, _ = login(checkout_env)
    order_id = create(client, headers, quote(client, headers)['quote_id']).json()['data']['id']
    secret = {'state': 'delivered', 'iccid': 'test-iccid', 'activation_code': 'LPA:1$test$secret', 'smdp_address': 'test', 'matching_id': 'secret', 'qr_code_url': 'https://example.com/test-qr.png'}
    provider.orders[order_id].update(state='delivered', provision=secret)
    delivered = client.get('/api/orders/' + order_id, headers=headers).json()['data']
    assert delivered['provision']['activation_code'] == secret['activation_code']
    assert delivered['payment']['url'] is None
    provider.orders[order_id].update(state='cancelled', payment_state='refunded')
    cancelled = client.get('/api/orders/' + order_id, headers=headers)
    assert cancelled.json()['data']['provision'] is None
    assert 'LPA:' not in cancelled.text
    with client.app.state.orders.store.db() as conn:
        persisted = '\n'.join(conn.iterdump())
    assert secret['activation_code'] not in persisted
    assert secret['qr_code_url'] not in persisted
    assert 'payform.aurapay.tech' not in persisted


def test_unsafe_payment_redirect_is_not_exposed(checkout_env):
    client, provider, *_ = checkout_env
    headers, _ = login(checkout_env)
    provider.unsafe_url = True
    result = create(client, headers, quote(client, headers)['quote_id'])
    assert result.status_code == 201 and result.json()['data']['payment']['url'] is None
    assert 'untrusted.example' not in result.text


def test_decimal_major_units_are_not_truncated_or_rescaled(checkout_env):
    client, provider, *_ = checkout_env
    headers, _ = login(checkout_env)
    provider.amount = 45.5
    data = quote(client, headers)
    assert data['amount'] == data['tariff']['price_amount_minor'] == 45.5
    result = create(client, headers, data['quote_id'])
    assert result.status_code == 201 and result.json()['data']['total_amount_minor'] == 45.5


def test_summary_rejects_mismatched_country_and_injected_price(checkout_env):
    client, provider, *_ = checkout_env
    headers, _ = login(checkout_env)
    provider.mismatch = True
    assert client.post('/api/checkout/summary', json=selection(), headers=headers).status_code == 502
    result = client.post('/api/checkout/summary', json=selection(amount=1, email='private@example.com'))
    assert result.status_code == 422 and 'private@example.com' not in result.text
    assert provider.orders == {}


def test_promo_and_untrusted_origin_are_rejected_without_purchase(checkout_env):
    client, provider, *_ = checkout_env
    assert client.post('/api/checkout/summary', json=selection(promo_code='TEST50')).status_code == 422
    assert client.post('/api/checkout/summary', json=selection(), headers={'Origin': 'https://untrusted.example'}).status_code == 403
    assert client.post('/api/orders', json={'quote_id': str(uuid4())}).status_code == 401
    assert provider.requests == []


def test_reopening_pending_checkout_resumes_same_order(checkout_env):
    client, provider, *_ = checkout_env
    headers, _ = login(checkout_env)
    first_quote = quote(client, headers)
    first = create(client, headers, first_quote['quote_id']).json()['data']
    resumed = quote(client, headers)
    assert resumed['quote_id'] == first_quote['quote_id']
    assert resumed['existing_order_id'] == first['id']
    assert create(client, headers, resumed['quote_id']).json()['data']['id'] == first['id']
    assert len(provider.orders) == 1


def test_completed_order_allows_a_new_explicit_purchase(checkout_env):
    client, provider, *_ = checkout_env
    headers, _ = login(checkout_env)
    old = quote(client, headers)
    order_id = create(client, headers, old['quote_id']).json()['data']['id']
    provider.orders[order_id].update(state='delivered')
    new = quote(client, headers)
    assert new['quote_id'] != old['quote_id']
    assert new['existing_order_id'] is None
    assert len(provider.orders) == 1  # A fresh summary alone never purchases.


def test_expired_payment_and_partial_delivery_do_not_fake_a_usable_link(checkout_env):
    client, provider, _, now, _ = checkout_env
    headers, _ = login(checkout_env)
    order_id = create(client, headers, quote(client, headers)['quote_id']).json()['data']['id']
    original = provider.order

    def expired_payment(value):
        response = original(value)
        response['data']['payment']['expires_at'] = datetime.fromtimestamp(now[0] - 1, timezone.utc).isoformat()
        return response

    provider.order = expired_payment
    result = client.get('/api/orders/' + order_id, headers=headers)
    assert result.status_code == 200 and result.json()['data']['payment']['url'] is None
    provider.order = original
    provider.orders[order_id].update(state='delivered', provision={'state': 'delivered'})
    partial = client.get('/api/orders/' + order_id, headers=headers)
    assert partial.status_code == 200
    assert partial.json()['data']['provision']['activation_code'] == ''
    provider.orders[order_id]['provision'].update(
        activation_code='LPA:1$test$secret', qr_code_url='https://example.com/expired-qr.png',
        qr_code_url_expires=datetime.fromtimestamp(now[0] - 1, timezone.utc).isoformat())
    delivered = client.get('/api/orders/' + order_id, headers=headers).json()['data']
    assert delivered['provision']['activation_code'] == 'LPA:1$test$secret'
    assert delivered['provision']['qr_code_url'] == ''


def test_idempotency_conflict_does_not_start_a_fresh_purchase(checkout_env):
    client, provider, *_ = checkout_env
    headers, _ = login(checkout_env)
    old = quote(client, headers)
    provider.timeout_once = True
    assert create(client, headers, old['quote_id']).status_code == 504
    provider.conflict = True
    conflict = create(client, headers, old['quote_id'])
    assert conflict.status_code == 409 and conflict.json()['error']['code'] == 'order_unconfirmed'
    resumed = quote(client, headers)
    assert resumed['quote_id'] == old['quote_id']
    assert create(client, headers, resumed['quote_id']).status_code == 409
    posts = [r for r in provider.requests if r.url.path == '/v1/sdk/orders' and r.method == 'POST']
    assert len({r.headers['Idempotency-Key'] for r in posts}) == 1
    assert len(provider.orders) == 1


def test_qr_download_is_private_fresh_and_only_for_delivered_orders(checkout_env):
    client, provider, *_ = checkout_env
    headers, _ = login(checkout_env)
    other, _ = login(checkout_env, 'another-buyer@example.com')
    order_id = create(client, headers, quote(client, headers)['quote_id']).json()['data']['id']
    path = '/api/orders/' + order_id + '/qr'
    assert client.get(path).status_code == 401
    assert client.get(path, headers=other).status_code == 404
    assert client.get(path, headers=headers).status_code == 409
    assert not any(r.url.host == 'qr-storage.example' for r in provider.requests)
    provider.orders[order_id].update(state='delivered', provision={
        'state': 'delivered', 'activation_code': 'LPA:1$test$secret',
        'qr_code_url': 'https://qr-storage.example/private-qr.png?signature=test-only',
    })
    downloaded = client.get(path, headers=headers)
    assert downloaded.status_code == 200 and downloaded.content == provider.qr_body
    assert downloaded.headers['content-type'] == 'image/png'
    assert downloaded.headers['cache-control'] == 'no-store'
    assert 'attachment;' in downloaded.headers['content-disposition']
    assert provider.requests[-2].url.path == '/v1/sdk/orders/' + order_id
    assert provider.requests[-1].url.host == 'qr-storage.example'
    provider.orders[order_id].update(state='cancelled', payment_state='refunded')
    count = len([r for r in provider.requests if r.url.host == 'qr-storage.example'])
    assert client.get(path, headers=headers).status_code == 409
    assert len([r for r in provider.requests if r.url.host == 'qr-storage.example']) == count


@pytest.mark.parametrize('body', [b'<html>not an image</html>', b'\x89PNG\r\n\x1a\n' + b'x' * (2 * 1024 * 1024)], ids=['not-image', 'too-large'])
def test_qr_download_rejects_invalid_or_oversized_images(checkout_env, body):
    client, provider, *_ = checkout_env
    headers, _ = login(checkout_env)
    order_id = create(client, headers, quote(client, headers)['quote_id']).json()['data']['id']
    provider.orders[order_id].update(state='delivered', provision={
        'state': 'delivered', 'qr_code_url': 'https://qr-storage.example/private.png',
    })
    provider.qr_body = body
    response = client.get('/api/orders/' + order_id + '/qr', headers=headers)
    assert response.status_code == 502
    assert 'not an image' not in response.text
