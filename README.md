# Dashboard Local

Локальний Jira-подібний трекер задач для команди (~50 користувачів). Працює на одному Windows PC і роздається в локальній мережі через браузер.

## Можливості

- Проєкти, команди, ролі (Admin / Project Lead / Member / Viewer)
- Issues: Epic, Story, Task, Bug, Sub-task
- Kanban, список, backlog + спринти
- Коментарі, вкладення (до 25 МБ), activity log, in-app сповіщення
- Custom fields, issue links, watchers, story points, work log
- Дашборди (особистий і проєктний)
- Автобекап SQLite + CSV export + dump/restore

## Вимоги

- Node.js 22+ (рекомендовано 24; використовується вбудований `node:sqlite`)
- Windows / Linux / macOS

## Швидкий старт

```bash
npm install
npm run dev
```

Відкрийте `http://localhost:3000` і пройдіть setup-майстер (створення адміністратора).

Опція «демо-проєкт» створює проєкт `DEMO` і користувача `demo` / `demo1234`.

## Доступ у локальній мережі

1. Запуск сервера на всіх інтерфейсах уже налаштований:

```bash
npm run build
npm start
```

Сервер слухає `0.0.0.0:3000`.

2. Дізнайтесь IP машини-сервера (`ipconfig` → IPv4).
3. На інших ПК відкрийте `http://SERVER_IP:3000`.
4. Дозвольте порт у Windows Firewall:

```powershell
New-NetFirewallRule -DisplayName "Dashboard Local" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

Порт змінюється через змінну середовища `PORT` (Next.js читає її автоматично, за замовчуванням `3000`). Приклад:

```powershell
$env:PORT=8080; npm start
```

Див. також `.env.example`.

## Дані та бекапи

- База: `data/dashboard.db`
- Файли: `data/uploads/`
- Бекапи: `data/backups/`

Ручний бекап:

```bash
npm run backup
```

Або в UI: **Адмін → Бекапи**.

Cold backup: скопіюйте всю папку `data/`.

## Стек

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- SQLite через `node:sqlite` (WAL)
- Локальна автентифікація (scrypt + cookie sessions), опційний LDAP bind
- PWA (manifest + service worker)
- Expo-клієнт у `mobile/` (REST API)

## Додаткові можливості

- Multi-assignee, Kanban swimlanes (assignee/epic), JQL, Gantt (Timeline + Dependencies)
- LDAP: **Адмін → Налаштування**
- Мобільний клієнт: див. `mobile/README.md` (upload вкладень, Expo push)
- Тести: `npm test`

## Ролі

| Роль | Можливості |
|------|------------|
| Admin | Користувачі, команди, бекапи, усі проєкти |
| Project Lead | Налаштування проєкту, статуси, спринти, учасники |
| Member | Створення/редагування задач, DnD, work log, файли |
| Viewer | Перегляд + коментарі |
