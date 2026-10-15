import type { Book } from "@/lib/server/domain/book";

// Forma que devuelve GET /api/library/list (Book + progreso en % y estantes).
export interface LibraryBook extends Book {
  progressPercent: number | null;
  shelfIds: number[];
}

export type LibrarySortField = "dateAdded" | "title" | "author" | "series" | "publishedDate" | "progressUpdated";
export type LibrarySortDirection = "asc" | "desc";
export type LibraryStatusFilter = "all" | "unread" | "reading" | "read";
export type LibraryVisualMode = "grid" | "list";

export interface LibrarySortPreference {
  field: LibrarySortField;
  direction: LibrarySortDirection;
}

export interface LibraryBookGroup {
  id: string;
  label: string;
  books: LibraryBook[];
}

export const DEFAULT_LIBRARY_SORT: LibrarySortPreference = { field: "dateAdded", direction: "desc" };

export const LIBRARY_SORT_FIELD_OPTIONS: ReadonlyArray<{ value: LibrarySortField; label: string }> = [
  { value: "dateAdded", label: "Date added" },
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
  { value: "series", label: "Series" },
  { value: "publishedDate", label: "Date published" },
  { value: "progressUpdated", label: "Progress updated" },
];

export const LIBRARY_STATUS_OPTIONS: ReadonlyArray<{ value: LibraryStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "reading", label: "Reading" },
  { value: "read", label: "Read" },
];
