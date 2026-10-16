"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, BookOpen, ChevronDown, Download, Library, Loader2, Search, SearchX } from "lucide-react";
import { SearchApi, type SearchBookMetadata } from "@/lib/client/search-api";
import { errorMessage } from "@/lib/client/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { SearchProviderId, SearchResultBook } from "@/lib/types/search";
import {
  DEFAULT_FILTERS,
  SEARCH_FORMAT_OPTIONS,
  SEARCH_LANGUAGE_OPTIONS,
  SEARCH_PROVIDER_OPTIONS,
  SEARCH_SORT_OPTIONS,
  bookCacheKey,
  emptyCollapsedGroups,
  formatFileSize,
  getDefaultSelectedProviders,
  loadStoredCollapsed,
  loadStoredFilters,
  loadStoredProviders,
  normalizeProviderSelection,
  parseYearInput,
  persistCollapsed,
  persistFilters,
  persistProviders,
  providerLabel,
  type SearchSortValue,
} from "@/lib/search/view";
import { SearchDetailsModal } from "./search-details-modal";

type PendingAction = { book: SearchResultBook; action: "download" | "library" } | null;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function ResultCard({
  book,
  onOpen,
  onDownload,
  onLibrary,
}: {
  book: SearchResultBook;
  onOpen: (book: SearchResultBook) => void;
  onDownload: (book: SearchResultBook) => void;
  onLibrary: (book: SearchResultBook) => void;
}) {
  const actions = book.capabilities.filesAvailable;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <button
        type="button"
        onClick={() => onOpen(book)}
        aria-label={`Open details for ${book.title}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          {book.cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- portadas externas de providers
            <img src={book.cover} alt={book.title} loading="lazy" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-xs font-semibold text-muted-foreground">
              {book.extension?.toUpperCase() ?? <BookOpen className="size-5" aria-hidden="true" />}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={book.title}>
            {book.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">by {book.author ?? "Unknown author"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[providerLabel(book.provider), book.extension?.toUpperCase(), book.language, book.year, formatFileSize(book.filesize).replace("Not available", "Unknown size")]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </button>
      {actions && (
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" onClick={() => onDownload(book)} title="Download to device">
            <Download className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Download</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => onLibrary(book)} title="Add to library">
            <Library className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Library</span>
          </Button>
        </div>
      )}
    </li>
  );
}

// Búsqueda multi-provider: filtros persistidos, resultados agrupados, descarga directa o a la cola.
export function SearchView({ activeProviders }: { activeProviders: SearchProviderId[] }) {
  const [title, setTitle] = useState("");
  const [providers, setProviders] = useState<SearchProviderId[]>(() => getDefaultSelectedProviders(activeProviders));
  const [languages, setLanguages] = useState<string[]>(DEFAULT_FILTERS.selectedLanguages);
  const [formats, setFormats] = useState<string[]>(DEFAULT_FILTERS.selectedFormats);
  const [sort, setSort] = useState<SearchSortValue>(DEFAULT_FILTERS.selectedSort);
  const [onlyFiles, setOnlyFiles] = useState(DEFAULT_FILTERS.onlyFilesAvailable);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [collapsed, setCollapsed] = useState(emptyCollapsedGroups);
  const [prefsReady, setPrefsReady] = useState(false);

  const [books, setBooks] = useState<SearchResultBook[]>([]);
  const [searched, setSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const [pending, setPending] = useState<PendingAction>(null);
  const [adjustedTitle, setAdjustedTitle] = useState("");
  const [detailBook, setDetailBook] = useState<SearchResultBook | null>(null);
  const [metadata, setMetadata] = useState<Record<string, SearchBookMetadata>>({});
  const [metaLoading, setMetaLoading] = useState<Record<string, boolean>>({});
  const [metaError, setMetaError] = useState<Record<string, string | null>>({});

  // Preferencias guardadas (solo cliente).
  useEffect(() => {
    const storedProviders = loadStoredProviders(activeProviders);
    if (storedProviders) setProviders(storedProviders);
    else persistProviders(getDefaultSelectedProviders(activeProviders));
    const storedCollapsed = loadStoredCollapsed();
    if (storedCollapsed) setCollapsed(storedCollapsed);
    const storedFilters = loadStoredFilters();
    if (storedFilters) {
      setLanguages(storedFilters.selectedLanguages);
      setFormats(storedFilters.selectedFormats);
      setSort(storedFilters.selectedSort);
      setOnlyFiles(storedFilters.onlyFilesAvailable);
    }
    setPrefsReady(true);
  }, [activeProviders]);

  useEffect(() => {
    if (prefsReady) persistFilters({ selectedLanguages: languages, selectedFormats: formats, selectedSort: sort, onlyFilesAvailable: onlyFiles });
  }, [prefsReady, languages, formats, sort, onlyFiles]);

  const displayed = useMemo(() => (onlyFiles ? books.filter((book) => book.capabilities.filesAvailable) : books), [books, onlyFiles]);
  const byProvider = useMemo(() => {
    const grouped: Record<SearchProviderId, SearchResultBook[]> = { zlibrary: [], anna: [], openlibrary: [], gutenberg: [] };
    for (const book of displayed) grouped[book.provider].push(book);
    return grouped;
  }, [displayed]);

  function changeProviders(next: SearchProviderId[]) {
    const normalized = normalizeProviderSelection(next, activeProviders);
    setProviders(normalized);
    persistProviders(normalized);
  }

  function toggleGroup(id: SearchProviderId) {
    const next = { ...collapsed, [id]: !collapsed[id] };
    setCollapsed(next);
    persistCollapsed(next);
  }

  async function runSearch() {
    if (!title.trim() || providers.length === 0 || isSearching) return;
    setIsSearching(true);
    setError(null);
    try {
      const result = await SearchApi.search({
        query: title,
        providers,
        filters: {
          language: languages.length > 0 ? languages : undefined,
          extension: formats.length > 0 ? formats : undefined,
          yearFrom: parseYearInput(yearFrom),
          yearTo: parseYearInput(yearTo),
          limitPerProvider: 20,
        },
        sort,
      });
      setBooks(result.books);
      const failed = result.meta.failedProviders;
      if (failed.length > 0) {
        const message = failed.map((entry) => `${providerLabel(entry.provider)}: ${entry.error}`).join(" | ");
        toast.error(`Some providers failed: ${message}`);
        if (result.books.length === 0) setError(message);
      }
    } catch (cause: unknown) {
      setBooks([]);
      setError(errorMessage(cause, "Search failed"));
    }
    setSearched(true);
    setIsSearching(false);
  }

  function openAdjust(book: SearchResultBook, action: "download" | "library") {
    setDetailBook(null);
    setPending({ book, action });
    setAdjustedTitle(book.title);
  }

  async function confirmAdjust() {
    if (!pending) return;
    const finalTitle = adjustedTitle.trim();
    if (!finalTitle) {
      toast.error("Title cannot be empty");
      return;
    }
    const book = { ...pending.book, title: finalTitle };
    const action = pending.action;
    setPending(null);

    if (action === "download") {
      setDownloading(book.title);
      try {
        await SearchApi.download(book);
        toast.success(`Download started for "${book.title}"`);
      } catch (cause: unknown) {
        toast.error(`Download failed: ${errorMessage(cause, "unknown error")}`);
      }
      setDownloading(null);
      return;
    }

    try {
      const result = await SearchApi.queueToLibrary(book);
      const info = result.queueStatus.pending > 0 ? ` (${result.queueStatus.pending} in queue)` : "";
      toast.success(`"${book.title}" added to download queue${info}`);
    } catch (cause: unknown) {
      toast.error(`Failed to add to library: ${errorMessage(cause, "unknown error")}`);
    }
  }

  async function loadMetadata(book: SearchResultBook) {
    const key = bookCacheKey(book.provider, book.providerBookId);
    setMetaLoading((current) => ({ ...current, [key]: true }));
    setMetaError((current) => ({ ...current, [key]: null }));
    try {
      const result = await SearchApi.lookupMetadata({ title: book.title, author: book.author, identifier: book.identifier, language: book.language });
      setMetadata((current) => ({ ...current, [key]: result.metadata }));
    } catch (cause: unknown) {
      setMetaError((current) => ({ ...current, [key]: errorMessage(cause, "Failed to fetch metadata") }));
    }
    setMetaLoading((current) => ({ ...current, [key]: false }));
  }

  function openDetails(book: SearchResultBook) {
    setDetailBook(book);
    const key = bookCacheKey(book.provider, book.providerBookId);
    if (!metadata[key] && !metaLoading[key]) void loadMetadata(book);
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value.trim());
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Failed to copy ${label}`);
    }
  }

  if (activeProviders.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Search is disabled. Set <code>ACTIVATED_PROVIDERS</code> on the server to enable at least one provider.
      </div>
    );
  }

  const detailKey = detailBook ? bookCacheKey(detailBook.provider, detailBook.providerBookId) : "";

  return (
    <div className="flex flex-col gap-5 py-5">
      <header>
        <h1 className="text-xl font-semibold">Search Books</h1>
        <p className="text-sm text-muted-foreground">Find books across multiple providers</p>
      </header>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch();
        }}
      >
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title, author or ISBN" aria-label="Search books" />
        <Button type="submit" disabled={!title.trim() || providers.length === 0 || isSearching}>
          {isSearching ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
          Search
        </Button>
      </form>

      <section aria-label="Search filters" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 text-muted-foreground">Providers</span>
          {SEARCH_PROVIDER_OPTIONS.filter((option) => activeProviders.includes(option.value)).map((option) => (
            <Chip key={option.value} active={providers.includes(option.value)} onClick={() => changeProviders(toggle(providers, option.value))}>
              {option.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 text-muted-foreground">Languages</span>
          {SEARCH_LANGUAGE_OPTIONS.map((option) => (
            <Chip key={option.value} active={languages.includes(option.value)} onClick={() => setLanguages(toggle(languages, option.value))}>
              {option.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 text-muted-foreground">Formats</span>
          {SEARCH_FORMAT_OPTIONS.map((option) => (
            <Chip key={option.value} active={formats.includes(option.value)} onClick={() => setFormats(toggle(formats, option.value))}>
              {option.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-muted-foreground">
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SearchSortValue)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground"
            >
              {SEARCH_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-muted-foreground">
            Year
            <Input value={yearFrom} onChange={(event) => setYearFrom(event.target.value)} inputMode="numeric" placeholder="from" className="w-20" aria-label="Year from" />
            –
            <Input value={yearTo} onChange={(event) => setYearTo(event.target.value)} inputMode="numeric" placeholder="to" className="w-20" aria-label="Year to" />
          </label>
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" checked={onlyFiles} onChange={(event) => setOnlyFiles(event.target.checked)} />
            Only with files
          </label>
        </div>
      </section>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          {error}
        </p>
      )}

      {displayed.length > 0 ? (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            {displayed.length} result{displayed.length === 1 ? "" : "s"} found
          </p>
          {providers.map((id) =>
            byProvider[id].length > 0 ? (
              <section key={id} className="flex flex-col gap-2">
                <button
                  type="button"
                  aria-expanded={!collapsed[id]}
                  onClick={() => toggleGroup(id)}
                  className="flex items-center gap-1.5 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {providerLabel(id)} ({byProvider[id].length})
                  <ChevronDown className={cn("size-4 transition-transform", collapsed[id] && "-rotate-90")} aria-hidden="true" />
                </button>
                {!collapsed[id] && (
                  <ul className="flex flex-col gap-2">
                    {byProvider[id].map((book) => (
                      <ResultCard
                        key={bookCacheKey(book.provider, book.providerBookId)}
                        book={book}
                        onOpen={openDetails}
                        onDownload={(target) => openAdjust(target, "download")}
                        onLibrary={(target) => openAdjust(target, "library")}
                      />
                    ))}
                  </ul>
                )}
              </section>
            ) : null,
          )}
        </div>
      ) : !isSearching ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          {searched ? <SearchX className="size-10" aria-hidden="true" /> : <BookOpen className="size-10" aria-hidden="true" />}
          <h2 className="text-base font-medium text-foreground">{searched ? "No books found" : "Search for books"}</h2>
          <p className="text-sm">{searched ? "Try adjusting your search terms or filters" : "Enter a title, author, or ISBN to get started"}</p>
        </div>
      ) : null}

      {downloading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80" role="status">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Downloading...</p>
              <p className="max-w-64 truncate text-xs text-muted-foreground">{downloading}</p>
            </div>
          </div>
        </div>
      )}

      <Dialog open={pending !== null} onOpenChange={(next) => !next && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust title</DialogTitle>
            <DialogDescription>The title is used as the file name and library entry.</DialogDescription>
          </DialogHeader>
          <Input
            value={adjustedTitle}
            onChange={(event) => setAdjustedTitle(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void confirmAdjust()}
            aria-label="Title"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmAdjust()}>{pending?.action === "download" ? "Download" : "Add To Library"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SearchDetailsModal
        book={detailBook}
        metadata={metadata[detailKey]}
        isLoading={metaLoading[detailKey] ?? false}
        error={metaError[detailKey] ?? null}
        onClose={() => setDetailBook(null)}
        onRetry={(book) => void loadMetadata(book)}
        onCopy={(value, label) => void copyText(value, label)}
        onDownload={(book) => openAdjust(book, "download")}
        onAddToLibrary={(book) => openAdjust(book, "library")}
      />
    </div>
  );
}
