# Modern Chat — заметки по проекту

Учебный проект на React 19 + TypeScript + Vite, который работает поверх GREEN-API (Telegram).
Клиент никогда не знает токена инстанса: все вызовы идут через прокси `/api/greenapi/:method`
на сервере, а в проде отдаётся собранный SPA.

## Команды

```bash
npm run dev            # vite dev server, GREEN-API проксируется из .env.local
npm run build          # сборка клиента в dist
npm run build:server   # esbuild api/greenapi/[method].ts, api/auth.ts и api/og.ts в dist-server
npm run build:all      # оба шага сразу
npm start              # node server.js: статика + /api/auth + прокси + /api/og
npx tsc -b             # типы
npm run lint           # eslint (включая правила react-hooks и react-compiler)
npx vitest run         # тесты
```

Переменные окружения: `.env.local` (`GREEN_API_URL`, `GREEN_API_INSTANCE`, `GREEN_API_TOKEN`,
`APP_PASSWORD`, `WRITE_PASSWORD`, `SESSION_SECRET`, `APP_ALLOW_WRITES`) — образец в `.env.example`.
Docker-вариант описан в README.

## Деплой на Vercel

Проект совместим с Vercel «из коробки»: статика — обычная сборка Vite, а `api/` Vercel
разворачивает как serverless-функции. `server.js`, `dist-server` и `build:server` нужны только
для self-hosting (Docker) — на Vercel их собирать не надо.

### 1. Переменные окружения

Project → Settings → Environment Variables. Задать для **Production** и **Preview**:

| Переменная         | Пример                    | Sensitive | Где используется                          |
| ------------------ | ------------------------- | --------- | ----------------------------------------- |
| `GREEN_API_URL`    | `https://api.green-api.com` | нет     | только серверные функции (`api/`)         |
| `GREEN_API_INSTANCE` | `1100000000`             | нет       | только серверные функции (`api/`)         |
| `GREEN_API_TOKEN`  | токен инстанса            | **да**    | только серверные функции (`api/`)         |
| `APP_PASSWORD`     | пароль приложения         | **да**    | `api/auth.ts`, вход на сайт               |
| `WRITE_PASSWORD`   | пароль записи, по умолчанию `APP_PASSWORD` | **да** | `api/auth.ts`, mutating-методы |
| `SESSION_SECRET`   | ключ подписи cookie       | **да**    | `api/_session.ts`                          |
| `APP_ALLOW_WRITES` | `true` или `false`        | нет       | `false` — режим только для чтения         |

Важно:
- **Никогда не добавлять префикс `VITE_`** — Vite вшивает такие переменные в бандл, и токен
  инстанса уедет в браузер. Проверка: `grep -r "<токен>" dist/` должен быть пустым.
- Переменные читаются в рантайме функции, а не на этапе сборки, поэтому preview-деплой с
  собственными значениями работает без пересборки фронтенда.
- Локально те же значения берутся из `.env.local`: `vite.config.ts` копирует их в `process.env`
  для dev-middleware, поэтому локально и на Vercel работают одни и те же обработчики `api/`.
- `APP_PASSWORD` обязателен: без него `api/auth` отвечает `500`, и прокси не пропускает ни одного
  метода — публичный деплой без пароля закрывается целиком.

### 2. Настройки проекта

- Framework Preset: **Vite** (определяется автоматически).
- Build Command: `npm run build`, Output Directory: `dist`.
- Node.js: 20+ (в Project Settings → Node.js Version; функции используют `node:dns/promises`
  и глобальный `fetch`). При желании зафиксировать в `package.json` → `"engines": { "node": ">=20" }`.
- Install Command: `npm i` или `pnpm i` — в проекте есть `pnpm-lock.yaml` и `pnpm-workspace.yaml`,
  так что Vercel определит pnpm сам.

### 3. `vercel.json`

