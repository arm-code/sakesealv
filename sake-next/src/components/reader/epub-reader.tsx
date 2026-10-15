"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type Book from "epubjs/types/book";
import type { NavItem } from "epubjs/types/navigation";
import type Rendition from "epubjs/types/rendition";
import type { Location } from "epubjs/types/rendition";
import { ArrowLeft, ChevronLeft, ChevronRight, List, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  applyReaderAppearance,
  parseReaderTheme,
  READER_THEMES,
  registerReaderAppearance,
  type ReaderTheme,
} from "@/lib/reader/reader-appearance";
import { fetchKoreaderSidecar } from "@/lib/reader/koreader-sidecar-client";
import { ReaderSaveQueue } from "@/lib/reader/reader-save-queue";
import { createReaderSessionId } from "@/lib/reader/reader-session-id";
import { bookPageFromLocation } from "@/lib/reader/reader-pagination";
import { chapterFor, cfiToKoreaderXPointer, displayKoreaderXPointer } from "@/lib/reader/reader-runtime";
import type { SidecarSnapshot } from "@/lib/koreader/koreader-sidecar";

interface EpubReaderProps {
  bookId: number;
  fileName: string;
  title: string;
}

const THEME_KEY = "readerTheme";
const FONT_SIZE_KEY = "readerFontSize";
const MIN_FONT = 70;
const MAX_FONT = 220;
const FONT_STEP = 10;

const THEME_STYLES: Record<ReaderTheme, string> = {
  paper: "bg-[#fbfaf7] text-[#252422]",
  night: "bg-[#111318] text-[#d8dbe1]",
  sepia: "bg-[#ead8b5] text-[#43311f]",
};

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferencia solo de conveniencia.
  }
}

function flattenToc(items: NavItem[], depth = 0): Array<{ item: NavItem; depth: number }> {
  return items.flatMap((item) => [{ item, depth }, ...flattenToc(item.subitems ?? [], depth + 1)]);
}

