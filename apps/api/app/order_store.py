"""SQLite checkout quotes and durable provider idempotency keys for local runs.

Only ownership, price snapshots and IDs are persisted: no SDK tokens, payment
URLs, QR URLs or eSIM activation secrets are stored here.
"""
from contextlib import contextmanager
import json
from pathlib import Path
import sqlite3
import threading
from uuid import uuid4

from app.auth import AuthError

SCHEMA = """
CREATE TABLE IF NOT EXISTS checkout_quotes (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, esim_id TEXT NOT NULL,
  tariff_id TEXT NOT NULL, snapshot TEXT NOT NULL, created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS checkout_quotes_user ON checkout_quotes(user_id);
CREATE TABLE IF NOT EXISTS checkout_attempts (
  quote_id TEXT PRIMARY KEY REFERENCES checkout_quotes(id), user_id TEXT NOT NULL,
  provider_key TEXT NOT NULL UNIQUE, payload TEXT NOT NULL,
  provider_order_id TEXT UNIQUE, state TEXT NOT NULL,
  lease TEXT, lease_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS owned_orders (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS owned_orders_user ON owned_orders(user_id);
"""


class OrderStore:
    def __init__(self, path: Path):
        self.path = path
        self._initialized = False
        self._lock = threading.Lock()

    @contextmanager
    def db(self):
        with self._lock:
            if not self._initialized:
                self.path.parent.mkdir(parents=True, exist_ok=True)
                with sqlite3.connect(self.path, timeout=10) as conn:
                    conn.execute("PRAGMA journal_mode=WAL")
                    conn.executescript(SCHEMA)
                self._initialized = True
        conn = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
        finally:
            conn.close()

    def quote(self, user_id, esim_id, tariff_id, snapshot, now):
        quote_id = str(uuid4())
        with self.db() as conn:
            conn.execute("INSERT INTO checkout_quotes VALUES (?,?,?,?,?,?,?)",
                         (quote_id, user_id, esim_id, tariff_id, snapshot, now, now + 300))
        return quote_id, now + 300

    def get_quote(self, quote_id, user_id):
        with self.db() as conn:
            row = conn.execute("SELECT * FROM checkout_quotes WHERE id=? AND user_id=?", (quote_id, user_id)).fetchone()
            if row is None:
                raise AuthError(404, "checkout_not_found", "Оформление не найдено.")
            return dict(row)

    def attempt(self, quote_id, user_id):
        with self.db() as conn:
            row = conn.execute("SELECT * FROM checkout_attempts WHERE quote_id=? AND user_id=?", (quote_id, user_id)).fetchone()
            return dict(row) if row else None

    def unresolved(self, user_id, tariff_id):
        with self.db() as conn:
            row = conn.execute("SELECT q.*,a.provider_order_id FROM checkout_quotes q JOIN checkout_attempts a ON a.quote_id=q.id WHERE q.user_id=? AND q.tariff_id=? AND a.state IN ('creating','uncertain','created') ORDER BY q.created_at DESC,q.rowid DESC LIMIT 1", (user_id, tariff_id)).fetchone()
            return dict(row) if row else None

    def claim(self, quote, payload, now):
        lease = str(uuid4())
        with self.db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT * FROM checkout_attempts WHERE quote_id=?", (quote["id"],)).fetchone()
            if row:
                if row["state"] == "creating" and row["lease_at"] > now - 180:
                    raise AuthError(409, "order_in_progress", "Заказ уже создаётся. Подождите и повторите проверку.")
                if row["provider_order_id"]:
                    return dict(row)
                if row["state"] == "rejected":
                    raise AuthError(409, "checkout_rejected", "Обновите стоимость перед новым оформлением.")
                conn.execute("UPDATE checkout_attempts SET state='creating',lease=?,lease_at=?,updated_at=? WHERE quote_id=?", (lease, now, now, quote["id"]))
            else:
                conn.execute("INSERT INTO checkout_attempts VALUES (?,?,?,?,NULL,'creating',?,?,?)",
                             (quote["id"], quote["user_id"], str(uuid4()), json.dumps(payload, sort_keys=True), lease, now, now))
            result = conn.execute("SELECT * FROM checkout_attempts WHERE quote_id=?", (quote["id"],)).fetchone()
            conn.commit()
            return dict(result)

    def finish(self, attempt, state, now, order_id=None):
        with self.db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            if order_id:
                self._own(conn, order_id, attempt["user_id"], now)
            conn.execute("UPDATE checkout_attempts SET state=?,provider_order_id=COALESCE(?,provider_order_id),lease=NULL,updated_at=? WHERE quote_id=? AND lease=?",
                         (state, order_id, now, attempt["quote_id"], attempt["lease"]))
            conn.commit()

    @staticmethod
    def _own(conn, order_id, user_id, now):
        row = conn.execute("SELECT user_id FROM owned_orders WHERE id=?", (order_id,)).fetchone()
        if row and row["user_id"] != user_id:
            raise AuthError(502, "invalid_order_response", "Не удалось проверить принадлежность заказа.")
        conn.execute("INSERT OR IGNORE INTO owned_orders VALUES (?,?,?)", (order_id, user_id, now))

    def own_many(self, ids, user_id, now):
        with self.db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            for order_id in ids:
                self._own(conn, order_id, user_id, now)
            conn.commit()

    def require_owner(self, order_id, user_id):
        with self.db() as conn:
            if not conn.execute("SELECT 1 FROM owned_orders WHERE id=? AND user_id=?", (order_id, user_id)).fetchone():
                raise AuthError(404, "order_not_found", "Заказ не найден.")

    def expected(self, order_id, user_id):
        with self.db() as conn:
            row = conn.execute("SELECT q.snapshot FROM checkout_attempts a JOIN checkout_quotes q ON q.id=a.quote_id WHERE a.provider_order_id=? AND a.user_id=?", (order_id, user_id)).fetchone()
            return json.loads(row["snapshot"]) if row else None
