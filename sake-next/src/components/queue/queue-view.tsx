"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, List, Loader2, SearchX, type LucideIcon } from "lucide-react";
import { QueueApi } from "@/lib/client/queue-api";
import { errorMessage } from "@/lib/client/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { QueueJob, QueueJobStatus } from "@/lib/types/queue-status";

type QueueTab = "all" | QueueJobStatus;

const POLL_MS = 5000;

const TABS: Array<{ key: QueueTab; label: string; icon: LucideIcon }> = [
  { key: "all", label: "All", icon: List },
  { key: "queued", label: "Queued", icon: Clock },
  { key: "processing", label: "Processing", icon: Loader2 },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
  { key: "skipped", label: "Skipped", icon: SearchX },
  { key: "failed", label: "Failed", icon: AlertCircle },
];

const STATUS_LABEL: Record<QueueJobStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  skipped: "Skipped",
  failed: "Failed",
};

const STATUS_TONE: Record<QueueJobStatus, string> = {
  queued: "text-muted-foreground",
  processing: "text-primary",
  completed: "text-emerald-500",
  skipped: "text-muted-foreground",
  failed: "text-destructive",
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function jobAuthor(job: QueueJob): string {
  return job.author?.trim() || `Book #${job.bookId}`;
}

function targetProgress(job: QueueJob): number | null {
  return typeof job.targetProgressPercent === "number" ? Math.max(0, Math.min(100, job.targetProgressPercent)) : null;
}

function StatusIcon({ status, className }: { status: QueueJobStatus; className?: string }) {
  const Icon = TABS.find((tab) => tab.key === status)?.icon ?? AlertCircle;
  return <Icon className={cn("size-4", status === "processing" && "animate-spin", className)} aria-hidden="true" />;
}

function JobCard({ job }: { job: QueueJob }) {
  const progress = targetProgress(job);
  const retryLimit = job.maxRetries > 0 ? job.maxRetries : 3;
  return (
    <article className={cn("flex flex-col gap-2 rounded-lg border bg-card p-3", job.status === "failed" ? "border-destructive/50" : "border-border")}>
      <div className="flex items-start gap-3">
        <StatusIcon status={job.status} className={cn("mt-0.5 shrink-0", STATUS_TONE[job.status])} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium" title={job.title}>
              {job.title}
            </p>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
              {job.type === "book-download" ? "Book download" : "Hardcover sync"}
            </span>
            <span className={cn("text-xs font-medium", STATUS_TONE[job.status])}>{STATUS_LABEL[job.status]}</span>
          </div>
          <p className="truncate text-xs text-muted-foreground">{jobAuthor(job)}</p>
        </div>
      </div>

      {progress !== null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn("h-full rounded-full", progress === 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${progress}%` }} />
          </div>
          <span>{Math.round(progress)}% target</span>
        </div>
      )}

      {job.error && <p className="text-xs text-destructive">{job.error}</p>}
      {job.outcomeMessage && <p className="text-xs text-muted-foreground">{job.outcomeMessage}</p>}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-5">
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{formatDateTime(job.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Updated</dt>
          <dd>{formatDateTime(job.updatedAt)}</dd>
        </div>
        {job.finishedAt && (
          <div>
            <dt className="text-muted-foreground">Finished</dt>
            <dd>{formatDateTime(job.finishedAt)}</dd>
          </div>
        )}
        {job.nextAttemptAt && (
          <div>
            <dt className="text-muted-foreground">Next retry</dt>
            <dd>{formatDateTime(job.nextAttemptAt)}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">Retries</dt>
          <dd>
            {job.attempts}/{retryLimit}
            {job.status === "failed" && job.attempts >= retryLimit && <em className="ml-1 not-italic text-destructive">(max reached)</em>}
          </dd>
        </div>
      </dl>
    </article>
  );
}

// Cola de jobs (descargas + Hardcover): sondeo cada 5 s, sin solapar peticiones.
export function QueueView() {
  const [jobs, setJobs] = useState<QueueJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<QueueTab>("all");
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await QueueApi.status();
      setJobs(result.jobs);
      setError(null);
    } catch (cause: unknown) {
      setError(errorMessage(cause, "Failed to load queue"));
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const counts = useMemo(() => {
    const all = jobs ?? [];
    const count = (status: QueueJobStatus) => all.filter((job) => job.status === status).length;
    return { all: all.length, queued: count("queued"), processing: count("processing"), completed: count("completed"), skipped: count("skipped"), failed: count("failed") };
  }, [jobs]);
  const visible = useMemo(() => (tab === "all" ? (jobs ?? []) : (jobs ?? []).filter((job) => job.status === tab)), [jobs, tab]);

  return (
    <div className="flex flex-col gap-5 py-5">
      <header>
        <h1 className="text-xl font-semibold">Queue</h1>
        <p className="text-sm text-muted-foreground">Book downloads and integration jobs. Refreshes every 5 seconds.</p>
      </header>

      <section aria-label="Queue stats" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(["queued", "processing", "completed", "skipped", "failed"] as const).map((status) => (
          <div key={status} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{status === "queued" ? "In Queue" : STATUS_LABEL[status]}</p>
            <p className={cn("text-2xl font-semibold", STATUS_TONE[status])}>{counts[status]}</p>
          </div>
        ))}
      </section>

      <div role="tablist" aria-label="Queue filters" className="flex flex-wrap gap-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("size-3.5", key === "processing" && "animate-spin")} aria-hidden="true" />
            {label}
            <span className="opacity-70">{counts[key]}</span>
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {jobs === null && !error ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <h2 className="text-base font-medium text-foreground">Queue is empty</h2>
          <p className="text-sm">Book downloads and integration jobs will appear here when they run.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
