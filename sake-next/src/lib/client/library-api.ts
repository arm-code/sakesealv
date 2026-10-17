import { applyAuthResponseSignals } from "@/lib/client/apply-auth-response-signals";
import { request } from "@/lib/client/api-client";
import type { LibraryBookDetail } from "@/lib/server/application/use-cases/get-library-book-detail";
import type { LibraryBook } from "@/lib/library/types";
import type { Book } from "@/lib/server/domain/book";
import type { MetadataCandidate, MetadataCoverCandidate } from "@/lib/server/application/ports";
import type { ApplyMetadataFieldSelection } from "@/lib/server/application/use-cases/apply-metadata-candidate";

export interface BookStateChange {
  isRead?: boolean;
  excludeFromNewBooks?: boolean;
  archived?: boolean;
}

export interface BookStateResult {
  success: true;
  bookId: number;
  isRead: boolean;
  readAt: string | null;
  progressPercent: number | null;
  excludeFromNewBooks: boolean;
  isArchived: boolean;
  archivedAt: string | null;
}

export interface BookMetadataPatch {
  title?: string;
  author?: string | null;
  publisher?: string | null;
  series?: string | null;
  volume?: string | null;
  seriesIndex?: number | null;
  edition?: string | null;
  identifier?: string | null;
  pages?: number | null;
  description?: string | null;
  language?: string | null;
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

export interface ProgressHistoryEntry {
  progressPercent: number;
  recordedAt: string;
}

function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

export const LibraryApi = {
  list: () => request<{ success: true; books: LibraryBook[] }>("/api/library/list"),

  detail: (id: number) => request<LibraryBookDetail>(`/api/library/${id}/detail`),

  progressHistory: (id: number) =>
    request<{ success: true; bookId: number; history: ProgressHistoryEntry[] }>(`/api/library/${id}/progress-history`),

  setRating: (id: number, rating: number | null) => request<{ success: true }>(`/api/library/${id}/rating`, json("PUT", { rating })),

  setShelves: (id: number, shelfIds: number[]) =>
    request<{ success: true }>(`/api/library/${id}/shelves`, json("PUT", { shelfIds })),

  setState: (id: number, change: BookStateChange) => request<BookStateResult>(`/api/library/${id}/state`, json("PUT", change)),

  moveToTrash: (id: number) => request<{ success: true }>(`/api/library/${id}/trash`, { method: "POST" }),

  listTrash: () => request<{ success: true; books: Array<Book & { progressPercent: number | null }> }>("/api/library/trash"),

  restore: (id: number) => request<{ success: true }>(`/api/library/${id}/restore`, { method: "POST", body: "{}" }),

  deleteTrashed: (id: number) => request<{ success: true }>(`/api/library/${id}/trash`, { method: "DELETE" }),

  updateMetadata: (id: number, patch: BookMetadataPatch) =>
    request<{ success: true }>(`/api/library/${id}/metadata`, json("PUT", patch)),

  refetchMetadata: (id: number) => request<{ success: true }>(`/api/library/${id}/refetch-metadata`, { method: "POST" }),

  searchMetadataCandidates: (bookId: number) =>
    request<{ candidates: MetadataCandidate[]; providerErrors: Array<{ providerId: string; message: string }> }>(
      "/api/metadata/search",
      json("POST", { bookId }),
    ),

  applyMetadataCandidate: (
    id: number,
    body: { candidate: MetadataCandidate; fieldSelections: ApplyMetadataFieldSelection[]; coverChoice?: MetadataCoverCandidate | null },
  ) =>
    request<{
      success: true;
      book: { title: string; author: string | null; series: string | null; seriesIndex: number | null; language: string | null; year: number | null; cover: string | null };
    }>(`/api/library/${id}/metadata/apply`, json("POST", body)),

  uploadCover(id: number, file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<{ success: true; cover: string }>(`/api/library/${id}/cover/upload`, { method: "POST", body: form });
  },

  importCover: (id: number, coverUrl?: string) =>
    request<{ success: true; cover: string }>(`/api/library/${id}/cover/import`, json("POST", coverUrl ? { coverUrl } : {})),

  removeDeviceDownload: (id: number, deviceId: string) =>
    request<{ success: true }>(`/api/library/${id}/downloads/${encodeURIComponent(deviceId)}`, { method: "DELETE" }),

  resetDownloads: (id: number) => request<{ success: true }>(`/api/library/${id}/downloads`, { method: "DELETE" }),

  // Subida manual: el segmento de ruta es el nombre del archivo y el body son los bytes crudos.
  async upload(file: File): Promise<void> {
    const response = await fetch(`/api/library/${encodeURIComponent(file.name)}`, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });
    if (!response.ok) {
      applyAuthResponseSignals(response);
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Upload failed");
    }
  },

  downloadUrl: (fileName: string) => `/api/library/${encodeURIComponent(fileName)}`,
};
