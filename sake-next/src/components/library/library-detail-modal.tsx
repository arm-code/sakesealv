"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, BookOpen, BookOpenCheck, Download, EyeOff, RefreshCw, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LibraryApi } from "@/lib/client/library-api";
import { cn } from "@/lib/utils";
import { clampProgress } from "@/lib/library/view";
import type { LibraryBook } from "@/lib/library/types";
import type { LibraryShelf } from "@/lib/types/library";
import type { LibraryBookDetail } from "@/lib/server/application/use-cases/get-library-book-detail";
import { useLibraryBookDetail } from "./use-library-book-detail";

interface LibraryDetailModalProps {
  book: LibraryBook | null;
  shelves: LibraryShelf[];
  onClose: () => void;
  onBookPatched: (bookId: number, patch: Partial<LibraryBook>) => void;
  onBookRemoved: (bookId: number) => void;
}

type DetailTab = "overview" | "progress" | "metadata" | "devices";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function publicationDate(detail: LibraryBookDetail): string {
  const { year, month, day } = detail;
  if (!year) return "—";
  return [year, month ? String(month).padStart(2, "0") : null, month && day ? String(day).padStart(2, "0") : null]
    .filter(Boolean)
    .join("-");
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right text-foreground">{value}</dd>
    </div>
  );
}

