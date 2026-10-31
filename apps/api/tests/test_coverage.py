import asyncio
from types import SimpleNamespace
from test_auth import auth_env, login, send
from app.coverage import dispatch

def headers(client, outbox):
    return {'Authorization': 'Bearer ' + login(client, outbox).json()['access_token']}

def test_subscription_is_authenticated_idempotent_and_durable(auth_env):
    client, settings, _, outbox, _ = auth_env
    assert client.post('/api/me/coverage-subscriptions', json={'country_iso2':'KP'}).status_code == 401
    auth = headers(client,outbox)
    for _ in range(2):
        result=client.post('/api/me/coverage-subscriptions',headers=auth,json={'country_iso2':'KP'})
        assert result.status_code == 200
        assert result.headers['cache-control']=='no-store'
    assert client.get('/api/me/coverage-subscriptions',headers=auth).json()['data']==[{'country_iso2':'KP','status':'pending'}]
    import sqlite3
    with sqlite3.connect(settings.auth_database_path) as conn:
        assert conn.execute('SELECT COUNT(*) FROM coverage_subscriptions').fetchone()[0]==1
    assert client.post('/api/me/coverage-subscriptions',headers=auth,json={'country_iso2':'invalid','email':'other@example.com'}).status_code==422
    challenge=send(client,'other@example.com')
    session=client.post('/api/auth/email/verify',json={'challenge_id':challenge['challenge_id'],'code':outbox[-1][1],'client':'native'}).json()
    assert client.get('/api/me/coverage-subscriptions',headers={'Authorization':'Bearer '+session['access_token']}).json()['data']==[]
    client.post('/api/me/coverage-subscriptions/cancel',headers=auth,json={'country_iso2':'KP'})
    assert client.get('/api/me/coverage-subscriptions',headers=auth).json()['data']==[]

class Catalog:
    def __init__(self, available=True, tariffs=True):
        self.available=available;self.tariffs=tariffs
    async def get_categories(self):
        country=SimpleNamespace(id='kp',country_iso2='KP',display_name='КНДР')
        return SimpleNamespace(data=[SimpleNamespace(esims=[country] if self.available else [])])
    async def get_tariffs(self,id):
        return SimpleNamespace(data=SimpleNamespace(tariffs=[1] if self.tariffs else []))

def test_delivery_waits_for_real_tariffs_and_is_once(auth_env):
    client,_,_,outbox,_=auth_env
    auth=headers(client,outbox)
    client.post('/api/me/coverage-subscriptions',headers=auth,json={'country_iso2':'KP'})
    delivered=[]
    mailer=lambda email,country: delivered.append((email,country))
    service=client.app.state.auth
    assert asyncio.run(dispatch(service,Catalog(False),mailer))==0
    assert asyncio.run(dispatch(service,Catalog(True,False),mailer))==0
    assert asyncio.run(dispatch(service,Catalog(),mailer))==1
    assert asyncio.run(dispatch(service,Catalog(),mailer))==0
    assert len(delivered)==1
    assert client.get('/api/me/coverage-subscriptions',headers=auth).json()['data'][0]['status']=='notified'

def test_failed_smtp_is_not_silently_retried(auth_env):
    client,_,_,outbox,_=auth_env
    auth=headers(client,outbox)
    client.post('/api/me/coverage-subscriptions',headers=auth,json={'country_iso2':'KP'})
    def fail(*args): raise OSError('Ambiguous delivery')
    assert asyncio.run(dispatch(client.app.state.auth,Catalog(),fail))==0
    assert client.get('/api/me/coverage-subscriptions',headers=auth).json()['data'][0]['status']=='failed'
    assert asyncio.run(dispatch(client.app.state.auth,Catalog(),fail))==0
