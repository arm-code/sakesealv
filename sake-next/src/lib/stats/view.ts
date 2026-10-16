import type { LibraryBook } from "@/lib/library/types";
import type { ReadingActivityDay, ReadingActivityHour, ReadingActivityMonth, ReadingActivityStats, ReadingActivityWeek } from "@/lib/types/stats";

// Modelo de vista de estadísticas (portado de statsView.ts del original).

export type DailyRange = 7 | 14 | 30;
export type StatsBookStatus = "Unread" | "Reading" | "Completed";

export interface DistributionEntry {
  name: string;
  value: number;
}

export interface DailyChartEntry extends ReadingActivityDay {
  label: string;
}

export interface HeatmapCell {
  date: string;
  pagesRead: number;
}

export interface HeatmapData {
  weeks: Array<Array<HeatmapCell | null>>;
  monthLabels: Array<{ label: string; col: number }>;
  maxPages: number;
}

export const DAILY_RANGES: DailyRange[] = [7, 14, 30];
export const FORMAT_COLORS = ["#60a5fa", "#c084fc", "#c9a962", "#4ade80", "#f87171"];

export function getStatsBookStatus(book: LibraryBook): StatsBookStatus {
  if (book.read_at) return "Completed";
  if ((book.progressPercent ?? 0) > 0) return "Reading";
  return "Unread";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function toDailyLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function buildHeatmap(input: ReadingActivityDay[]): HeatmapData {
  if (input.length === 0) return { weeks: [], monthLabels: [], maxPages: 0 };

  const dateMap = new Map(input.map((entry) => [entry.date, entry.pagesRead]));
  const start = new Date(`${input[0].date}T00:00:00.000Z`);
  const end = new Date(`${input[input.length - 1].date}T00:00:00.000Z`);
  while (start.getUTCDay() !== 1) start.setUTCDate(start.getUTCDate() - 1);

  const weeks: Array<Array<HeatmapCell | null>> = [];
  const monthLabels: Array<{ label: string; col: number }> = [];
  let maxPages = 0;
  let week: Array<HeatmapCell | null> = Array(7).fill(null);
  let weekIndex = 0;
  let lastMonth = "";
  const cursor = new Date(start);

  while (cursor <= end) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const dayOfWeek = cursor.getUTCDay() === 0 ? 6 : cursor.getUTCDay() - 1;
    const pagesRead = dateMap.get(dateKey) ?? 0;
    maxPages = Math.max(maxPages, pagesRead);
    if (dateMap.has(dateKey)) week[dayOfWeek] = { date: dateKey, pagesRead };

    const monthKey = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`;
    if (monthKey !== lastMonth) {
      const next = { label: cursor.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), col: weekIndex };
      const previous = monthLabels[monthLabels.length - 1];
      if (previous && previous.col === next.col) monthLabels[monthLabels.length - 1] = next;
      else monthLabels.push(next);
      lastMonth = monthKey;
    }

    if (dayOfWeek === 6) {
      weeks.push(week);
      week = Array(7).fill(null);
      weekIndex += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (week.some((cell) => cell !== null)) weeks.push(week);
  return { weeks, monthLabels, maxPages };
}

export function buildConicGradient(entries: Array<{ value: number }>, colors: string[]): string {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (total <= 0) return "var(--muted)";
  let offset = 0;
  const segments = entries.map((entry, index) => {
    const startDeg = (offset / total) * 360;
    offset += entry.value;
    return `${colors[index % colors.length]} ${startDeg}deg ${(offset / total) * 360}deg`;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

export function buildStatsViewModel(books: LibraryBook[], activity: ReadingActivityStats | null, dailyRange: DailyRange) {
  const completedBooksCount = books.filter((book) => Boolean(book.read_at)).length;
  const statusCounts: Record<StatsBookStatus, number> = { Unread: 0, Reading: 0, Completed: 0 };
  const formatCounts = new Map<string, number>();
  const ratingCounts = [0, 0, 0, 0, 0, 0];
  for (const book of books) {
    statusCounts[getStatsBookStatus(book)] += 1;
    const format = (book.extension ?? "unknown").toUpperCase();
    formatCounts.set(format, (formatCounts.get(format) ?? 0) + 1);
    const rating = book.rating ?? 0;
    if (rating >= 1 && rating <= 5) ratingCounts[rating] += 1;
  }

  const booksByStatus = (["Unread", "Reading", "Completed"] as const).map((name) => ({ name, value: statusCounts[name] }));
  const booksByFormat: DistributionEntry[] = [...formatCounts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({ label: `${rating}★`, value: ratingCounts[rating] }));
  const recentDaily: DailyChartEntry[] = (activity?.daily.slice(-dailyRange) ?? []).map((entry) => ({ ...entry, label: toDailyLabel(entry.date) }));
  const recentWeekly: ReadingActivityWeek[] = activity?.weekly.slice(-12) ?? [];
  const recentMonthly: ReadingActivityMonth[] = activity?.monthly ?? [];
  const maxOf = (values: number[]) => Math.max(...values, 1);

  return {
    completedBooksCount,
    readingBooksCount: statusCounts.Reading,
    unreadBooksCount: statusCounts.Unread,
    booksByFormat,
    booksByStatus,
    ratingDistribution,
    recentDaily,
    recentWeekly,
    recentMonthly,
    heatmap: buildHeatmap(activity?.daily ?? []),
    maxDailyPages: maxOf(recentDaily.map((entry) => entry.pagesRead)),
    maxWeeklyPages: maxOf(recentWeekly.map((entry) => entry.pages)),
    maxHourlyPages: maxOf((activity?.hourly ?? []).map((entry: ReadingActivityHour) => entry.pages)),
    maxMonthlyPages: maxOf(recentMonthly.map((entry) => entry.pages)),
    maxRatingCount: maxOf(ratingDistribution.map((entry) => entry.value)),
    maxStatusCount: maxOf(booksByStatus.map((entry) => entry.value)),
    readingPercentage: activity && activity.totals.totalDays > 0 ? Math.round((activity.totals.daysActive / activity.totals.totalDays) * 100) : 0,
    formatPieGradient: buildConicGradient(booksByFormat, FORMAT_COLORS),
    streakPreviewCells: Array.from({ length: Math.min(activity?.streak.current ?? 0, 14) }, (_, index) => index),
  };
}
