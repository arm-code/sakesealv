"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { LibraryApi } from "@/lib/client/library-api";
import { ShelvesApi } from "@/lib/client/shelves-api";
import { errorMessage } from "@/lib/client/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { LibraryShelf } from "@/lib/types/library";
import { LibraryToolbar } from "./library-toolbar";
import { LibraryBookItem } from "./library-book-tile";
import { LibraryBulkBar } from "./library-bulk-bar";
import { LibraryDetailModal } from "./library-detail-modal";
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

interface BookCollectionProps {
  books: LibraryBook[];
  mode: LibraryVisualMode;
  selectionMode: boolean;
  selectedIds: Set<number>;
  onActivate: (book: LibraryBook) => void;
}

function BookCollection({ books, mode, selectionMode, selectedIds, onActivate }: BookCollectionProps) {
  return (
    <ul
      className={
        mode === "grid"
          ? "grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
          : "flex flex-col gap-2"
      }
    >
      {books.map((book) => (
        <LibraryBookItem
          key={book.id}
          book={book}
          mode={mode}
          selectionMode={selectionMode}
          selected={selectedIds.has(book.id)}
          onActivate={onActivate}
        />
      ))}
    </ul>
  );
}

type BulkAction = "trash" | null;

// Estado de la vista en la URL: ?shelf=&q=&status=&sort=&dir=&mode=&book=
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
  const openBookId = parseShelfId(searchParams.get("book"));

  const [books, setBooks] = useState<LibraryBook[] | null>(null);
  const [shelves, setShelves] = useState<LibraryShelf[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(urlQuery);
  const [storedMode, setStoredMode] = useState<LibraryVisualMode>("grid");
  const [storedSort, setStoredSort] = useState(DEFAULT_LIBRARY_SORT);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkWorking, setIsBulkWorking] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragDepth = useRef(0);

  const sort = urlSort ?? storedSort;
  const mode = urlMode ?? storedMode;

  // Preferencias guardadas (solo cliente) — por estante para el orden.
  useEffect(() => {
    setStoredSort(readStoredSort(shelfId));
  }, [shelfId]);
  useEffect(() => {
    setStoredMode(readStoredMode());
  }, []);

  const loadLibrary = useCallback(async () => {
    try {
      const result = await LibraryApi.list();
      setBooks(result.books);
      setError(null);
    } catch (cause: unknown) {
      setError(errorMessage(cause, "Failed to load your library"));
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
    ShelvesApi.list()
      .then((result) => setShelves(result.shelves))
      .catch(() => setShelves([]));
  }, [loadLibrary]);

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
  const openBook = useMemo(() => (openBookId === null ? null : (books?.find((book) => book.id === openBookId) ?? null)), [books, openBookId]);

  // --- Selección y bulk ---

  function exitSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelected(bookId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  }

  function handleActivate(book: LibraryBook) {
    if (selectionMode) toggleSelected(book.id);
    else updateParams({ book: String(book.id) });
  }

  const patchBook = useCallback((bookId: number, patch: Partial<LibraryBook>) => {
    setBooks((current) => (current ? current.map((book) => (book.id === bookId ? { ...book, ...patch } : book)) : current));
  }, []);

  const removeBook = useCallback(
    (bookId: number) => {
      setBooks((current) => (current ? current.filter((book) => book.id !== bookId) : current));
      setSelectedIds((current) => {
        if (!current.has(bookId)) return current;
        const next = new Set(current);
        next.delete(bookId);
        return next;
      });
      if (openBookId === bookId) updateParams({ book: null });
    },
    [openBookId, updateParams],
  );

  // Las acciones bulk son llamadas por libro, en serie; informamos los fallos.
  async function runBulk(label: string, action: (book: LibraryBook) => Promise<void>) {
    if (isBulkWorking || !books) return;
    const targets = books.filter((book) => selectedIds.has(book.id));
    if (targets.length === 0) return;
    setIsBulkWorking(true);
    let failed = 0;
    for (const book of targets) {
      try {
        await action(book);
      } catch {
        failed += 1;
      }
    }
    await loadLibrary();
    setIsBulkWorking(false);
    if (failed > 0) toast.error(`${label}: ${failed} of ${targets.length} failed`);
    else toast.success(`${label}: ${targets.length} book${targets.length === 1 ? "" : "s"}`);
  }

  function bulkShelf(shelfIdToChange: number, add: boolean) {
    const shelf = shelves.find((candidate) => candidate.id === shelfIdToChange);
    void runBulk(`${add ? "Added to" : "Removed from"} ${shelf?.name ?? "shelf"}`, async (book) => {
      const has = book.shelfIds.includes(shelfIdToChange);
      if (add === has) return;
      const next = add ? [...book.shelfIds, shelfIdToChange] : book.shelfIds.filter((id) => id !== shelfIdToChange);
      await LibraryApi.setShelves(book.id, next);
    });
  }

  async function confirmBulkTrash() {
    await runBulk("Moved to trash", (book) => LibraryApi.moveToTrash(book.id).then(() => undefined));
    setBulkAction(null);
    setSelectedIds(new Set());
  }

  // --- Subida ---

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (isUploading || files.length === 0) return;
      setIsUploading(true);
      let uploaded = 0;
      for (const file of files) {
        try {
          await LibraryApi.upload(file);
          uploaded += 1;
        } catch (cause: unknown) {
          toast.error(`${file.name}: ${errorMessage(cause, "upload failed")}`);
        }
      }
      if (uploaded > 0) {
        toast.success(`Uploaded ${uploaded} book${uploaded === 1 ? "" : "s"}`);
        await loadLibrary();
      }
      setIsUploading(false);
    },
    [isUploading, loadLibrary],
  );

  function hasFiles(event: React.DragEvent): boolean {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  return (
    <div
      className="relative flex min-h-[60vh] flex-col gap-5 py-5"
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        dragDepth.current += 1;
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!hasFiles(event)) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragging(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        dragDepth.current = 0;
        setIsDragging(false);
        void uploadFiles(Array.from(event.dataTransfer.files));
      }}
    >
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
        selectionMode={selectionMode}
        isUploading={isUploading}
        onToggleSelection={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
        onFilesChosen={(files) => void uploadFiles(files)}
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
              : "Your library is empty. Upload a book or drop files here."}
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
                  <BookCollection books={group.books} mode={mode} selectionMode={selectionMode} selectedIds={selectedIds} onActivate={handleActivate} />
                </section>
              ))}
            </div>
          ) : (
            <BookCollection books={visibleBooks} mode={mode} selectionMode={selectionMode} selectedIds={selectedIds} onActivate={handleActivate} />
          )}
        </>
      )}

      {selectionMode && (
        <LibraryBulkBar
          count={selectedIds.size}
          visibleCount={visibleBooks.length}
          shelves={shelves}
          isWorking={isBulkWorking}
          onSelectAll={() => setSelectedIds(new Set(visibleBooks.map((book) => book.id)))}
          onClear={() => setSelectedIds(new Set())}
          onExit={exitSelection}
          onAddToShelf={(id) => bulkShelf(id, true)}
          onRemoveFromShelf={(id) => bulkShelf(id, false)}
          onMarkRead={(isRead) => void runBulk(isRead ? "Marked as read" : "Marked as unread", (book) => LibraryApi.setState(book.id, { isRead }).then(() => undefined))}
          onArchive={() => void runBulk("Archived", (book) => LibraryApi.setState(book.id, { archived: true }).then(() => undefined))}
          onTrash={() => setBulkAction("trash")}
        />
      )}

      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary bg-background/80 text-foreground">
          <Upload className="size-8" aria-hidden="true" />
          <p className="text-sm font-medium">Drop files to add them to your library</p>
        </div>
      )}

      <LibraryDetailModal
        book={openBook}
        shelves={shelves}
        onClose={() => updateParams({ book: null })}
        onBookPatched={patchBook}
        onBookRemoved={removeBook}
      />

      <ConfirmDialog
        open={bulkAction === "trash"}
        title={`Move ${selectedIds.size} book${selectedIds.size === 1 ? "" : "s"} to trash?`}
        message="They can be restored from Trash until they expire."
        confirmLabel="Move to trash"
        danger
        pending={isBulkWorking}
        onCancel={() => setBulkAction(null)}
        onConfirm={confirmBulkTrash}
      />
    </div>
  );
}
