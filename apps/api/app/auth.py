"""Email-code authentication for local testing; SMTP secrets stay on the server."""
from contextlib import contextmanager
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import parseaddr
import hashlib
import hmac
import secrets
import smtplib
import sqlite3
import ssl
import threading
import time
from uuid import uuid4

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth_models import AuthErrorResponse, AuthUser, MeResponse, RefreshRequest, SendCodeRequest, SendCodeResponse, SessionResponse, VerifyCodeRequest
from app.config import Settings

ACCESS_TTL = 15 * 60
SESSION_TTL = 30 * 24 * 60 * 60
COOKIE_NAME = "tursim_refresh"


class AuthError(Exception):
    def __init__(self, status: int, code: str, message: str, retry_after: int | None = None):
        self.status, self.code, self.message, self.retry_after = status, code, message, retry_after


def send_smtp_code(settings: Settings, recipient: str, code: str) -> None:
    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = recipient
    message["Subject"] = "Код для входа в ТурСим"
    minutes = settings.auth_otp_ttl_seconds // 60
    message.set_content(f"Ваш код для входа в ТурСим: {code}\n\nКод действует {minutes} мин. Никому его не сообщайте.\nЕсли вы не запрашивали код, просто проигнорируйте письмо.")
    context = ssl.create_default_context()
    if settings.smtp_use_ssl:
        connection = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15, context=context)
    else:
        connection = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
    with connection as smtp:
        if not settings.smtp_use_ssl:
            smtp.ehlo()
            smtp.starttls(context=context)
            smtp.ehlo()
        smtp.login(settings.smtp_username.strip(), settings.smtp_password.get_secret_value().replace(" ", ""))
        refused = smtp.send_message(message)
        if refused:
            raise smtplib.SMTPException("Recipient rejected")


SCHEMA = """
CREATE TABLE IF NOT EXISTS auth_users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_challenges (
    id TEXT PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL,
    status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_challenge_email ON auth_challenges(email, created_at);
CREATE TABLE IF NOT EXISTS auth_events (
    kind TEXT NOT NULL, email_key TEXT NOT NULL, ip_key TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_event_time ON auth_events(kind, created_at);
CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id),
    access_hash TEXT NOT NULL UNIQUE, refresh_hash TEXT NOT NULL UNIQUE,
    access_expires_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
PRAGMA user_version = 1;
"""


