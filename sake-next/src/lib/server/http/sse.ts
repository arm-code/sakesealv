const HEARTBEAT_INTERVAL_MS = 15000;
const RETRY_INTERVAL_MS = 2000;

interface Observation<T> {
  snapshot: T[];
  subscribe(listener: (entry: T) => void): () => void;
}

// Respuesta SSE común a los visores de logs: `snapshot` inicial con el
// backlog, `entry` por cada log nuevo y `heartbeat` cada 15 s. Se limpia al
// abortarse la request o cancelarse el stream.
export function createLogStreamResponse<T>(request: Request, observation: Observation<T>): Response {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const encode = (event: string, payload: unknown) => encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // El controller puede estar ya cerrado durante la cancelación.
        }
      };

      const send = (event: string, payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encode(event, payload));
        } catch {
          close();
        }
      };

      const unsubscribe = observation.subscribe((entry) => send("entry", entry));
      const heartbeat = setInterval(() => send("heartbeat", { entries: [] }), HEARTBEAT_INTERVAL_MS);
      request.signal.addEventListener("abort", close);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        request.signal.removeEventListener("abort", close);
      };

      controller.enqueue(encoder.encode(`retry: ${RETRY_INTERVAL_MS}\n\n`));
      send("snapshot", { entries: observation.snapshot });
    },
    cancel() {
      cleanup();
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
