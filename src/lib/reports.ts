import { all, get, nowIso, run } from "./db";

export type SprintScope = {
  remaining_points: number;
  remaining_issues: number;
  done_points: number;
  done_issues: number;
};

export function sprintWork(sprintId: string): SprintScope {
  const remaining = get<{ points: number; n: number }>(
    `SELECT COALESCE(SUM(i.story_points), 0) as points, COUNT(*) as n
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     WHERE i.sprint_id = ? AND i.deleted_at IS NULL AND s.category != 'done'`,
    [sprintId],
  );
  const done = get<{ points: number; n: number }>(
    `SELECT COALESCE(SUM(i.story_points), 0) as points, COUNT(*) as n
     FROM issues i
     JOIN statuses s ON s.id = i.status_id
     WHERE i.sprint_id = ? AND i.deleted_at IS NULL AND s.category = 'done'`,
    [sprintId],
  );
  return {
    remaining_points: Number(remaining?.points ?? 0),
    remaining_issues: Number(remaining?.n ?? 0),
    done_points: Number(done?.points ?? 0),
    done_issues: Number(done?.n ?? 0),
  };
}

export function snapshotSprint(sprintId: string, day = nowIso().slice(0, 10)) {
  const work = sprintWork(sprintId);
  run(
    `INSERT INTO sprint_snapshots (sprint_id, day, remaining_points, remaining_issues, done_points, done_issues)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(sprint_id, day) DO UPDATE SET
       remaining_points = excluded.remaining_points,
       remaining_issues = excluded.remaining_issues,
       done_points = excluded.done_points,
       done_issues = excluded.done_issues`,
    [
      sprintId,
      day,
      work.remaining_points,
      work.remaining_issues,
      work.done_points,
      work.done_issues,
    ],
  );
  return work;
}

export function snapshotProjectSprints(projectId: string) {
  const rows = all<{ id: string }>(
    `SELECT id FROM sprints WHERE project_id = ? AND status = 'active'`,
    [projectId],
  );
  for (const row of rows) snapshotSprint(row.id);
}

export function snapshotAllActiveSprints() {
  const rows = all<{ id: string }>(`SELECT id FROM sprints WHERE status = 'active'`);
  for (const row of rows) snapshotSprint(row.id);
}

export function recordSprintCommit(sprintId: string) {
  const work = snapshotSprint(sprintId);
  const committedPoints = work.remaining_points + work.done_points;
  const committedIssues = work.remaining_issues + work.done_issues;
  run(
    `INSERT INTO sprint_stats (sprint_id, committed_points, committed_issues, completed_points, completed_issues, captured_at)
     VALUES (?, ?, ?, 0, 0, ?)
     ON CONFLICT(sprint_id) DO UPDATE SET
       committed_points = excluded.committed_points,
       committed_issues = excluded.committed_issues,
       captured_at = excluded.captured_at`,
    [sprintId, committedPoints, committedIssues, nowIso()],
  );
}

export function recordSprintComplete(sprintId: string) {
  const work = snapshotSprint(sprintId);
  const committedPoints = work.remaining_points + work.done_points;
  const committedIssues = work.remaining_issues + work.done_issues;
  const existing = get<{ committed_points: number; committed_issues: number }>(
    `SELECT committed_points, committed_issues FROM sprint_stats WHERE sprint_id = ?`,
    [sprintId],
  );
  run(
    `INSERT INTO sprint_stats (sprint_id, committed_points, committed_issues, completed_points, completed_issues, captured_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(sprint_id) DO UPDATE SET
       completed_points = excluded.completed_points,
       completed_issues = excluded.completed_issues,
       captured_at = excluded.captured_at`,
    [
      sprintId,
      existing?.committed_points ?? committedPoints,
      existing?.committed_issues ?? committedIssues,
      work.done_points,
      work.done_issues,
      nowIso(),
    ],
  );
}

export type BurndownPoint = {
  day: string;
  remaining_points: number;
  remaining_issues: number;
  done_points: number;
  ideal: number | null;
};

