from concurrent.futures import ThreadPoolExecutor
import smtplib
import sqlite3
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest

from app.auth import ACCESS_TTL, SESSION_TTL, AuthService, send_smtp_code
from app.config import Settings
from app.main import create_app

ORIGIN = {"Origin": "http://localhost:8081"}


@pytest.fixture
def auth_env(tmp_path):
    now = [1_800_000_000]
    outbox = []
    settings = Settings(_env_file=None, auth_database_path=tmp_path / "auth.sqlite3", auth_otp_secret="test-secret-not-for-real-use-" * 2, smtp_username="sender@example.com", smtp_password="smtp-test-password", mail_from="ТурСим <sender@example.com>")
    def mailer(email, code):
        outbox.append((email, code))
    app = create_app(settings, auth_mailer=mailer, auth_clock=lambda: now[0])
    with TestClient(app) as client:
        yield client, settings, now, outbox, mailer


def send(client, email="person@example.com"):
    response = client.post("/api/auth/email/send-code", json={"email": email})
    assert response.status_code == 200, response.text
    return response.json()


def login(client, outbox, client_type="native"):
    challenge = send(client)
    response = client.post("/api/auth/email/verify", json={"challenge_id": challenge["challenge_id"], "code": outbox[-1][1], "client": client_type}, headers=ORIGIN if client_type == "web" else {})
    assert response.status_code == 200, response.text
    return response


def test_login_creates_verified_user_and_protects_me(auth_env):
    client, settings, now, outbox, _ = auth_env
    challenge = send(client)
    assert challenge["expires_in"] == 300
    assert challenge["resend_after_seconds"] == 60
    assert len(outbox[0][1]) == 6 and outbox[0][1].isdigit()
    assert outbox[0][1] not in str(challenge)
    assert client.get("/api/me").status_code == 401
    response = client.post("/api/auth/email/verify", json={"challenge_id": challenge["challenge_id"], "code": outbox[0][1], "client": "native"})
    session = response.json()
    assert response.status_code == 200
    assert session["user"]["email_verified"] is True
    assert client.get("/api/me", headers={"Authorization": "Bearer " + session["access_token"]}).json()["user"] == session["user"]
    with sqlite3.connect(settings.auth_database_path) as db:
        stored = db.execute("SELECT access_hash,refresh_hash FROM auth_sessions").fetchone()
        assert session["access_token"] not in stored and session["refresh_token"] not in stored
        assert db.execute("SELECT code_hash FROM auth_challenges").fetchone()[0] == ""
    assert response.headers["Cache-Control"] == "no-store"


def test_web_refresh_is_httponly_and_rotation_invalidates_old_access(auth_env):
    client, _, now, outbox, _ = auth_env
    response = login(client, outbox, "web")
    first = response.json()
    assert first["refresh_token"] is None
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/api/auth" in cookie
    response = client.post("/api/auth/refresh", json={"client": "web"}, headers=ORIGIN)
    assert response.status_code == 200
    assert response.json()["refresh_token"] is None
    assert client.get("/api/me", headers={"Authorization": "Bearer " + first["access_token"]}).status_code == 401
    access = response.json()["access_token"]
    assert client.post("/api/auth/logout", json={"client": "web"}, headers=ORIGIN).status_code == 204
    assert client.get("/api/me", headers={"Authorization": "Bearer " + access}).status_code == 401
    assert client.post("/api/auth/refresh", json={"client": "web"}, headers=ORIGIN).status_code == 401


def test_native_refresh_rotation_rejects_replay_and_logout_revokes(auth_env):
    client, _, now, outbox, _ = auth_env
    first = login(client, outbox).json()
    now[0] += ACCESS_TTL
    assert client.get("/api/me", headers={"Authorization": "Bearer " + first["access_token"]}).status_code == 401
    response = client.post("/api/auth/refresh", json={"client": "native", "refresh_token": first["refresh_token"]})
    assert response.status_code == 200
    second = response.json()
    assert client.post("/api/auth/refresh", json={"client": "native", "refresh_token": first["refresh_token"]}).status_code == 401
    assert client.post("/api/auth/logout", json={"client": "native", "refresh_token": second["refresh_token"]}).status_code == 204
    assert client.get("/api/me", headers={"Authorization": "Bearer " + second["access_token"]}).status_code == 401


