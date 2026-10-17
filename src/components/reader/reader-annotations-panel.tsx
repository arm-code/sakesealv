"use client";

import { Bookmark, Highlighter, Trash2 } from "lucide-react";
import type { ReaderAnnotation } from "@/lib/koreader/koreader-sidecar";

interface ReaderAnnotationsPanelProps {
  annotations: ReaderAnnotation[];
  onOpen: (annotation: ReaderAnnotation) => void;
  onDelete: (annotation: ReaderAnnotation) => void;
}

function sortKey(annotation: ReaderAnnotation): string {
  return annotation.datetimeUpdated ?? annotation.datetime;
}

// Lista de subrayados y marcadores del libro (más recientes primero).
export function ReaderAnnotationsPanel({ annotations, onOpen, onDelete }: ReaderAnnotationsPanelProps) {
  if (annotations.length === 0) {
    return <p className="text-sm opacity-70">No highlights or bookmarks yet. Select text to highlight it, or use the bookmark button.</p>;
  }
  const sorted = [...annotations].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((annotation) => (
        <li key={annotation.id} className="rounded-lg border border-current/15 p-2 text-sm">
          <button type="button" onClick={() => onOpen(annotation)} className="flex w-full flex-col gap-1 text-left">
            <span className="flex items-center gap-1.5 text-xs opacity-70">
              {annotation.kind === "highlight" ? (
                <Highlighter className="size-3.5" style={{ color: annotation.color }} aria-hidden="true" />
              ) : (
                <Bookmark className="size-3.5" aria-hidden="true" />
              )}
              <span className="truncate">{annotation.chapter ?? (annotation.kind === "highlight" ? "Highlight" : "Bookmark")}</span>
            </span>
            {annotation.text && <span className="line-clamp-4">{annotation.text}</span>}
            {annotation.note && <span className="line-clamp-3 text-xs italic opacity-80">{annotation.note}</span>}
          </button>
          <div className="mt-1 flex justify-end">
            <button
              type="button"
              onClick={() => onDelete(annotation)}
              aria-label={`Delete ${annotation.kind}`}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs opacity-70 hover:bg-current/10 hover:opacity-100"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
