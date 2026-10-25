"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  PlayCircle,
  UserCheck,
} from "lucide-react";
import { addWorklogAction, updateIssueAction } from "@/app/actions/issues";
import { markNotificationReadAction } from "@/app/actions/notifications";
import { GlobalIssueDrawerHost, useIssueDrawer } from "@/components/issues/issue-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { MyWorkItem, MyWorkPayload } from "@/lib/my-work";
import { PRIORITY_LABELS } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const TYPE_CLASS: Record<string, string> = {
  epic: "bg-violet-500",
  story: "bg-emerald-500",
  task: "bg-sky-500",
  bug: "bg-rose-500",
  subtask: "bg-zinc-400",
};

export function MyWorkClient({
  initialData,
}: {
  initialData: MyWorkPayload;
}) {
  const router = useRouter();
  const toast = useToast();
  const openDrawer = useIssueDrawer();
  const [data, setData] = useState<MyWorkPayload>(initialData);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [logTimeItem, setLogTimeItem] = useState<MyWorkItem | null>(null);
  const [customMinutes, setCustomMinutes] = useState("30");
  const [worklogNote, setWorklogNote] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Flatten all selectable items in display order
  const selectableItems = useMemo(() => {
    const list: MyWorkItem[] = [];
    const seen = new Set<string>();
    const add = (item: MyWorkItem) => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        list.push(item);
      }
    };
    data.overdue.forEach(add);
    data.today.forEach(add);
    data.inProgress.forEach(add);
    data.waitingOnMe.forEach(add);
    data.unreadMentions.forEach((m) => {
      if (m.issue) add(m.issue);
    });
    return list;
  }, [data]);

  // Set default active row if none selected
  useEffect(() => {
    if (!activeId && selectableItems.length > 0) {
      setActiveId(selectableItems[0].id);
    } else if (activeId && !selectableItems.some((i) => i.id === activeId)) {
      setActiveId(selectableItems[0]?.id || null);
    }
  }, [selectableItems, activeId]);

  // Keyboard navigation: j/k, Enter, l, a
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!selectableItems.length) return;
      const currentIndex = selectableItems.findIndex((i) => i.id === activeId);

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next =
          currentIndex < 0
            ? 0
            : Math.min(selectableItems.length - 1, currentIndex + 1);
        setActiveId(selectableItems[next].id);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = currentIndex < 0 ? 0 : Math.max(0, currentIndex - 1);
        setActiveId(selectableItems[prev].id);
      } else if (e.key === "Enter") {
        const item = selectableItems[currentIndex >= 0 ? currentIndex : 0];
        if (item) {
          e.preventDefault();
          openDrawer(item.id);
        }
      } else if (e.key.toLowerCase() === "l") {
        const item = selectableItems[currentIndex >= 0 ? currentIndex : 0];
        if (item) {
          e.preventDefault();
          setLogTimeItem(item);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectableItems, activeId, openDrawer]);

  // Quick 1-click status change
  function onStatusChange(issue: MyWorkItem, nextStatusId: string) {
    if (issue.status_id === nextStatusId) return;
    const nextStatus = issue.available_statuses.find((s) => s.id === nextStatusId);
    if (!nextStatus) return;

    // Snapshot for rollback
    const prevData = data;

    // Optimistic update
    const patchItem = (i: MyWorkItem): MyWorkItem =>
      i.id === issue.id
        ? {
            ...i,
            status_id: nextStatusId,
            status_name: nextStatus.name,
            status_category: nextStatus.category,
          }
        : i;

    setData({
      overdue: data.overdue.map(patchItem),
      today: data.today.map(patchItem),
      inProgress: data.inProgress.map(patchItem),
      waitingOnMe: data.waitingOnMe.map(patchItem),
      unreadMentions: data.unreadMentions.map((m) => ({
        ...m,
        issue: m.issue ? patchItem(m.issue) : null,
      })),
    });

    startTransition(async () => {
      const fd = new FormData();
      fd.set("issueId", issue.id);
      fd.set("statusId", nextStatusId);
      const res = await updateIssueAction(fd);
      if (res && "error" in res && res.error) {
        setData(prevData);
        toast.push(res.error, "error");
      } else {
        toast.push(`Статус ${issue.key} оновлено на «${nextStatus.name}»`);
        router.refresh();
      }
    });
  }

  // Quick 1-click log time (15m, 30m, 60m)
  function onQuickLog(issue: MyWorkItem, minutes: number) {
    const seconds = minutes * 60;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("issueId", issue.id);
      fd.set("seconds", String(seconds));
      const res = await addWorklogAction(fd);
      if (res && "error" in res && res.error) {
        toast.push(res.error, "error");
      } else {
        toast.push(`Залоговано ${minutes} хв на ${issue.key}`);
      }
    });
  }

  // Custom log time modal submission
  function onSubmitCustomLog(e: React.FormEvent) {
    e.preventDefault();
    if (!logTimeItem) return;
    const mins = Number(customMinutes) || 0;
    if (mins <= 0) {
      toast.push("Вкажіть тривалість більше 0 хв.", "error");
      return;
    }
    const seconds = mins * 60;
    const note = worklogNote.trim();
    const item = logTimeItem;
    setLogTimeItem(null);
    setWorklogNote("");

    startTransition(async () => {
      const fd = new FormData();
      fd.set("issueId", item.id);
      fd.set("seconds", String(seconds));
      if (note) fd.set("note", note);
      const res = await addWorklogAction(fd);
      if (res && "error" in res && res.error) {
        toast.push(res.error, "error");
      } else {
        toast.push(`Залоговано ${mins} хв на ${item.key}`);
      }
    });
  }

  // Dismiss / Mark mention read
  function onDismissMention(mentionId: string) {
    setData((prev) => ({
      ...prev,
      unreadMentions: prev.unreadMentions.filter(
        (m) => m.notification_id !== mentionId,
      ),
    }));
    startTransition(async () => {
      await markNotificationReadAction(mentionId);
      toast.push("Згадку позначено як прочитану");
      router.refresh();
    });
  }

  const totalTasks =
    data.overdue.length +
    data.today.length +
    data.inProgress.length +
    data.waitingOnMe.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Моя робота</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Ранковий екран: задачі, дедлайни, очікування та згадки.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="hidden items-center gap-1 rounded bg-zinc-100 px-2 py-1 font-mono text-[11px] sm:inline-flex dark:bg-zinc-800">
            <kbd className="font-semibold text-zinc-700 dark:text-zinc-200">j</kbd>/
            <kbd className="font-semibold text-zinc-700 dark:text-zinc-200">k</kbd> навігація
          </span>
          <span className="hidden items-center gap-1 rounded bg-zinc-100 px-2 py-1 font-mono text-[11px] sm:inline-flex dark:bg-zinc-800">
            <kbd className="font-semibold text-zinc-700 dark:text-zinc-200">Enter</kbd> картка
          </span>
          <span className="hidden items-center gap-1 rounded bg-zinc-100 px-2 py-1 font-mono text-[11px] sm:inline-flex dark:bg-zinc-800">
            <kbd className="font-semibold text-zinc-700 dark:text-zinc-200">l</kbd> лог часу
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
            className="text-xs"
          >
            Оновити
          </Button>
        </div>
      </div>

      {totalTasks === 0 && data.unreadMentions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
          <h3 className="mt-3 text-base font-semibold">Все чисто!</h3>
          <p className="mt-1 text-sm text-zinc-500">
            У вас немає прострочених задач, дедлайнів на сьогодні або непрочитаних згадок.
          </p>
          <div className="mt-4">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline"
            >
              Переглянути проєкти <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>
      ) : null}

      {/* 1. Overdue Section */}
      {data.overdue.length > 0 ? (
        <SectionBlock
          title="Прострочені"
          count={data.overdue.length}
          tone="rose"
          icon={<AlertTriangle className="size-4 text-rose-600" />}
        >
          <div className="divide-y divide-zinc-200 rounded-xl border border-rose-200 bg-rose-50/20 dark:divide-zinc-800 dark:border-rose-950/60 dark:bg-rose-950/10">
            {data.overdue.map((item) => (
              <WorkRow
                key={item.id}
                item={item}
                isActive={item.id === activeId}
                onSelect={() => setActiveId(item.id)}
                onOpen={() => openDrawer(item.id)}
                onStatusChange={(statusId) => onStatusChange(item, statusId)}
                onQuickLog={(mins) => onQuickLog(item, mins)}
                onOpenLogTime={() => setLogTimeItem(item)}
              />
            ))}
          </div>
        </SectionBlock>
      ) : null}

      {/* 2. Today Section */}
      {data.today.length > 0 ? (
        <SectionBlock
          title="Сьогодні"
          count={data.today.length}
          tone="amber"
          icon={<Calendar className="size-4 text-amber-600" />}
        >
          <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {data.today.map((item) => (
              <WorkRow
                key={item.id}
                item={item}
                isActive={item.id === activeId}
                onSelect={() => setActiveId(item.id)}
                onOpen={() => openDrawer(item.id)}
                onStatusChange={(statusId) => onStatusChange(item, statusId)}
                onQuickLog={(mins) => onQuickLog(item, mins)}
                onOpenLogTime={() => setLogTimeItem(item)}
              />
            ))}
          </div>
        </SectionBlock>
      ) : null}

      {/* 3. In Progress Section */}
      {data.inProgress.length > 0 ? (
        <SectionBlock
          title="В процесі"
          count={data.inProgress.length}
          tone="sky"
          icon={<PlayCircle className="size-4 text-sky-600" />}
        >
          <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {data.inProgress.map((item) => (
              <WorkRow
                key={item.id}
                item={item}
                isActive={item.id === activeId}
                onSelect={() => setActiveId(item.id)}
                onOpen={() => openDrawer(item.id)}
                onStatusChange={(statusId) => onStatusChange(item, statusId)}
                onQuickLog={(mins) => onQuickLog(item, mins)}
                onOpenLogTime={() => setLogTimeItem(item)}
              />
            ))}
          </div>
        </SectionBlock>
      ) : null}

      {/* 4. Waiting on me (Reporter + In Progress or Review) */}
      {data.waitingOnMe.length > 0 ? (
        <SectionBlock
          title="Очікують на мене"
          count={data.waitingOnMe.length}
          tone="default"
          subtitle="Я є автором, задача в роботі або на рев'ю"
          icon={<UserCheck className="size-4 text-zinc-500" />}
        >
          <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {data.waitingOnMe.map((item) => (
              <WorkRow
                key={item.id}
                item={item}
                isActive={item.id === activeId}
                onSelect={() => setActiveId(item.id)}
                onOpen={() => openDrawer(item.id)}
                onStatusChange={(statusId) => onStatusChange(item, statusId)}
                onQuickLog={(mins) => onQuickLog(item, mins)}
                onOpenLogTime={() => setLogTimeItem(item)}
              />
            ))}
          </div>
        </SectionBlock>
      ) : null}

      {/* 5. Unread Mentions Section */}
      {data.unreadMentions.length > 0 ? (
        <SectionBlock
          title="Непрочитані згадки"
          count={data.unreadMentions.length}
          tone="violet"
          icon={<MessageSquare className="size-4 text-violet-600" />}
        >
          <div className="space-y-2">
            {data.unreadMentions.map((mention) => (
              <div
                key={mention.notification_id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-950/60 dark:bg-violet-950/20"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-violet-900 dark:text-violet-200">
                      {mention.title}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {formatDate(mention.created_at)}
                    </span>
                  </div>
                  {mention.body ? (
                    <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">
                      «{mention.body}»
                    </p>
                  ) : null}
                  {mention.issue ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => openDrawer(mention.issue!.id)}
                        className="font-semibold text-sky-600 hover:underline"
                      >
                        {mention.issue.key}: {mention.issue.title}
                      </button>
                      <Badge tone="default">{mention.issue.project_name}</Badge>
                      <span className="text-zinc-400">• {mention.issue.status_name}</span>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {mention.issue ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDrawer(mention.issue!.id)}
                      className="text-xs"
                    >
                      Відкрити
                    </Button>
                  ) : mention.link ? (
                    <Link
                      href={mention.link}
                      className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      Перейти
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    title="Позначити прочитаним"
                    onClick={() => onDismissMention(mention.notification_id)}
                    className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:bg-emerald-50 hover:text-emerald-600 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-emerald-950/40"
                  >
                    <Check className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionBlock>
      ) : null}

      {/* Custom Log Time Dialog */}
      <Dialog
        open={!!logTimeItem}
        onClose={() => setLogTimeItem(null)}
        title={`Лог часу: ${logTimeItem?.key ?? ""}`}
      >
        <form onSubmit={onSubmitCustomLog} className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {logTimeItem?.title}
          </p>
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Тривалість (хвилини)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="5"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                autoFocus
                required
              />
              <div className="flex gap-1 text-xs">
                {[15, 30, 45, 60, 120].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCustomMinutes(String(m))}
                    className="rounded bg-zinc-100 px-2 py-1 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                  >
                    {m}хв
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Коментар (необов&apos;язково)
            </label>
            <input
              type="text"
              value={worklogNote}
              onChange={(e) => setWorklogNote(e.target.value)}
              placeholder="Що було зроблено…"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLogTimeItem(null)}
            >
              Скасувати
            </Button>
            <Button type="submit" size="sm">
              Зберегти
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Global Issue Drawer Host */}
      <GlobalIssueDrawerHost />
    </div>
  );
}

