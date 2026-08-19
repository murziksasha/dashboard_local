# Dashboard Local — Expo mobile

Нативний клієнт (Expo) до локального сервера Dashboard Local.

## Підготовка

1. Запустіть веб-сервер: у корені репо `npm start` (слухає `0.0.0.0`).
2. У `mobile/`:

```bash
npm install
npx expo start
```

3. У формі входу вкажіть API URL:
   - Android emulator: `http://10.0.2.2:3000`
   - iOS simulator: `http://localhost:3000`
   - Фізичний телефон: `http://<LAN-IP-сервера>:3000`

## Можливості клієнта

- Логін (локальний / LDAP через той самий API)
- Список проєктів і задач
- Деталі задачі + зміна статусу
- Створення задачі
- Коментарі (перегляд/додавання)
- Вкладення: перегляд + **upload** (Expo DocumentPicker → multipart `file`)
- Відкриття вкладень через авторизоване завантаження + Share sheet
- **Push-нотифікації** (Expo Push Token → `POST /api/push/register`)

## API

- `POST /api/auth/login` → `{ token, user }`
- `GET /api/me` (Bearer)
- `GET /api/projects`
- `GET /api/projects/:id`
- `GET /api/projects/:id/issues`
- `POST /api/projects/:id/issues`
- `GET /api/projects/:id/issues/:issueId`
- `PATCH /api/projects/:id/issues/:issueId`
- `GET/POST /api/projects/:id/issues/:issueId/comments`
- `GET/POST /api/projects/:id/issues/:issueId/attachments` (POST: `multipart/form-data`, поле `file`, ≤ 25 МБ)
- `GET /api/attachments/:id` (cookie-сесія або Bearer)
- `POST /api/push/register` → `{ token, platform?, deviceName? }`
- `DELETE /api/push/register` → `{ token }`

Токен сесії та push-token зберігаються в SecureStore.

### Push: нотатки

- Потрібен **фізичний пристрій** (емулятор без push).
- Для production/EAS вкажіть `extra.eas.projectId` у `app.json`.
- Сервер шле push через Expo Push API при кожному `notifyUser` (разом з email/Telegram).
