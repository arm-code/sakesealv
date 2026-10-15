"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LibraryApi } from "@/lib/client/library-api";
import { errorMessage } from "@/lib/client/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { LibraryToolbar } from "./library-toolbar";
import { LibraryBookItem } from "./library-book-tile";
import {
  DEFAULT_LIBRARY_SORT,
  type LibraryBook,
  type LibrarySortDirection,
  type LibrarySortField,
  type LibraryStatusFilter,
  type LibraryVisualMode,
} from "@/lib/library/types";
import {
  groupBooksBySeries,
  matchesBookQuery,
  matchesBookStatus,
  parseMode,
  parseShelfId,
  parseSort,
  parseStatus,
  readStoredSort,
  sortBooks,
  storeSort,
} from "@/lib/library/view";

const MODE_STORAGE_KEY = "libraryVisualMode";
const SEARCH_DEBOUNCE_MS = 250;

function readStoredMode(): LibraryVisualMode {
  try {
    return parseMode(localStorage.getItem(MODE_STORAGE_KEY)) ?? "grid";
  } catch {
    return "grid";
  }
}

function BookCollection({ books, mode }: { books: LibraryBook[]; mode: LibraryVisualMode }) {
  return (
    <ul
      className={
        mode === "grid"
          ? "grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
          : "flex flex-col gap-2"
      }
    >
      {books.map((book) => (
        <LibraryBookItem key={book.id} book={book} mode={mode} />
      ))}
    </ul>
  );
}

// Estado de la vista en la URL: ?shelf=&q=&status=&sort=&dir=&mode=
// (sort/mode caen a localStorage como preferencia por estante, como en el original).
export function LibraryView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const shelfId = parseShelfId(searchParams.get("shelf"));
  const urlQuery = searchParams.get("q") ?? "";
  const status = parseStatus(searchParams.get("status"));
  const urlSort = parseSort(searchParams.get("sort"), searchParams.get("dir"));
  const urlMode = parseMode(searchParams.get("mode"));

  const [books, setBooks] = useState<LibraryBook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(urlQuery);
  const [storedMode, setStoredMode] = useState<LibraryVisualMode>("grid");
  const [storedSort, setStoredSort] = useState(DEFAULT_LIBRARY_SORT);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sort = urlSort ?? storedSort;
  const mode = urlMode ?? storedMode;

  // Preferencias guardadas (solo cliente) — por estante para el orden.
  useEffect(() => {
    setStoredSort(readStoredSort(shelfId));
  }, [shelfId]);
  useEffect(() => {
    setStoredMode(readStoredMode());
  }, []);

  useEffect(() => {
    let cancelled = false;
    LibraryApi.list()
      .then((result) => {
        if (!cancelled) setBooks(result.books);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause, "Failed to load your library"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // El input local sigue a la URL cuando cambia desde fuera (atrás/adelante, otro estante).
  useEffect(() => {
    setSearchInput(urlQuery);
  }, [urlQuery]);

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParams({ q: value.trim() || null }), SEARCH_DEBOUNCE_MS);
  }

  function handleSortChange(next: { field: LibrarySortField; direction: LibrarySortDirection }) {
    storeSort(shelfId, next);
    setStoredSort(next);
    updateParams({ sort: next.field, dir: next.direction });
  }

  function handleModeChange(next: LibraryVisualMode) {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Solo conveniencia.
    }
    setStoredMode(next);
    updateParams({ mode: next });
  }

  const visibleBooks = useMemo(() => {
    if (!books) return [];
    const active = books.filter((book) => !book.archived_at);
    const scoped = shelfId === null ? active : active.filter((book) => book.shelfIds.includes(shelfId));
    const filtered = scoped.filter((book) => matchesBookQuery(book, urlQuery) && matchesBookStatus(book, status as LibraryStatusFilter));
    return sortBooks(filtered, sort);
  }, [books, shelfId, urlQuery, status, sort]);

  const groups = useMemo(() => (sort.field === "series" ? groupBooksBySeries(visibleBooks) : []), [sort.field, visibleBooks]);

  const hasActiveFilter = urlQuery !== "" || status !== "all";

  return (
    <div className="flex flex-col gap-5 py-5">
      <LibraryToolbar
        search={searchInput}
        status={status}
        sort={sort}
        mode={mode}
        onSearchChange={handleSearchChange}
        onStatusChange={(value) => updateParams({ status: value === "all" ? null : value })}
        onSortFieldChange={(field) => handleSortChange({ field, direction: sort.direction })}
        onSortDirectionChange={(direction) => handleSortChange({ field: sort.field, direction })}
        onModeChange={handleModeChange}
      />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : books === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" aria-busy="true">
          {Array.from({ length: 12 }, (_, index) => (
            <Skeleton key={index} className="aspect-[2/3] w-full" />
          ))}
        </div>
      ) : visibleBooks.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {hasActiveFilter
            ? "No books match your search or filters."
            : shelfId !== null
              ? "This shelf is empty."
              : "Your library is empty."}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {visibleBooks.length} {visibleBooks.length === 1 ? "book" : "books"}
          </p>
          {groups.length > 0 ? (
            <div className="flex flex-col gap-6">
              {groups.map((group) => (
                <section key={group.id} className="flex flex-col gap-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {group.label} <span className="font-normal text-muted-foreground">({group.books.length})</span>
                  </h2>
                  <BookCollection books={group.books} mode={mode} />
                </section>
              ))}
            </div>
          ) : (
            <BookCollection books={visibleBooks} mode={mode} />
          )}
        </>
      )}
    </div>
  );
}
