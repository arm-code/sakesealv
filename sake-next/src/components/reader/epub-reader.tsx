"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type Book from "epubjs/types/book";
import type { NavItem } from "epubjs/types/navigation";
import type Rendition from "epubjs/types/rendition";
import type { Location } from "epubjs/types/rendition";
import type Contents from "epubjs/types/contents";
import { ArrowLeft, Bookmark, ChevronLeft, ChevronRight, Highlighter, List, Minus, Plus, Zap } from "lucide-react";
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
import {
  annotationRange,
  chapterFor,
  cfiToKoreaderXPointer,
  displayKoreaderXPointer,
  renditionContents,
  selectionFromCfi,
  xpointerSpineIndex,
  type SelectionDraft,
} from "@/lib/reader/reader-runtime";
import {
  createAnnotationId,
  HIGHLIGHT_COLORS,
  koreaderDateTime,
  type ReaderAnnotation,
  type SidecarSnapshot,
} from "@/lib/koreader/koreader-sidecar";
import { AnnotationsApi } from "@/lib/client/annotations-api";
import { ReaderAnnotationsPanel } from "./reader-annotations-panel";
import { RsvpReader } from "./rsvp-reader";
import { useRsvp } from "./use-rsvp";

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

interface ReaderAnnotationTarget {
  xpointer: string;
}

type ReaderPanel = "contents" | "annotations" | null;

async function loadDeepLinkedAnnotation(bookId: number): Promise<{ annotation: ReaderAnnotationTarget | null; warning: string | null }> {
  const raw = new URLSearchParams(window.location.search).get("annotationId");
  if (raw === null) return { annotation: null, warning: null };
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return { annotation: null, warning: "This annotation link is invalid. Your saved reading position was opened instead." };
  }
  try {
    const item = await AnnotationsApi.get(id);
    if (item.book.id !== bookId) throw new Error("wrong book");
    return { annotation: { xpointer: item.pos0 ?? item.page }, warning: null };
  } catch {
    return { annotation: null, warning: "This annotation is no longer available. Your saved reading position was opened instead." };
  }
}

