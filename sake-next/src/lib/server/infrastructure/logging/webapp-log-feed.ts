import { Writable } from "node:stream";
import type { WebappLogFeedPort, WebappLogObservation } from "@/lib/server/application/ports";
import { normalizeLogLevel } from "@/lib/types/device-log";
import { WEBAPP_LOG_BACKLOG_LIMIT, type WebappLogEntry, type WebappLogError } from "@/lib/types/webapp-log";

const RESERVED_LOG_KEYS = new Set(["level", "time", "msg", "pid", "hostname", "err", "error", "name", "service", "env"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toTimestamp(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const timestamp = new Date(value);
    return Number.isNaN(timestamp.getTime()) ? value : timestamp.toISOString();
  }
  return new Date().toISOString();
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function toError(value: unknown): WebappLogError | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return { name: "Error", message: value };
  }
  if (!isRecord(value)) return undefined;

  const name = nonEmptyString(value.name) ?? nonEmptyString(value.type) ?? "Error";
  const message = nonEmptyString(value.message);
  const stack = nonEmptyString(value.stack);
  if (!message && !stack) return undefined;

  return { name, message: message ?? name, stack };
}

function toContext(payload: Record<string, unknown>): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!RESERVED_LOG_KEYS.has(key)) context[key] = value;
  }
  return context;
}

function cloneEntry(entry: WebappLogEntry): WebappLogEntry {
  return { ...entry, context: { ...entry.context }, error: entry.error ? { ...entry.error } : undefined };
}

function parseWebappLogLine(line: string, sequence: number): WebappLogEntry | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isRecord(payload)) return null;

  const error = toError(payload.err ?? payload.error);
  const message = nonEmptyString(payload.msg) ?? error?.message ?? "Log entry";
  const timestamp = toTimestamp(payload.time);

  return {
    id: `${sequence}-${timestamp}`,
    timestamp,
    level: normalizeLogLevel(payload.level),
    message,
    context: toContext(payload),
    error,
  };
}

// Writable que recibe las líneas JSON de pino (multistream en logger.ts) y las
// retiene en un backlog para el visor de logs en vivo (SSE).
export class InMemoryWebappLogFeed extends Writable implements WebappLogFeedPort {
  private readonly entries: WebappLogEntry[] = [];
  private readonly subscribers = new Set<(entry: WebappLogEntry) => void>();
  private remainder = "";
  private sequence = 0;

  constructor(private readonly backlogLimit = WEBAPP_LOG_BACKLOG_LIMIT) {
    super({ decodeStrings: false });
  }

  observe(): WebappLogObservation {
    return {
      snapshot: this.entries.map(cloneEntry),
      subscribe: (listener) => {
        this.subscribers.add(listener);
        return () => {
          this.subscribers.delete(listener);
        };
      },
    };
  }

  override _write(chunk: string | Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.remainder += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    this.flushCompleteLines();
    callback();
  }

  private flushCompleteLines(): void {
    for (;;) {
      const newlineIndex = this.remainder.indexOf("\n");
      if (newlineIndex < 0) return;
      const line = this.remainder.slice(0, newlineIndex);
      this.remainder = this.remainder.slice(newlineIndex + 1);
      this.pushLine(line);
    }
  }

  private pushLine(line: string): void {
    this.sequence += 1;
    const entry = parseWebappLogLine(line, this.sequence);
    if (!entry) return;

    this.entries.push(entry);
    if (this.entries.length > this.backlogLimit) {
      this.entries.splice(0, this.entries.length - this.backlogLimit);
    }
    for (const subscriber of this.subscribers) {
      subscriber(cloneEntry(entry));
    }
  }
}

// Next puede instanciar este módulo más de una vez (proxy, bundles de rutas,
// HMR en dev); el feed vive en globalThis para que logger y SSE vean el mismo.
const GLOBAL_KEY = Symbol.for("sake.webappLogFeed");
const globalStore = globalThis as unknown as Record<symbol, InMemoryWebappLogFeed | undefined>;
export const webappLogFeed: InMemoryWebappLogFeed = (globalStore[GLOBAL_KEY] ??= new InMemoryWebappLogFeed());
