import { all } from "./db";
import type { IssueRow } from "./issues";
import { listIssues } from "./issues";

export type JqlError = { message: string; position?: number };

type Token =
  | { type: "word"; value: string }
  | { type: "string"; value: string }
  | { type: "op"; value: string }
  | { type: "paren"; value: "(" | ")" };

const OPS = ["!=", "!~", ">=", "<=", "~", "=", ">", "<", "in", "not"];

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
      continue;
    }
    // cf[Custom Field]
    if (input.slice(i, i + 3).toLowerCase() === "cf[") {
      const end = input.indexOf("]", i + 3);
      if (end === -1) throw new Error("Unclosed cf[]");
      const name = input.slice(i + 3, end);
      tokens.push({ type: "word", value: `cf[${name}]` });
      i = end + 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let value = "";
      while (i < input.length && input[i] !== quote) {
        value += input[i++];
      }
      i++; // closing
      tokens.push({ type: "string", value });
      continue;
    }
    const two = input.slice(i, i + 2);
    if (OPS.includes(two)) {
      tokens.push({ type: "op", value: two.toLowerCase() });
      i += 2;
      continue;
    }
    if (OPS.includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    let word = "";
    while (i < input.length && !/\s|[=!<>~()]/.test(input[i])) {
      word += input[i++];
    }
    const lower = word.toLowerCase();
    if (
      [
        "and",
        "or",
        "not",
        "order",
        "by",
        "asc",
        "desc",
        "in",
        "empty",
        "isnull",
        "was",
        "changed",
        "after",
        "before",
        "during",
        "on",
        "is",
      ].includes(lower)
    ) {
      tokens.push({ type: "op", value: lower });
    } else {
      tokens.push({ type: "word", value: word });
    }
  }
  return tokens;
}

function valueOf(tok: Token | undefined): string {
  if (!tok) return "";
  if (tok.type === "string" || tok.type === "word") return tok.value;
  return tok.value;
}

