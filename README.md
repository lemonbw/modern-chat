# Modern Chat

Веб-клиент для Telegram поверх [GREEN-API](https://green-api.com): список чатов с превью и
счётчиком непрочитанных, лента сообщений с медиа и голосовыми, поиск по чату, панель контакта
и группы. Интерфейс сделан по образцу Telegram.

Ключевая идея: **токен инстанса никогда не попадает в браузер**. Клиент отправляет только имя
метода (`/api/greenapi/getChats`), а сервер подставляет адрес, инстанс и токен. Второй слой:
сам инстанс доступен только после входа по паролю приложения, поэтому чужая сессия в браузере
не даёт ни прочитать чаты, ни отправить сообщение.

- Клиент: React 19, TypeScript, Vite 8, Tailwind CSS 4, zustand, react-icons.
- Сервер: serverless-функции — вход приложения, прокси GREEN-API и превью ссылок (OpenGraph).

## Возможности

| Область | Что умеет |
| --- | --- |
| Вход | QR-код через метод `qr`, ввод кода и 2FA-пароля, ожидание авторизации с опросом `getStateInstance` |
| Чаты | Список с последним сообщением, временем, счётчиком непрочитанных и пометкой «10+», поиск чатов, архив, mute, создание группы и добавление контакта |
| Сообщения | Отправка текста, файлов (фото, видео, документы, аудио), голосовые с записью и воспроизведением, ответ на сообщение, пересылка, удаление, отметки о прочтении, показ удалённых |
| Медиа | Ленивая загрузка, полноэкранный просмотр, скачивание, превью ссылок с картинкой и сайтом |
| История | Постраничная догрузка вверх по IntersectionObserver, дата сверху ленты, поиск по тексту |
| Панель информации | Имя, телефон, ник, «был(а) недавно», медиа и ссылки чата, участники группы, локальный профиль контакта |
| Интерфейс | Тёмная тема, мобильная раскладка с отдельным режимом чата, обои ленты — см. `src/App.css` |
| Доступ | Пароль приложения на вход, сессия в HttpOnly-cookie, отдельное подтверждение паролем для отправки и удаления, режим только для чтения |
| Надёжность | ErrorBoundary вокруг чата, кеш прочитанных сообщений в IndexedDB, пауза методов при исчерпанной квоте |

## Требования

- Node.js 20 или новее (используются глобальный `fetch` и `node:dns/promises`).
- pnpm либо npm — версия pnpm зафиксирована в `package.json`, corepack подхватит её сам.
- Аккаунт GREEN-API с авторизованным Telegram-инстансом.
- Свой пароль приложения: без `APP_PASSWORD` прокси не отвечает ни на один метод.

## Локальный запуск

1. **Получите учётные данные GREEN-API.** В личном кабинете green-api.com создайте инстанс,
   отсканируйте QR-код авторизации и скопируйте `idInstance` и `apiTokenInstance`.

2. **Создайте файл с переменными.** Скопируйте образец и впишите свои значения:

   ```bash
   cp .env.example .env.local
   ```

   ```dotenv
   GREEN_API_URL=https://api.green-api.com
   GREEN_API_INSTANCE=1100000000
   GREEN_API_TOKEN=your-token-here
   APP_PASSWORD=choose-a-long-password
   ```

   > Не добавляйте префикс `VITE_`: Vite вшивает такие переменные в бандл, и токен станет
   > виден любому, кто открыл страницу.

   `APP_PASSWORD` — пароль самого приложения: его спрашивают при первом открытии сайта. Без него
   `api/auth` отвечает `500`, а прокси остаётся закрытым — без сессии не проходит ни один метод.
   Остальные переменные (`WRITE_PASSWORD`, `SESSION_SECRET`, `APP_ALLOW_WRITES`) необязательны,
   их смысл — в разделе «Доступ и запись».

3. **Установите зависимости и запустите dev-сервер:**

   ```bash
   pnpm install      # или npm install
   pnpm dev          # или npm run dev
   ```

4. Откройте <http://localhost:5173>: сначала экран с паролем приложения, потом вход в Telegram
   по QR. Dev-сервер запускает те же обработчики `api/`, что и serverless-функции, и отдаёт
   `/api/og` как middleware, поэтому дополнительных процессов не нужно.

   Вход запоминается на 24 часа в cookie `mc_session`. Если cookie протухла или её удалили,
   приложение вернёт экран пароля, а не ошибку API.

### Проверка, что всё сошлось

```bash
curl -s http://localhost:5173/api/auth
# {"authenticated":false,"writesEnabled":true,"writeGranted":false}

curl -s -c jar.txt -X POST http://localhost:5173/api/auth \
  -H 'content-type: application/json' -d '{"password":"choose-a-long-password"}'
# {"ok":true,"authenticated":true,"writesEnabled":true,"writeGranted":true}

curl -s -b jar.txt http://localhost:5173/api/greenapi/getStateInstance
# {"stateInstance":"authorized"}
```

Без cookie прокси отвечает `401` и кодом `session_required` — это и есть проверка, что гейт
работает. Ответ `qr` вместо `authorized` означает, что инстанс ещё не авторизован: отсканируйте
QR приложением с экрана входа. Файл `jar.txt` с cookie после проверки удалите.

## Скрипты

| Команда | Что делает |
| --- | --- |
| `npm run dev` | Dev-сервер Vite: те же обработчики `api/`, что и в проде |
| `npm run build` | Типы + сборка клиента в `dist` |
| `npm run build:server` | esbuild функций из `api/` в `dist-server` (для self-hosting) |
| `npm run build:all` | Клиент и сервер одной командой |
| `npm start` | Продакшен-сервер: статика из `dist`, `/api/auth`, прокси и `/api/og` |
| `npm run preview` | Локальный просмотр собранного клиента |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | ESLint с правилами react-hooks и react-compiler |
| `npm test` | Vitest (108 тестов) |
| `npm run test:watch` | Vitest в watch-режиме |
| `npm run test:coverage` | Покрытие через v8 |
| `npm run docker:build` / `npm run docker:run` | Сборка и запуск контейнера |

Перед коммитом: `npm run typecheck && npm run lint && npm test && npm run build`.

## Переменные окружения

| Переменная | Обязательна | Где используется |
| --- | --- | --- |
| `GREEN_API_URL` | да | адрес API, например `https://api.green-api.com` |
| `GREEN_API_INSTANCE` | да | `idInstance` |
| `GREEN_API_TOKEN` | да | `apiTokenInstance`, только на сервере |
| `APP_PASSWORD` | да | пароль приложения, только на сервере |
| `WRITE_PASSWORD` | нет | пароль изменяющих методов, по умолчанию `APP_PASSWORD` |
| `SESSION_SECRET` | нет | ключ подписи cookie, иначе берётся из `APP_PASSWORD` |
| `APP_ALLOW_WRITES` | нет | `false` — режим только для чтения |
| `PORT` | нет | порт `server.js`, по умолчанию `3000` |

Клиентские переменные с префиксом `VITE_` не используются и не нужны: всё общение с Telegram
идёт через собственный сервер.

## Доступ и запись

Приложение закрыто паролем, иначе любой, кто открыл публичный URL, получил бы ваши чаты.

- **Вход.** `POST /api/auth` с `APP_PASSWORD` кладёт cookie `mc_session` (`HttpOnly`, `SameSite=Lax`,
  `Secure` на https, 24 часа) с подписью HMAC-SHA256. Ключ — `SESSION_SECRET`, а если его нет,
  он выводится из `APP_PASSWORD`. Пять неудач с одного адреса дают блокировку на пять минут.
- **Прокси.** Без сессии `api/greenapi/*` отвечает `401` и кодом `session_required` — это касается
  и запросов без заголовка `Origin`, например из `curl`. Так же закрыт `/api/og`.
- **Чтение и запись.** Чтение (`getChats`, `getChatHistory`, `getContacts`, `getAvatar` и другие)
  проходит сразу. Отправка, удаление, контакты, группы, архив и `logout` требуют cookie
  `mc_write` — это подтверждение паролем `WRITE_PASSWORD` (по умолчанию `APP_PASSWORD`).
  Пароль запрашивается один раз в час и действует на все изменяющие методы сразу.
- **Только чтение.** `APP_ALLOW_WRITES=false` отключает запись на сервере: интерфейс честно
  сообщает, что деплой доступен для чтения.
- **Что остаётся публичным:** статика (`index.html`, js, css) — в ней нет данных, только код.

Для публичного деплая на Vercel добавьте ещё Deployment Protection: пароль приложения защищает
API, а заглушка Vercel прячет сам сайт.

## Архитектура

```
api/                     serverless-функции
  _session.ts            подпись и проверка cookie, пароли приложения и записи
  auth.ts                вход и выход приложения, выдача гранта на запись
  greenapi/[method].ts   прокси GREEN-API: сессия, allow-list чтения, проверка origin, лимиты тела
  og.ts                  превью ссылок: разбор OpenGraph, защита от SSRF, кеш на сутки
src/
  app/App.tsx            провайдеры и маршрутизация
  pages/AuthPage         вход по QR, коду и 2FA
  pages/ChatPage         композиция страницы чата
  widgets/               ChatWindow, Sidebar, ChatInfoPanel
  features/              auth, contacts, messages, search-chats
  entities/              доменные типы чата и пользователя
  shared/                api-клиент, ui-примитивы, утилиты
server.js                сервер для self-hosting и Docker
```

Поток запроса: `greenApiClient` (браузер) → `fetch("/api/greenapi/<method>")` →
`api/greenapi/[method].ts` проверяет сессию, добавляет `/waInstance<id>/<method>/<token>` →
GREEN-API → ответ обратно. Квоты и кеши лежат в `greenApiRead` и `greenApiContacts`:
при 466 метод приостанавливается, а не повторяется.

Подробное описание модулей, квот и оптимизаций — в [Notes.md](./Notes.md)
(файл локальный и не попадает в репозиторий).

## Квоты GREEN-API

У инстанса около 100 вызовов на метод в месяц, поэтому дорогие методы (`getAvatar`,
`getContactInfo`, `getGroupData`, `getChatHistory`) идут через кеш и «паузу»:

- ответы и пустые ответы кешируются в `localStorage`;
- при ошибке 466 метод приостанавливается до истечения времени;
- непрочитанные считаются из уже загруженной истории: если их больше окна, бейдж показывает `10+`.

Если превью аватара или карточка контакта недоступны из-за квоты, интерфейс честно говорит об
этом: в шапке — «Online status hidden», в панели — «Name, phone and username come from the
chat list».

## Деплой

### Self-hosting (Docker)

```bash
cp .env.example .env.local      # заполнить значения, APP_PASSWORD обязателен
pnpm run docker:build
pnpm run docker:run             # http://localhost:3000, переменные из .env.local
# или
docker compose up -d --build
```

`pnpm run docker:run` — это `docker run --network=host --env-file .env.local`, поэтому пароль
приложения и токен инстанса попадают в контейнер из того же файла, а GREEN-API доступен по сети
хоста. Порт из `PORT` публикуется напрямую, поэтому `-p` здесь не нужен и не работает.

Запускайте контейнер за прокси с TLS: cookie ставится с флагом `Secure` на любом не-localhost
хосте, и по http браузер её не примет.

> Если в вашей сети DNS из docker-сети не резолвится (типичный симптом — `502 Bad Gateway` от
> `/api/greenapi/*`), `--network=host` в обоих скриптах это обходит. В режиме host порт из `PORT`
> занимается на самом хосте, так что `http://localhost:3000` работает без проброса портов.

`server.js` раздаёт `dist`, обслуживает `/api/auth`, проксирует `/api/greenapi/*` и `/api/og`
и отдаёт CSP, `nosniff`, `X-Frame-Options: DENY` и `Referrer-Policy: no-referrer`.

### Vercel

Framework Preset — Vite, build command `npm run build`, output `dist`, Node.js 20+.
Переменные `GREEN_API_URL`, `GREEN_API_INSTANCE`, `GREEN_API_TOKEN`, `APP_PASSWORD`,
`WRITE_PASSWORD`, `SESSION_SECRET`, `APP_ALLOW_WRITES` задаются в Project → Settings →
Environment Variables для Production и Preview (токен и пароли — Sensitive).
`api/` развернётся как serverless-функции, `server.js` и `build:server` не нужны.

Готовый `vercel.json` с SPA-fallback и теми же заголовками безопасности — в разделе
«Деплой на Vercel» файла `Notes.md`.

## Тесты

```bash
npm test
```

Покрыты: подпись и проверка cookie, эндпоинт входа (пароль, грант на запись, блокировка перебора),
прокси GREEN-API (методы, allow-list чтения, гейт сессии, заголовки, лимиты, проверка origin),
превью ссылок (редиректы, приватные адреса, сессия), квота-guard, модель чата, сайдбар,
компонентные тесты ErrorBoundary и модель контактов.

## Лицензия

Учебный проект. Используйте столько, сколько нужно.