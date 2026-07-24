import { NextRequest } from "next/server";
import { getLiveState, subscribeLive, type LiveEvent } from "@/lib/live-bus";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events stream of live workout data. The browser opens this with
 * `new EventSource("/api/live")` on the live screen. Emits an initial snapshot,
 * then every live event, plus periodic heartbeats to keep the connection alive
 * through proxies.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: LiveEvent | { kind: "heartbeat" }) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller already closed; ignore.
        }
      };

      // Immediate snapshot so the UI is populated on connect.
      send({ kind: "snapshot", state: getLiveState() });

      unsubscribe = subscribeLive(send);
      heartbeat = setInterval(() => send({ kind: "heartbeat" }), 15000);

      // Clean up when the client disconnects.
      req.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