class AuthService:
    def __init__(self, settings: Settings, mailer=None, clock=None):
        self.settings = settings
        self.mailer = mailer or (lambda email, code: send_smtp_code(settings, email, code))
        self.clock = clock or time.time
        self._initialized = False
        self._lock = threading.Lock()

    @contextmanager
    def db(self):
        path = self.settings.auth_database_path
        with self._lock:
            if not self._initialized:
                path.parent.mkdir(parents=True, exist_ok=True)
                with sqlite3.connect(path, timeout=10) as conn:
                    conn.execute("PRAGMA journal_mode=WAL")
                    conn.executescript(SCHEMA)
                self._initialized = True
        conn = sqlite3.connect(path, timeout=10, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
        finally:
            conn.close()

    def digest(self, value: str) -> str:
        return hmac.new(self.settings.auth_otp_secret.get_secret_value().encode(), value.encode(), hashlib.sha256).hexdigest()

    @staticmethod
    def token_hash(value: str) -> str:
        return hashlib.sha256(value.encode()).hexdigest()

    def require_secret(self):
        if len(self.settings.auth_otp_secret.get_secret_value()) < 32:
            raise AuthError(503, "auth_not_configured", "Вход временно недоступен.")

    def require_smtp(self):
        self.require_secret()
        sender = self.settings.mail_from
        if not (self.settings.smtp_host.strip() and self.settings.smtp_username.strip() and self.settings.smtp_password.get_secret_value().strip() and sender.strip()) or "\r" in sender or "\n" in sender or "@" not in parseaddr(sender)[1]:
            raise AuthError(503, "mail_not_configured", "Отправка кода временно недоступна.")

    def send_code(self, email: str, ip: str) -> SendCodeResponse:
        self.require_smtp()
        now = int(self.clock())
        email_key, ip_key = self.digest("email:" + email.casefold()), self.digest("ip:" + ip)
        challenge_id = str(uuid4())
        code = f"{secrets.randbelow(1_000_000):06d}"
        code_hash = self.digest(f"otp:{challenge_id}:{email}:{code}")
        with self.db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            latest = conn.execute("SELECT MAX(created_at) FROM auth_events WHERE kind='send' AND email_key=?", (email_key,)).fetchone()[0]
            if latest is not None and now - latest < 60:
                raise AuthError(429, "resend_too_soon", "Подождите перед повторной отправкой.", 60 - (now - latest))
            email_count = conn.execute("SELECT COUNT(*) FROM auth_events WHERE kind='send' AND email_key=? AND created_at>?", (email_key, now - 3600)).fetchone()[0]
            ip_count = conn.execute("SELECT COUNT(*) FROM auth_events WHERE kind='send' AND ip_key=? AND created_at>?", (ip_key, now - 3600)).fetchone()[0]
            if email_count >= 6 or ip_count >= 20:
                raise AuthError(429, "send_rate_limited", "Слишком много запросов. Попробуйте через час.", 3600)
            conn.execute("DELETE FROM auth_events WHERE created_at<?", (now - 86400,))
            conn.execute("DELETE FROM auth_challenges WHERE expires_at<?", (now - 86400,))
            conn.execute("DELETE FROM auth_sessions WHERE expires_at<=?", (now,))
            conn.execute("INSERT INTO auth_events VALUES ('send',?,?,?)", (email_key, ip_key, now))
            conn.execute("INSERT INTO auth_challenges (id,email,code_hash,status,created_at,expires_at) VALUES (?,?,?,'pending',?,?)", (challenge_id, email, code_hash, now, now + self.settings.auth_otp_ttl_seconds))
            conn.commit()
        try:
            self.mailer(email, code)
        except (smtplib.SMTPException, OSError):
            with self.db() as conn:
                conn.execute("UPDATE auth_challenges SET status='failed',code_hash='' WHERE id=?", (challenge_id,))
            # SMTP exceptions may contain credentials or message data.
            raise AuthError(502, "mail_send_failed", "Не удалось отправить письмо. Попробуйте через минуту.", 60) from None
        with self.db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            conn.execute("UPDATE auth_challenges SET status='superseded',code_hash='' WHERE email=? AND status='sent'", (email,))
            conn.execute("UPDATE auth_challenges SET status='sent',expires_at=? WHERE id=?", (int(self.clock()) + self.settings.auth_otp_ttl_seconds, challenge_id))
            conn.commit()
        return SendCodeResponse(challenge_id=challenge_id, email=email, expires_in=self.settings.auth_otp_ttl_seconds, resend_after_seconds=60)

    def user(self, row) -> AuthUser:
        return AuthUser(id=row["id"], email=row["email"], created_at=datetime.fromtimestamp(row["created_at"], timezone.utc))

    def new_session(self, conn, user, now: int):
        access, refresh = secrets.token_urlsafe(32), secrets.token_urlsafe(48)
        conn.execute("INSERT INTO auth_sessions VALUES (?,?,?,?,?,?)", (str(uuid4()), str(user.id), self.token_hash(access), self.token_hash(refresh), now + ACCESS_TTL, now + SESSION_TTL))
        return SessionResponse(user=user, access_token=access, expires_in=ACCESS_TTL, refresh_token=refresh), SESSION_TTL

    def verify_code(self, challenge_id: str, code: str, ip: str):
        self.require_secret()
        now, ip_key = int(self.clock()), self.digest("ip:" + ip)
        with self.db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT * FROM auth_challenges WHERE id=?", (challenge_id,)).fetchone()
            email_key = self.digest("email:" + row["email"].casefold()) if row else ""
            ip_count = conn.execute("SELECT COUNT(*) FROM auth_events WHERE kind='verify' AND ip_key=? AND created_at>?", (ip_key, now - 300)).fetchone()[0]
            email_count = conn.execute("SELECT COUNT(*) FROM auth_events WHERE kind='verify' AND email_key=? AND created_at>?", (email_key, now - 3600)).fetchone()[0] if row else 0
            if ip_count >= 60 or email_count >= 10:
                raise AuthError(429, "verify_rate_limited", "Слишком много попыток. Попробуйте позже.", 3600 if email_count >= 10 else 300)
            conn.execute("INSERT INTO auth_events VALUES ('verify',?,?,?)", (email_key, ip_key, now))
            if not row or row["status"] != "sent" or row["expires_at"] <= now or row["attempts"] >= 5:
                conn.commit()
                raise AuthError(400, "code_invalid", "Код недействителен или истёк. Запросите новый.")
            expected = self.digest(f"otp:{challenge_id}:{row['email']}:{code}")
            if not hmac.compare_digest(expected, row["code_hash"]):
                conn.execute("UPDATE auth_challenges SET attempts=attempts+1 WHERE id=?", (challenge_id,))
                conn.commit()
                raise AuthError(400, "code_incorrect", "Неверный код. Проверьте письмо и попробуйте ещё раз.")
            conn.execute("UPDATE auth_challenges SET status='used',code_hash='' WHERE id=?", (challenge_id,))
            existing = conn.execute("SELECT * FROM auth_users WHERE email=?", (row["email"],)).fetchone()
            if existing is None:
                conn.execute("INSERT INTO auth_users VALUES (?,?,?)", (str(uuid4()), row["email"], now))
                existing = conn.execute("SELECT * FROM auth_users WHERE email=?", (row["email"],)).fetchone()
            result = self.new_session(conn, self.user(existing), now)
            conn.commit()
            return result

    def refresh(self, token: str):
        now = int(self.clock())
        with self.db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT * FROM auth_sessions WHERE refresh_hash=? AND expires_at>?", (self.token_hash(token), now)).fetchone()
            if row is None:
                raise AuthError(401, "session_expired", "Войдите по почте ещё раз.")
            user = self.user(conn.execute("SELECT * FROM auth_users WHERE id=?", (row["user_id"],)).fetchone())
            access, refresh = secrets.token_urlsafe(32), secrets.token_urlsafe(48)
            conn.execute("UPDATE auth_sessions SET access_hash=?,refresh_hash=?,access_expires_at=? WHERE id=?", (self.token_hash(access), self.token_hash(refresh), now + ACCESS_TTL, row["id"]))
            conn.commit()
            return SessionResponse(user=user, access_token=access, expires_in=ACCESS_TTL, refresh_token=refresh), row["expires_at"] - now

    def me(self, access: str):
        with self.db() as conn:
            row = conn.execute("SELECT u.* FROM auth_users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.access_hash=? AND s.access_expires_at>? AND s.expires_at>?", (self.token_hash(access), int(self.clock()), int(self.clock()))).fetchone()
            if row is None:
                raise AuthError(401, "session_expired", "Войдите по почте ещё раз.")
            return self.user(row)

    def logout(self, refresh: str | None, access: str | None):
        with self.db() as conn:
            conn.execute("DELETE FROM auth_sessions WHERE refresh_hash=? OR access_hash=?", (self.token_hash(refresh or ""), self.token_hash(access or "")))


def bearer(request: Request) -> str | None:
    value = request.headers.get("Authorization", "")
    scheme, _, token = value.partition(" ")
    return token if scheme.lower() == "bearer" and token and len(token) <= 256 else None


def check_origin(request: Request, required=False):
    origin = request.headers.get("origin")
    if (required and not origin) or (origin is not None and origin not in request.app.state.auth.settings.api_cors_origins):
        raise AuthError(403, "origin_not_allowed", "Запрос отклонён. Откройте приложение заново.")


def session_response(result, response: Response, client: str, settings: Settings):
    body, remaining = result
    response.headers["Cache-Control"] = "no-store"
    if client == "web":
        response.set_cookie(COOKIE_NAME, body.refresh_token, max_age=remaining, httponly=True, secure=settings.auth_cookie_secure, samesite="lax", path="/api/auth")
        body.refresh_token = None
    return body


bearer_scheme = HTTPBearer(auto_error=False)
router = APIRouter(tags=["auth"], responses={status: {"model": AuthErrorResponse} for status in (400, 401, 403, 422, 429, 502, 503)})


@router.post("/api/auth/email/send-code", response_model=SendCodeResponse)
def send_code(body: SendCodeRequest, request: Request, response: Response):
    check_origin(request)
    response.headers["Cache-Control"] = "no-store"
    return request.app.state.auth.send_code(body.email, request.client.host if request.client else "unknown")


@router.post("/api/auth/email/verify", response_model=SessionResponse)
def verify_code(body: VerifyCodeRequest, request: Request, response: Response):
    check_origin(request, required=body.client == "web")
    service = request.app.state.auth
    result = service.verify_code(str(body.challenge_id), body.code, request.client.host if request.client else "unknown")
    return session_response(result, response, body.client, service.settings)


@router.post("/api/auth/refresh", response_model=SessionResponse)
def refresh(body: RefreshRequest, request: Request, response: Response):
    check_origin(request, required=body.client == "web")
    token = request.cookies.get(COOKIE_NAME) if body.client == "web" else (body.refresh_token.get_secret_value() if body.refresh_token else None)
    if not token:
        raise AuthError(401, "session_expired", "Войдите по почте ещё раз.")
    service = request.app.state.auth
    return session_response(service.refresh(token), response, body.client, service.settings)


@router.post("/api/auth/logout", status_code=204)
def logout(body: RefreshRequest, request: Request, response: Response):
    check_origin(request, required=body.client == "web")
    token = request.cookies.get(COOKIE_NAME) if body.client == "web" else (body.refresh_token.get_secret_value() if body.refresh_token else None)
    request.app.state.auth.logout(token, bearer(request))
    response.delete_cookie(COOKIE_NAME, path="/api/auth", httponly=True, secure=request.app.state.auth.settings.auth_cookie_secure, samesite="lax")
    response.headers["Cache-Control"] = "no-store"


@router.get("/api/me", response_model=MeResponse)
def me(request: Request, response: Response, credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)):
    token = bearer(request)
    if not token:
        raise AuthError(401, "session_expired", "Войдите по почте ещё раз.")
    response.headers["Cache-Control"] = "no-store"
    return MeResponse(user=request.app.state.auth.me(token))
