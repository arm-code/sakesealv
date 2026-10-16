"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, BookOpen } from "lucide-react";
import { LibraryApi } from "@/lib/client/library-api";
import { ShelvesApi } from "@/lib/client/shelves-api";
import { errorMessage } from "@/lib/client/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { clampProgress, getBookStatus, parseShelfId } from "@/lib/library/view";
import type { LibraryBook } from "@/lib/library/types";
import type { LibraryShelf } from "@/lib/types/library";
import { LibraryDetailModal } from "./library-detail-modal";

const STATUS_LABEL = { read: "Read", reading: "Reading", unread: "Unread" } as const;

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Archivados: libros ocultos de la vista principal; se desarchivan desde la tarjeta o el modal (?book=ID).
export function ArchivedView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openBookId = parseShelfId(searchParams.get("book"));

  const [books, setBooks] = useState<LibraryBook[] | null>(null);
  const [shelves, setShelves] = useState<LibraryShelf[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [unarchivingId, setUnarchivingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await LibraryApi.list();
      setBooks(result.books);
      setError(null);
    } catch (cause: unknown) {
      setError(errorMessage(cause, "Failed to load archived books"));
    }
  }, []);

  useEffect(() => {
    void load();
    ShelvesApi.list()
      .then((result) => setShelves(result.shelves))
      .catch(() => setShelves([]));
  }, [load]);

  const archived = useMemo(
    () =>
      (books ?? [])
        .filter((book) => Boolean(book.archived_at))
        .sort((a, b) => String(b.archived_at ?? "").localeCompare(String(a.archived_at ?? ""))),
    [books],
  );
  const openBook = useMemo(() => (openBookId === null ? null : (archived.find((book) => book.id === openBookId) ?? null)), [archived, openBookId]);

  const setOpenBook = useCallback(
    (id: number | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (id === null) next.delete("book");
      else next.set("book", String(id));
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  async function unarchive(book: LibraryBook) {
    if (unarchivingId !== null) return;
    setUnarchivingId(book.id);
    try {
      await LibraryApi.setState(book.id, { archived: false });
      setBooks((current) => current?.map((candidate) => (candidate.id === book.id ? { ...candidate, archived_at: null } : candidate)) ?? current);
      toast.success(`"${book.title}" unarchived`);
    } catch (cause: unknown) {
      toast.error(`Failed to unarchive "${book.title}": ${errorMessage(cause, "unknown error")}`);
    }
    setUnarchivingId(null);
  }

  const patchBook = useCallback((bookId: number, patch: Partial<LibraryBook>) => {
    setBooks((current) => current?.map((book) => (book.id === bookId ? { ...book, ...patch } : book)) ?? current);
  }, []);

  const removeBook = useCallback(
    (bookId: number) => {
      setBooks((current) => current?.filter((book) => book.id !== bookId) ?? current);
      setOpenBook(null);
    },
    [setOpenBook],
  );

  return (
    <div className="flex flex-col gap-5 py-5">
      <header>
        <h1 className="text-xl font-semibold">Archived</h1>
        <p className="text-sm text-muted-foreground">
          {archived.length} archived book{archived.length === 1 ? "" : "s"}. These books are hidden from your main library view.
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : books === null ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : archived.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <Archive className="size-7" aria-hidden="true" />
          <h2 className="text-base font-medium text-foreground">No archived books</h2>
          <p className="text-sm">Books you archive will appear here. Archive books to hide them from your main library without deleting them.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {archived.map((book) => {
            const status = getBookStatus(book);
            const progress = Math.round(clampProgress(book.progressPercent));
            return (
              <li key={book.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <button
                  type="button"
                  onClick={() => setOpenBook(book.id)}
                  aria-label={`Show details for ${book.title}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {book.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- portadas gestionadas servidas por /api con cookie de sesión
                      <img src={book.cover} alt={book.title} loading="lazy" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <BookOpen className="size-5" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={book.title}>
                      {book.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{book.author ?? "Unknown author"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {book.extension ? `${book.extension.toUpperCase()} · ` : ""}
                      <span className={cn(status === "read" && "text-primary")}>{STATUS_LABEL[status]}</span> · {formatFileSize(book.filesize)}
                      {progress > 0 ? ` · ${progress}%` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">Added {formatDate(book.createdAt)}</p>
                  </div>
                </button>
                <Button size="sm" variant="outline" onClick={() => void unarchive(book)} disabled={unarchivingId !== null}>
                  <ArchiveRestore className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{unarchivingId === book.id ? "Saving..." : "Unarchive"}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <LibraryDetailModal
        book={openBook}
        shelves={shelves}
        onClose={() => setOpenBook(null)}
        onBookPatched={patchBook}
        onBookRemoved={removeBook}
      />
    </div>
  );
}
