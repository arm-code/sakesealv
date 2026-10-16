"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { extractIsbn } from "@/lib/utils/isbn";
import type { SearchBookMetadata } from "@/lib/client/search-api";
import type { SearchResultBook } from "@/lib/types/search";
import { displayValue, formatFileSize, providerLabel, toGoogleBooksUrl, toOpenLibraryUrl } from "@/lib/search/view";

interface SearchDetailsModalProps {
  book: SearchResultBook | null;
  metadata?: SearchBookMetadata;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: (book: SearchResultBook) => void;
  onCopy: (value: string, label: string) => void;
  onDownload: (book: SearchResultBook) => void;
  onAddToLibrary: (book: SearchResultBook) => void;
}

function Row({ label, value, copy, href }: { label: string; value: string; copy?: () => void; href?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-right">{value}</span>
        {copy && (
          <button type="button" onClick={copy} className="text-xs text-primary hover:underline">
            Copy
          </button>
        )}
        {href && (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
            Open
          </a>
        )}
      </span>
    </div>
  );
}

export function SearchDetailsModal({ book, metadata, isLoading, error, onClose, onRetry, onCopy, onDownload, onAddToLibrary }: SearchDetailsModalProps) {
  const identifier = book ? (metadata?.identifier ?? book.identifier) : null;
  const isbn = extractIsbn(identifier);
  const description = book ? (metadata?.description ?? book.description) : null;

  return (
    <Dialog open={book !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        {book && (
          <>
            <DialogHeader>
              <DialogTitle>{book.title}</DialogTitle>
              <DialogDescription>
                by {displayValue(book.author)} · {providerLabel(book.provider)}
              </DialogDescription>
            </DialogHeader>

            {isLoading ? (
              <p className="text-xs text-muted-foreground">Fetching metadata from Google Books and OpenLibrary...</p>
            ) : error ? (
              <p className="flex items-center gap-2 text-xs text-destructive">
                {error}
                <button type="button" className="text-primary hover:underline" onClick={() => onRetry(book)}>
                  Retry
                </button>
              </p>
            ) : null}

            <div>
              <Row label="Format" value={displayValue(book.extension).toUpperCase()} />
              <Row label="Language" value={displayValue(book.language)} />
              <Row label="Year" value={displayValue(book.year)} />
              <Row label="Pages" value={displayValue(metadata?.pages ?? book.pages)} />
              <Row label="Filesize" value={formatFileSize(book.filesize)} />
              <Row label="Publisher" value={displayValue(metadata?.publisher)} />
              <Row label="Series" value={displayValue(metadata?.series ?? book.series)} />
              <Row label="Series Index" value={displayValue(metadata?.seriesIndex ?? book.seriesIndex)} />
              <Row label="Volume" value={displayValue(metadata?.volume ?? book.volume)} />
              <Row label="Edition" value={displayValue(metadata?.edition)} />
              <Row label="ISBN" value={displayValue(isbn)} copy={isbn ? () => onCopy(isbn, "ISBN") : undefined} />
              <Row label="Identifier" value={displayValue(identifier)} copy={identifier ? () => onCopy(identifier, "Identifier") : undefined} />
              <Row label="Google Books" value={displayValue(metadata?.googleBooksId)} href={toGoogleBooksUrl(metadata?.googleBooksId)} />
              <Row label="OpenLibrary" value={displayValue(metadata?.openLibraryKey)} href={toOpenLibraryUrl(metadata?.openLibraryKey)} />
              <Row
                label="ASIN"
                value={displayValue(metadata?.amazonAsin)}
                copy={metadata?.amazonAsin ? () => onCopy(metadata.amazonAsin as string, "ASIN") : undefined}
              />
              <Row
                label="External Rating"
                value={
                  typeof metadata?.externalRating === "number"
                    ? `${metadata.externalRating}${typeof metadata.externalRatingCount === "number" ? ` (${metadata.externalRatingCount} ratings)` : ""}`
                    : "Not available"
                }
              />
            </div>

            {description && (
              <div>
                <h4 className="mb-1 text-sm font-medium">Description</h4>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{description}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {book.capabilities.filesAvailable ? (
                <>
                  <Button onClick={() => onDownload(book)}>Download</Button>
                  <Button variant="outline" onClick={() => onAddToLibrary(book)}>
                    Add to Library
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">This provider currently exposes metadata only.</span>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
