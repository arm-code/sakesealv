import {
  DEFAULT_LIBRARY_SORT,
  LIBRARY_SORT_FIELD_OPTIONS,
  LIBRARY_STATUS_OPTIONS,
  type LibraryBook,
  type LibraryBookGroup,
  type LibrarySortDirection,
  type LibrarySortField,
  type LibrarySortPreference,
  type LibraryStatusFilter,
  type LibraryVisualMode,
} from "./types";

// --- Estado / filtros (portado de view/filtering.ts del original) ---

export function clampProgress(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function normalizeText(value: string | null | undefined): string {
  return value?.toLowerCase().trim() ?? "";
}

export function getBookStatus(book: LibraryBook): Exclude<LibraryStatusFilter, "all"> {
  const progress = clampProgress(book.progressPercent);
  if (book.read_at || progress >= 99.95) return "read";
  if (progress > 0) return "reading";
  return "unread";
}

export function matchesBookQuery(book: LibraryBook, query: string): boolean {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;
  return [book.title, book.author, book.series, book.volume, book.extension, book.language, book.series_index]
    .map((value) => normalizeText(value === null || value === undefined ? null : String(value)))
    .some((value) => value.includes(normalizedQuery));
}

export function matchesBookStatus(book: LibraryBook, filter: LibraryStatusFilter): boolean {
  return filter === "all" ? true : getBookStatus(book) === filter;
}

// --- Orden (portado de view/sorting.ts) ---

function label(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function compareLabel(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function compareOptionalText(left: string | null | undefined, right: string | null | undefined, direction: LibrarySortDirection): number {
  const l = label(left);
  const r = label(right);
  if (!l && !r) return 0;
  if (!l) return 1;
  if (!r) return -1;
  const ascending = compareLabel(l, r);
  return direction === "asc" ? ascending : -ascending;
}

function compareOptionalNumber(left: number | null | undefined, right: number | null | undefined, direction: LibrarySortDirection): number {
  const l = typeof left === "number" && Number.isFinite(left) ? left : null;
  const r = typeof right === "number" && Number.isFinite(right) ? right : null;
  if (l === null && r === null) return 0;
  if (l === null) return 1;
  if (r === null) return -1;
  return direction === "asc" ? l - r : r - l;
}

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareTimestamp(left: string | null | undefined, right: string | null | undefined, direction: LibrarySortDirection): number {
  return compareOptionalNumber(timestamp(left), timestamp(right), direction);
}

function compareTieBreakers(left: LibraryBook, right: LibraryBook): number {
  return compareLabel(left.title, right.title) || compareTimestamp(left.createdAt, right.createdAt, "desc") || left.id - right.id;
}

function compareBooksBySeries(left: LibraryBook, right: LibraryBook, direction: LibrarySortDirection): number {
  const seriesCompare = compareOptionalText(left.series, right.series, direction);
  if (seriesCompare !== 0) return seriesCompare;
  if (label(left.series).length === 0) return compareTieBreakers(left, right);
  return (
    compareOptionalNumber(left.series_index, right.series_index, "asc") ||
    compareOptionalText(left.volume, right.volume, "asc") ||
    compareTieBreakers(left, right)
  );
}

function compareBooks(left: LibraryBook, right: LibraryBook, sort: LibrarySortPreference): number {
  let primary = 0;
  switch (sort.field) {
    case "dateAdded":
      primary = compareTimestamp(left.createdAt, right.createdAt, sort.direction);
      break;
    case "title": {
      const ascending = compareLabel(left.title, right.title);
      primary = sort.direction === "asc" ? ascending : -ascending;
      break;
    }
    case "author":
      primary = compareOptionalText(left.author, right.author, sort.direction);
      break;
    case "series":
      primary = compareBooksBySeries(left, right, sort.direction);
      break;
    case "publishedDate":
      primary =
        compareOptionalNumber(left.year, right.year, sort.direction) ||
        compareOptionalNumber(left.month, right.month, sort.direction) ||
        compareOptionalNumber(left.day, right.day, sort.direction);
      break;
    case "progressUpdated":
      primary = compareTimestamp(left.progress_updated_at, right.progress_updated_at, sort.direction);
      break;
  }
  return primary !== 0 ? primary : compareTieBreakers(left, right);
}

export function sortBooks(list: LibraryBook[], sort: LibrarySortPreference): LibraryBook[] {
  return [...list].sort((left, right) => compareBooks(left, right, sort));
}

export function groupBooksBySeries(books: LibraryBook[]): LibraryBookGroup[] {
  const groups: LibraryBookGroup[] = [];
  const byId = new Map<string, LibraryBookGroup>();
  for (const book of books) {
    const seriesLabel = label(book.series);
    const id = seriesLabel ? `series:${seriesLabel.toLowerCase()}` : "series:none";
    const existing = byId.get(id);
    if (existing) {
      existing.books.push(book);
      continue;
    }
    const group: LibraryBookGroup = { id, label: seriesLabel || "No series", books: [book] };
    byId.set(id, group);
    groups.push(group);
  }
  return groups;
}

// --- Estado en URL / storage ---

const SORT_FIELDS = new Set<string>(LIBRARY_SORT_FIELD_OPTIONS.map((option) => option.value));
const STATUSES = new Set<string>(LIBRARY_STATUS_OPTIONS.map((option) => option.value));

export function parseSort(field: string | null, direction: string | null): LibrarySortPreference | null {
  if (!field || !SORT_FIELDS.has(field)) return null;
  return { field: field as LibrarySortField, direction: direction === "asc" ? "asc" : "desc" };
}

export function parseStatus(value: string | null): LibraryStatusFilter {
  return value && STATUSES.has(value) ? (value as LibraryStatusFilter) : "all";
}

export function parseMode(value: string | null): LibraryVisualMode | null {
  return value === "grid" || value === "list" ? value : null;
}

export function parseShelfId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function sortStorageKey(shelfId: number | null): string {
  return shelfId === null ? "librarySort:library" : `librarySort:library:shelf:${shelfId}`;
}

export function readStoredSort(shelfId: number | null): LibrarySortPreference {
  try {
    const raw = localStorage.getItem(sortStorageKey(shelfId));
    const [field, direction] = (raw ?? "").split(":");
    return parseSort(field ?? null, direction ?? null) ?? DEFAULT_LIBRARY_SORT;
  } catch {
    return DEFAULT_LIBRARY_SORT;
  }
}

export function storeSort(shelfId: number | null, sort: LibrarySortPreference): void {
  try {
    localStorage.setItem(sortStorageKey(shelfId), `${sort.field}:${sort.direction}`);
  } catch {
    // Preferencia solo de conveniencia.
  }
}