def test_sessions_survive_server_restart_and_expire(auth_env):
    client, settings, now, outbox, mailer = auth_env
    first = login(client, outbox).json()
    with TestClient(create_app(settings, auth_mailer=mailer, auth_clock=lambda: now[0])) as restarted:
        assert restarted.get("/api/me", headers={"Authorization": "Bearer " + first["access_token"]}).status_code == 200
        now[0] += SESSION_TTL
        assert restarted.post("/api/auth/refresh", json={"client": "native", "refresh_token": first["refresh_token"]}).status_code == 401


def test_expired_code_does_not_create_account(auth_env):
    client, settings, now, outbox, _ = auth_env
    challenge = send(client)
    now[0] += 300
    response = client.post("/api/auth/email/verify", json={"challenge_id": challenge["challenge_id"], "code": outbox[-1][1], "client": "native"})
    assert response.status_code == 400
    with sqlite3.connect(settings.auth_database_path) as db:
        assert db.execute("SELECT COUNT(*) FROM auth_users").fetchone()[0] == 0


def test_five_failed_attempts_lock_challenge(auth_env):
    client, _, now, outbox, _ = auth_env
    challenge = send(client)
    right = outbox[-1][1]
    wrong = "000000" if right != "000000" else "111111"
    for _ in range(5):
        assert client.post("/api/auth/email/verify", json={"challenge_id": challenge["challenge_id"], "code": wrong, "client": "native"}).status_code == 400
    assert client.post("/api/auth/email/verify", json={"challenge_id": challenge["challenge_id"], "code": right, "client": "native"}).status_code == 400


def test_code_is_consumed_atomically(auth_env):
    client, settings, _, outbox, _ = auth_env
    challenge = send(client)
    body = {"challenge_id": challenge["challenge_id"], "code": outbox[-1][1], "client": "native"}
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(lambda _: client.post("/api/auth/email/verify", json=body).status_code, range(2)))
    assert sorted(statuses) == [200, 400]
    with sqlite3.connect(settings.auth_database_path) as db:
        assert db.execute("SELECT COUNT(*) FROM auth_users").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM auth_sessions").fetchone()[0] == 1


def test_resend_cooldown_and_new_code_invalidates_previous(auth_env):
    client, _, now, outbox, _ = auth_env
    first = send(client)
    first_code = outbox[-1][1]
    response = client.post("/api/auth/email/send-code", json={"email": "person@example.com"})
    assert response.status_code == 429 and response.headers["Retry-After"] == "60"
    now[0] += 60
    second = send(client)
    assert client.post("/api/auth/email/verify", json={"challenge_id": first["challenge_id"], "code": first_code, "client": "native"}).status_code == 400
    assert client.post("/api/auth/email/verify", json={"challenge_id": second["challenge_id"], "code": outbox[-1][1], "client": "native"}).status_code == 200


def test_resends_do_not_reset_global_guess_limit(auth_env):
    client, _, now, outbox, _ = auth_env
    for _ in range(2):
        challenge = send(client)
        wrong = "000000" if outbox[-1][1] != "000000" else "111111"
        for _ in range(5):
            assert client.post("/api/auth/email/verify", json={"challenge_id": challenge["challenge_id"], "code": wrong, "client": "native"}).status_code == 400
        now[0] += 60
    challenge = send(client)
    assert client.post("/api/auth/email/verify", json={"challenge_id": challenge["challenge_id"], "code": outbox[-1][1], "client": "native"}).status_code == 429


def test_send_limits_survive_restart(auth_env):
    client, settings, now, outbox, mailer = auth_env
    for _ in range(6):
        send(client)
        now[0] += 60
    with TestClient(create_app(settings, auth_mailer=mailer, auth_clock=lambda: now[0])) as restarted:
        assert restarted.post("/api/auth/email/send-code", json={"email": "person@example.com"}).status_code == 429


