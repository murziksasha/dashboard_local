import fs from "fs";
import path from "path";
import { all, get } from "./db";
import { getUploadsDir } from "./paths";

export function attachmentDiskPath(projectId: string, storedName: string) {
  return path.join(getUploadsDir(), projectId, storedName);
}

export function deleteStoredFilesForIssue(issueId: string) {
  const rows = all<{ project_id: string; stored_name: string }>(
    `SELECT i.project_id, a.stored_name
     FROM attachments a
     JOIN issues i ON i.id = a.issue_id
     WHERE a.issue_id = ?`,
    [issueId],
  );
  for (const row of rows) {
    try {
      const filePath = attachmentDiskPath(row.project_id, row.stored_name);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // ignore fs errors
    }
  }
}

export function uploadsSnapshotDir(backupDbName: string) {
  return backupDbName.replace(/\.db$/i, ".uploads");
}

export function copyDirIfExists(src: string, dest: string) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  return true;
}

export function dirSizeBytes(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const walk = (p: string) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(p)) walk(path.join(p, name));
    } else {
      total += st.size;
    }
  };
  walk(dir);
  return total;
}

export function getIssueProjectId(issueId: string) {
  return get<{ project_id: string }>(
    `SELECT project_id FROM issues WHERE id = ?`,
    [issueId],
  )?.project_id;
}
