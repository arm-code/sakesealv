"use client";

import { useEffect, useMemo, useState } from "react";
import { LibraryApi } from "@/lib/client/library-api";
import { StatsApi } from "@/lib/client/stats-api";
import { errorMessage } from "@/lib/client/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LibraryBook } from "@/lib/library/types";
import type { ReadingActivityStats } from "@/lib/types/stats";
import { DAILY_RANGES, FORMAT_COLORS, buildStatsViewModel, formatDate, formatNumber, type DailyRange } from "@/lib/stats/view";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function Card({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-lg border border-border bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub: React.ReactNode; tone?: string }) {
  return (
    <article className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-semibold", tone)}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </article>
  );
}

function BarChart({ items, max, className }: { items: Array<{ key: string; label: string; value: number; tip: string }>; max: number; className?: string }) {
  return (
    <div className={cn("flex h-40 items-end gap-1", className)}>
      {items.map((item) => (
        <div key={item.key} title={item.tip} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <div className="flex w-full flex-1 items-end">
            <div className="w-full rounded-t bg-primary" style={{ height: `${(item.value / max) * 100}%` }} />
          </div>
          <span className="w-full truncate text-center text-[0.6rem] text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function heatColor(pages: number, max: number): string {
  if (pages <= 0 || max <= 0) return "var(--muted)";
  const percent = Math.max(15, Math.round((pages / max) * 100));
  return `color-mix(in oklab, var(--primary) ${percent}%, var(--muted))`;
}

function Bars({ rows }: { rows: Array<{ key: string; label: string; value: number; max: number; tip?: string; right?: string; color?: string }> }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.key} title={row.tip} className="flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 text-muted-foreground">{row.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(row.value / row.max) * 100}%`, background: row.color }} />
          </div>
          <span className="w-16 shrink-0 text-right">{row.right ?? row.value}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS_COLORS = { Unread: "var(--muted-foreground)", Reading: "var(--primary)", Completed: "#4ade80" } as const;

export function StatsView() {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [activity, setActivity] = useState<ReadingActivityStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DailyRange>(30);

  useEffect(() => {
    Promise.all([LibraryApi.list(), StatsApi.readingActivity(365)])
      .then(([library, stats]) => {
        setBooks(library.books);
        setActivity(stats);
      })
      .catch((cause: unknown) => setError(errorMessage(cause, "Failed to load stats")));
  }, []);

  const view = useMemo(() => buildStatsViewModel(books, activity, range), [books, activity, range]);

  if (error) {
    return (
      <p role="alert" className="py-8 text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!activity) {
    return (
      <div className="flex flex-col gap-3 py-5" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { totals, streak } = activity;

  return (
    <div className="flex flex-col gap-4 py-5">
      <header>
        <h1 className="text-xl font-semibold">Stats</h1>
        <p className="text-sm text-muted-foreground">Your reading activity over the last year.</p>
      </header>

      <section aria-label="Summary stats" className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="Total Pages Read" value={formatNumber(totals.totalPages)} sub={`${totals.avgPagesPerDay} avg/day`} />
        <Tile label="Current Streak" value={`${streak.current} days`} sub={`Longest: ${streak.longest} days`} tone="text-destructive" />
        <Tile label="Days Active" value={totals.daysActive} sub={`${view.readingPercentage}% of days`} tone="text-emerald-500" />
        <Tile label="Books Completed" value={view.completedBooksCount} sub={`${books.length} books in library`} tone="text-blue-400" />
      </section>

      <section aria-label="Highlights" className="grid gap-2 md:grid-cols-3">
        <Tile label="Best Reading Day" value={`${totals.bestDay.pagesRead} pages`} sub={formatDate(totals.bestDay.date)} />
        <Tile label="Avg on Active Days" value={`${totals.avgPagesOnActiveDay} pages`} sub={`${formatNumber(totals.totalSessions)} progress snapshots`} />
        <Tile label="Reading Mix" value={`${view.readingBooksCount} reading / ${view.unreadBooksCount} unread`} sub={`${view.completedBooksCount} completed`} />
      </section>

      <Card title="Reading Activity" action={<span className="text-xs text-muted-foreground">{formatNumber(totals.totalPages)} pages in the last year</span>}>
        {view.heatmap.weeks.length > 0 ? (
          <div
            className="overflow-x-auto pb-1"
            ref={(element) => {
              // La actividad reciente está a la derecha: abre desplazado al final.
              if (element) element.scrollLeft = element.scrollWidth;
            }}
          >
            <div className="relative h-4 text-[0.6rem] text-muted-foreground" style={{ width: view.heatmap.weeks.length * 16, marginLeft: 32 }}>
              {view.heatmap.monthLabels.map((label) => (
                <span key={`${label.label}-${label.col}`} className="absolute" style={{ left: label.col * 16 }}>
                  {label.label}
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <div className="flex w-7 flex-col justify-between py-px text-[0.6rem] text-muted-foreground">
                {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((day, index) => (
                  <span key={index} className="h-3.5 leading-[0.875rem]">
                    {day}
                  </span>
                ))}
              </div>
              <div className="flex gap-[2px]">
                {view.heatmap.weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-[2px]">
                    {week.map((cell, dayIndex) =>
                      cell ? (
                        <div
                          key={dayIndex}
                          title={`${formatDate(cell.date)}: ${plural(cell.pagesRead, "page")}`}
                          aria-label={`${formatDate(cell.date)}: ${plural(cell.pagesRead, "page")}`}
                          className="size-3.5 rounded-[3px]"
                          style={{ background: heatColor(cell.pagesRead, view.heatmap.maxPages) }}
                        />
                      ) : (
                        <div key={dayIndex} className="size-3.5" />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No reading activity recorded yet.</p>
        )}
      </Card>

      <Card
        title="Pages Per Day"
        action={
          <div className="flex gap-1">
            {DAILY_RANGES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={range === option}
                onClick={() => setRange(option)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium",
                  range === option ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {option}d
              </button>
            ))}
          </div>
        }
      >
        <BarChart
          max={view.maxDailyPages}
          items={view.recentDaily.map((item) => ({ key: item.date, label: range === 30 ? item.label.split(" ")[1] : item.label, value: item.pagesRead, tip: `${formatDate(item.date)}: ${plural(item.pagesRead, "page")}` }))}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Weekly Trend">
          <BarChart max={view.maxWeeklyPages} items={view.recentWeekly.map((item) => ({ key: item.weekStart, label: item.week, value: item.pages, tip: `${item.week}: ${plural(item.pages, "page")}` }))} />
        </Card>
        <Card title="Reading by Time of Day">
          <BarChart max={view.maxHourlyPages} items={activity.hourly.map((item) => ({ key: String(item.hour), label: String(item.hour), value: item.pages, tip: `${item.label}: ${plural(item.pages, "page")}` }))} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Monthly Overview">
          <Bars
            rows={view.recentMonthly.map((month) => ({
              key: month.monthKey,
              label: month.month,
              value: month.pages,
              max: view.maxMonthlyPages,
              right: `${formatNumber(month.pages)} · ${month.booksFinished}`,
              tip: `${month.month}: ${plural(month.pages, "page")}, ${plural(month.booksFinished, "book")} finished`,
            }))}
          />
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Month</th>
                <th className="font-medium">Pages</th>
                <th className="font-medium">Avg/Day</th>
                <th className="font-medium">Books Done</th>
              </tr>
            </thead>
            <tbody>
              {[...view.recentMonthly].slice(-6).reverse().map((month) => (
                <tr key={month.monthKey} className="border-t border-border/60">
                  <td className="py-1">{month.month}</td>
                  <td>{formatNumber(month.pages)}</td>
                  <td>{month.avgPagesPerDay}</td>
                  <td>{month.booksFinished > 0 ? month.booksFinished : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Books by Format">
            <div className="flex items-center gap-4">
              <div className="relative size-24 shrink-0 rounded-full" style={{ background: view.formatPieGradient }}>
                <div className="absolute inset-4 rounded-full bg-card" />
              </div>
              <ul className="grid flex-1 grid-cols-2 gap-1 text-xs">
                {view.booksByFormat.map((format, index) => (
                  <li key={format.name} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ background: FORMAT_COLORS[index % FORMAT_COLORS.length] }} />
                    {format.name} ({format.value})
                  </li>
                ))}
              </ul>
            </div>
          </Card>
          <Card title="Rating Distribution">
            <Bars rows={view.ratingDistribution.map((rating) => ({ key: rating.label, label: rating.label, value: rating.value, max: view.maxRatingCount, tip: `${rating.label}: ${plural(rating.value, "book")}` }))} />
          </Card>
          <Card title="Books by Status">
            <Bars
              rows={view.booksByStatus.map((status) => ({
                key: status.name,
                label: status.name,
                value: status.value,
                max: view.maxStatusCount,
                color: STATUS_COLORS[status.name],
                right: `${status.value} (${books.length > 0 ? Math.round((status.value / books.length) * 100) : 0}%)`,
              }))}
            />
          </Card>
        </div>
      </div>

      <Card title="Reading Streaks">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Current Streak</p>
            <p className="text-2xl font-semibold">
              {streak.current} <span className="text-sm font-normal text-muted-foreground">days</span>
            </p>
            <div className="mt-2 flex items-center gap-1">
              {view.streakPreviewCells.map((cell) => (
                <div key={cell} className="size-3 rounded-sm bg-primary" style={{ opacity: 0.3 + (cell / Math.max(view.streakPreviewCells.length, 1)) * 0.7 }} />
              ))}
              {streak.current > 14 && <em className="text-xs not-italic text-muted-foreground">+{streak.current - 14}</em>}
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Longest Streak</p>
            <p className="text-2xl font-semibold">
              {streak.longest} <span className="text-sm font-normal text-muted-foreground">days</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {streak.longestStart && streak.longestEnd ? `${formatDate(streak.longestStart)} — ${formatDate(streak.longestEnd)}` : "—"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