Два момента, которых нет в zero-config: SPA-fallback для маршрутов вида `/chat/:id` и заголовки
безопасности (на Vercel их не отдаёт `server.js`).

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "default-src 'self'; img-src 'self' data: blob: https: http:; media-src 'self' blob: https: http:; connect-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "no-referrer" }
      ]
    }
  ]
}
```

Правило `rewrites` специально исключает `/api/`, иначе SPA-fallback перехватил бы вызовы
прокси и превью ссылок. Значение CSP совпадает с тем, что отдаёт `server.js`.

### 4. Что и куда попадает

| Путь в репозитории        | Адрес на Vercel                | Рантайм |
| ------------------------- | ------------------------------ | ------- |
| `api/greenapi/[method].ts` | `/api/greenapi/<method>`       | Node.js |
| `api/og.ts`                | `/api/og?url=…`                | Node.js |
| `dist/` (сборка Vite)      | `/`, `/chat/:id`, статика      | Статика |

### 5. Проверка после деплоя

```bash
curl -sI https://<домен>/ | grep -i "content-security-policy\|x-frame-options"
curl -s "https://<домен>/api/og?url=https://example.com" | head -c 200
curl -s -X POST https://<домен>/api/greenapi/getChats -H 'content-type: application/json' -d '{}'
# ожидается 401/466 от GREEN-API, а не 404/500: значит прокси жив и токен подхватился
curl -s -o /dev/null -w '%{http_code}\n' https://<домен>/chat/2109546103   # 200, а не 404
```

### 6. Мелочи, о которых легко забыть

- **Тесты в `api/` попадут в деплой как функции.** Vercel собирает каждый файл каталога `api/`
  как endpoint, поэтому `api/og.test.ts` станет «мёртвым» маршрутом `/api/og.test`. Тесты лучше
  держать в `tests/api/` (паттерн `tests/**/*.test.ts` уже включён в `vitest.config.ts`) либо
  исключить через `.vercelignore`.
- **Квоты GREEN-API общие для всех пользователей деплоя**: инстанс даёт ~100 вызовов на метод в
  месяц, и кеши с паузами (`greenApiRead`) живут в памяти функции — при холодном старте они пусты,
  так что первый запрос после простоя уйдёт в API.
- **`/api/og` кеширует превью в памяти инстанса**, между холодными стартами кеш сбрасывается.
- Функции на Vercel имеют лимит времени выполнения (~10–15 с): `api/og.ts` сам ограничен таймаутом
  6 с и чтением 512 КБ документа, так что укладывается.
- Свое доменное имя — Project → Settings → Domains; HTTPS-сертификат выпускается автоматически.

## Структура (после разбиения на небольшие модули)

```
api/
  greenapi/[method].ts   прокси GREEN-API: allow-list методов, origin-проверка, лимиты тела
  og.ts                  серверный парсер OpenGraph (для превью ссылок), защита от SSRF
  og.test.ts, greenapi/proxy.test.ts
src/
  app/                   провайдеры и роуты
  pages/AuthPage, pages/ChatPage
  widgets/               крупные блоки интерфейса (ChatWindow, Sidebar, ChatInfoPanel)
  features/              вертикальные фичи (auth, contacts, messages, search-chats)
  entities/, shared/     типы, api-клиент, ui-примитивы, утилиты
```

### Недавние изменения (2026-10-03)

- **Голосовые сообщения**: запись теперь в OGG/Opus (приоритет), с фоллбеками WebM/Opus → WebM → MP4.
  Исправлена логика `onstop` в `useVoiceRecorder`: после отправки/отмены UI корректно возвращается
  в исходное состояние (input вместо волны, таймеры и стримы очищены).

- **Имена контактов**: локально отредактированные `firstName`/`lastName` (хранятся в IndexedDB
  через `localProfile.ts`) теперь отображаются в шапке чата (`ChatHeader`) и в сайдбаре (`ChatList`)
  вместо имён из списка чатов. В `Conversation` добавлены опциональные поля `firstName`/`lastName`.

- **Уведомления**: переключатели per-chat уведомлений скрыты (закомментированы с `// TODO:`),
  так как GREEN-API не предоставляет per-chat notification state. Сохранена логика в `mutedChats.ts`
  и `localProfile.ts` для будущего включения. Единая система теперь — `mutedChats` (localStorage).

### Модель чата (важно для понимания)

- `useChatPage` — только сборка: открытый чат, баннер ошибки, подключение остальных хуков.
- `useChatList` — состояние списка и два эффекта: первичная загрузка и фоновый проход превью.
  Список и история грузятся параллельно, поэтому кэшированные сообщения видны раньше списка.
