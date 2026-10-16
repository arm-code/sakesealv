"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshCw, Search } from "lucide-react";
import { AnnotationsApi } from "@/lib/client/annotations-api";
import { errorMessage } from "@/lib/client/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { HIGHLIGHT_COLORS, type ReaderHighlightColor } from "@/lib/koreader/koreader-sidecar";
import {
  EMPTY_ANNOTATION_QUERY,
  type AnnotationFacetsResponse,
  type AnnotationHubItem,
  type AnnotationIndexSummary,
  type AnnotationQuery,
} from "@/lib/types/annotation";

const SELECT_CLASS = "h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground";

function queryFromUrl(): AnnotationQuery {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  const sort = params.get("sort");
  const positive = (name: string): number | null => {
    const parsed = Number(params.get(name));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  };
  return {
    ...EMPTY_ANNOTATION_QUERY,
    q: params.get("q")?.trim() || null,
    type: type === "highlight" || type === "bookmark" || type === "with-note" ? type : "all",
    bookId: positive("bookId"),
    shelfId: positive("shelfId"),
    color: params.get("color") || null,
    from: params.get("from") || null,
    to: params.get("to") || null,
    sort: sort === "oldest" || sort === "book" ? sort : "newest",
  };
}

function urlForQuery(query: AnnotationQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.type !== "all") params.set("type", query.type);
  if (query.bookId) params.set("bookId", String(query.bookId));
  if (query.shelfId) params.set("shelfId", String(query.shelfId));
  if (query.color) params.set("color", query.color);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.sort !== "newest") params.set("sort", query.sort);
  const encoded = params.toString();
  return encoded ? `/annotations?${encoded}` : "/annotations";
}

function formatTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

