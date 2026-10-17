import { listLibraryUseCase, listShelvesUseCase } from "@/lib/server/application/composition";
import { requireBasicAuth } from "@/lib/server/auth/basic-auth";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";
import { renderAcquisitionFeed, renderNavigationFeed } from "./feed-builder";

import type { Book as DomainBook } from "@/lib/server/domain/book";

type Book = DomainBook & { shelfIds: number[] };

type Entry = { title: string; id: string; url: string; description?: string };

const FEED_CONTENT_TYPE = "application/atom+xml;charset=utf-8";

// Error de dominio que el handler traduce a la respuesta JSON de error.
export class OpdsHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Auth Basic ("OPDS Catalog") + manejo de error común a todos los feeds.
export async function handleOpdsFeed(request: Request, eventName: string, build: () => Promise<string>): Promise<Response> {
  const authResponse = await requireBasicAuth(request, "OPDS Catalog");
  if (authResponse) return authResponse;

  try {
    return new Response(await build(), { headers: { "Content-Type": FEED_CONTENT_TYPE } });
  } catch (cause: unknown) {
    if (cause instanceof OpdsHttpError) {
      return errorResponse(cause.message, cause.status);
    }
    logger.error({ event: eventName, error: toLogError(cause) }, "Failed to generate OPDS feed");
    return errorResponse("Internal Server Error", 500);
  }
}

export async function loadBooks(): Promise<Book[]> {
  const result = await listLibraryUseCase.execute();
  if (!result.ok) throw new OpdsHttpError(result.error.message, result.error.status);
  return result.value.books;
}

export async function loadShelves() {
  const result = await listShelvesUseCase.execute();
  if (!result.ok) throw new OpdsHttpError(result.error.message, result.error.status);
  return result.value.shelves;
}

export const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);

// Feed de navegación con un valor distinto por libro (autores, series, ...).
export async function distinctValuesFeed(opts: {
  title: string;
  feedId: string;
  selfUrl: string;
  entryIdPrefix: string;
  pick: (book: Book) => string | null | undefined;
  entryTitle?: (value: string) => string;
}): Promise<string> {
  const values = new Set<string>();
  for (const book of await loadBooks()) {
    const value = opts.pick(book);
    if (value) values.add(value);
  }
  const entries: Entry[] = [...values].sort().map((value) => ({
    title: opts.entryTitle ? opts.entryTitle(value) : value,
    id: `${opts.entryIdPrefix}${encodeURIComponent(value)}`,
    url: encodeURIComponent(value),
  }));
  return renderNavigationFeed(opts.title, opts.feedId, entries, opts.selfUrl);
}

// Feed de adquisición con los libros que cumplen un filtro.
export async function booksFeed(opts: {
  title: string;
  feedId: string;
  selfUrl: string;
  filter?: (book: Book) => boolean;
  sort?: (a: Book, b: Book) => number;
}): Promise<string> {
  let books = await loadBooks();
  if (opts.filter) books = books.filter(opts.filter);
  if (opts.sort) books = [...books].sort(opts.sort);
  return renderAcquisitionFeed(opts.title, opts.feedId, books, opts.selfUrl);
}
