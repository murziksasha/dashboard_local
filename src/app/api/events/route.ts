import { getSessionUser } from "@/lib/auth";
import { listAppEventsSince, type AppEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

function visible(e: AppEvent, userId: string, projectId: string) {
  if (e.type === "notification") return e.userId === userId;
  if (projectId && e.projectId && e.projectId !== projectId) return false;
  return true;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") || "";
  let lastId = Number(url.searchParams.get("lastId") || 0);
  if (!Number.isFinite(lastId) || lastId < 0) lastId = 0;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (e: AppEvent) => {
        if (!visible(e, user.id, projectId)) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      const flush = () => {
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
      const poll = setInterval(flush, 1500);
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(ping);
        }
      }, 25000);
      const abort = () => {
        clearInterval(poll);
        clearInterval(ping);
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