- `useChatHistory` — постраничная история, слияние кэша и сети без дублей, опрос раз в 15 с.
- `useHistoryCache` — чтение/запись истории в IndexedDB (store `profiles`, ключ `history:${chatId}`).
- `useChatSelection` — выбор чата, back/forward, карточка контакта, архив, уведомления.
- `useChatCommands` — отправка, пересылка, удаление, загрузка файлов.
- `useMessageWall` — скролл, «прилипание» к низу, дата сверху; `useOlderPages` — sentinel,
  IntersectionObserver и пагинация вверх (`olderBatchLimit = 2`, `loadAhead = 160`).
- `useInfoPanel` — вкладки и производные значения; `useContactDetails` — запрос карточки.

## Производительность

- Форматтеры дат живут в `shared/lib/format.ts`: `Intl.DateTimeFormat` больше не создаётся на
  каждое сообщение, а результаты мемоизируются по метке времени.
- `features/messages/model/mediaCache.ts` — дескрипторы медиа (источник превью, имя файла)
  считаются один раз на сообщение и передаются в `MessageMedia` стабильной ссылкой.
- `React.memo` + стабильные пропсы: `MessageBubble` (ref-колбэки кэшируются по индексу в
  `useMessageWall`), `MessageMedia`, `ChatRow`, `ContactAvatar`, `SidebarAccountBar`, `InfoRow`,
  `ChatSearchField`, `ChatHeaderMenu`.
- `useMemo` там, где производные данные дороже пересчёта: активные сообщения и индекс поиска
  (`ChatPage`), видимые сообщения (`ChatWindow`), участники и вкладки (`useInfoPanel`).
- Важно: колбэк, который зависит от состояния, нельзя создавать inline — `useChatHistory` зависит
  от `onLatestMessage`, и новая функция на каждом рендере перезапускала бы опрос истории.

## Квоты GREEN-API

Около 100 вызовов на метод в месяц. `getAvatar`, `getContactInfo`, `getGroupData`, `getChatHistory`
проходят через кеш и «паузу» (`greenApiRead`, `greenApiContacts`), при ошибке 466 метод
приостанавливается, а не повторяется. Непрочитанные считаются из уже загруженной истории:
если непрочитанных больше окна, бейдж показывает `10+`.

## Безопасность

- Токен только на сервере; прокси принимает лишь идентификатор метода по allow-list regex.
- Кросс-доменные вызовы прокси отклоняются (защита от расхода квоты и от чужих страниц).
- Лимиты: 1 МБ тела запроса, 8 МБ ответа, без пересылки `set-cookie` и CORS-заголовков апстрима.
- `/api/og` не ходит во внутреннюю сеть: проверяется каждый хоп редиректов, блокируются
  loopback/link-local/private/ULA/CGNAT/multicast и нестандартные схемы; кеш ограничен 500 записями.
- Статика отдаётся с CSP (`default-src 'self'`, `frame-ancestors 'none'`), `nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`. Путь к файлу нормализуется и
  проверяется на выход за пределы `dist`.
- Ссылки из сообщений вытаскиваются только по шаблону `https?://`, `target="_blank"` всегда
  с `rel="noopener noreferrer"`. HTML нигде не вставляется через `innerHTML`.

### Остаточные риски

- DNS-rebinding между проверкой и самим запросом в `api/og.ts` не закрыт (нужен pinned-IP
  dispatcher `undici`). Смягчается тем, что каждый редирект проверяется заново.
- Звонок на `/api/og` можно повторить с разными url: стоит добавить лимит запросов на IP, если
  эндпоинт будет доступен из интернета.
- Медиа-ссылки берутся из ответа GREEN-API и не фильтруются по схеме.

## Проверка перед коммитом

```bash
npx tsc -b && npm run lint && npx vitest run && npm run build
```

Полезные пробы в `/tmp/kilo/pa`: `probe15.js` (загрузка чатов, бейджи, пагинация),
`probe7.js` (счётчики запросов при прокрутке вверх), `probe-csp.js` (то же против прод-сервера).

## Заметки по сессиям

- Счётчик непрочитанных оставлен как «10+», второй проход по 100 сообщениям не делаем.
- Клик по строке чата открывает чат; кнопка «назад» на мобильном закрывает его.
- `2109546103` (личный чат) возвращает пустую историю — проверять кеш на группе
  `-1001310609169`, self-чат `1907442184`.