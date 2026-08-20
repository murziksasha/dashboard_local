# Dashboard Local

Локальний Jira-подібний трекер задач для команди (~50 користувачів). Працює на одному Windows PC і роздається в локальній мережі через браузер.

## Можливості

- Проєкти, команди, ролі (Admin / Project Lead / Member / Viewer)
- Issues: Epic, Story, Task, Bug, Sub-task
- Kanban, список, беклог + спринти, гант, календар, JQL
- Drawer картки задачі, глобальний пошук (`Ctrl+K`)
- Коментарі, вкладення (до 25 МБ), activity log, in-app сповіщення
- Кошик видалених задач (30 днів, потім файли теж прибираються)
- Custom fields, issue links, watchers, story points, work log
- Дашборди (особистий і проєктний), звіти: burndown / velocity / час
- Автобекап SQLite **і вкладень** + CSV export + dump/restore
- Ліміт спроб логіну, аудит входів (Адмін → Аудит)

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
4. Для HTTPS у LAN поставте Caddy або nginx перед Next (сам додаток слухає HTTP). Приклад Caddy:

```
dashboard.lan {
    reverse_proxy 127.0.0.1:3000
}
```

У `.env` тоді вкажіть `APP_BASE_URL=https://dashboard.lan` (посилання в листах і OIDC).

5. Дозвольте порт у Windows Firewall:

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

Або в UI: **Адмін → Бекапи**. Створюється пара `dashboard-….db` + `dashboard-….uploads/` (знімок вкладень). Restore з UI піднімає обидва, якщо знімок файлів є.

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

Аудит входів і бекапів: **Адмін → Аудит**. Звіти спринту: вкладка **Звіти** в проєкті.
