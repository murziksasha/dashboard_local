# AGENTS.md

Instructions for coding agents working in this repository. Read the token rule before anything else. Functional detail lives in `SPECS.md`. How to run the app lives in `README.md`.

## Safe token rule

Never print, log, commit, paste into chat, or write into source, tests, or scratch files any live secret. That includes:

- API bearer tokens (`dl_` + hex from `issueApiToken`)
- Session cookie values (`dl_session`; the cookie value is the `sessions.id`)
- Passwords and `password_hash` values from a real database
- `DASHBOARD_SECRET`, `APP_SECRET`, and the contents of `.env` / `.env*.local`
- SMTP passwords, Telegram bot tokens, OIDC client secrets, LDAP bind passwords, webhook secrets
- Expo push tokens (`push_tokens.token`)
- Decrypted settings (`decryptSecret` / `settingGetSecret` output)
- `cookies.txt`, `session.id`, `Authorization` headers, and `Set-Cookie` values

How secrets are stored. Follow this when you add or change auth:

- API tokens are shown once and stored only as SHA-256 hex in `api_tokens.token_hash` (`hashApiToken` in `src/lib/api-auth.ts`). Never insert the raw token. Lifetime is 30 days, at most 5 active tokens per user.
- Browser sessions are an opaque id in the HTTP-only cookie `dl_session` (`src/lib/auth.ts`, about 14 days). Do not log the id. Do not dump the `sessions` table into a reply.
- Integration secrets go through `encryptSecret` / `settingSetSecret` (`enc:v1:` AES-256-GCM, key from `DASHBOARD_SECRET` or `APP_SECRET`). Do not write those values into `settings` in plaintext, and do not `console.log` the decrypt result.
- Passwords are scrypt (`salt:hash`) via `hashPassword` / `verifyPassword`. LDAP users get a `!ldap!…` placeholder, not a real password. Compare with `timingSafeEqual` (already inside `verifyPassword`).
- `src/lib/logger.ts` does not redact. Never pass a token, cookie, password, or decrypted secret as `extra`.

If a value must be discussed, say only whether it is set. A redacted form is `dl_…` plus the last 4 characters, or the first 8 hex chars of the hash. Never the full secret.

Do not read `data/dashboard.db` (or backups) into the conversation to debug login. Query counts and non-secret columns only. Do not commit `data/`, `.env`, `cookies.txt`, or `session.id` (already in `.gitignore`).

Tests may use obvious fake passwords such as `secret12`. Those fixtures are not credentials. Do not copy a password out of the local database into a test, a script, or a reply.

`scripts/make-session.ts` and `scripts/smoke-setup.ts` mint local credentials. Run them only for local tests. Do not echo the token or password they print.

## What this project is

Dashboard Local is a Jira-like issue tracker for one team (about 50 people). One Node process on a single PC, reached over the LAN in a browser. The UI language is Ukrainian (`uk-UA`). User-facing strings stay Ukrainian.

Stack: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, SQLite through `node:sqlite` (WAL), Zod, Vitest. No ORM. Node.js 22+ (24 recommended).

Default listen address is `0.0.0.0:3000` (`npm run dev`, `npm start`). HTTPS is a reverse proxy (Caddy or nginx) in front of the app. The app itself speaks HTTP. `APP_BASE_URL` / `APP_URL` must be the public origin so mail links, OIDC, and cookie `Secure` stay correct.

## Layout

| Path | Role |
| --- | --- |
| `src/app/(auth)` | `/login`, `/setup` |
| `src/app/(app)` | Authenticated UI: dashboard, projects, teams, profile, admin |
| `src/app/actions` | Server Actions used by the web UI |
| `src/app/api` | REST for the Expo client and a few web calls (attachments, export, SSE, health) |
| `src/components` | UI. Domain logic does not belong here |
| `src/lib` | Database, auth, permissions, issues, JQL, backup, LDAP, OIDC, jobs |
| `src/middleware.ts` | Security headers, API rate limit, CSRF on cookie-authenticated mutations |
| `tests` | Vitest. `npm test` |
| `scripts` | `backup.ts`, `smoke-setup.ts`, `make-session.ts` |
| `mobile` | Expo client. See `mobile/README.md` |
| `data` | `dashboard.db`, `uploads/`, `backups/`. Live files are gitignored |
| `SPECS.md` | Functional specification. Update it when behavior changes |
| `public` | PWA manifest, service worker, icons |

Path aliases: `@/` is `src/`.

Data directories come from `src/lib/paths.ts`: `DASHBOARD_DATA_DIR`, or `DASHBOARD_DB_PATH` for the database file alone. Defaults are `data/dashboard.db`, `data/uploads/`, `data/backups/`.

## Request flow

Web UI mutations are Server Actions in `src/app/actions`. Wrap them in `withAction` (`src/lib/action.ts`). It maps `UNAUTHORIZED` and `FORBIDDEN` to Ukrainian error strings and logs anything else without returning the raw exception to the client.

REST handlers under `src/app/api` authenticate with `getUserFromApiToken` (Bearer `dl_…`). A few routes also accept the session cookie (`getSessionUser`): attachments, presence, events, search, export, backups. New mobile endpoints should accept the bearer token.

Middleware (`src/middleware.ts`):

- Mutating `/api/*` without an `Authorization` header must send a matching `Origin` or `Referer` (`isMutatingApiCsrfOk`). A bearer token skips that check so the Expo client can call the API. Missing `Origin` is allowed (curl, native).
- Login route: 20 requests / minute / IP. Other API routes: 240 / minute / IP.
- Security headers from `src/lib/security-headers.ts`.