def test_failed_delivery_does_not_allow_login_or_leak_smtp_error(auth_env, caplog):
    client, settings, now, outbox, _ = auth_env
    captured = []
    def failing(email, code):
        captured.append(code)
        raise smtplib.SMTPAuthenticationError(535, b"smtp-test-password")
    with TestClient(create_app(settings, auth_mailer=failing, auth_clock=lambda: now[0])) as broken:
        response = broken.post("/api/auth/email/send-code", json={"email": "person@example.com"})
        assert response.status_code == 502
        assert "smtp-test-password" not in response.text + caplog.text
        assert captured[0] not in response.text
    with sqlite3.connect(settings.auth_database_path) as db:
        challenge_id = db.execute("SELECT id FROM auth_challenges").fetchone()[0]
    assert client.post("/api/auth/email/verify", json={"challenge_id": challenge_id, "code": captured[0], "client": "native"}).status_code == 400


@pytest.mark.parametrize("email", ["bad", "a@example.com\r\nBcc:someone@example.com", "a@localhost", "a..b@example.com", "<a@example.com>"])
def test_invalid_email_never_sends(email, auth_env):
    client, _, _, outbox, _ = auth_env
    response = client.post("/api/auth/email/send-code", json={"email": email})
    assert response.status_code == 422
    assert not outbox
    assert "input" not in response.text


def test_code_validation_does_not_echo_input(auth_env):
    client, _, _, _, _ = auth_env
    response = client.post("/api/auth/email/verify", json={"challenge_id": str(uuid4()), "code": "secret-input", "client": "native"})
    assert response.status_code == 422
    assert "secret-input" not in response.text


def test_browser_origins_and_cors(auth_env):
    client, _, _, outbox, _ = auth_env
    response = client.post("/api/auth/email/send-code", json={"email": "person@example.com"}, headers={"Origin": "https://attacker.example"})
    assert response.status_code == 403 and not outbox
    for origin in [None, "https://attacker.example"]:
        headers = {"Origin": origin} if origin else {}
        assert client.post("/api/auth/refresh", json={"client": "web"}, headers=headers).status_code == 403
    response = client.options("/api/auth/email/send-code", headers={**ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-credentials"] == "true"


def test_missing_smtp_fails_without_attempting_delivery(tmp_path):
    settings = Settings(_env_file=None, auth_database_path=tmp_path / "auth.sqlite3")
    with TestClient(create_app(settings, auth_mailer=lambda *_: pytest.fail("Should not send"))) as client:
        assert client.post("/api/auth/email/send-code", json={"email": "person@example.com"}).status_code == 503


def test_smtp_uses_tls_and_app_password_without_printing_it(monkeypatch, auth_env):
    _, settings, _, _, _ = auth_env
    calls = []
    class SMTP:
        def __init__(self, host, port, timeout, context):
            assert context.check_hostname and port == 465
        def __enter__(self): return self
        def __exit__(self, *args): return False
        def login(self, username, password): calls.append((username, password))
        def send_message(self, message):
            assert message["To"] == "person@example.com"
            assert "123456" in message.get_content()
            return {}
    monkeypatch.setattr(smtplib, "SMTP_SSL", SMTP)
    send_smtp_code(settings, "person@example.com", "123456")
    assert calls == [("sender@example.com", "smtp-test-password")]


def test_repeated_login_uses_same_user(auth_env):
    client, settings, now, outbox, _ = auth_env
    first = login(client, outbox).json()
    now[0] += 61
    second = login(client, outbox).json()
    assert first["user"]["id"] == second["user"]["id"]
    with sqlite3.connect(settings.auth_database_path) as db:
        assert db.execute("SELECT COUNT(*) FROM auth_users").fetchone()[0] == 1


def test_address_case_does_not_bypass_send_limits(auth_env):
    client, _, _, outbox, _ = auth_env
    send(client, "person@example.com")
    assert client.post("/api/auth/email/send-code", json={"email": "PERSON@EXAMPLE.COM"}).status_code == 429
    assert len(outbox) == 1


def test_failed_resend_keeps_previous_code_usable(auth_env):
    client, settings, now, outbox, _ = auth_env
    previous = send(client)
    code = outbox[-1][1]
    now[0] += 61
    def failing(*_): raise smtplib.SMTPException("delivery failed")
    with TestClient(create_app(settings, auth_mailer=failing, auth_clock=lambda: now[0])) as broken:
        assert broken.post("/api/auth/email/send-code", json={"email": "person@example.com"}).status_code == 502
    assert client.post("/api/auth/email/verify", json={"challenge_id": previous["challenge_id"], "code": code, "client": "native"}).status_code == 200