export function EpubReader({ bookId, fileName, title }: EpubReaderProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const saveQueueRef = useRef<ReaderSaveQueue | null>(null);
  const positionRef = useRef({ percentFinished: 0, lastXPointer: null as string | null });
  const restoringRef = useRef(true);
  const annotationsRef = useRef<ReaderAnnotation[]>([]);
  const renderedRef = useRef(new Map<string, string>());
  const spineCountRef = useRef(1);
  const tocRef = useRef<NavItem[]>([]);
  const bookRef = useRef<Book | null>(null);
  const locationRef = useRef<{ cfi: string | null; spineIndex: number }>({ cfi: null, spineIndex: 0 });

  const [theme, setTheme] = useState<ReaderTheme>("paper");
  const [fontSize, setFontSize] = useState(100);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [panel, setPanel] = useState<ReaderPanel>(null);
  const [annotations, setAnnotationsState] = useState<ReaderAnnotation[]>([]);
  const [selection, setSelection] = useState<SelectionDraft | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [highlightColor, setHighlightColor] = useState<string>("yellow");
  const [notice, setNotice] = useState<string | null>(null);
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

  const setAnnotations = useCallback((next: ReaderAnnotation[]) => {
    annotationsRef.current = next;
    setAnnotationsState(next);
  }, []);

  // Dibuja en la vista actual los subrayados que aún no están pintados.
  const renderVisibleAnnotations = useCallback(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    for (const contents of renditionContents(rendition)) {
      for (const annotation of annotationsRef.current) {
        if (annotation.kind !== "highlight" || renderedRef.current.has(annotation.id)) continue;
        if (xpointerSpineIndex(annotation.page) !== contents.sectionIndex) continue;
        const range = annotationRange(contents, annotation, spineCountRef.current);
        if (!range) continue;
        const cfi = contents.cfiFromRange(range);
        rendition.annotations.highlight(cfi, { annotationId: annotation.id }, undefined, "sake-reader-highlight", {
          fill: annotation.color ?? "yellow",
          "fill-opacity": "0.32",
        });
        renderedRef.current.set(annotation.id, cfi);
      }
    }
  }, []);

  const rsvp = useRsvp({
    bookRef,
    spineCountRef,
    positionRef,
    locationRef,
    saveQueueRef,
    restoringRef,
    annotationsRef,
    setAnnotations,
    onProgress: (nextPercent, chapterTitle) => {
      setPercent(nextPercent);
      if (chapterTitle) setChapter(chapterTitle);
    },
    // Al salir de RSVP, la vista paginada vuelve a la palabra donde quedó la lectura.
    onExit: async (target) => {
      const rendition = renditionRef.current;
      if (!rendition) return;
      const restored = target.xpointer ? await displayKoreaderXPointer(rendition, target.xpointer, spineCountRef.current) : false;
      if (!restored && target.cfi) await rendition.display(target.cfi);
      renderVisibleAnnotations();
    },
  });
  const rsvpActive = rsvp.active;

  useEffect(() => {
    if (!rsvp.active && rsvp.error) setNotice(rsvp.error);
  }, [rsvp.active, rsvp.error]);

  useEffect(() => {
    let cancelled = false;
    const renderedHighlights = renderedRef.current;
    let book: Book | null = null;
    let rendition: Rendition | null = null;
    let saveQueue: ReaderSaveQueue | null = null;

    const handlePageHide = () => void saveQueue?.flush(true);
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") void saveQueue?.flush();
    };

    async function init() {
      try {
        const [contentResponse, sidecar, epubModule, deepLink] = await Promise.all([
          fetch(`/api/library/${bookId}/content`),
          fetchKoreaderSidecar(fileName).catch((): SidecarSnapshot | null => null),
          import("epubjs"),
          loadDeepLinkedAnnotation(bookId),
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
        tocRef.current = navigation.toc;
        bookRef.current = book;
        spineCountRef.current = spineCount;
        setAnnotations(sidecar?.annotations ?? []);
        if (deepLink.warning) setNotice(deepLink.warning);

        positionRef.current = { percentFinished: sidecar?.percentFinished ?? 0, lastXPointer: sidecar?.lastXPointer ?? null };
        setPercent(positionRef.current.percentFinished);

        await book.locations.generate(1200);
        const totalLocations = book.locations.length();
        if (cancelled || !viewportRef.current) return;

        saveQueue = new ReaderSaveQueue(
          fileName,
          createReaderSessionId(),
          () => positionRef.current,
          (snapshot) => {
            // El sidecar fusionado puede traer anotaciones de otros dispositivos.
            setAnnotations(snapshot.annotations);
            renderVisibleAnnotations();
          },
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
          locationRef.current = { cfi: location.start.cfi, spineIndex: location.start.index };
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

        rendition.on("selected", (cfiRange: string, contents: Contents) => {
          const draft = selectionFromCfi(contents, cfiRange, spineCount, chapterFor(activeBook, navigation.toc, contents.sectionIndex));
          setSelection(draft);
          setNoteDraft("");
          setHighlightColor("yellow");
        });
        rendition.on("rendered", renderVisibleAnnotations);

        // Zonas de toque: tercio izquierdo/derecho navegan, el centro no hace nada.
        rendition.on("click", (event: MouseEvent) => {
          const view = event.view as Window | null;
          const width = view?.innerWidth ?? 0;
          if (!width) return;
          const x = event.clientX % width;
          if (x < width * 0.25) {
            restoringRef.current = false;
            void activeRendition.prev();
          } else if (x > width * 0.75) {
            restoringRef.current = false;
            void activeRendition.next();
          }
        });
        rendition.on("keyup", (event: KeyboardEvent) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") restoringRef.current = false;
          if (event.key === "ArrowLeft") void activeRendition.prev();
          if (event.key === "ArrowRight") void activeRendition.next();
        });

        const saved = positionRef.current;
        let restored = false;
        let jumpedToLink = false;
        if (deepLink.annotation) {
          restored = await displayKoreaderXPointer(rendition, deepLink.annotation.xpointer, spineCount);
          jumpedToLink = restored;
          if (!restored) setNotice("The linked position could not be opened; the stored reading position was used.");
        }
        if (!restored && saved.lastXPointer) restored = await displayKoreaderXPointer(rendition, saved.lastXPointer, spineCount);
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
        // Un salto por enlace no sobrescribe la posición guardada hasta que el usuario navegue.
        restoringRef.current = jumpedToLink;

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
      renderedHighlights.clear();
      book?.destroy();
    };
  }, [bookId, fileName, setAnnotations, renderVisibleAnnotations]);

  const goPrev = useCallback(() => {
    restoringRef.current = false;
    void renditionRef.current?.prev();
  }, []);
  const goNext = useCallback(() => {
    restoringRef.current = false;
    void renditionRef.current?.next();
  }, []);

  useEffect(() => {
    if (rsvpActive) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goPrev, goNext, rsvpActive]);

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
    setPanel(null);
    restoringRef.current = false;
    await renditionRef.current?.display(href);
  }

  function saveHighlight() {
    const queue = saveQueueRef.current;
    if (!selection || !queue) return;
    const datetime = koreaderDateTime();
    const base = {
      kind: "highlight" as const,
      ...selection,
      note: noteDraft.trim() || undefined,
      drawer: "lighten",
      color: highlightColor,
      datetime,
      datetimeUpdated: datetime,
    };
    const annotation: ReaderAnnotation = { ...base, id: createAnnotationId(base) };
    setAnnotations([...annotationsRef.current.filter((item) => item.id !== annotation.id), annotation]);
    queue.upsert(annotation);
    setSelection(null);
    renderVisibleAnnotations();
    queue.schedule(0);
  }

  function addBookmark() {
    const queue = saveQueueRef.current;
    const xpointer = positionRef.current.lastXPointer;
    if (!queue) return;
    if (!xpointer) {
      setNotice("Move to a page first to add a bookmark");
      return;
    }
    const datetime = koreaderDateTime();
    const base = {
      kind: "bookmark" as const,
      page: xpointer,
      chapter: bookRef.current ? chapterFor(bookRef.current, tocRef.current, xpointerSpineIndex(xpointer)) : undefined,
      datetime,
      datetimeUpdated: datetime,
    };
    const annotation: ReaderAnnotation = { ...base, id: createAnnotationId(base) };
    setAnnotations([...annotationsRef.current, annotation]);
    queue.upsert(annotation);
    queue.schedule(0);
    setNotice("Bookmark added");
  }

  function deleteAnnotation(annotation: ReaderAnnotation) {
    const queue = saveQueueRef.current;
    const cfi = renderedRef.current.get(annotation.id);
    if (cfi && renditionRef.current) renditionRef.current.annotations.remove(cfi, "highlight");
    renderedRef.current.delete(annotation.id);
    setAnnotations(annotationsRef.current.filter((item) => item.id !== annotation.id));
    queue?.delete(annotation.id);
    queue?.schedule(0);
  }

  async function openAnnotation(annotation: ReaderAnnotation) {
    const rendition = renditionRef.current;
    if (!rendition) return;
    setPanel(null);
    restoringRef.current = false;
    const opened = await displayKoreaderXPointer(rendition, annotation.pos0 ?? annotation.page, spineCountRef.current);
    if (!opened) setNotice("This annotation could not be opened in the web reader; your current position was kept.");
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
          <Button variant="ghost" size="icon" aria-label="RSVP mode" disabled={isLoading || rsvp.isLoading || rsvpActive} onClick={() => void rsvp.enter()} className="text-current">
            <Zap className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Add bookmark" onClick={addBookmark} className="text-current">
            <Bookmark className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Annotations" aria-expanded={panel === "annotations"} onClick={() => setPanel((current) => (current === "annotations" ? null : "annotations"))} className="text-current">
            <Highlighter className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Table of contents" aria-expanded={panel === "contents"} onClick={() => setPanel((current) => (current === "contents" ? null : "contents"))} className="text-current">
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

        {panel && (
          <aside className="absolute inset-y-0 right-0 z-10 w-72 max-w-[85%] overflow-y-auto border-l border-current/15 bg-inherit p-3 shadow-xl" aria-label={panel === "contents" ? "Table of contents" : "Annotations"}>
            {panel === "contents" ? (
              flatToc.length === 0 ? (
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
              )
            ) : (
              <ReaderAnnotationsPanel annotations={annotations} onOpen={(annotation) => void openAnnotation(annotation)} onDelete={deleteAnnotation} />
            )}
          </aside>
        )}

        {selection && (
          <div role="dialog" aria-label="Save highlight" className="absolute inset-x-3 bottom-3 z-20 mx-auto flex max-w-md flex-col gap-2 rounded-xl border border-current/20 bg-inherit p-3 shadow-xl">
            <p className="line-clamp-4 text-sm">{selection.text}</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Highlight color">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  aria-pressed={highlightColor === color}
                  onClick={() => setHighlightColor(color)}
                  className={cn("size-5 rounded-full border border-current/30", highlightColor === color && "ring-2 ring-current ring-offset-1")}
                  style={{ background: color }}
                />
              ))}
            </div>
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              rows={2}
              maxLength={20000}
              placeholder="Add a note (optional)"
              aria-label="Note"
              className="rounded-lg border border-current/20 bg-transparent p-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="text-current" onClick={() => setSelection(null)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-current"
                onClick={() => {
                  const start = selection.pos0;
                  setSelection(null);
                  void rsvp.enter({ xpointer: start, spineIndex: xpointerSpineIndex(start) });
                }}
              >
                Start RSVP here
              </Button>
              <Button size="sm" onClick={saveHighlight}>
                Highlight
              </Button>
            </div>
          </div>
        )}

        {rsvpActive && (
          <RsvpReader
            className={THEME_STYLES[theme]}
            token={rsvp.token}
            isPlaying={rsvp.isPlaying}
            isCompleted={rsvp.isCompleted}
            isLoading={rsvp.isLoading}
            prefs={rsvp.prefs}
            percentFinished={percent}
            chapterTitle={rsvp.chapterTitle}
            theme={theme}
            error={rsvp.error}
            onTogglePlay={() => void rsvp.toggle()}
            onJumpWords={(delta) => void rsvp.jumpWords(delta)}
            onJumpSentence={(direction) => void rsvp.jumpSentence(direction)}
            onPrefsChange={rsvp.updatePrefs}
            onExit={() => void rsvp.exit()}
          />
        )}

        {notice && (
          <div role="status" className="absolute left-1/2 top-3 z-20 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-lg border border-current/20 bg-inherit px-3 py-1.5 text-xs shadow-lg">
            <span>{notice}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100">
              ×
            </button>
          </div>
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
