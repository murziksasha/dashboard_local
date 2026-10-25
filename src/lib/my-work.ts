import { all } from "./db";
import { listProjectsForUser } from "./projects";
import type { IssueType, Priority, SessionUser, StatusCategory } from "./types";

export type MyWorkItem = {
  id: string;
  project_id: string;
  project_key: string;
  project_name: string;
  key: string;
  title: string;
  type: IssueType;
  priority: Priority;
  status_id: string;
  status_name: string;
  status_category: StatusCategory;
  due_date: string | null;
  reporter_id: string | null;
  reporter_name?: string | null;
  assignee_id: string | null;
  assignee_names: string | null;
  open_blockers_count: number;
  subtasks_done: number;
  subtasks_total: number;
  available_statuses: Array<{ id: string; name: string; category: StatusCategory }>;
};

export type MyWorkMention = {
  notification_id: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  issue?: MyWorkItem | null;
};

export type MyWorkPayload = {
  overdue: MyWorkItem[];
  today: MyWorkItem[];
  inProgress: MyWorkItem[];
  waitingOnMe: MyWorkItem[];
  unreadMentions: MyWorkMention[];
};

type RawWorkItem = Omit<MyWorkItem, "available_statuses">;

const BASE_SELECT = `
  SELECT i.id, i.project_id, p.key as project_key, p.name as project_name,
         i.key, i.title, i.type, i.priority, i.status_id,
         s.name as status_name, s.category as status_category,
         i.due_date, i.reporter_id, ru.name as reporter_name,
         i.assignee_id,
         (SELECT GROUP_CONCAT(u.name, ', ') FROM issue_assignees ia JOIN users u ON u.id = ia.user_id WHERE ia.issue_id = i.id) as assignee_names,
         (SELECT COUNT(*) FROM issue_links l
          JOIN issues bi ON bi.id = l.from_issue_id
          JOIN statuses bs ON bs.id = bi.status_id
          WHERE l.to_issue_id = i.id AND l.link_type = 'blocks' AND bs.category != 'done' AND bi.deleted_at IS NULL
         ) as open_blockers_count,
         (SELECT COUNT(*) FROM issues st
          JOIN statuses sts ON sts.id = st.status_id
          WHERE st.parent_id = i.id AND sts.category = 'done' AND st.deleted_at IS NULL
         ) as subtasks_done,
         (SELECT COUNT(*) FROM issues st
          WHERE st.parent_id = i.id AND st.deleted_at IS NULL
         ) as subtasks_total
  FROM issues i
  JOIN projects p ON p.id = i.project_id
  JOIN statuses s ON s.id = i.status_id
  LEFT JOIN users ru ON ru.id = i.reporter_id
`;

