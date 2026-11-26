import { getSessionUser } from "@/lib/auth";
import { latestAppEventId, listAppEventsSince, onAppEvent, type AppEvent } from "@/lib/events";
import { canAccessProject } from "@/lib/permissions";
import { listProjectsForUser } from "@/lib/projects";

export const dynamic = "force-dynamic";

function visible(
  e: AppEvent,
  userId: string,
  projectId: string,
  allowedProjects: Set<string>,
) {
  if (e.type === "notification") return e.userId === userId;
  if (!e.projectId || !allowedProjects.has(e.projectId)) return false;
  if (projectId && e.projectId !== projectId) return false;
  return true;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") || "";
  if (projectId && !canAccessProject(user, projectId)) {
    return new Response("forbidden", { status: 403 });
  }
  const allowedProjects = new Set(listProjectsForUser(user).map((p) => p.id));

  const rawLastId = url.searchParams.get("lastId");
  let lastId =
    rawLastId != null && rawLastId !== "" ? Number(rawLastId) : latestAppEventId();
  if (!Number.isFinite(lastId) || lastId < 0) lastId = latestAppEventId();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (e: AppEvent) => {
        if (closed || !visible(e, user.id, projectId, allowedProjects)) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const flush = () => {
        if (closed) return;
        try {
          const rows = listAppEventsSince(lastId, 80);
          for (const row of rows) {
            lastId = Math.max(lastId, row.id ?? lastId);
            send(row);
          }
        } catch {
          // ignore
        }
      };
      flush();
      const off = onAppEvent((e) => {
        lastId = Math.max(lastId, e.id ?? lastId);
        send(e);
      });
      const poll = setInterval(flush, 3000);
      const ping = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closed = true;
          clearInterval(ping);
        }
      }, 25000);
      const abort = () => {
        closed = true;
        clearInterval(poll);
        clearInterval(ping);
        off();
        try {
          controller.close();
        } catch {
          // ignore
        }
      };
      req.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