export function getBurndown(sprintId: string): {
  sprint: {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    status: string;
  } | null;
  points: BurndownPoint[];
  committed_points: number;
} {
  const sprint = get<{
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    status: string;
  }>(
    `SELECT id, name, start_date, end_date, status FROM sprints WHERE id = ?`,
    [sprintId],
  );
  if (!sprint) return { sprint: null, points: [], committed_points: 0 };

  const stats = get<{ committed_points: number }>(
    `SELECT committed_points FROM sprint_stats WHERE sprint_id = ?`,
    [sprintId],
  );
  const snapshots = all<{
    day: string;
    remaining_points: number;
    remaining_issues: number;
    done_points: number;
  }>(
    `SELECT day, remaining_points, remaining_issues, done_points
     FROM sprint_snapshots WHERE sprint_id = ? ORDER BY day`,
    [sprintId],
  );
  const live = sprintWork(sprintId);
  const today = nowIso().slice(0, 10);
  if (!snapshots.some((s) => s.day === today) && sprint.status === "active") {
    snapshots.push({
      day: today,
      remaining_points: live.remaining_points,
      remaining_issues: live.remaining_issues,
      done_points: live.done_points,
    });
  }
  const committed =
    stats?.committed_points ??
    live.remaining_points + live.done_points;

  const start = sprint.start_date || snapshots[0]?.day || today;
  const end = sprint.end_date || today;
  const startMs = new Date(start + "T00:00:00").getTime();
  const endMs = new Date(end + "T00:00:00").getTime();
  const spanDays = Math.max(1, Math.round((endMs - startMs) / 86400000));

  const points: BurndownPoint[] = snapshots.map((s) => {
    const dayMs = new Date(s.day + "T00:00:00").getTime();
    const elapsed = Math.round((dayMs - startMs) / 86400000);
    const ideal =
      Number.isFinite(elapsed) && spanDays > 0
        ? Math.max(0, committed * (1 - elapsed / spanDays))
        : null;
    return {
      day: s.day,
      remaining_points: Number(s.remaining_points),
      remaining_issues: Number(s.remaining_issues),
      done_points: Number(s.done_points),
      ideal,
    };
  });

  return { sprint, points, committed_points: committed };
}

export type VelocityRow = {
  sprint_id: string;
  name: string;
  committed_points: number;
  completed_points: number;
  committed_issues: number;
  completed_issues: number;
};

export function getVelocity(projectId: string, limit = 6): VelocityRow[] {
  return all<VelocityRow>(
    `SELECT st.sprint_id, s.name, st.committed_points, st.completed_points,
            st.committed_issues, st.completed_issues
     FROM sprint_stats st
     JOIN sprints s ON s.id = st.sprint_id
     WHERE s.project_id = ? AND s.status = 'closed'
     ORDER BY s.created_at DESC
     LIMIT ?`,
    [projectId, limit],
  );
}

export type TimeByUser = {
  user_id: string;
  name: string;
  seconds: number;
  entries: number;
};

export type TimeEntry = {
  id: string;
  issue_id: string;
  key: string;
  title: string;
  name: string;
  seconds: number;
  work_date: string;
  note: string | null;
};

export function getTimeReport(
  projectId: string,
  from: string,
  to: string,
): { byUser: TimeByUser[]; entries: TimeEntry[]; totalSeconds: number } {
  const byUser = all<TimeByUser>(
    `SELECT u.id as user_id, u.name, COALESCE(SUM(w.seconds), 0) as seconds, COUNT(*) as entries
     FROM worklogs w
     JOIN users u ON u.id = w.user_id
     JOIN issues i ON i.id = w.issue_id
     WHERE i.project_id = ? AND i.deleted_at IS NULL
       AND w.work_date >= ? AND w.work_date <= ?
     GROUP BY u.id
     ORDER BY seconds DESC, u.name`,
    [projectId, from, to],
  );
  const entries = all<TimeEntry>(
    `SELECT w.id, w.issue_id, i.key, i.title, u.name, w.seconds, w.work_date, w.note
     FROM worklogs w
     JOIN users u ON u.id = w.user_id
     JOIN issues i ON i.id = w.issue_id
     WHERE i.project_id = ? AND i.deleted_at IS NULL
       AND w.work_date >= ? AND w.work_date <= ?
     ORDER BY w.work_date DESC, w.created_at DESC
     LIMIT 80`,
    [projectId, from, to],
  );
  const totalSeconds = byUser.reduce((sum, row) => sum + Number(row.seconds), 0);
  return { byUser, entries, totalSeconds };
}