function SectionBlock({
  title,
  count,
  tone,
  subtitle,
  icon,
  children,
}: {
  title: string;
  count: number;
  tone: "rose" | "amber" | "sky" | "violet" | "default";
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-700 dark:text-zinc-200">
          {title}
        </h2>
        <Badge tone={tone}>{count}</Badge>
        {subtitle ? (
          <span className="text-xs text-zinc-400">— {subtitle}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function WorkRow({
  item,
  isActive,
  onSelect,
  onOpen,
  onStatusChange,
  onQuickLog,
  onOpenLogTime,
}: {
  item: MyWorkItem;
  isActive: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onStatusChange: (statusId: string) => void;
  onQuickLog: (minutes: number) => void;
  onOpenLogTime: () => void;
}) {
  const isOverdue =
    item.due_date &&
    new Date(`${item.due_date}T00:00:00`).getTime() <
      new Date().setHours(0, 0, 0, 0);

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 transition-colors sm:px-4",
        isActive
          ? "bg-sky-50/80 ring-1 ring-inset ring-sky-300 dark:bg-sky-950/30 dark:ring-sky-700"
          : "hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40",
      )}
    >
      {/* Left side: Key, Type, Title, Project, Chips */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Key with Type dot */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:underline"
          >
            <span
              className={cn("size-2 rounded-full", TYPE_CLASS[item.type] || "bg-zinc-400")}
              title={item.type}
            />
            {item.key}
          </button>

          {/* Project Badge */}
          <span
            className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            title={item.project_name}
          >
            {item.project_key}
          </span>

          {/* Priority */}
          <Badge
            tone={
              item.priority === "highest" || item.priority === "high"
                ? "rose"
                : item.priority === "medium"
                  ? "amber"
                  : "default"
            }
          >
            {PRIORITY_LABELS[item.priority]}
          </Badge>

          {/* Red Blocked Chip */}
          {Number(item.open_blockers_count) > 0 ? (
            <span
              className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
              title={`Заблоковано іншими задачами: ${item.open_blockers_count}`}
            >
              <AlertCircle className="size-3" />
              Заблоковано
            </span>
          ) : null}

          {/* Subtasks progress */}
          {Number(item.subtasks_total) > 0 ? (
            <span
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                item.subtasks_done === item.subtasks_total
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
              )}
              title={`Підзадачі: ${item.subtasks_done}/${item.subtasks_total}`}
            >
              {item.subtasks_done}/{item.subtasks_total}
            </span>
          ) : null}

          {/* Due date */}
          {item.due_date ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px]",
                isOverdue
                  ? "font-semibold text-rose-600 dark:text-rose-400"
                  : "text-zinc-500",
              )}
            >
              <Clock className="size-3" />
              {item.due_date}
            </span>
          ) : null}
        </div>

        {/* Title */}
        <p
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="cursor-pointer text-sm font-medium leading-snug text-zinc-900 hover:text-sky-600 dark:text-zinc-100 dark:hover:text-sky-400"
        >
          {item.title}
        </p>
      </div>

      {/* Right side: 1-click Status + 1-click Log Time */}
      <div
        className="flex flex-wrap items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status Dropdown */}
        <select
          value={item.status_id}
          onChange={(e) => onStatusChange(e.target.value)}
          className={cn(
            "h-7 rounded-md border px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500",
            item.status_category === "done"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : item.status_category === "in_progress"
                ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                : "border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
          )}
        >
          {item.available_statuses.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </select>

        {/* 1-click Log Time Buttons */}
        <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
          <button
            type="button"
            title="Залогувати 15 хвилин"
            onClick={() => onQuickLog(15)}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            +15хв
          </button>
          <button
            type="button"
            title="Залогувати 30 хвилин"
            onClick={() => onQuickLog(30)}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            +30хв
          </button>
          <button
            type="button"
            title="Залогувати 1 годину"
            onClick={() => onQuickLog(60)}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            +1г
          </button>
          <button
            type="button"
            title="Вказати інший час"
            onClick={onOpenLogTime}
            className="rounded px-1 py-0.5 text-[10px] text-zinc-400 hover:bg-white hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            …
          </button>
        </div>
      </div>
    </div>
  );
}
