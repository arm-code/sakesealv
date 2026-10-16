import { applyAuthResponseSignals } from "@/lib/client/apply-auth-response-signals";
import { request } from "@/lib/client/api-client";
import type { QueueSearchBookRequest, SearchBooksRequest, SearchBooksResponse, SearchResultBook } from "@/lib/types/search";

export interface SearchBookMetadata {
  googleBooksId: string | null;
  openLibraryKey: string | null;
  amazonAsin: string | null;
  cover: string | null;
  description: string | null;
  publisher: string | null;
  series: string | null;
  volume: string | null;
  seriesIndex: number | null;
  edition: string | null;
  identifier: string | null;
  pages: number | null;
  externalRating: number | null;
  externalRatingCount: number | null;
}

export interface QueueSearchBookResponse {
  taskId: string | null;
  message: string;
  queueStatus: { pending: number; processing: number };
}

const JSON_POST = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

// Cuerpo común de las rutas de Z-Library (descarga y cola).
function zlibraryBody(book: SearchResultBook, ref: string, downloadToDevice: boolean) {
  return {
    bookId: book.providerBookId,
    hash: ref,
    title: book.title,
    upload: true,
    extension: book.extension ?? "epub",
    author: book.author ?? undefined,
    series: book.series ?? undefined,
    volume: book.volume ?? undefined,
    seriesIndex: book.seriesIndex ?? undefined,
    identifier: book.identifier ?? undefined,
    pages: book.pages ?? undefined,
    description: book.description ?? undefined,
    cover: book.cover ?? undefined,
    filesize: book.filesize ?? undefined,
    language: book.language ?? undefined,
    year: book.year ?? undefined,
    downloadToDevice,
  };
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export const SearchApi = {
  search: (body: SearchBooksRequest) => request<SearchBooksResponse>("/api/search", JSON_POST(body)),

  lookupMetadata: (body: { title: string; author?: string | null; identifier?: string | null; language?: string | null }) =>
    request<{ success: true; metadata: SearchBookMetadata }>("/api/zlibrary/search/metadata", JSON_POST(body)),

  // Descarga directa: el servidor importa a la biblioteca y devuelve el archivo, que se guarda en el navegador.
  async download(book: SearchResultBook): Promise<void> {
    if (!book.downloadRef) throw new Error("Selected provider does not expose a downloadable file");
    const response =
      book.provider === "zlibrary"
        ? await fetch("/api/zlibrary/download", {
            ...JSON_POST(zlibraryBody(book, book.downloadRef, true)),
            headers: { "Content-Type": "application/json" },
          })
        : await fetch("/api/search/download", {
            ...JSON_POST({ provider: book.provider, downloadRef: book.downloadRef, title: book.title, extension: book.extension ?? null }),
            headers: { "Content-Type": "application/json" },
          });
    if (!response.ok) {
      applyAuthResponseSignals(response);
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Download failed");
    }
    triggerBrowserDownload(await response.blob(), `${book.title}.${(book.extension ?? "epub").toLowerCase()}`);
  },

  queueToLibrary(book: SearchResultBook): Promise<QueueSearchBookResponse> {
    if (book.provider === "zlibrary") {
      if (!book.queueRef) throw new Error("Missing queue reference for selected book");
      return request<QueueSearchBookResponse>("/api/zlibrary/queue", JSON_POST(zlibraryBody(book, book.queueRef, false)));
    }
    if (!book.downloadRef) throw new Error("Selected provider does not expose a downloadable file");
    const body: QueueSearchBookRequest = {
      provider: book.provider,
      providerBookId: book.providerBookId,
      downloadRef: book.downloadRef,
      title: book.title,
      extension: book.extension ?? null,
      author: book.author ?? null,
      series: book.series ?? null,
      volume: book.volume ?? null,
      seriesIndex: book.seriesIndex ?? null,
      identifier: book.identifier ?? null,
      pages: book.pages ?? null,
      description: book.description ?? null,
      cover: book.cover ?? null,
      filesize: book.filesize ?? null,
      language: book.language ?? null,
      year: book.year ?? null,
    };
    return request<QueueSearchBookResponse>("/api/search/queue", JSON_POST(body));
  },
};
