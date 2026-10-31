from test_auth import auth_env, login, send
from app.auth import AuthService

def test_profile_is_persisted_and_private(auth_env):
    client, settings, now, outbox, mailer = auth_env
    session = login(client, outbox).json()
    headers = {'Authorization': 'Bearer ' + session['access_token']}
    assert client.post('/api/me/profile', json={'display_name': 'Имя'}).status_code == 401
    response = client.post('/api/me/profile', headers=headers, json={'display_name': '  Миша  ', 'avatar': None})
    assert response.status_code == 200
    assert response.json()['user']['display_name'] == 'Миша'
    assert AuthService(settings, mailer=mailer, clock=lambda: now[0]).me(session['access_token']).display_name == 'Миша'
    assert client.post('/api/me/profile', headers=headers, json={'display_name': ' '}).status_code == 422
    assert client.post('/api/me/profile', headers=headers, json={'display_name': 'Миша', 'avatar': 'https://example.com/a.svg'}).status_code == 422
    assert client.get('/api/me', headers=headers).json()['user']['display_name'] == 'Миша'

def test_support_messages_are_isolated(auth_env):
    client, _, _, outbox, _ = auth_env
    session = login(client, outbox).json()
    headers = {'Authorization': 'Bearer ' + session['access_token']}
    assert client.get('/api/support/messages').status_code == 401
    assert client.post('/api/support/messages', headers=headers, json={'text': ' '}).status_code == 422
    assert client.post('/api/support/messages', headers=headers, json={'text': 'Не работает интернет'}).status_code == 201
    result = client.get('/api/support/messages', headers=headers).json()
    assert len(result['messages']) == 1
    assert result['operator_connected'] is False
    challenge = send(client, 'second@example.com')
    other = client.post('/api/auth/email/verify', json={'challenge_id': challenge['challenge_id'], 'code': outbox[-1][1], 'client': 'native'}).json()
    assert client.get('/api/support/messages', headers={'Authorization': 'Bearer ' + other['access_token']}).json()['messages'] == []
