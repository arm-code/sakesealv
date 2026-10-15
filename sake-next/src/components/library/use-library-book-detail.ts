"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/client/api-client";
import { LibraryApi, type BookMetadataPatch, type BookStateChange, type ProgressHistoryEntry } from "@/lib/client/library-api";
import type { LibraryBookDetail } from "@/lib/server/application/use-cases/get-library-book-detail";
import type { LibraryBook } from "@/lib/library/types";

interface UseLibraryBookDetailOptions {
  bookId: number | null;
  /** Aplica un cambio local a la fila de la lista sin recargarla entera. */
  onBookPatched: (bookId: number, patch: Partial<LibraryBook>) => void;
  /** El libro salió de la lista (papelera): cierra el modal y lo quita. */
  onBookRemoved: (bookId: number) => void;
}

export function useLibraryBookDetail({ bookId, onBookPatched, onBookRemoved }: UseLibraryBookDetailOptions) {
  const [detail, setDetail] = useState<LibraryBookDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ProgressHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const loadDetail = useCallback(async (id: number) => {
    try {
      setDetail(await LibraryApi.detail(id));
      setError(null);
    } catch (cause: unknown) {
      setError(errorMessage(cause, "Failed to load book details"));
    }
  }, []);

  useEffect(() => {
    if (bookId === null) return;
    let cancelled = false;
    LibraryApi.detail(bookId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause, "Failed to load book details"));
      });
    return () => {
      cancelled = true;
      setDetail(null);
      setError(null);
      setHistory(null);
      setHistoryError(null);
    };
  }, [bookId]);

  const loadHistory = useCallback(async () => {
    if (bookId === null || history !== null) return;
    try {
      setHistory((await LibraryApi.progressHistory(bookId)).history);
    } catch (cause: unknown) {
      setHistoryError(errorMessage(cause, "Failed to load progress history"));
    }
  }, [bookId, history]);

  async function run(name: string, action: () => Promise<void>, failure: string): Promise<boolean> {
    if (pending) return false;
    setPending(name);
    try {
      await action();
      return true;
    } catch (cause: unknown) {
      toast.error(`${failure}: ${errorMessage(cause, "unknown error")}`);
      return false;
    } finally {
      setPending(null);
    }
  }

  async function setRating(rating: number | null) {
    if (bookId === null) return;
    await run("rating", async () => {
      await LibraryApi.setRating(bookId, rating);
      setDetail((current) => (current ? { ...current, rating } : current));
      onBookPatched(bookId, { rating });
    }, "Failed to update rating");
  }

  async function toggleShelf(shelfId: number) {
    if (bookId === null || !detail) return;
    const next = detail.shelfIds.includes(shelfId)
      ? detail.shelfIds.filter((id) => id !== shelfId)
      : [...detail.shelfIds, shelfId];
    await run("shelves", async () => {
      await LibraryApi.setShelves(bookId, next);
      setDetail((current) => (current ? { ...current, shelfIds: next } : current));
      onBookPatched(bookId, { shelfIds: next });
    }, "Failed to update shelves");
  }

  async function changeState(name: string, change: BookStateChange) {
    if (bookId === null) return;
    await run(name, async () => {
      const result = await LibraryApi.setState(bookId, change);
      // El API devuelve el progreso como fracción 0..1; la lista y el detalle usan porcentaje.
      const percent = typeof result.progressPercent === "number" ? Math.max(0, Math.min(100, result.progressPercent * 100)) : null;
      setDetail((current) =>
        current
          ? {
              ...current,
              isRead: result.isRead,
              readAt: result.readAt,
              progressPercent: percent,
              excludeFromNewBooks: result.excludeFromNewBooks,
              isArchived: result.isArchived,
              archivedAt: result.archivedAt,
            }
          : current,
      );
      onBookPatched(bookId, {
        read_at: result.readAt,
        progressPercent: percent,
        progress_percent: result.progressPercent,
        exclude_from_new_books: result.excludeFromNewBooks,
        archived_at: result.archivedAt,
      });
      setHistory(null);
    }, "Failed to update book");
  }

  async function moveToTrash(): Promise<boolean> {
    if (bookId === null) return false;
    return run("trash", async () => {
      await LibraryApi.moveToTrash(bookId);
      toast.success("Moved to trash");
      onBookRemoved(bookId);
    }, "Failed to move to trash");
  }

  async function saveMetadata(patch: BookMetadataPatch): Promise<boolean> {
    if (bookId === null) return false;
    return run("metadata", async () => {
      await LibraryApi.updateMetadata(bookId, patch);
      await loadDetail(bookId);
      onBookPatched(bookId, {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.author !== undefined ? { author: patch.author } : {}),
        ...(patch.series !== undefined ? { series: patch.series } : {}),
        ...(patch.volume !== undefined ? { volume: patch.volume } : {}),
        ...(patch.seriesIndex !== undefined ? { series_index: patch.seriesIndex } : {}),
        ...(patch.language !== undefined ? { language: patch.language } : {}),
        ...(patch.year !== undefined ? { year: patch.year } : {}),
      });
      toast.success("Metadata saved");
    }, "Failed to save metadata");
  }

  async function refetchMetadata() {
    if (bookId === null) return;
    await run("refetch", async () => {
      await LibraryApi.refetchMetadata(bookId);
      await loadDetail(bookId);
      toast.success("Metadata refetched");
    }, "Failed to refetch metadata");
  }

  async function removeDeviceDownload(deviceId: string) {
    if (bookId === null) return;
    await run(`device:${deviceId}`, async () => {
      await LibraryApi.removeDeviceDownload(bookId, deviceId);
      setDetail((current) =>
        current ? { ...current, downloadedDevices: current.downloadedDevices.filter((id) => id !== deviceId) } : current,
      );
    }, "Failed to remove device download");
  }

  async function resetDownloads() {
    if (bookId === null) return;
    await run("reset-downloads", async () => {
      await LibraryApi.resetDownloads(bookId);
      setDetail((current) => (current ? { ...current, downloadedDevices: [] } : current));
    }, "Failed to reset downloads");
  }

  return {
    detail,
    error,
    history,
    historyError,
    pending,
    loadHistory,
    setRating,
    toggleShelf,
    changeState,
    moveToTrash,
    saveMetadata,
    refetchMetadata,
    removeDeviceDownload,
    resetDownloads,
  };
}