function RatingStars({ rating, disabled, onChange }: { rating: number | null; disabled: boolean; onChange: (rating: number | null) => void }) {
  const current = rating ?? 0;
  return (
    <div role="group" aria-label="Rating" className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          disabled={disabled}
          aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
          aria-pressed={current >= value}
          onClick={() => onChange(current === value ? null : value)}
          className="p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <Star className={cn("size-5", current >= value && "fill-current text-foreground")} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

interface MetadataFormState {
  title: string;
  author: string;
  publisher: string;
  series: string;
  volume: string;
  seriesIndex: string;
  edition: string;
  identifier: string;
  pages: string;
  language: string;
  year: string;
  description: string;
}

function toForm(detail: LibraryBookDetail, language: string | null): MetadataFormState {
  const text = (value: string | number | null) => (value === null || value === undefined ? "" : String(value));
  return {
    title: detail.title,
    author: text(detail.author),
    publisher: text(detail.publisher),
    series: text(detail.series),
    volume: text(detail.volume),
    seriesIndex: text(detail.seriesIndex),
    edition: text(detail.edition),
    identifier: text(detail.identifier),
    pages: text(detail.pages),
    language: text(language),
    year: text(detail.year),
    description: text(detail.description),
  };
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function nullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

const METADATA_FIELDS: ReadonlyArray<{ key: keyof MetadataFormState; label: string; type?: "number" }> = [
  { key: "title", label: "Title" },
  { key: "author", label: "Author" },
  { key: "publisher", label: "Publisher" },
  { key: "series", label: "Series" },
  { key: "volume", label: "Volume" },
  { key: "seriesIndex", label: "Series index", type: "number" },
  { key: "edition", label: "Edition" },
  { key: "identifier", label: "Identifier (ISBN)" },
  { key: "pages", label: "Pages", type: "number" },
  { key: "language", label: "Language" },
  { key: "year", label: "Year", type: "number" },
];

export function LibraryDetailModal({ book, shelves, onClose, onBookPatched, onBookRemoved }: LibraryDetailModalProps) {
  const bookId = book?.id ?? null;
  const state = useLibraryBookDetail({ bookId, onBookPatched, onBookRemoved });
  const { detail } = state;

  const [tab, setTab] = useState<DetailTab>("overview");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MetadataFormState | null>(null);
  const [confirmTrash, setConfirmTrash] = useState(false);

  useEffect(() => {
    setTab("overview");
    setEditing(false);
    setForm(null);
  }, [bookId]);

  const { loadHistory } = state;
  useEffect(() => {
    if (tab === "progress") void loadHistory();
  }, [tab, loadHistory]);

  const busy = state.pending !== null;
  const percent = clampProgress(detail?.progressPercent ?? book?.progressPercent);

  async function handleSave() {
    if (!form) return;
    const saved = await state.saveMetadata({
      title: form.title.trim() || undefined,
      author: nullableText(form.author),
      publisher: nullableText(form.publisher),
      series: nullableText(form.series),
      volume: nullableText(form.volume),
      seriesIndex: nullableNumber(form.seriesIndex),
      edition: nullableText(form.edition),
      identifier: nullableText(form.identifier),
      pages: nullableNumber(form.pages),
      language: nullableText(form.language),
      year: nullableNumber(form.year),
      description: nullableText(form.description),
    });
    if (saved) setEditing(false);
  }

  return (
    <>
      <Dialog open={book !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[88vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="line-clamp-2 pr-8">{detail?.title ?? book?.title ?? "Book details"}</DialogTitle>
            <DialogDescription className="truncate">{detail?.author ?? book?.author ?? "Unknown author"}</DialogDescription>
          </DialogHeader>

          {state.error ? (
            <p role="alert" className="p-5 text-sm text-destructive">
              {state.error}
            </p>
          ) : !detail ? (
            <p className="p-5 text-sm text-muted-foreground">Loading details...</p>
          ) : (
            <Tabs value={tab} onValueChange={(value) => setTab(value as DetailTab)} className="flex-1 gap-0 overflow-hidden">
              <TabsList variant="line" className="h-auto w-full shrink-0 justify-start gap-1 overflow-x-auto border-b border-border bg-transparent px-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="progress">Progress</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                <TabsTrigger value="devices">Devices ({detail.downloadedDevices.length})</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto p-5">
                <TabsContent value="overview" className="flex flex-col gap-5">
                  <div className="flex gap-4">
                    <div className="h-40 w-28 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                      {book?.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element -- portada gestionada servida por /api con cookie
                        <img src={book.cover} alt={detail.title} className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                          <BookOpen className="size-7" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <dl className="min-w-0 flex-1">
                      <InfoRow label="Status" value={detail.isRead ? "Read" : percent > 0 ? `Reading (${Math.round(percent)}%)` : "Unread"} />
                      <InfoRow label="Series" value={detail.series ? `${detail.series}${detail.seriesIndex ? ` #${detail.seriesIndex}` : ""}` : "—"} />
                      <InfoRow label="Format" value={detail.extension?.toUpperCase() ?? "—"} />
                      <InfoRow label="Pages" value={detail.pages ?? "—"} />
                      <InfoRow label="Published" value={publicationDate(detail)} />
                      <InfoRow label="Size" value={formatFileSize(book?.filesize)} />
                    </dl>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Your rating</span>
                    <RatingStars rating={detail.rating} disabled={busy} onChange={(value) => void state.setRating(value)} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm text-muted-foreground">Shelves</span>
                    {shelves.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No shelves yet. Create one from the sidebar.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {shelves.map((shelf) => {
                          const assigned = detail.shelfIds.includes(shelf.id);
                          return (
                            <button
                              key={shelf.id}
                              type="button"
                              disabled={busy}
                              aria-pressed={assigned}
                              onClick={() => void state.toggleShelf(shelf.id)}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50",
                                assigned ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-secondary",
                              )}
                            >
                              <span aria-hidden="true">{shelf.icon}</span>
                              {shelf.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {detail.description && (
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-muted-foreground">Description</span>
                      <p className="whitespace-pre-line text-sm text-foreground">{detail.description}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => void state.changeState("read", { isRead: !detail.isRead })}>
                      {detail.isRead ? "Mark as unread" : "Mark as read"}
                    </Button>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => void state.changeState("archive", { archived: !detail.isArchived })}>
                      <Archive className="size-4" aria-hidden="true" />
                      {detail.isArchived ? "Unarchive" : "Archive"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || detail.isArchived}
                      onClick={() => void state.changeState("exclude", { excludeFromNewBooks: !detail.excludeFromNewBooks })}
                    >
                      <EyeOff className="size-4" aria-hidden="true" />
                      {detail.excludeFromNewBooks ? "Include in new books" : "Exclude from new books"}
                    </Button>
                    {detail.extension?.toLowerCase() === "epub" && (
                      <Link
                        href={`/library/${detail.bookId}/read`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <BookOpenCheck className="size-4" aria-hidden="true" />
                        Read
                      </Link>
                    )}
                    <a
                      href={LibraryApi.downloadUrl(detail.fileName)}
                      download={detail.fileName}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm font-medium hover:bg-secondary"
                    >
                      <Download className="size-4" aria-hidden="true" />
                      Download
                    </a>
                    <Button variant="destructive" size="sm" disabled={busy} onClick={() => setConfirmTrash(true)}>
                      <Trash2 className="size-4" aria-hidden="true" />
                      Move to trash
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="progress" className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current progress</span>
                      <span className="font-medium text-foreground">{Math.round(percent)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">Finished: {formatDate(detail.readAt)}</p>
                  </div>
                  {state.historyError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {state.historyError}
                    </p>
                  ) : state.history === null ? (
                    <p className="text-sm text-muted-foreground">Loading history...</p>
                  ) : state.history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No reading sessions recorded yet.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {[...state.history].reverse().map((entry) => (
                        <li key={entry.recordedAt} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                          <span className="text-muted-foreground">{formatDateTime(entry.recordedAt)}</span>
                          <span className="font-medium text-foreground">{Math.round(clampProgress(entry.progressPercent * 100))}%</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="metadata" className="flex flex-col gap-4">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => void state.refetchMetadata()}>
                      <RefreshCw className="size-4" aria-hidden="true" />
                      {state.pending === "refetch" ? "Refetching..." : "Refetch"}
                    </Button>
                    {editing ? (
                      <>
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => setEditing(false)}>
                          Cancel
                        </Button>
                        <Button size="sm" disabled={busy || !form?.title.trim()} onClick={() => void handleSave()}>
                          {state.pending === "metadata" ? "Saving..." : "Save"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          setForm(toForm(detail, book?.language ?? null));
                          setEditing(true);
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </div>

                  {editing && form ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {METADATA_FIELDS.map((field) => (
                        <div key={field.key} className={cn("flex flex-col gap-1.5", field.key === "title" && "sm:col-span-2")}>
                          <Label htmlFor={`meta-${field.key}`}>{field.label}</Label>
                          <Input
                            id={`meta-${field.key}`}
                            type={field.type === "number" ? "number" : "text"}
                            value={form[field.key]}
                            onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                          />
                        </div>
                      ))}
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <Label htmlFor="meta-description">Description</Label>
                        <textarea
                          id="meta-description"
                          rows={5}
                          value={form.description}
                          onChange={(event) => setForm({ ...form, description: event.target.value })}
                          className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                    </div>
                  ) : (
                    <dl>
                      <InfoRow label="Title" value={detail.title} />
                      <InfoRow label="Author" value={detail.author ?? "—"} />
                      <InfoRow label="Publisher" value={detail.publisher ?? "—"} />
                      <InfoRow label="Series" value={detail.series ?? "—"} />
                      <InfoRow label="Volume" value={detail.volume ?? "—"} />
                      <InfoRow label="Series index" value={detail.seriesIndex ?? "—"} />
                      <InfoRow label="Edition" value={detail.edition ?? "—"} />
                      <InfoRow label="Identifier" value={detail.identifier ?? "—"} />
                      <InfoRow label="Pages" value={detail.pages ?? "—"} />
                      <InfoRow label="Language" value={book?.language ?? "—"} />
                      <InfoRow label="Published" value={publicationDate(detail)} />
                      <InfoRow label="File" value={detail.fileName} />
                      <InfoRow label="Added" value={formatDate(book?.createdAt ?? null)} />
                    </dl>
                  )}
                </TabsContent>

                <TabsContent value="devices" className="flex flex-col gap-3">
                  {detail.downloadedDevices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">This book has not been downloaded by any device.</p>
                  ) : (
                    <>
                      <ul className="flex flex-col gap-1.5">
                        {detail.downloadedDevices.map((deviceId) => (
                          <li key={deviceId} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                            <span className="min-w-0 truncate text-foreground">{deviceId}</span>
                            <Button variant="outline" size="sm" disabled={busy} onClick={() => void state.removeDeviceDownload(deviceId)}>
                              Remove
                            </Button>
                          </li>
                        ))}
                      </ul>
                      <Button variant="outline" size="sm" className="w-fit" disabled={busy} onClick={() => void state.resetDownloads()}>
                        Reset all downloads
                      </Button>
                    </>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmTrash}
        title="Move to trash?"
        message="The book can be restored from Trash until it expires."
        confirmLabel="Move to trash"
        danger
        pending={state.pending === "trash"}
        onCancel={() => setConfirmTrash(false)}
        onConfirm={async () => {
          const moved = await state.moveToTrash();
          if (moved) setConfirmTrash(false);
        }}
      />
    </>
  );
}
