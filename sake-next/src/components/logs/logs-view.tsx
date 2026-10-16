"use client";

import { useEffect, useRef, useState } from "react";
import { DevicesApi } from "@/lib/client/devices-api";
import { errorMessage } from "@/lib/client/api-client";
import { useLogStream, type LogStreamState } from "@/lib/client/use-log-stream";
import { cn } from "@/lib/utils";
import type { RegisteredDevice } from "@/lib/types/auth";
import { DEVICE_LOG_BACKLOG_LIMIT, type DeviceLogEntry, type LogLevel } from "@/lib/types/device-log";
import { WEBAPP_LOG_BACKLOG_LIMIT, type WebappLogEntry } from "@/lib/types/webapp-log";

type LogsSource = "webapp" | "devices";

const TABS: Array<{ key: LogsSource; label: string; description: string }> = [
  { key: "webapp", label: "Webapp", description: "Live logs from the running Sake webapp process." },
  { key: "devices", label: "Devices", description: "Live logs shipped from connected Sake devices." },
];

const STATE_LABEL: Record<LogStreamState, string> = { live: "Live", reconnecting: "Reconnecting", disconnected: "Disconnected", connecting: "Connecting" };
const STATE_TONE: Record<LogStreamState, string> = {
  live: "bg-emerald-500",
  reconnecting: "bg-amber-500",
  disconnected: "bg-destructive",
  connecting: "bg-muted-foreground",
};
const LEVEL_TONE: Record<LogLevel, string> = {
  fatal: "bg-destructive text-destructive-foreground",
  error: "bg-destructive/20 text-destructive",
  warn: "bg-amber-500/20 text-amber-500",
  info: "bg-blue-500/20 text-blue-400",
  debug: "bg-muted text-muted-foreground",
  trace: "bg-muted text-muted-foreground",
  unknown: "bg-muted text-muted-foreground",
};

const TIMESTAMP = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : TIMESTAMP.format(date);
}

function contextValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function hasDetails(entry: WebappLogEntry): boolean {
  return Object.keys(entry.context).length > 0 || Boolean(entry.error);
}

function formatDetails(entry: WebappLogEntry): string {
  const payload: Record<string, unknown> = {};
  if (Object.keys(entry.context).length > 0) payload.context = entry.context;
  if (entry.error) payload.error = entry.error;
  return JSON.stringify(payload, null, 2);
}

function LevelBadge({ level }: { level: LogLevel }) {
  return <span className={cn("rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase", LEVEL_TONE[level])}>{level}</span>;
}

function StateBadge({ state }: { state: LogStreamState }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-foreground">
      <span className={cn("size-2 rounded-full", STATE_TONE[state])} aria-hidden="true" />
      {STATE_LABEL[state]}
    </div>
  );
}

function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-16 text-center text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{title}</p>
      <p>{description}</p>
    </div>
  );
}

// Feed con auto-scroll: se pega al final salvo que el usuario suba.
function Feed({ lastId, children }: { lastId: string | undefined; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const element = ref.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [lastId]);

  return (
    <div
      ref={ref}
      onScroll={(event) => {
        const element = event.currentTarget;
        stick.current = element.scrollHeight - element.scrollTop - element.clientHeight <= 48;
      }}
      className="flex max-h-[65vh] min-h-64 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-card p-3"
    >
      {children}
    </div>
  );
}

function WebappFeed({ entries }: { entries: WebappLogEntry[] }) {
  return (
    <Feed lastId={entries[entries.length - 1]?.id}>
      {entries.length === 0 ? (
        <Empty title="Waiting for webapp logs..." description="New entries will appear here as the server emits them." />
      ) : (
        entries.map((entry) => (
          <article key={entry.id} className="flex flex-col gap-1 border-b border-border/60 pb-2 last:border-0">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <LevelBadge level={entry.level} />
              <time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time>
            </div>
            <p className="break-words text-sm">{entry.message}</p>
            {Object.keys(entry.context).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(entry.context)
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <span key={key} className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-[0.7rem]">
                      <strong className="mr-1 font-medium">{key}</strong>
                      {contextValue(value)}
                    </span>
                  ))}
              </div>
            )}
            {hasDetails(entry) && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Details</summary>
                <pre className="mt-1 overflow-x-auto rounded bg-muted p-2">{formatDetails(entry)}</pre>
              </details>
            )}
          </article>
        ))
      )}
    </Feed>
  );
}

