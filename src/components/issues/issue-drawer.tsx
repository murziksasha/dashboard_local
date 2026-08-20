"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, useTransition } from "react";
import { loadIssueWorkspaceAction } from "@/app/actions/issues";
import { IssueDetailClient } from "@/components/issues/issue-detail-client";
import { Drawer } from "@/components/ui/drawer";
import type { IssueWorkspacePayload } from "@/lib/issue-workspace";

export function IssueDrawerHost(props: HostProps) {
  return (
    <Suspense fallback={null}>
      <IssueDrawerInner {...props} />
    </Suspense>
  );
}

type HostProps = {
  projectId: string;
  projectKey: string;
  statuses: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; login?: string }>;
  sprints: Array<{ id: string; name: string }>;
  epics: Array<{ id: string; key: string; title: string }>;
  labelSuggestions?: string[];
  canEdit: boolean;
  canComment: boolean;
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
};

function IssueDrawerInner(props: HostProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const issueId = searchParams.get("issue");
  const [data, setData] = useState<IssueWorkspacePayload | null>(null);
  const [, startTransition] = useTransition();

  const close = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("issue");
    const q = next.toString();
    router.push(q ? `?${q}` : "?", { scroll: false });
    setData(null);
  }, [router, searchParams]);

  useEffect(() => {
    if (!issueId) {
      setData(null);
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      const res = await loadIssueWorkspaceAction(props.projectId, issueId);
      if (cancelled) return;
      if (res && "data" in res && res.data) setData(res.data);
      else setData(null);
    });
    return () => {
      cancelled = true;
    };
  }, [issueId, props.projectId]);

  return (
    <Drawer
      open={!!issueId}
      onClose={close}
      title={data ? `${data.issue.key}` : "Задача"}
      footer={
        issueId ? (
          <Link
            href={`/projects/${props.projectId}/issues/${issueId}?from=/projects/${props.projectId}`}
            className="text-sm text-sky-600 hover:underline"
          >
            Відкрити на повну сторінку
          </Link>
        ) : null
      }
    >
      {!data ? (
        <p className="text-sm text-zinc-500">Завантаження…</p>
      ) : (
        <IssueDetailClient
          compact
          issue={{
            id: data.issue.id,
            project_id: data.issue.project_id,
            key: data.issue.key,
            title: data.issue.title,
            description: data.issue.description,
            type: data.issue.type,
            priority: data.issue.priority,
            status_id: data.issue.status_id,
            assignee_id: data.issue.assignee_id,
            epic_id: data.issue.epic_id,
            sprint_id: data.issue.sprint_id,
            story_points: data.issue.story_points,
            original_estimate_sec: data.issue.original_estimate_sec,
            remaining_estimate_sec: data.issue.remaining_estimate_sec,
            start_date: data.issue.start_date ?? null,
            due_date: data.issue.due_date,
          }}
          labels={data.labels}
          labelSuggestions={props.labelSuggestions}
          assigneeIds={data.assigneeIds}
          statuses={props.statuses}
          users={props.users}
          sprints={props.sprints}
          epics={props.epics}
          customFields={data.customFields}
          watching={data.watching}
          canEdit={data.canEdit}
          canComment={data.canComment}
          comments={data.comments}
          attachments={data.attachments}
          links={data.links}
          worklogs={data.worklogs}
          subtasks={data.subtasks}
          activity={data.activity}
          currentUserId={props.currentUserId}
          currentUserName={props.currentUserName}
          isAdmin={props.isAdmin}
          onDeleted={close}
        />
      )}
    </Drawer>
  );
}

export function useIssueDrawer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  return useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("issue", id);
      router.push(`?${next.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );
}