// Hub de anotaciones: búsqueda/filtros (en URL), edición de nota/color, borrado y export.
export function AnnotationsView() {
  const [query, setQuery] = useState<AnnotationQuery>({ ...EMPTY_ANNOTATION_QUERY });
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<AnnotationHubItem[]>([]);
  const [facets, setFacets] = useState<AnnotationFacetsResponse>({ books: [], shelves: [], colors: [], types: [] });
  const [index, setIndex] = useState<AnnotationIndexSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [colorDraft, setColorDraft] = useState<ReaderHighlightColor | null>("yellow");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AnnotationHubItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorRef = useRef<string | null>(null);
  const queryRef = useRef(query);

  const hasFilters = Boolean(query.q || query.bookId || query.shelfId || query.color || query.from || query.to || query.type !== "all" || query.sort !== "newest");

  const load = useCallback(async (reset: boolean, active: AnnotationQuery) => {
    if (reset) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }
    try {
      const result = await AnnotationsApi.list({ ...active, cursor: reset ? null : cursorRef.current });
      setItems((current) => (reset ? result.items : [...current, ...result.items]));
      setTotal(result.total);
      cursorRef.current = result.nextCursor;
      setNextCursor(result.nextCursor);
      setIndex(result.index);
    } catch (cause: unknown) {
      setError(errorMessage(cause, "Failed to load annotations"));
    }
    setIsLoading(false);
    setIsLoadingMore(false);
  }, []);

  const loadFacets = useCallback(async () => {
    try {
      setFacets(await AnnotationsApi.facets());
    } catch {
      // Los filtros son opcionales.
    }
  }, []);

  // Estado inicial desde la URL (solo cliente).
  useEffect(() => {
    const initial = queryFromUrl();
    queryRef.current = initial;
    setQuery(initial);
    setSearchInput(initial.q ?? "");
    setReady(true);
    void load(true, initial);
    void loadFacets();
  }, [load, loadFacets]);

  // Mientras el índice se reconstruye, refresca cada 4 s.
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      if (index && (index.isReconciling || index.pendingBooks > 0)) void load(true, queryRef.current);
    }, 4000);
    return () => clearInterval(timer);
  }, [ready, index, load]);

  function apply(patch: Partial<AnnotationQuery>) {
    const next = { ...queryRef.current, ...patch, cursor: null };
    queryRef.current = next;
    setQuery(next);
    window.history.replaceState(null, "", urlForQuery(next));
    void load(true, next);
  }

  function scheduleSearch(value: string) {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => apply({ q: value.trim() || null }), 300);
  }

  function clearFilters() {
    setSearchInput("");
    apply({ ...EMPTY_ANNOTATION_QUERY });
  }

  function beginEdit(item: AnnotationHubItem) {
    setEditingId(item.id);
    setNoteDraft(item.note ?? "");
    setColorDraft(HIGHLIGHT_COLORS.includes(item.color as ReaderHighlightColor) ? (item.color as ReaderHighlightColor) : null);
  }

  async function saveEdit(item: AnnotationHubItem) {
    setSavingId(item.id);
    try {
      const updated = await AnnotationsApi.update(item.id, {
        note: noteDraft.trim() || null,
        ...(item.kind === "highlight" && colorDraft ? { color: colorDraft } : {}),
        expectedVersion: item.version,
      });
      setItems((current) => current.map((candidate) => (candidate.id === item.id ? updated : candidate)));
      setEditingId(null);
      toast.success("Annotation updated");
      void loadFacets();
    } catch (cause: unknown) {
      toast.error(errorMessage(cause, "Failed to update annotation"));
      void load(true, queryRef.current); // posible conflicto de versión
    }
    setSavingId(null);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleting(true);
    try {
      await AnnotationsApi.remove(target.id, { expectedVersion: target.version });
      setItems((current) => current.filter((candidate) => candidate.id !== target.id));
      setTotal((current) => Math.max(0, current - 1));
      toast.success("Annotation deleted");
      void loadFacets();
    } catch (cause: unknown) {
      toast.error(errorMessage(cause, "Failed to delete annotation"));
      void load(true, queryRef.current);
    }
    setDeleting(false);
    setPendingDelete(null);
  }

  async function retryIndexing() {
    setIsReindexing(true);
    try {
      await AnnotationsApi.reindex();
      toast.success("Annotation indexing started");
      setTimeout(() => void load(true, queryRef.current), 600);
    } catch (cause: unknown) {
      toast.error(errorMessage(cause, "Failed to start indexing"));
    }
    setIsReindexing(false);
  }

  const bookLink = (item: AnnotationHubItem) => (item.book.isArchived ? `/archived?book=${item.book.id}` : `/library?book=${item.book.id}`);

  return (
    <div className="flex flex-col gap-5 py-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reading memory</p>
          <h1 className="text-xl font-semibold">Highlights and annotations</h1>
          <p className="text-sm text-muted-foreground">Search every passage, note, and bookmark saved by KOReader or the web reader.</p>
        </div>
        <div className="flex gap-2 text-sm" aria-label="Export annotations">
          <a className="text-primary hover:underline" href={AnnotationsApi.exportUrl(query, "markdown")}>
            Export Markdown
          </a>
          <a className="text-primary hover:underline" href={AnnotationsApi.exportUrl(query, "json")}>
            Export JSON
          </a>
        </div>
      </section>

      {index && (index.isReconciling || index.pendingBooks > 0 || index.failedBooks > 0) && (
        <section aria-live="polite" className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
          <div>
            <strong>{index.isReconciling ? "Indexing reading notes" : "Annotation index needs attention"}</strong>
            <p className="text-xs text-muted-foreground">
              {index.indexedBooks} of {index.totalBooks} books indexed{index.failedBooks ? `, ${index.failedBooks} failed` : ""}.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void retryIndexing()} disabled={isReindexing || index.isReconciling}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {isReindexing ? "Starting…" : "Retry"}
          </Button>
        </section>
      )}

      <section aria-label="Annotation filters" className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchInput}
            onChange={(event) => scheduleSearch(event.target.value)}
            placeholder="Search passages, notes, books, or authors"
            aria-label="Search annotations"
            className="pl-8"
          />
        </div>
        <select aria-label="Annotation type" className={SELECT_CLASS} value={query.type} onChange={(event) => apply({ type: event.target.value as AnnotationQuery["type"] })}>
          <option value="all">All annotations</option>
          <option value="highlight">Highlights</option>
          <option value="bookmark">Bookmarks</option>
          <option value="with-note">With notes</option>
        </select>
        <select aria-label="Book" className={SELECT_CLASS} value={query.bookId ?? ""} onChange={(event) => apply({ bookId: event.target.value ? Number(event.target.value) : null })}>
          <option value="">All books</option>
          {facets.books.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label} ({option.count})
            </option>
          ))}
        </select>
        <select aria-label="Shelf" className={SELECT_CLASS} value={query.shelfId ?? ""} onChange={(event) => apply({ shelfId: event.target.value ? Number(event.target.value) : null })}>
          <option value="">All shelves</option>
          {facets.shelves.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label} ({option.count})
            </option>
          ))}
        </select>
        <select aria-label="Highlight color" className={SELECT_CLASS} value={query.color ?? ""} onChange={(event) => apply({ color: event.target.value || null })}>
          <option value="">All colors</option>
          {facets.colors.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label} ({option.count})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          From
          <Input type="date" value={query.from ?? ""} onChange={(event) => apply({ from: event.target.value || null })} className="w-36" />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          To
          <Input type="date" value={query.to ?? ""} onChange={(event) => apply({ to: event.target.value || null })} className="w-36" />
        </label>
        <select aria-label="Sort annotations" className={SELECT_CLASS} value={query.sort} onChange={(event) => apply({ sort: event.target.value as AnnotationQuery["sort"] })}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="book">By book</option>
        </select>
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </section>

      {error ? (
        <p role="alert" className="flex items-center gap-3 text-sm text-destructive">
          {error}
          <button type="button" className="text-primary hover:underline" onClick={() => void load(true, queryRef.current)}>
            Retry
          </button>
        </p>
      ) : isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <section className="flex flex-col items-center gap-2 py-16 text-center">
          <h2 className="text-base font-medium">{hasFilters ? "No matching annotations" : "Your reading notes will collect here"}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {hasFilters
              ? "Try broadening the search or clearing the active filters."
              : "Create a highlight, note, or bookmark in KOReader, then sync reading progress."}
          </p>
          {hasFilters && (
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </section>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {total} annotation{total === 1 ? "" : "s"}
          </p>
          <section aria-label="Annotations" className="flex flex-col gap-3">
            {items.map((item) => (
              <article key={item.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row">
                <div className="flex shrink-0 items-start gap-2 sm:w-48">
                  {item.book.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- portadas gestionadas servidas por /api con cookie de sesión
                    <img src={item.book.cover} alt="" loading="lazy" className="h-16 w-11 rounded object-cover" />
                  ) : (
                    <div aria-hidden="true" className="flex h-16 w-11 items-center justify-center rounded bg-muted text-sm font-semibold text-muted-foreground">
                      {item.book.title.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 text-xs">
                    <Link href={bookLink(item)} className="line-clamp-2 font-medium hover:underline">
                      {item.book.title}
                    </Link>
                    <p className="truncate text-muted-foreground">{item.book.author || "Unknown author"}</p>
                    {item.book.isArchived && <small className="text-muted-foreground">Archived</small>}
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <header className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-medium capitalize text-foreground">{item.kind}</span>
                      {item.color && (
                        <span className="inline-flex items-center gap-1">
                          <i className="size-2.5 rounded-full" style={{ background: item.color }} />
                          {item.color}
                        </span>
                      )}
                    </div>
                    <time>{formatTime(item.updatedAt ?? item.recordedAt)}</time>
                  </header>
                  {item.chapter && <p className="text-xs text-muted-foreground">{item.chapter}</p>}
                  {item.text && <blockquote className="border-l-2 border-primary/60 pl-3 text-sm">{item.text}</blockquote>}

                  {editingId === item.id ? (
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        Note
                        <textarea
                          rows={4}
                          maxLength={20000}
                          value={noteDraft}
                          onChange={(event) => setNoteDraft(event.target.value)}
                          className="rounded-lg border border-input bg-background p-2 text-sm text-foreground"
                        />
                      </label>
                      {item.kind === "highlight" && (
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          Color
                          <select
                            className={SELECT_CLASS}
                            value={colorDraft ?? ""}
                            onChange={(event) => setColorDraft(event.target.value ? (event.target.value as ReaderHighlightColor) : null)}
                          >
                            {colorDraft === null && <option value="">Keep {item.color || "original color"}</option>}
                            {HIGHLIGHT_COLORS.map((color) => (
                              <option key={color} value={color}>
                                {color}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={savingId === item.id}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => void saveEdit(item)} disabled={savingId === item.id}>
                          {savingId === item.id ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    item.note && <p className="whitespace-pre-line text-sm text-muted-foreground">{item.note}</p>
                  )}

                  <footer className="flex flex-wrap items-center gap-3 text-xs">
                    {item.book.extension?.toLowerCase() === "epub" ? (
                      <Link className="text-primary hover:underline" href={`/library/${item.book.id}/read?annotationId=${item.id}`}>
                        Open in reader
                      </Link>
                    ) : (
                      <Link className="text-primary hover:underline" href={bookLink(item)}>
                        View book
                      </Link>
                    )}
                    <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => beginEdit(item)}>
                      Edit
                    </button>
                    <button type="button" className="text-destructive hover:underline" onClick={() => setPendingDelete(item)}>
                      Delete
                    </button>
                  </footer>
                </div>
              </article>
            ))}
          </section>
          {nextCursor && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => void load(false, queryRef.current)} disabled={isLoadingMore}>
                {isLoadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete annotation?"
        message="This removes the annotation from the KOReader sidecar and syncs the change to your devices."
        confirmLabel="Delete annotation"
        danger
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