Login lockout is separate: 5 failures for the same IP + login in 15 minutes, then a 15 minute pause. Failures and successes go to `audit_events`. The same lock applies to the cookie login, `POST /api/auth/login`, and OIDC.

## Authorization

Global role on `users.global_role`: `admin` or `user`.

Project role on `project_members.role` and `project_teams.role`: `viewer` < `member` < `lead`.

Access to a project is a direct membership, or membership of a team linked in `project_teams`. An admin is treated as `lead` on every project (`getProjectRole` in `src/lib/permissions.ts`).

Check on the server for every mutation. Do not rely on hidden buttons.

| Helper | Allows |
| --- | --- |
| `canAccessProject` / `assertProjectAccess` | Any project role |
| `canComment` | Viewer and above |
| `canEditIssues` | Member and above (create and edit issues, DnD, work log, files) |
| `canManageProject` | Lead and above (settings, statuses, sprints, members) |
| `requireAdmin` | Instance admin (users, teams admin, backups, audit, integrations) |

## Data model

Schema and migrations are inline in `src/lib/db.ts` (`migrate`). The connection is a process-wide `node:sqlite` `DatabaseSync` on `globalThis.__dashboardDb`. Pragmas: WAL, `foreign_keys = ON`, `busy_timeout = 5000`, `synchronous = NORMAL`.

Ids come from `createId(prefix)` (`src/lib/id.ts`): 12 random bytes hex, optional prefix (`usr_`, `prj_`, `ses_`, `tok_`, …). Issue keys are `PROJECT-N` from `projects.issue_seq`.

Issues are soft-deleted (`issues.deleted_at`). Every live query filters `deleted_at IS NULL` (dashboards, lists, CSV, rank, due-soon, subtasks). Hard delete (trash button or the 30-day job) removes files under `data/uploads/` before `DELETE FROM issues`.

Other tables worth knowing: `issue_assignees` (multi-assignee; `issues.assignee_id` is legacy), `statuses` (category `todo` | `in_progress` | `done`, optional WIP), `sprints`, `custom_field_defs` / `custom_field_values`, `issue_links` (`blocks`, `relates`, `duplicates`), `worklogs`, `activity_events`, `notifications`, `saved_filters`, `dashboard_widgets`, `workflow_rules`, `webhooks` / `webhook_deliveries`, `issue_templates`, `recurring_issues`, `comment_reactions`, `audit_events`, `app_events` (SSE bus, polled by `/api/events`), `sprint_snapshots` / `sprint_stats`.

Board order is a lexicographic `rank` (`rankBetween` in `src/lib/id.ts`).

## Main surfaces

Authenticated shell: sidebar (dashboard, projects, teams; admin links for admins), command palette (`Ctrl+K`), notification bell.

Project routes under `/projects/[id]`:

| Route | What it is |
| --- | --- |
| `/projects/[id]` | Kanban (sprint or whole project) |
| `…/list` | Filterable table, bulk actions |
| `…/backlog` | Backlog and sprint planning |
| `…/sprint` | Sprint board |
| `…/calendar` | Due dates |
| `…/gantt` | Timeline and dependencies |
| `…/jql` | JQL subset (`src/lib/jql.ts`) |
| `…/reports` | Burndown, velocity, time |
| `…/dashboard` | Project dashboard |
| `…/trash` | Soft-deleted issues (lead/admin) |
| `…/settings` | Statuses, fields, members (lead/admin) |
| `…/issues/[issueId]` | Issue page. The board opens the same issue as `?issue=` |

Issue types: `epic`, `story`, `task`, `bug`, `subtask`. Priorities: `highest` … `lowest`.

Personal dashboard is `/dashboard`. Admin: `/admin/users`, `/admin/teams`, `/admin/backups`, `/admin/audit`, `/admin/settings`.

## Integrations

- LDAP bind is optional. Local scrypt login stays available. Settings in Admin.
- OIDC: `/api/auth/oidc/start` and `/callback`. Short-lived `oidc_states` hold `state` and `code_verifier`.
- Notifications (`notifyUser`): in-app row, plus optional SMTP, Telegram, and Expo push.
- Webhooks and workflow rules are project settings (lead/admin).
- Backups: `npm run backup` or Admin → Backups. A backup is a `.db` file plus a `.uploads/` snapshot. Restore replaces both when the snapshot exists.
- Uploads are authorized downloads only (`GET /api/attachments/:id`). Max file size 25 MB. Images can be inlined with `?inline=1`.

## Mobile

`mobile/` is an Expo app. It logs in with `POST /api/auth/login`, stores the bearer token in SecureStore, and calls the REST routes listed in `mobile/README.md`. Push registration is `POST /api/push/register` with the Expo push token. Do not put the API token in `app.json` or in source.

## Conventions for changes

- Keep a change small and match the surrounding style. Server code lives in `src/lib` and is called from actions or route handlers. Components stay presentational.
- Authorize on the server with the helpers above. Filter `deleted_at IS NULL` on any new issue query that means "still on the board".
- New bearer credentials are hashed at rest the same way as `api_tokens`. New integration secrets go through `settingSetSecret`.
- UI copy is Ukrainian. Error strings returned to the browser should be Ukrainian too (`withAction` already does this for auth failures).
- Add or extend a Vitest test in `tests/` when you change permissions, JQL, backup, auth, or query filters. Run `npm test`.
- When behavior changes, update `SPECS.md` (and `README.md` if setup or operator steps change).
- Do not add a new database driver or ORM. Migrations are `CREATE TABLE IF NOT EXISTS` plus `ensureColumn` in `src/lib/db.ts`.
- Do not bind the server to localhost only. LAN access on `0.0.0.0` is intentional.
