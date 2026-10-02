# Modern Chat

Веб-клиент для Telegram поверх [GREEN-API](https://green-api.com): список чатов с превью и
счётчиком непрочитанных, лента сообщений с медиа и голосовыми, поиск по чату, панель контакта
и группы. Интерфейс сделан по образцу Telegram.

Ключевая идея: **токен инстанса никогда не попадает в браузер**. Клиент отправляет только имя
метода (`/api/greenapi/getChats`), а сервер подставляет адрес, инстанс и токен.

- Клиент: React 19, TypeScript, Vite 8, Tailwind CSS 4, zustand, react-icons.
- Сервер: три serverless-функции — прокси GREEN-API, превью ссылок (OpenGraph) и отдача SPA.

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
| Надёжность | ErrorBoundary вокруг чата, кеш прочитанных сообщений в IndexedDB, пауза методов при исчерпанной квоте |

## Требования

- Node.js 20 или новее (используются глобальный `fetch` и `node:dns/promises`).
- pnpm 9+ либо npm — в репозитории лежит `pnpm-lock.yaml`.
- Аккаунт GREEN-API с авторизованным Telegram-инстансом.

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
   ```

   > Не добавляйте префикс `VITE_`: Vite вшивает такие переменные в бандл, и токен станет
   > виден любому, кто открыл страницу.

3. **Установите зависимости и запустите dev-сервер:**

   ```bash
   pnpm install      # или npm install
   pnpm dev          # или npm run dev
   ```

4. Откройте <http://localhost:5173>. Dev-сервер сам проксирует `/api/greenapi/*` на GREEN-API и
   отдаёт `/api/og` как middleware, поэтому дополнительных процессов не нужно.

### Проверка, что всё сошлось

```bash
curl -s http://localhost:5173/api/greenapi/getStateInstance
# {"stateInstance":"authorized"}
```

Ответ `qr` вместо `authorized` означает, что инстанс ещё не авторизован: отсканируйте QR
приложением с экрана входа. Пустой `404` — неверные `GREEN_API_INSTANCE` или `GREEN_API_TOKEN`
либо прокси не собран, если переменных нет в `.env.local`.

## Скрипты

| Команда | Что делает |
| --- | --- |
| `npm run dev` | Dev-сервер Vite с прокси к GREEN-API |
| `npm run build` | Типы + сборка клиента в `dist` |
| `npm run build:server` | esbuild функций из `api/` в `dist-server` (для self-hosting) |
| `npm run build:all` | Клиент и сервер одной командой |
| `npm start` | Продакшен-сервер: статика из `dist`, прокси и `/api/og` |
| `npm run preview` | Локальный просмотр собранного клиента |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | ESLint с правилами react-hooks и react-compiler |
| `npm test` | Vitest (68 тестов) |
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
| `PORT` | нет | порт `server.js`, по умолчанию `3000` |

Клиентские переменные с префиксом `VITE_` не используются и не нужны: всё общение с Telegram
идёт через собственный сервер.

## Архитектура

```
api/                     serverless-функции
  greenapi/[method].ts   прокси GREEN-API: allow-list методов, проверка origin, лимиты тела
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
`api/greenapi/[method].ts` добавляет `/waInstance<id>/<method>/<token>` →
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
cp .env.example .env.local      # заполнить значения
pnpm run docker:build
pnpm run docker:run             # http://localhost:3000
# или
docker compose up -d --build
```

`server.js` раздаёт `dist`, проксирует `/api/greenapi/*` и `/api/og` и отдаёт CSP, `nosniff`,
`X-Frame-Options: DENY` и `Referrer-Policy: no-referrer`.

### Vercel

Framework Preset — Vite, build command `npm run build`, output `dist`, Node.js 20+.
Переменные `GREEN_API_URL`, `GREEN_API_INSTANCE`, `GREEN_API_TOKEN` задаются в
Project → Settings → Environment Variables для Production и Preview (токен — Sensitive).
`api/` развернётся как serverless-функции, `server.js` и `build:server` не нужны.

Готовый `vercel.json` с SPA-fallback и теми же заголовками безопасности — в разделе
«Деплой на Vercel» файла `Notes.md`.

## Тесты

```bash
npm test
```

Покрыты: прокси GREEN-API (методы, заголовки, лимиты, проверка origin), превью ссылок (редиректы
и приватные адреса), квота-guard, модель чата, сайдбар, компонентные тесты ErrorBoundary и
модель контактов.

## Лицензия

Учебный проект. Используйте столько, сколько нужно.