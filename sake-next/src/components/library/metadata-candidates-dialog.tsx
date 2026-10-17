"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/client/api-client";
import { LibraryApi } from "@/lib/client/library-api";
import { cn } from "@/lib/utils";
import type { MetadataCandidate, MetadataCoverCandidate } from "@/lib/server/application/ports";
import type { ApplyMetadataFieldSelection } from "@/lib/server/application/use-cases/apply-metadata-candidate";

interface MetadataCandidatesDialogProps {
  bookId: number | null;
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (body: {
    candidate: MetadataCandidate;
    fieldSelections: ApplyMetadataFieldSelection[];
    coverChoice: MetadataCoverCandidate | null;
  }) => Promise<boolean>;
}

interface FieldOption {
  key: ApplyMetadataFieldSelection;
  label: string;
  value: (candidate: MetadataCandidate) => string | null;
}

const text = (value: string | number | null | undefined) => (value === null || value === undefined || value === "" ? null : String(value));

const FIELD_OPTIONS: FieldOption[] = [
  { key: "title", label: "Title", value: (c) => text(c.title) },
  { key: "author", label: "Author", value: (c) => text(c.authors.join(", ")) },
  { key: "publisher", label: "Publisher", value: (c) => text(c.publisher) },
  { key: "series", label: "Series", value: (c) => text(c.series) },
  { key: "seriesIndex", label: "Series index", value: (c) => text(c.seriesIndex) },
  { key: "identifier", label: "ISBN", value: (c) => text(c.identifiers.isbn13 ?? c.identifiers.isbn10) },
  { key: "pages", label: "Pages", value: (c) => text(c.pageCount) },
  { key: "language", label: "Language", value: (c) => text(c.language) },
  {
    key: "publishedDate",
    label: "Published",
    value: (c) => {
      const { year, month, day } = c.publishedDate;
      return year ? [year, month, month ? day : null].filter(Boolean).join("-") : null;
    },
  },
  { key: "description", label: "Description", value: (c) => text(c.description) },
  { key: "googleBooksId", label: "Google Books ID", value: (c) => text(c.identifiers.googleBooksId) },
  { key: "openLibraryKey", label: "Open Library key", value: (c) => text(c.identifiers.openLibraryKey) },
  { key: "externalRating", label: "External rating", value: (c) => text(c.rating.average) },
];

function availableFields(candidate: MetadataCandidate): FieldOption[] {
  return FIELD_OPTIONS.filter((field) => field.value(candidate) !== null);
}

export function MetadataCandidatesDialog({ bookId, open, busy, onOpenChange, onApply }: MetadataCandidatesDialogProps) {
  const [candidates, setCandidates] = useState<MetadataCandidate[] | null>(null);
  const [providerErrors, setProviderErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MetadataCandidate | null>(null);
  const [fields, setFields] = useState<Set<ApplyMetadataFieldSelection>>(new Set());
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || bookId === null) return;
    let cancelled = false;
    LibraryApi.searchMetadataCandidates(bookId)
      .then((result) => {
        if (cancelled) return;
        setCandidates(result.candidates);
        setProviderErrors(result.providerErrors.map((entry) => `${entry.providerId}: ${entry.message}`));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause, "Metadata lookup failed"));
      });
    return () => {
      cancelled = true;
      setCandidates(null);
      setProviderErrors([]);
      setError(null);
      setSelected(null);
      setFields(new Set());
      setCoverUrl(null);
    };
  }, [open, bookId]);

  function choose(candidate: MetadataCandidate) {
    setSelected(candidate);
    setFields(new Set(availableFields(candidate).map((field) => field.key)));
    setCoverUrl(null);
  }

  function toggleField(key: ApplyMetadataFieldSelection) {
    setFields((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const coverChoice = selected?.covers.find((cover) => cover.url === coverUrl) ?? null;
  const canApply = selected !== null && (fields.size > 0 || coverChoice !== null) && !busy;

  async function handleApply() {
    if (!selected) return;
    // La valoración externa viaja con su conteo para que quede coherente.
    const fieldSelections = [...fields];
    if (fields.has("externalRating")) fieldSelections.push("externalRatingCount");
    const applied = await onApply({ candidate: selected, fieldSelections, coverChoice });
    if (applied) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>{selected ? "Choose what to apply" : "Find metadata"}</DialogTitle>
          <DialogDescription>
            {selected ? "Selected fields overwrite the current values." : "Candidates from your metadata providers."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : candidates === null ? (
            <p className="text-sm text-muted-foreground">Searching providers...</p>
          ) : selected ? (
            <div className="flex flex-col gap-4">
              <ul className="flex flex-col gap-1.5">
                {availableFields(selected).map((field) => (
                  <li key={field.key}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <input type="checkbox" className="mt-0.5" checked={fields.has(field.key)} onChange={() => toggleField(field.key)} />
                      <span className="w-28 shrink-0 text-muted-foreground">{field.label}</span>
                      <span className="line-clamp-3 min-w-0 break-words text-foreground">{field.value(selected)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {selected.covers.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-muted-foreground">Cover</span>
                  <div className="flex flex-wrap gap-2">
                    {selected.covers.map((cover) => (
                      <button
                        key={cover.url}
                        type="button"
                        aria-pressed={coverUrl === cover.url}
                        onClick={() => setCoverUrl(coverUrl === cover.url ? null : cover.url)}
                        className={cn("h-28 w-20 overflow-hidden rounded-md border-2 bg-muted", coverUrl === cover.url ? "border-primary" : "border-border")}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- portada externa de un proveedor */}
                        <img src={cover.url} alt={`Cover from ${cover.source}`} className="size-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No candidates found.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {candidates.map((candidate, index) => (
                <li key={`${candidate.providerId}-${index}`}>
                  <button
                    type="button"
                    onClick={() => choose(candidate)}
                    className="flex w-full gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-secondary"
                  >
                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded bg-muted">
                      {candidate.covers[0] && (
                        // eslint-disable-next-line @next/next/no-img-element -- portada externa de un proveedor
                        <img src={candidate.covers[0].url} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="line-clamp-2 font-medium text-foreground">{candidate.title}</p>
                      <p className="truncate text-muted-foreground">{candidate.authors.join(", ") || "Unknown author"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[candidate.providerId, candidate.publisher, candidate.publishedDate.year].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {providerErrors.length > 0 && !selected && (
            <p className="mt-3 text-xs text-muted-foreground">Some providers failed: {providerErrors.join("; ")}</p>
          )}
        </div>

        {selected && (
          <div className="flex justify-between gap-2 border-t border-border px-5 py-3">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setSelected(null)}>
              Back
            </Button>
            <Button size="sm" disabled={!canApply} onClick={() => void handleApply()}>
              {busy ? "Applying..." : "Apply"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
