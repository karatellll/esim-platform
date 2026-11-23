# Проверка iOS

## Сборка с API на VPS

Профиль EAS `preview` использует `https://185.103.103.245:8443`. Для VPS без домена
файл `compose.https-ip.yaml` добавляет Caddy к развёрнутому API. Caddy выпускает
и продлевает сертификат Let's Encrypt для публичного IPv4. Разрешите входящие
подключения на TCP 80 для проверки Let's Encrypt и TCP 8443 для запросов к API.
Порт 443 используется Amnezia Xray. Том `tursim_caddy_data` хранит состояние
ACME и сертификаты.

Скопируйте `Caddyfile.ip` и `compose.https-ip.yaml` рядом с серверным
`compose.yaml`, затем выполните на VPS:

```bash
cd /opt/tursim-docker
export TURSIM_PUBLIC_IP=185.103.103.245
docker compose -f compose.yaml -f compose.https-ip.yaml up -d --force-recreate caddy
docker compose -f compose.yaml -f compose.https-ip.yaml logs --tail=40 caddy
```

После выпуска сертификата проверьте с компьютера
`curl -fsS https://185.103.103.245:8443/health`. Если команда вернула JSON с
`status: ok`, можно запускать iOS-сборку по инструкции ниже.

## Альтернативный вариант с бэкендом на ПК

Бэкенд работает на ПК, HTTPS-туннель пересылает запросы на
`http://127.0.0.1:8000`, iOS-приложение использует публичный адрес туннеля.

## Сервер и туннель

Из корня проекта запустите API и оставьте терминал открытым:

```bash
npm run api
```

Во втором терминале:

```bash
npx --yes localtunnel@2.0.2 --port 8000 --local-host 127.0.0.1 --subdomain stupid-aliens-live
```

Скопируйте выданный HTTPS-адрес. Проверьте `<адрес>/health`:
ожидается JSON со `status: ok`. В браузере LocalTunnel может сначала показать
страницу предупреждения с запросом пароля. Пароль для текущего подключения
можно получить на ПК через `curl https://loca.lt/mytunnelpassword`.
Нативные запросы приложения с `Accept: application/json` проверены отдельно.
`catalog_configured: true` подтверждает
наличие серверных ключей, но не успешность запроса к поставщику.
Загрузку каталога проверяйте отдельно через приложение.

ПК, API и процесс LocalTunnel должны оставаться включёнными во время тестирования.
Базы и пользовательские данные находятся в `apps/api/var/`; сохраняйте эту
папку между запусками. Секреты остаются только в корневом серверном `.env`.

## Настройка клиента

### Фоновый запуск на Linux

На локальном ПК API и туннель можно держать в пользовательских службах systemd,
независимо от открытого терминала. Из корня проекта:

```bash
npm install --prefix /tmp/tursim-tunnel-tools --no-audit --no-fund --ignore-scripts localtunnel@2.0.2

systemd-run --user --unit=tursim-api \
  --property=Restart=on-failure --property=RestartSec=5 \
  --working-directory="$PWD" \
  "$PWD/apps/api/.venv/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

systemd-run --user --unit=tursim-localtunnel \
  --property=Restart=always --property=RestartSec=5 \
  --working-directory="$PWD" \
  "$(command -v node)" /tmp/tursim-tunnel-tools/node_modules/localtunnel/bin/lt.js \
  --port 8000 --local-host 127.0.0.1 --subdomain stupid-aliens-live --print-requests
```

Если API уже запущен другим способом на порту 8000, сначала остановите тот
процесс. Службы выше создаются для текущего запуска системы; после перезагрузки
повторите команды. ПК должен оставаться включённым, с интернетом и без сна.

Проверка состояния и текущего внешнего адреса:

```bash
systemctl --user status tursim-api tursim-localtunnel --no-pager
journalctl --user -u tursim-localtunnel --no-pager -o cat | rg 'your url is:'
```

Перезапуск API и остановка обоих процессов:

```bash
systemctl --user restart tursim-api
systemctl --user stop tursim-localtunnel tursim-api
```

`Restart=always` перезапускает туннель и после завершения с кодом 0.
`--subdomain stupid-aliens-live` запрашивает прежний адрес установленной сборки;
после запуска проверьте фактически выданный URL в журнале. Бесплатный сервис
не гарантирует доступность имени. Если URL отличается, приложение по прежнему
адресу не подключится. После смены адреса обновите клиент
по инструкции ниже. `localhost.run` без регистрации для этой сборки не используем:
12 ноября он сменил домен при работающем SSH-процессе примерно через 8 минут.
Cloudflare Quick Tunnel в текущей сети не подключился к edge ни по HTTP/2,
ни по QUIC; служба остановлена. Проверка LocalTunnel 12 ноября 2026: через внешний HTTPS-адрес
`/health` и `/api/catalog/categories` вернули HTTP 200; каталог — 7 категорий,
160 записей eSIM.

### Адрес API в приложении

В `apps/mobile/eas.json` профиль `preview` содержит публичный адрес API
в `env.EXPO_PUBLIC_API_URL`. Если понадобится сборка с туннелем, задайте
его адрес перед сборкой. Для локального Expo укажите выбранный адрес в
`apps/mobile/.env` как `EXPO_PUBLIC_API_URL=https://...` и перезапустите Expo.

Адрес бесплатного туннеля может меняться даже при длительной работе.
Установленная сборка сохраняет адрес, использованный при её создании;
при его смене требуется новая сборка и установка. Для длительного
тестирования используйте стабильный домен сервиса туннелей.

## Сборка и установка

Нужны аккаунт Expo и действующая платная подписка Apple Developer Program
у владельца сборки. Другу эта подписка не нужна. Mac не требуется:
сборку выполняет EAS в облаке.

Из `apps/mobile`:

```bash
npm ci
npm run typecheck
npx eas-cli@latest login
npx eas-cli@latest build:configure --platform ios
npx eas-cli@latest device:create
```

При настройке свяжите приложение с вашим Expo-проектом. Сохраните профиль
`preview` с адресом API. Укажите собственный уникальный `ios.bundleIdentifier`
в `app.json`, если EAS запросит его. Не заменяйте остальные параметры файла.

Отправьте другу ссылку регистрации от `device:create`: он должен открыть
её в Safari на нужном iPhone и установить профиль по инструкции Expo.
Регистрация устройства должна завершиться до сборки.

```bash
npx eas-cli@latest device:list
npx eas-cli@latest build --platform ios --profile preview
```

При настройке подписи войдите в Apple Developer и включите iPhone друга
в профиль сборки. Отправьте другу ссылку установки из результата EAS.
На iOS 16 и новее включите «Настройки → Конфиденциальность и безопасность →
Режим разработчика», перезагрузите телефон и подтвердите включение.

Профиль `preview` создаёт самостоятельную сборку: Metro и Expo Go не нужны.
Проверьте каталог, тарифы и вход по почте; затем повторный запуск приложения.

Источники: [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/),
[iOS Developer Mode](https://docs.expo.dev/guides/ios-developer-mode/),
[LocalTunnel](https://github.com/localtunnel/localtunnel).
