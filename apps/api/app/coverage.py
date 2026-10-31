"""Verified-account opt-in requests; no provider coverage is invented."""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from app.auth import AuthError, bearer, check_origin

class CoverageRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    country_iso2: str = Field(pattern=r'^[A-Z]{2}$')

class CoverageSubscription(BaseModel):
    country_iso2: str
    status: str

class CoverageSubscriptions(BaseModel):
    data: list[CoverageSubscription]

router = APIRouter(tags=['coverage'])

def initialize(conn):
    conn.execute('''CREATE TABLE IF NOT EXISTS coverage_subscriptions (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id),
        country_iso2 TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL, UNIQUE(user_id, country_iso2))''')

def account(request):
    token = bearer(request)
    if not token:
        raise AuthError(401, 'session_expired', 'Войдите по почте, чтобы получить уведомление.')
    return request.app.state.auth.me(token)

@router.get('/api/me/coverage-subscriptions', response_model=CoverageSubscriptions)
def subscriptions(request: Request, response: Response):
    user = account(request)
    response.headers['Cache-Control'] = 'no-store'
    with request.app.state.auth.db() as conn:
        initialize(conn)
        rows = conn.execute('SELECT country_iso2,status FROM coverage_subscriptions WHERE user_id=? AND status!=?', (str(user.id), 'cancelled')).fetchall()
    return CoverageSubscriptions(data=[CoverageSubscription(**dict(row)) for row in rows])

@router.post('/api/me/coverage-subscriptions', response_model=CoverageSubscription)
def subscribe(body: CoverageRequest, request: Request, response: Response):
    check_origin(request)
    user = account(request)
    response.headers['Cache-Control'] = 'no-store'
    with request.app.state.auth.db() as conn:
        initialize(conn)
        existing = conn.execute('SELECT status FROM coverage_subscriptions WHERE user_id=? AND country_iso2=?', (str(user.id), body.country_iso2)).fetchone()
        if not existing:
            count = conn.execute("SELECT COUNT(*) FROM coverage_subscriptions WHERE user_id=? AND status='pending'", (str(user.id),)).fetchone()[0]
            if count >= 250:
                raise AuthError(429, 'coverage_limit', 'Слишком много заявок.')
        conn.execute('''INSERT INTO coverage_subscriptions VALUES (?,?,?,'pending',?)
            ON CONFLICT(user_id,country_iso2) DO UPDATE SET status='pending'
            WHERE coverage_subscriptions.status IN ('cancelled','failed','notified')''',
            (str(uuid4()), str(user.id), body.country_iso2, datetime.now(timezone.utc).isoformat()))
        status = conn.execute('SELECT status FROM coverage_subscriptions WHERE user_id=? AND country_iso2=?', (str(user.id), body.country_iso2)).fetchone()['status']
    return CoverageSubscription(country_iso2=body.country_iso2, status=status)

@router.post('/api/me/coverage-subscriptions/cancel', response_model=CoverageSubscription)
def cancel(body: CoverageRequest, request: Request, response: Response):
    check_origin(request)
    user = account(request)
    response.headers['Cache-Control'] = 'no-store'
    with request.app.state.auth.db() as conn:
        initialize(conn)
        conn.execute("UPDATE coverage_subscriptions SET status='cancelled' WHERE user_id=? AND country_iso2=?", (str(user.id), body.country_iso2))
    return CoverageSubscription(country_iso2=body.country_iso2, status='cancelled')

async def dispatch(auth, catalog, mailer):
    """Run from the separate worker. Claim a request before SMTP, never resend ambiguous delivery."""
    with auth.db() as conn:
        initialize(conn)
        pending = conn.execute("SELECT DISTINCT country_iso2 FROM coverage_subscriptions WHERE status='pending'").fetchall()
    if not pending:
        return 0
    groups = await catalog.get_categories()
    sent = 0
    for row in pending:
        code = row['country_iso2']
        country = next((item for group in groups.data for item in group.esims if item.country_iso2 == code), None)
        if not country:
            continue
        tariffs = await catalog.get_tariffs(str(country.id))
        if not tariffs.data.tariffs:
            continue
        with auth.db() as conn:
            recipients = conn.execute("SELECT c.id,u.email FROM coverage_subscriptions c JOIN auth_users u ON u.id=c.user_id WHERE c.country_iso2=? AND c.status='pending'", (code,)).fetchall()
        for recipient in recipients:
            with auth.db() as conn:
                claimed = conn.execute("UPDATE coverage_subscriptions SET status='sending' WHERE id=? AND status='pending'", (recipient['id'],)).rowcount
            if not claimed:
                continue
            try:
                mailer(recipient['email'], country.display_name)
            except Exception:
                # Delivery can be ambiguous after SMTP accepts a message. Manual reconciliation only.
                with auth.db() as conn:
                    conn.execute("UPDATE coverage_subscriptions SET status='failed' WHERE id=? AND status='sending'", (recipient['id'],))
                continue
            with auth.db() as conn:
                conn.execute("UPDATE coverage_subscriptions SET status='notified' WHERE id=? AND status='sending'", (recipient['id'],))
            sent += 1
    return sent