export function listMyWork(user: SessionUser): MyWorkPayload {
  const projects = listProjectsForUser(user);
  if (!projects.length) {
    return {
      overdue: [],
      today: [],
      inProgress: [],
      waitingOnMe: [],
      unreadMentions: [],
    };
  }

  const projectIds = projects.map((p) => p.id);
  const pPlaceholders = projectIds.map(() => "?").join(",");

  const statuses = all<{
    id: string;
    project_id: string;
    name: string;
    category: StatusCategory;
    position: number;
  }>(
    `SELECT id, project_id, name, category, position
     FROM statuses
     WHERE project_id IN (${pPlaceholders})
     ORDER BY position ASC`,
    projectIds,
  );

  const statusesByProject = new Map<
    string,
    Array<{ id: string; name: string; category: StatusCategory }>
  >();
  for (const s of statuses) {
    if (!statusesByProject.has(s.project_id)) {
      statusesByProject.set(s.project_id, []);
    }
    statusesByProject.get(s.project_id)!.push({
      id: s.id,
      name: s.name,
      category: s.category,
    });
  }

  function hydrate(rows: RawWorkItem[]): MyWorkItem[] {
    return rows.map((r) => ({
      ...r,
      open_blockers_count: Number(r.open_blockers_count) || 0,
      subtasks_done: Number(r.subtasks_done) || 0,
      subtasks_total: Number(r.subtasks_total) || 0,
      available_statuses: statusesByProject.get(r.project_id) || [],
    }));
  }

  // 1. Overdue
  const overdueRaw = all<RawWorkItem>(
    `${BASE_SELECT}
     WHERE i.deleted_at IS NULL
       AND i.project_id IN (${pPlaceholders})
       AND EXISTS (SELECT 1 FROM issue_assignees ia WHERE ia.issue_id = i.id AND ia.user_id = ?)
       AND s.category != 'done'
       AND i.due_date IS NOT NULL AND i.due_date < date('now')
     ORDER BY i.due_date ASC, i.rank ASC`,
    [...projectIds, user.id],
  );

  // 2. Due today
  const todayRaw = all<RawWorkItem>(
    `${BASE_SELECT}
     WHERE i.deleted_at IS NULL
       AND i.project_id IN (${pPlaceholders})
       AND EXISTS (SELECT 1 FROM issue_assignees ia WHERE ia.issue_id = i.id AND ia.user_id = ?)
       AND s.category != 'done'
       AND i.due_date = date('now')
     ORDER BY i.rank ASC, i.updated_at DESC`,
    [...projectIds, user.id],
  );

  // 3. In progress (excluding overdue and today)
  const inProgressRaw = all<RawWorkItem>(
    `${BASE_SELECT}
     WHERE i.deleted_at IS NULL
       AND i.project_id IN (${pPlaceholders})
       AND EXISTS (SELECT 1 FROM issue_assignees ia WHERE ia.issue_id = i.id AND ia.user_id = ?)
       AND s.category = 'in_progress'
       AND (i.due_date IS NULL OR i.due_date > date('now'))
     ORDER BY i.updated_at DESC`,
    [...projectIds, user.id],
  );

  // 4. Waiting on me: reporter is user, status category is in_progress or status name is Review, not done, not already assigned to user
  const waitingRaw = all<RawWorkItem>(
    `${BASE_SELECT}
     WHERE i.deleted_at IS NULL
       AND i.project_id IN (${pPlaceholders})
       AND i.reporter_id = ?
       AND (s.category = 'in_progress' OR LOWER(s.name) = 'review')
       AND s.category != 'done'
       AND NOT EXISTS (SELECT 1 FROM issue_assignees ia WHERE ia.issue_id = i.id AND ia.user_id = ?)
     ORDER BY i.updated_at DESC`,
    [...projectIds, user.id, user.id],
  );

  // 5. Unread mentions
  const mentionsRaw = all<{
    id: string;
    title: string;
    body: string | null;
    link: string | null;
    created_at: string;
  }>(
    `SELECT id, title, body, link, created_at
     FROM notifications
     WHERE user_id = ? AND type = 'mention' AND read_at IS NULL
     ORDER BY created_at DESC
     LIMIT 30`,
    [user.id],
  );

  // Extract issue IDs from notification links: /projects/<pid>/issues/<iid>
  const issueIdToMention = new Map<string, string[]>();
  for (const m of mentionsRaw) {
    if (m.link) {
      const match = m.link.match(/\/projects\/[^/]+\/issues\/([^/?]+)/);
      if (match?.[1]) {
        const iid = match[1];
        if (!issueIdToMention.has(iid)) issueIdToMention.set(iid, []);
        issueIdToMention.get(iid)!.push(m.id);
      }
    }
  }

  const mentionIssueIds = [...issueIdToMention.keys()];
  const mentionIssuesHydrated = new Map<string, MyWorkItem>();
  if (mentionIssueIds.length > 0) {
    const iPlaceholders = mentionIssueIds.map(() => "?").join(",");
    const issueRows = all<RawWorkItem>(
      `${BASE_SELECT}
       WHERE i.deleted_at IS NULL
         AND i.project_id IN (${pPlaceholders})
         AND i.id IN (${iPlaceholders})`,
      [...projectIds, ...mentionIssueIds],
    );
    for (const item of hydrate(issueRows)) {
      mentionIssuesHydrated.set(item.id, item);
    }
  }

  const unreadMentions: MyWorkMention[] = mentionsRaw.map((m) => {
    let issue: MyWorkItem | null = null;
    if (m.link) {
      const match = m.link.match(/\/projects\/[^/]+\/issues\/([^/?]+)/);
      if (match?.[1]) {
        issue = mentionIssuesHydrated.get(match[1]) || null;
      }
    }
    return {
      notification_id: m.id,
      title: m.title,
      body: m.body,
      link: m.link,
      created_at: m.created_at,
      issue,
    };
  });

  return {
    overdue: hydrate(overdueRaw),
    today: hydrate(todayRaw),
    inProgress: hydrate(inProgressRaw),
    waitingOnMe: hydrate(waitingRaw),
    unreadMentions,
  };
}
