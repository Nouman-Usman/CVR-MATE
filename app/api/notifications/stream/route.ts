import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notificationBus, getUnreadCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;

      const send = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream closed
        }
      };

      // Send initial unread count
      getUnreadCount(userId).then((count) => {
        send({ type: "connected", unreadCount: count });
      });

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      // Subscribe to notification events for this user
      const unsubscribe = notificationBus.subscribe(userId, (event) => {
        send(event);
      });

      const doCleanup = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeat);
        unsubscribe();
      };

      cleanup = doCleanup;

      controller.enqueue(encoder.encode(": stream started\n\n"));
    },
    cancel() {
      cleanup?.();
    },
  });

  req.signal.addEventListener("abort", () => {
    cleanup?.();
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
