"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, BookOpen, RotateCcw, Trash2 } from "lucide-react";
import { LibraryApi } from "@/lib/client/library-api";
import { errorMessage } from "@/lib/client/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import type { Book } from "@/lib/server/domain/book";

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

function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

type Pending = { kind: "restore" | "delete"; id: number } | { kind: "empty" } | null;
type Confirm = { kind: "delete"; book: Book } | { kind: "empty" } | null;

// Papelera: restaurar, borrar permanente (con confirmación) y vaciar todo.
export function TrashView() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const load = useCallback(async () => {
    try {
      const result = await LibraryApi.listTrash();
      setBooks([...result.books].sort((a, b) => String(b.deleted_at ?? "").localeCompare(String(a.deleted_at ?? ""))));
      setError(null);
    } catch (cause: unknown) {
      setError(errorMessage(cause, "Failed to load trash"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const busy = pending !== null;

  async function restore(book: Book) {
    if (busy) return;
    setPending({ kind: "restore", id: book.id });
    try {
      await LibraryApi.restore(book.id);
      setBooks((current) => current?.filter((candidate) => candidate.id !== book.id) ?? current);
      toast.success(`"${book.title}" restored to library`);
    } catch (cause: unknown) {
      toast.error(`Failed to restore "${book.title}": ${errorMessage(cause, "unknown error")}`);
    }
    setPending(null);
  }

  async function deletePermanently(book: Book) {
    if (busy) return;
    setPending({ kind: "delete", id: book.id });
    try {
      await LibraryApi.deleteTrashed(book.id);
      setBooks((current) => current?.filter((candidate) => candidate.id !== book.id) ?? current);
      toast.success(`"${book.title}" deleted permanently`);
    } catch (cause: unknown) {
      toast.error(`Failed to delete "${book.title}": ${errorMessage(cause, "unknown error")}`);
    }
    setPending(null);
    setConfirm(null);
  }

  async function emptyTrash() {
    if (busy || !books || books.length === 0) return;
    setPending({ kind: "empty" });
    for (const book of [...books]) {
      try {
        await LibraryApi.deleteTrashed(book.id);
      } catch (cause: unknown) {
        toast.error(`Failed to delete "${book.title}": ${errorMessage(cause, "unknown error")}`);
        setPending(null);
        setConfirm(null);
        await load();
        return;
      }
    }
    setBooks([]);
    setPending(null);
    setConfirm(null);
    toast.success("Trash emptied");
  }

  const count = books?.length ?? 0;

  return (
    <div className="flex flex-col gap-5 py-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Trash</h1>
          <p className="text-sm text-muted-foreground">
            {count} item{count === 1 ? "" : "s"} in trash. Items are permanently deleted after 30 days.
          </p>
        </div>
        {count > 0 && (
          <Button variant="outline" onClick={() => setConfirm({ kind: "empty" })} disabled={busy}>
            <Trash2 className="size-4" aria-hidden="true" />
            {pending?.kind === "empty" ? "Emptying..." : "Empty Trash"}
          </Button>
        )}
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
      ) : books.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <Trash2 className="size-7" aria-hidden="true" />
          <h2 className="text-base font-medium text-foreground">Trash is empty</h2>
          <p className="text-sm">Items you delete will appear here before being permanently removed.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {books.map((book) => {
            const daysLeft = daysUntil(book.trash_expires_at);
            return (
              <li key={book.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
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
                    {formatFileSize(book.filesize)} · Trashed {formatDate(book.deleted_at)}
                  </p>
                  {daysLeft !== null && (
                    <p className={cn("mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground", daysLeft <= 7 && "text-destructive")}>
                      <AlertCircle className="size-3" aria-hidden="true" />
                      {daysLeft > 0 ? `Deletes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : "Scheduled for deletion"} (
                      {formatDate(book.trash_expires_at)})
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => void restore(book)} disabled={busy}>
                    <RotateCcw className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{pending?.kind === "restore" && pending.id === book.id ? "Restoring..." : "Restore"}</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setConfirm({ kind: "delete", book })}
                    disabled={busy}
                    title="Delete permanently"
                    aria-label={`Delete "${book.title}" permanently`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirm?.kind === "delete"}
        title="Delete permanently?"
        message={confirm?.kind === "delete" ? `"${confirm.book.title}" will be removed for good. This action cannot be undone.` : ""}
        confirmLabel="Delete"
        danger
        pending={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => (confirm?.kind === "delete" ? deletePermanently(confirm.book) : undefined)}
      />
      <ConfirmDialog
        open={confirm?.kind === "empty"}
        title={`Permanently delete all ${count} items?`}
        message="This action cannot be undone."
        confirmLabel="Delete All"
        danger
        pending={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={emptyTrash}
      />
    </div>
  );
}
