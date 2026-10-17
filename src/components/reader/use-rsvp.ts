"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type Book from "epubjs/types/book";
import { createAnnotationId, koreaderDateTime, type ReaderAnnotation } from "@/lib/koreader/koreader-sidecar";
import type { ReaderSaveQueue } from "@/lib/reader/reader-save-queue";
import { RsvpEpubSession } from "@/lib/reader/rsvp-epub";
import { RsvpPlaybackController } from "@/lib/reader/rsvp-playback";
import {
  clampRsvpTextScale,
  clampRsvpWpm,
  DEFAULT_RSVP_AUTO_ANNOTATE_LAST_WORD,
  DEFAULT_RSVP_SHOW_GUIDE_LINE,
  DEFAULT_RSVP_TEXT_SCALE,
  DEFAULT_RSVP_WPM,
  loadRsvpPreferences,
  saveRsvpPreferences,
  type RsvpPreferences,
} from "@/lib/reader/rsvp-preferences";
import type { RsvpToken } from "@/lib/reader/rsvp-text";

const CHECKPOINT_MS = 10_000;

export interface RsvpExitTarget {
  xpointer: string | null;
  cfi: string | null;
}

interface UseRsvpOptions {
  bookRef: MutableRefObject<Book | null>;
  spineCountRef: MutableRefObject<number>;
  positionRef: MutableRefObject<{ percentFinished: number; lastXPointer: string | null }>;
  locationRef: MutableRefObject<{ cfi: string | null; spineIndex: number }>;
  saveQueueRef: MutableRefObject<ReaderSaveQueue | null>;
  restoringRef: MutableRefObject<boolean>;
  annotationsRef: MutableRefObject<ReaderAnnotation[]>;
  setAnnotations: (next: ReaderAnnotation[]) => void;
  onProgress: (percent: number, chapterTitle: string) => void;
  onExit: (target: RsvpExitTarget) => Promise<void>;
}

const DEFAULT_PREFS: RsvpPreferences = {
  wpm: DEFAULT_RSVP_WPM,
  textScale: DEFAULT_RSVP_TEXT_SCALE,
  showGuideLine: DEFAULT_RSVP_SHOW_GUIDE_LINE,
  autoAnnotateLastWord: DEFAULT_RSVP_AUTO_ANNOTATE_LAST_WORD,
};

