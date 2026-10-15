import { BookOpen, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { clampProgress, getBookStatus } from "@/lib/library/view";
import type { LibraryBook, LibraryVisualMode } from "@/lib/library/types";

interface LibraryBookItemProps {
  book: LibraryBook;
  mode: LibraryVisualMode;
}

function BookCover({ book, className, showFormat = true }: { book: LibraryBook; className?: string; showFormat?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden rounded-md border border-border bg-muted", className)}>
      {book.cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- portadas gestionadas servidas por /api con cookie de sesión
        <img src={book.cover} alt={book.title} loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-muted-foreground">
          <BookOpen className="size-6" aria-hidden="true" />
          {showFormat && <span className="line-clamp-3 text-xs">{book.title}</span>}
        </div>
      )}
      {showFormat && book.extension && (
        <span className="absolute left-1.5 top-1.5 rounded bg-background/90 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase text-foreground">
          {book.extension}
        </span>
      )}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}

function Rating({ rating }: { rating: number | null }) {
  if (typeof rating !== "number" || rating <= 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
      <Star className="size-3 fill-current" aria-hidden="true" />
      {Math.round(rating)}
    </span>
  );
}

const STATUS_LABEL = { unread: "Unread", reading: "Reading", read: "Read" } as const;

export function LibraryBookItem({ book, mode }: LibraryBookItemProps) {
  const percent = clampProgress(book.progressPercent);
  const status = getBookStatus(book);

  if (mode === "list") {
    return (
      <li className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
        <BookCover book={book} className="h-16 w-11 shrink-0" showFormat={false} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-sm font-medium text-foreground">{book.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[book.author, book.series ? `${book.series}${book.series_index ? ` #${book.series_index}` : ""}` : null]
              .filter(Boolean)
              .join(" · ") || "Unknown author"}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <div className="w-28 max-w-[40%]">
              <ProgressBar percent={percent} />
            </div>
            <span className="text-xs text-muted-foreground">{status === "reading" ? `${Math.round(percent)}%` : STATUS_LABEL[status]}</span>
            <Rating rating={book.rating} />
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2">
      <BookCover book={book} className="aspect-[2/3] w-full" />
      <div className="flex flex-col gap-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground" title={book.title}>
          {book.title}
        </p>
        {book.author && <p className="truncate text-xs text-muted-foreground">{book.author}</p>}
        <ProgressBar percent={percent} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{status === "reading" ? `${Math.round(percent)}%` : STATUS_LABEL[status]}</span>
          <Rating rating={book.rating} />
        </div>
      </div>
    </li>
  );
}