/** Very practical JQL subset evaluator against project issues. */
export function runJql(
  projectId: string,
  query: string,
  currentUserId?: string,
): { issues: IssueRow[]; error?: string } {
  const trimmed = query.trim();
  if (!trimmed) return { issues: listIssues(projectId) };

  let tokens: Token[];
  try {
    tokens = tokenize(trimmed);
  } catch {
    return { issues: [], error: "Не вдалося розібрати JQL." };
  }

  // Split ORDER BY
  let orderField: string | null = null;
  let orderDir: "asc" | "desc" = "asc";
  const orderIdx = tokens.findIndex(
    (t, i) => t.type === "op" && t.value === "order" && tokens[i + 1]?.value === "by",
  );
  let whereTokens = tokens;
  if (orderIdx >= 0) {
    whereTokens = tokens.slice(0, orderIdx);
    orderField = valueOf(tokens[orderIdx + 2])?.toLowerCase() || null;
    const dir = valueOf(tokens[orderIdx + 3])?.toLowerCase();
    if (dir === "desc" || dir === "asc") orderDir = dir;
  }

  const allProjectIssues = listIssues(projectId);
  const users = all<{ id: string; login: string; name: string }>(
    `SELECT id, login, name FROM users`,
  );
  const statuses = all<{ id: string; name: string }>(
    `SELECT id, name FROM statuses WHERE project_id = ?`,
    [projectId],
  );
  const customDefs = all<{ id: string; name: string }>(
    `SELECT id, name FROM custom_field_defs WHERE project_id = ?`,
    [projectId],
  );
  const customValues = all<{ field_id: string; issue_id: string; value: string | null }>(
    `SELECT v.field_id, v.issue_id, v.value
     FROM custom_field_values v
     JOIN custom_field_defs d ON d.id = v.field_id
     WHERE d.project_id = ?`,
    [projectId],
  );
  const history = all<{
    issue_id: string;
    action: string;
    payload_json: string | null;
    created_at: string;
  }>(
    `SELECT issue_id, action, payload_json, created_at
     FROM activity_events
     WHERE project_id = ? AND issue_id IS NOT NULL
       AND action IN ('issue.updated', 'issue.moved')
     ORDER BY created_at ASC`,
    [projectId],
  );

  function statusNameById(id: string | null | undefined) {
    if (!id) return "";
    return statuses.find((s) => s.id === id)?.name || id;
  }

  function fieldHistory(
    issueId: string,
    field: string,
  ): Array<{ from: string; to: string; at: string }> {
    const out: Array<{ from: string; to: string; at: string }> = [];
    for (const h of history) {
      if (h.issue_id !== issueId || !h.payload_json) continue;
      try {
        const payload = JSON.parse(h.payload_json) as Record<string, unknown>;
        if (h.action === "issue.moved" && (field === "status" || field === "status_id")) {
          out.push({
            from: statusNameById(String(payload.from || "")),
            to: statusNameById(String(payload.to || payload.statusId || "")),
            at: h.created_at,
          });
          continue;
        }
        if (h.action === "issue.updated") {
          const changes = (payload.changes || payload) as Record<string, unknown>;
          const before = (payload.before || {}) as Record<string, unknown>;
          const col =
            field === "status"
              ? "status_id"
              : field === "assignee"
                ? "assignee_id"
                : field;
          if (col in changes) {
            let from = String(before[col] ?? "");
            let to = String(changes[col] ?? "");
            if (col === "status_id") {
              from = statusNameById(from);
              to = statusNameById(to);
            }
            out.push({ from, to, at: h.created_at });
          }
        }
      } catch {
        // ignore bad payload
      }
    }
    return out;
  }

  function resolveUser(v: string): string | "unassigned" | null {
    if (!v || v.toLowerCase() === "empty" || v.toLowerCase() === "null") {
      return "unassigned";
    }
    if (v === "currentUser()" || v.toLowerCase() === "currentuser()") {
      return currentUserId || null;
    }
    const found = users.find(
      (u) =>
        u.login.toLowerCase() === v.toLowerCase() ||
        u.name.toLowerCase() === v.toLowerCase(),
    );
    return found?.id ?? null;
  }

  type Pred = (issue: IssueRow) => boolean;

  function parseExpression(toks: Token[]): Pred {
    // Very small recursive descent: OR of AND of atoms
    let i = 0;

    function parsePrimary(): Pred {
      if (toks[i]?.type === "op" && toks[i].value === "not") {
        i++;
        const inner = parsePrimary();
        return (issue) => !inner(issue);
      }
      if (toks[i]?.type === "paren" && toks[i].value === "(") {
        i++;
        const inner = parseOr();
        if (toks[i]?.type === "paren" && toks[i].value === ")") i++;
        return inner;
      }
      return parseComparison();
    }

    function parseComparison(): Pred {
      const fieldTok = toks[i++];
      const field = valueOf(fieldTok).toLowerCase();
      const opTok = toks[i++];
      const op = (opTok?.value || "=").toLowerCase();

      if (op === "in") {
        // field in (a, b)
        if (toks[i]?.type === "paren" && toks[i].value === "(") i++;
        const values: string[] = [];
        while (i < toks.length && !(toks[i].type === "paren" && toks[i].value === ")")) {
          const v = valueOf(toks[i++]);
          if (v && v !== ",") values.push(v);
        }
        if (toks[i]?.type === "paren" && toks[i].value === ")") i++;
        return (issue) => values.some((v) => matchField(issue, field, "=", v));
      }

      // IS EMPTY / IS NOT EMPTY
      if (op === "is") {
        let negated = false;
        if (toks[i]?.type === "op" && toks[i].value === "not") {
          negated = true;
          i++;
        }
        const emptiness = valueOf(toks[i++]).toLowerCase();
        if (emptiness === "empty" || emptiness === "null") {
          return (issue) => {
            const empty = matchField(issue, field, "=", "empty");
            return negated ? !empty : empty;
          };
        }
        return (issue) => matchField(issue, field, "=", emptiness);
      }

      // status WAS Done
      if (op === "was") {
        const val = valueOf(toks[i++]);
        return (issue) => {
          const hist = fieldHistory(issue.id, field.toLowerCase());
          const target = val.toLowerCase();
          return hist.some(
            (h) => h.from.toLowerCase() === target || h.to.toLowerCase() === target,
          );
        };
      }

      // status CHANGED [AFTER -7d] [BEFORE 1d]
      if (op === "changed") {
        let after: string | null = null;
        let before: string | null = null;
        while (
          toks[i]?.type === "op" &&
          (toks[i].value === "after" ||
            toks[i].value === "before" ||
            toks[i].value === "on" ||
            toks[i].value === "during")
        ) {
          const kind = toks[i++].value;
          const raw = valueOf(toks[i++]);
          const day = resolveRelativeDate(raw);
          if (kind === "after") after = day;
          if (kind === "before" || kind === "on") before = day;
          if (kind === "during") {
            after = day;
            before = day;
          }
        }
        return (issue) => {
          const hist = fieldHistory(issue.id, field.toLowerCase());
          if (!hist.length) return false;
          return hist.some((h) => {
            const day = h.at.slice(0, 10);
            if (after && day < after) return false;
            if (before && day > before) return false;
            return true;
          });
        };
      }

      const val = valueOf(toks[i++]);
      return (issue) => matchField(issue, field, op, val);
    }

    function parseAnd(): Pred {
      let left = parsePrimary();
      while (toks[i]?.type === "op" && toks[i].value === "and") {
        i++;
        const right = parsePrimary();
        const prev = left;
        left = (issue) => prev(issue) && right(issue);
      }
      return left;
    }

    function parseOr(): Pred {
      let left = parseAnd();
      while (toks[i]?.type === "op" && toks[i].value === "or") {
        i++;
        const right = parseAnd();
        const prev = left;
        left = (issue) => prev(issue) || right(issue);
      }
      return left;
    }

    function matchField(
      issue: IssueRow,
      field: string,
      op: string,
      raw: string,
    ): boolean {
      const v = raw;
      switch (field) {
        case "type":
          return cmp(issue.type, op, v.toLowerCase());
        case "status": {
          const name = issue.status_name || "";
          return cmp(name.toLowerCase(), op, v.toLowerCase());
        }
        case "priority":
          return cmp(issue.priority, op, v.toLowerCase());
        case "key":
          return cmp(issue.key.toLowerCase(), op, v.toLowerCase());
        case "summary":
        case "text": {
          const hay = `${issue.title} ${issue.description || ""}`.toLowerCase();
          if (op === "~" || op === "!~") {
            const ok = hay.includes(v.toLowerCase());
            return op === "~" ? ok : !ok;
          }
          return cmp(issue.title.toLowerCase(), op, v.toLowerCase());
        }
        case "assignee": {
          const uid = resolveUser(v);
          if (uid === "unassigned") {
            const empty = !issue.assignee_names && !issue.assignee_id;
            return op === "!=" ? !empty : empty;
          }
          if (!uid) return false;
          const names = (issue.assignee_names || issue.assignee_name || "").toLowerCase();
          const user = users.find((u) => u.id === uid);
          const hit =
            issue.assignee_id === uid ||
            (user
              ? names.includes(user.name.toLowerCase()) ||
                names.includes(user.login.toLowerCase())
              : false);
          return op === "!=" ? !hit : hit;
        }
        case "reporter": {
          const uid = resolveUser(v);
          if (uid === "unassigned") {
            const empty = !issue.reporter_id;
            return op === "!=" ? !empty : empty;
          }
          if (!uid) return false;
          return op === "!="
            ? issue.reporter_id !== uid
            : issue.reporter_id === uid;
        }
        case "labels":
        case "label": {
          const labels = (issue.labels || "").toLowerCase();
          if (v.toLowerCase() === "empty") {
            const empty = !labels.trim();
            return op === "!=" ? !empty : empty;
          }
          if (op === "~") return labels.includes(v.toLowerCase());
          return labels
            .split(",")
            .map((s) => s.trim())
            .includes(v.toLowerCase());
        }
        case "sprint": {
          if (v.toLowerCase() === "empty") return !issue.sprint_id;
          return issue.sprint_id === v;
        }
        case "epic":
        case "epiclink": {
          if (v.toLowerCase() === "empty") {
            const empty = !issue.epic_id;
            return op === "!=" ? !empty : empty;
          }
          return (
            issue.epic_id === v ||
            (!!issue.epic_id &&
              allProjectIssues.some(
                (e) =>
                  e.id === issue.epic_id &&
                  (e.key.toLowerCase() === v.toLowerCase() ||
                    e.title.toLowerCase() === v.toLowerCase()),
              ))
          );
        }
        case "parent": {
          if (v.toLowerCase() === "empty") {
            const empty = !issue.parent_id;
            return op === "!=" ? !empty : empty;
          }
          return (
            issue.parent_id === v ||
            (!!issue.parent_id &&
              allProjectIssues.some(
                (e) =>
                  e.id === issue.parent_id &&
                  e.key.toLowerCase() === v.toLowerCase(),
              ))
          );
        }
        case "category":
          return cmp(
            (issue.status_category || "").toLowerCase(),
            op,
            v.toLowerCase(),
          );
        case "duedate":
        case "due": {
          const due = issue.due_date || "";
          if (v.toLowerCase() === "empty") {
            return op === "=" || op === "is" ? !due : !!due;
          }
          return cmp(due, op, resolveRelativeDate(v));
        }
        case "created":
          return cmp(issue.created_at.slice(0, 10), op, resolveRelativeDate(v));
        case "updated":
          return cmp(issue.updated_at.slice(0, 10), op, resolveRelativeDate(v));
        case "project":
          return true;
        default: {
          // cf[Custom Field Name]
          const cf = field.match(/^cf\[(.+)\]$/i);
          if (cf) {
            const def = customDefs.find(
              (d) => d.name.toLowerCase() === cf[1].toLowerCase(),
            );
            if (!def) return false;
            const row = customValues.find(
              (v) => v.field_id === def.id && v.issue_id === issue.id,
            );
            const cur = (row?.value || "").toLowerCase();
            if (v.toLowerCase() === "empty") {
              const empty = !cur;
              return op === "!=" ? !empty : empty;
            }
            if (op === "~") return cur.includes(v.toLowerCase());
            return cmp(cur, op, v.toLowerCase());
          }
          return true;
        }
      }
    }

    function cmp(left: string, op: string, right: string): boolean {
      switch (op) {
        case "!=":
          return left !== right;
        case "~":
          return left.includes(right);
        case "!~":
          return !left.includes(right);
        case ">":
          return left > right;
        case "<":
          return left < right;
        case ">=":
          return left >= right;
        case "<=":
          return left <= right;
        case "is":
        case "=":
        default:
          return left === right;
      }
    }

    if (!whereTokens.length) return () => true;
    return parseOr();
  }

  try {
    const pred = parseExpression(whereTokens);
    let issues = allProjectIssues.filter(pred);
    if (orderField) {
      issues = [...issues].sort((a, b) => {
        const av = String((a as unknown as Record<string, unknown>)[orderField] ?? "");
        const bv = String((b as unknown as Record<string, unknown>)[orderField] ?? "");
        const c = av.localeCompare(bv);
        return orderDir === "desc" ? -c : c;
      });
    }
    // silence unused
    void statuses;
    return { issues };
  } catch (e) {
    return {
      issues: [],
      error: e instanceof Error ? e.message : "Помилка JQL",
    };
  }
}