export function EpubReader({ bookId, fileName, title }: EpubReaderProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const saveQueueRef = useRef<ReaderSaveQueue | null>(null);
  const positionRef = useRef({ percentFinished: 0, lastXPointer: null as string | null });
  const restoringRef = useRef(true);

  const [theme, setTheme] = useState<ReaderTheme>("paper");
  const [fontSize, setFontSize] = useState(100);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ isSaving: boolean; error: string | null }>({ isSaving: false, error: null });
  const [percent, setPercent] = useState(0);
  const [chapter, setChapter] = useState<string | null>(null);
  const [page, setPage] = useState<{ current: number | null; total: number }>({ current: null, total: 0 });
  const themeRef = useRef(theme);
  const fontRef = useRef(fontSize);

  // Preferencias guardadas (solo cliente).
  useEffect(() => {
    const storedTheme = parseReaderTheme(readStored(THEME_KEY));
    const storedFont = Number.parseInt(readStored(FONT_SIZE_KEY) ?? "100", 10);
    const nextFont = Number.isFinite(storedFont) ? Math.min(MAX_FONT, Math.max(MIN_FONT, storedFont)) : 100;
    themeRef.current = storedTheme;
    fontRef.current = nextFont;
    setTheme(storedTheme);
    setFontSize(nextFont);
  }, []);

  useEffect(() => {
    themeRef.current = theme;
    fontRef.current = fontSize;
    if (renditionRef.current) applyReaderAppearance(renditionRef.current, theme, fontSize);
  }, [theme, fontSize]);

  useEffect(() => {
    let cancelled = false;
    let book: Book | null = null;
    let rendition: Rendition | null = null;
    let saveQueue: ReaderSaveQueue | null = null;

    const handlePageHide = () => void saveQueue?.flush(true);
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") void saveQueue?.flush();
    };

    async function init() {
      try {
        const [contentResponse, sidecar, epubModule] = await Promise.all([
          fetch(`/api/library/${bookId}/content`),
          fetchKoreaderSidecar(fileName).catch((): SidecarSnapshot | null => null),
          import("epubjs"),
        ]);
        if (!contentResponse.ok) throw new Error("Failed to load EPUB content");
        const data = await contentResponse.arrayBuffer();
        if (cancelled) return;

        book = epubModule.default(data.slice(0));
        await book.ready;
        const spine = await book.loaded.spine;
        const spineCount = Math.max(1, (spine as unknown as { length: number }).length);
        const navigation = await book.loaded.navigation;
        if (cancelled) return;
        setToc(navigation.toc);

        positionRef.current = { percentFinished: sidecar?.percentFinished ?? 0, lastXPointer: sidecar?.lastXPointer ?? null };
        setPercent(positionRef.current.percentFinished);

        await book.locations.generate(1200);
        const totalLocations = book.locations.length();
        if (cancelled || !viewportRef.current) return;

        saveQueue = new ReaderSaveQueue(
          fileName,
          createReaderSessionId(),
          () => positionRef.current,
          () => undefined,
          (status) => setSaveStatus(status),
        );
        saveQueueRef.current = saveQueue;

        rendition = book.renderTo(viewportRef.current, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "auto",
          allowScriptedContent: false,
        });
        renditionRef.current = rendition;
        registerReaderAppearance(rendition);
        applyReaderAppearance(rendition, themeRef.current, fontRef.current);

        const activeBook = book;
        const activeRendition = rendition;
        rendition.on("relocated", (location: Location) => {
          const calculated = activeBook.locations.percentageFromCfi(location.start.cfi);
          const nextPercent = Number.isFinite(calculated) ? calculated : Math.max(0, Math.min(1, location.start.percentage ?? 0));
          const xpointer = cfiToKoreaderXPointer(activeRendition, location.start.cfi, spineCount);
          setPercent(nextPercent);
          setChapter(chapterFor(activeBook, navigation.toc, location.start.index) ?? null);
          const fallbackLocation = Math.floor(nextPercent * Math.max(0, totalLocations - 1));
          setPage({
            current: bookPageFromLocation(totalLocations, location.start.location >= 0 ? location.start.location : fallbackLocation),
            total: totalLocations,
          });
          // Durante la restauración inicial no sobrescribimos la posición guardada.
          if (restoringRef.current) return;
          if (xpointer) {
            positionRef.current = { percentFinished: nextPercent, lastXPointer: xpointer };
            saveQueue?.schedule();
          }
        });

        // Zonas de toque: tercio izquierdo/derecho navegan, el centro no hace nada.
        rendition.on("click", (event: MouseEvent) => {
          const view = event.view as Window | null;
          const width = view?.innerWidth ?? 0;
          if (!width) return;
          const x = event.clientX % width;
          if (x < width * 0.25) void activeRendition.prev();
          else if (x > width * 0.75) void activeRendition.next();
        });
        rendition.on("keyup", (event: KeyboardEvent) => {
          if (event.key === "ArrowLeft") void activeRendition.prev();
          if (event.key === "ArrowRight") void activeRendition.next();
        });

        const saved = positionRef.current;
        let restored = false;
        if (saved.lastXPointer) restored = await displayKoreaderXPointer(rendition, saved.lastXPointer, spineCount);
        if (!restored) {
          if (saved.percentFinished > 0) {
            try {
              await rendition.display(book.locations.cfiFromPercentage(saved.percentFinished));
            } catch {
              await rendition.display();
            }
          } else {
            await rendition.display();
          }
        }
        restoringRef.current = false;

        window.addEventListener("pagehide", handlePageHide);
        document.addEventListener("visibilitychange", handleVisibility);
      } catch (cause: unknown) {
        if (!cancelled) setLoadError(cause instanceof Error ? cause.message : "Failed to open this EPUB");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void init();

    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
      saveQueue?.destroy();
      saveQueueRef.current = null;
      rendition?.destroy();
      renditionRef.current = null;
      book?.destroy();
    };
  }, [bookId, fileName]);

  const goPrev = useCallback(() => void renditionRef.current?.prev(), []);
  const goNext = useCallback(() => void renditionRef.current?.next(), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goPrev, goNext]);

  function changeTheme(next: ReaderTheme) {
    setTheme(next);
    writeStored(THEME_KEY, next);
  }

  function changeFont(delta: number) {
    const next = Math.min(MAX_FONT, Math.max(MIN_FONT, fontSize + delta));
    setFontSize(next);
    writeStored(FONT_SIZE_KEY, String(next));
  }

  async function openChapter(href: string) {
    setTocOpen(false);
    restoringRef.current = false;
    await renditionRef.current?.display(href);
  }

  const flatToc = flattenToc(toc);

  return (
    <div className={cn("flex h-dvh flex-col", THEME_STYLES[theme])}>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-current/15 px-3">
        <Link
          href={`/library?book=${bookId}`}
          aria-label="Back to library"
          className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-current/10"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h1>
        <div className="flex items-center gap-1" role="group" aria-label="Appearance">
          {READER_THEMES.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={`${option} theme`}
              aria-pressed={theme === option}
              onClick={() => changeTheme(option)}
              className={cn(
                "size-5 rounded-full border border-current/40",
                option === "paper" && "bg-[#fbfaf7]",
                option === "night" && "bg-[#111318]",
                option === "sepia" && "bg-[#ead8b5]",
                theme === option && "ring-2 ring-current ring-offset-1",
              )}
            />
          ))}
          <Button variant="ghost" size="icon" aria-label="Decrease font size" disabled={fontSize <= MIN_FONT} onClick={() => changeFont(-FONT_STEP)} className="text-current">
            <Minus className="size-4" aria-hidden="true" />
          </Button>
          <span className="w-10 text-center text-xs tabular-nums" aria-live="polite">
            {fontSize}%
          </span>
          <Button variant="ghost" size="icon" aria-label="Increase font size" disabled={fontSize >= MAX_FONT} onClick={() => changeFont(FONT_STEP)} className="text-current">
            <Plus className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Table of contents" aria-expanded={tocOpen} onClick={() => setTocOpen((open) => !open)} className="text-current">
            <List className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <button type="button" aria-label="Previous page" onClick={goPrev} className="hidden w-12 shrink-0 items-center justify-center opacity-50 hover:opacity-100 sm:flex">
          <ChevronLeft className="size-6" aria-hidden="true" />
        </button>

        <div className="relative min-w-0 flex-1">
          <div ref={viewportRef} className="absolute inset-0" aria-label="Book content" />
          {isLoading && !loadError && <p className="absolute inset-0 flex items-center justify-center text-sm opacity-70">Opening book...</p>}
          {loadError && (
            <p role="alert" className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-600">
              {loadError}
            </p>
          )}
        </div>

        <button type="button" aria-label="Next page" onClick={goNext} className="hidden w-12 shrink-0 items-center justify-center opacity-50 hover:opacity-100 sm:flex">
          <ChevronRight className="size-6" aria-hidden="true" />
        </button>

        {tocOpen && (
          <aside className="absolute inset-y-0 right-0 z-10 w-72 max-w-[85%] overflow-y-auto border-l border-current/15 bg-inherit p-3 shadow-xl" aria-label="Table of contents">
            {flatToc.length === 0 ? (
              <p className="text-sm opacity-70">This book has no table of contents.</p>
            ) : (
              <ul className="flex flex-col">
                {flatToc.map(({ item, depth }, index) => (
                  <li key={`${item.href}-${index}`}>
                    <button
                      type="button"
                      onClick={() => void openChapter(item.href)}
                      style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
                      className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-current/10"
                    >
                      {item.label.trim()}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>

      <footer className="shrink-0 border-t border-current/15 px-4 py-2 text-xs">
        <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-current/15">
          <div className="h-full rounded-full bg-current" style={{ width: `${Math.round(percent * 100)}%` }} />
        </div>
        <div className="flex items-center justify-between gap-3 opacity-80">
          <span className="min-w-0 truncate">{chapter ?? ""}</span>
          <span className="shrink-0 tabular-nums">
            {page.current !== null && page.total > 0 ? `${page.current}/${page.total} · ` : ""}
            {Math.round(percent * 100)}%
          </span>
          <span className="shrink-0" role="status">
            {saveStatus.error ? <span className="text-red-600">Not saved</span> : saveStatus.isSaving ? "Saving..." : ""}
          </span>
        </div>
      </footer>
    </div>
  );
}
