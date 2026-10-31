"""Private support messages saved locally; no external helpdesk delivery is configured."""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.auth import AuthError, bearer, check_origin

class SupportMessageRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    text: str = Field(min_length=1, max_length=2000)
    @field_validator('text')
    @classmethod
    def clean(cls, value):
        value = value.strip()
        if not value: raise ValueError('Empty message')
        return value

class SupportMessage(BaseModel):
    id: str
    text: str
    created_at: str
    status: str = 'saved'

class SupportResponse(BaseModel):
    messages: list[SupportMessage]
    operator_connected: bool = False

router = APIRouter(tags=['support'])

def owner(request):
    token = bearer(request)
    if not token: raise AuthError(401, 'session_expired', 'Войдите по почте ещё раз.')
    return str(request.app.state.auth.me(token).id)

def initialize(conn):
    conn.execute('CREATE TABLE IF NOT EXISTS support_messages (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,text TEXT NOT NULL,created_at TEXT NOT NULL)')

@router.get('/api/support/messages', response_model=SupportResponse)
def messages(request: Request, response: Response):
    user_id = owner(request)
    response.headers['Cache-Control'] = 'no-store'
    with request.app.state.auth.db() as conn:
        initialize(conn)
        rows = conn.execute('SELECT id,text,created_at FROM support_messages WHERE user_id=? ORDER BY created_at DESC LIMIT 100', (user_id,)).fetchall()
    return SupportResponse(messages=[SupportMessage(**dict(row)) for row in reversed(rows)])

@router.post('/api/support/messages', response_model=SupportMessage, status_code=201)
def send(body: SupportMessageRequest, request: Request, response: Response):
    check_origin(request)
    user_id = owner(request)
    message = SupportMessage(id=str(uuid4()), text=body.text, created_at=datetime.now(timezone.utc).isoformat())
    with request.app.state.auth.db() as conn:
        initialize(conn)
        conn.execute('INSERT INTO support_messages VALUES (?,?,?,?)', (message.id, user_id, message.text, message.created_at))
    response.headers['Cache-Control'] = 'no-store'
    return message
