from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_app_status_distinguishes_platform_update_and_maintenance(tmp_path):
    end = datetime.now(timezone.utc) + timedelta(hours=1)
    settings = Settings(
        _env_file=None,
        auth_database_path=tmp_path / "auth.sqlite3",
        orders_database_path=tmp_path / "orders.sqlite3",
        app_maintenance=True,
        app_maintenance_until=end,
        app_minimum_ios_version="0.10.0",
        app_ios_store_url="https://apps.apple.com/app/id12345",
    )
    with TestClient(create_app(settings)) as client:
        older = client.get("/api/app-status", params={"platform": "ios", "version": "0.9.12"})
        assert older.status_code == 426
        assert older.json() == {"status": "update_required", "store_url": str(settings.app_ios_store_url)}

        supported = client.get("/api/app-status", params={"platform": "ios", "version": "0.11.0"})
        assert supported.status_code == 503
        assert datetime.fromisoformat(supported.json()["until"]) == end
        assert supported.headers["Cache-Control"] == "no-store"

        settings.app_maintenance_until = datetime.now(timezone.utc) - timedelta(seconds=1)
        restored = client.get("/api/app-status", params={"platform": "android", "version": "0.1.0"})
        assert restored.status_code == 200
        assert restored.json() == {"status": "ok"}
        assert client.get("/health").status_code == 200