// Orquesta el modo RSVP sobre el lector: sesión EPUB, reproducción, posición/guardado y anotación de última palabra.
export function useRsvp(options: UseRsvpOptions) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const [active, setActive] = useState(false);
  const [token, setToken] = useState<RsvpToken | null>(null);
  const [chapterTitle, setChapterTitle] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefsState] = useState<RsvpPreferences>(DEFAULT_PREFS);

  const activeRef = useRef(false);
  const prefsRef = useRef(DEFAULT_PREFS);
  const tokenRef = useRef<RsvpToken | null>(null);
  const sessionRef = useRef<RsvpEpubSession | null>(null);
  const playbackRef = useRef<RsvpPlaybackController | null>(null);
  const checkpointRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAnnotationKeyRef = useRef<string | null>(null);

  // Preferencias guardadas (solo cliente).
  useEffect(() => {
    try {
      const stored = loadRsvpPreferences(localStorage);
      prefsRef.current = stored;
      setPrefsState(stored);
    } catch {
      // Solo conveniencia.
    }
  }, []);

  const stopCheckpoint = useCallback(() => {
    if (checkpointRef.current) clearInterval(checkpointRef.current);
    checkpointRef.current = null;
  }, []);

  const handleToken = useCallback((next: RsvpToken) => {
    const { positionRef, locationRef, onProgress } = optionsRef.current;
    const percent = Math.max(0, Math.min(1, next.percentFinished));
    tokenRef.current = next;
    positionRef.current = { percentFinished: percent, lastXPointer: next.startXPointer };
    locationRef.current = { cfi: next.startCfi, spineIndex: next.sectionIndex };
    const title = sessionRef.current?.currentChapterTitle ?? "";
    setToken(next);
    setChapterTitle(title);
    setIsCompleted(false);
    setError(null);
    onProgress(percent, title);
  }, []);

  const createSession = useCallback((): { session: RsvpEpubSession; playback: RsvpPlaybackController } | null => {
    const { bookRef, spineCountRef, saveQueueRef, restoringRef, positionRef, onProgress } = optionsRef.current;
    const book = bookRef.current;
    if (!book) return null;
    const session = new RsvpEpubSession({
      book,
      spineCount: spineCountRef.current,
      language: document.documentElement.lang || navigator.language,
    });
    const playback = new RsvpPlaybackController(
      { moveWords: (delta) => session.moveWords(delta), moveSentence: (direction) => session.moveSentence(direction) },
      {
        onToken: handleToken,
        onPlayingChange: (playing) => {
          setIsPlaying(playing);
          if (playing) {
            if (positionRef.current.lastXPointer) restoringRef.current = false;
            stopCheckpoint();
            checkpointRef.current = setInterval(() => void saveQueueRef.current?.flush(), CHECKPOINT_MS);
          } else {
            stopCheckpoint();
            void saveQueueRef.current?.flush();
          }
        },
        onCompleted: () => {
          setIsCompleted(true);
          positionRef.current = { ...positionRef.current, percentFinished: 1 };
          onProgress(1, sessionRef.current?.currentChapterTitle ?? "");
          restoringRef.current = false;
          stopCheckpoint();
          void saveQueueRef.current?.flush();
        },
        onError: (cause) => {
          setError(cause instanceof Error ? cause.message : "RSVP playback failed");
          setIsPlaying(false);
          stopCheckpoint();
          void saveQueueRef.current?.flush();
        },
      },
      undefined,
      prefsRef.current.wpm,
    );
    sessionRef.current = session;
    playbackRef.current = playback;
    return { session, playback };
  }, [handleToken, stopCheckpoint]);

  const enter = useCallback(
    async (explicit?: { xpointer: string; spineIndex: number }) => {
      if (activeRef.current || isLoading || !optionsRef.current.bookRef.current) return;
      const created = sessionRef.current && playbackRef.current ? { session: sessionRef.current, playback: playbackRef.current } : createSession();
      if (!created) return;
      const { positionRef, locationRef, saveQueueRef } = optionsRef.current;
      setError(null);
      setIsLoading(true);
      try {
        const first = await created.session.seek({
          xpointer: explicit?.xpointer ?? positionRef.current.lastXPointer,
          cfi: explicit ? null : locationRef.current.cfi,
          percentFinished: positionRef.current.percentFinished,
          spineIndex: explicit?.spineIndex ?? locationRef.current.spineIndex,
        });
        if (!first) throw new Error("No readable text was found for RSVP mode");
        activeRef.current = true;
        setActive(true);
        setIsCompleted(false);
        created.playback.setToken(first);
        await saveQueueRef.current?.flush();
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : "Failed to prepare RSVP mode");
      } finally {
        setIsLoading(false);
      }
    },
    [createSession, isLoading],
  );

  // Con el ajuste activo, la última palabra leída queda como subrayado con nota.
  const annotateLastWord = useCallback(() => {
    const current = tokenRef.current;
    const { positionRef, saveQueueRef, annotationsRef, setAnnotations } = optionsRef.current;
    if (!activeRef.current || !prefsRef.current.autoAnnotateLastWord || !current) return;
    const page = current.startXPointer || positionRef.current.lastXPointer;
    const queue = saveQueueRef.current;
    if (!page || !queue) return;
    const key = `${page}\u001f${current.text}`;
    if (lastAnnotationKeyRef.current === key) return;

    const datetime = koreaderDateTime();
    const base = {
      kind: "highlight" as const,
      page,
      pos0: page,
      pos1: current.endXPointer,
      text: current.text,
      note: `RSVP last word: ${current.text}`,
      chapter: sessionRef.current?.currentChapterTitle || undefined,
      drawer: "lighten",
      color: "yellow",
      datetime,
      datetimeUpdated: datetime,
    };
    const annotation: ReaderAnnotation = { ...base, id: createAnnotationId(base) };
    setAnnotations([...annotationsRef.current.filter((item) => item.id !== annotation.id), annotation]);
    queue.upsert(annotation);
    lastAnnotationKeyRef.current = key;
  }, []);

  const exit = useCallback(async () => {
    if (!activeRef.current) return;
    const current = tokenRef.current;
    const target: RsvpExitTarget = {
      xpointer: current?.startXPointer ?? optionsRef.current.positionRef.current.lastXPointer,
      cfi: current?.startCfi ?? optionsRef.current.locationRef.current.cfi,
    };
    annotateLastWord();
    playbackRef.current?.pause();
    await optionsRef.current.saveQueueRef.current?.flush();
    activeRef.current = false;
    setActive(false);
    setError(null);
    await optionsRef.current.onExit(target);
  }, [annotateLastWord]);

  const toggle = useCallback(async () => {
    const playback = playbackRef.current;
    const session = sessionRef.current;
    if (!playback || error) return;
    if (isCompleted && session) {
      const first = await session.seek({ xpointer: null, cfi: null, percentFinished: 0, spineIndex: 0 });
      if (first) {
        setIsCompleted(false);
        playback.setToken(first);
      }
    }
    if (playback.isPlaying) playback.pause();
    else playback.play();
  }, [error, isCompleted]);

  const jumpWords = useCallback(async (delta: number) => {
    setIsCompleted(false);
    await playbackRef.current?.moveWords(delta);
  }, []);

  const jumpSentence = useCallback(async (direction: "previous" | "next") => {
    setIsCompleted(false);
    await playbackRef.current?.moveSentence(direction);
  }, []);

  const updatePrefs = useCallback((patch: Partial<RsvpPreferences>) => {
    const next: RsvpPreferences = {
      ...prefsRef.current,
      ...patch,
      wpm: clampRsvpWpm(patch.wpm ?? prefsRef.current.wpm),
      textScale: clampRsvpTextScale(patch.textScale ?? prefsRef.current.textScale),
    };
    prefsRef.current = next;
    setPrefsState(next);
    try {
      saveRsvpPreferences(localStorage, next);
    } catch {
      // Solo conveniencia.
    }
    if (patch.wpm !== undefined) playbackRef.current?.setWpm(next.wpm);
  }, []);

  useEffect(() => {
    return () => {
      annotateLastWord();
      stopCheckpoint();
      playbackRef.current?.destroy();
      playbackRef.current = null;
      sessionRef.current = null;
    };
  }, [annotateLastWord, stopCheckpoint]);

  return { active, token, chapterTitle, isPlaying, isLoading, isCompleted, error, prefs, enter, exit, toggle, jumpWords, jumpSentence, updatePrefs };
}