function DevicesPanel() {
  const [devices, setDevices] = useState<RegisteredDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState("");

  useEffect(() => {
    DevicesApi.list()
      .then((result) => setDevices(result.devices))
      .catch((cause: unknown) => setError(errorMessage(cause, "Failed to load devices")));
  }, []);

  const selected = chosen || devices?.[0]?.deviceId || "";
  const { entries, state } = useLogStream<DeviceLogEntry>(selected ? `/api/devices/${encodeURIComponent(selected)}/logs/stream` : null, DEVICE_LOG_BACKLOG_LIMIT);

  let emptyTitle = "Waiting for device logs...";
  let emptyDescription = "New entries will appear here after remote log shipping is enabled on the device.";
  if (error) {
    emptyTitle = "Unable to load devices.";
    emptyDescription = error;
  } else if (devices === null) {
    emptyTitle = "Loading devices...";
    emptyDescription = "Your registered devices are loading now.";
  } else if (devices.length === 0) {
    emptyTitle = "No devices found.";
    emptyDescription = "Register a device in Sake before trying to view shipped logs.";
  } else if (state === "connecting" || state === "reconnecting") {
    emptyTitle = "Connecting to device logs...";
    emptyDescription = `Trying to connect to ${selected} now.`;
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {entries.length} buffered entr{entries.length === 1 ? "y" : "ies"} · {selected ? `Viewing ${selected}` : "Select a device to start streaming"}
        </span>
        <StateBadge state={state} />
        <label className="flex items-center gap-1.5">
          Device
          <select
            value={selected}
            onChange={(event) => setChosen(event.target.value)}
            disabled={!devices || devices.length === 0}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground"
          >
            {!devices || devices.length === 0 ? (
              <option value="">{devices === null ? "Loading devices..." : "No devices available"}</option>
            ) : (
              devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.deviceId}
                </option>
              ))
            )}
          </select>
        </label>
      </div>
      <Feed lastId={entries[entries.length - 1]?.id}>
        {entries.length === 0 ? (
          <Empty title={emptyTitle} description={emptyDescription} />
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className="flex flex-col gap-1 border-b border-border/60 pb-2 last:border-0">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <LevelBadge level={entry.level} />
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[0.7rem]">{entry.source.trim() ? entry.source.trim().charAt(0).toUpperCase() + entry.source.trim().slice(1) : "Unknown source"}</span>
                </span>
                <time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time>
              </div>
              <p className="break-words text-sm">{entry.message}</p>
            </article>
          ))
        )}
      </Feed>
    </section>
  );
}

// Logs en vivo (SSE): webapp y dispositivos.
export function LogsView() {
  const [source, setSource] = useState<LogsSource>("webapp");
  const webapp = useLogStream<WebappLogEntry>(source === "webapp" ? "/api/logs/webapp/stream" : null, WEBAPP_LOG_BACKLOG_LIMIT);

  return (
    <div className="flex flex-col gap-4 py-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{source === "webapp" ? "Live webapp logs" : "Live device logs"}</h1>
          <p className="text-sm text-muted-foreground">
            {source === "webapp"
              ? "This feed shows logs emitted by the running Sake webapp process. It is process-local and resets when the server restarts."
              : "This feed shows logs shipped from the KOReader Sake plugin when remote log shipping is enabled on a device. Logs reset when the server restarts."}
          </p>
        </div>
        {source === "webapp" && <StateBadge state={webapp.state} />}
      </section>

      <div role="tablist" aria-label="Log sources" className="flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={source === tab.key}
            title={tab.description}
            onClick={() => setSource(tab.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
              source === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {source === "webapp" ? (
        <section className="flex flex-col gap-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {webapp.entries.length} buffered entr{webapp.entries.length === 1 ? "y" : "ies"}
            </span>
            <span>Newest entries appear at the bottom</span>
          </div>
          <WebappFeed entries={webapp.entries} />
        </section>
      ) : (
        <DevicesPanel />
      )}
    </div>
  );
}