function resolveRelativeDate(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v === "now" || v === "today") {
    return new Date().toISOString().slice(0, 10);
  }
  const m = v.match(/^([+-]?)(\d+)([dwmy])$/);
  if (!m) return raw;
  const sign = m[1] === "-" ? -1 : 1;
  const n = Number(m[2]) * sign;
  const d = new Date();
  if (m[3] === "d") d.setDate(d.getDate() + n);
  if (m[3] === "w") d.setDate(d.getDate() + n * 7);
  if (m[3] === "m") d.setMonth(d.getMonth() + n);
  if (m[3] === "y") d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

export const JQL_HELP = `Поля: type, status, priority, key, summary/text, assignee, reporter, labels,
epic/epicLink, parent, sprint, due/duedate, created, updated, project, category,
cf[Custom Field]
Функції: currentUser(), empty/null, відносні дати: -7d, 2w, +1m, now/today
Оператори: = != ~ !~ > < >= <= IN IS WAS CHANGED AFTER BEFORE
Логіка: AND OR NOT
Сортування: ORDER BY field ASC|DESC
Приклади:
  type = bug AND status != Done
  assignee = currentUser() AND due <= 7d
  assignee is empty
  status WAS Done
  status CHANGED AFTER -7d
  cf[Risk] = high
  text ~ "firewall" ORDER BY updated DESC`;
