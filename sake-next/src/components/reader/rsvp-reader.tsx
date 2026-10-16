"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import type { ReaderTheme } from "@/lib/reader/reader-appearance";
import {
  MAX_RSVP_TEXT_SCALE,
  MAX_RSVP_WPM,
  MIN_RSVP_TEXT_SCALE,
  MIN_RSVP_WPM,
  RSVP_TEXT_SCALE_STEP,
  RSVP_WPM_STEP,
  type RsvpPreferences,
} from "@/lib/reader/rsvp-preferences";
import { splitRsvpWord, type RsvpToken } from "@/lib/reader/rsvp-text";

interface RsvpReaderProps {
  token: RsvpToken | null;
  isPlaying: boolean;
  isCompleted: boolean;
  isLoading: boolean;
  prefs: RsvpPreferences;
  percentFinished: number;
  chapterTitle: string;
  theme: ReaderTheme;
  error: string | null;
  className?: string;
  onTogglePlay: () => void;
  onJumpWords: (delta: number) => void;
  onJumpSentence: (direction: "previous" | "next") => void;
  onPrefsChange: (patch: Partial<RsvpPreferences>) => void;
  onExit: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName));
}

const BUTTON = "rounded-md border border-current/25 px-3 py-1.5 text-sm hover:bg-current/10 disabled:opacity-40";

// Lectura RSVP: una palabra a la vez con la letra focal resaltada; atajos de teclado como en el original.
export function RsvpReader({
  token,
  isPlaying,
  isCompleted,
  isLoading,
  prefs,
  percentFinished,
  chapterTitle,
  theme,
  error,
  className,
  onTogglePlay,
  onJumpWords,
  onJumpSentence,
  onPrefsChange,
  onExit,
}: RsvpReaderProps) {
  const word = token ? splitRsvpWord(token) : null;
  const fontSize = Math.max(48, Math.min(180, Math.round((72 * prefs.textScale) / 100)));

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onExit();
      } else if (event.code === "Space") {
        event.preventDefault();
        onTogglePlay();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        if (event.shiftKey) onJumpSentence(event.key === "ArrowLeft" ? "previous" : "next");
        else onJumpWords(event.key === "ArrowLeft" ? -10 : 10);
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        onPrefsChange({ wpm: prefs.wpm + (event.key === "ArrowUp" ? RSVP_WPM_STEP : -RSVP_WPM_STEP) });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit, onTogglePlay, onJumpSentence, onJumpWords, onPrefsChange, prefs.wpm]);

  return (
    <section aria-label="RSVP reader" className={cn("absolute inset-0 z-30 flex flex-col", className)} data-theme={theme}>
      <div className="flex items-center justify-between px-4 py-2 text-xs opacity-70">
        <span className="truncate">{chapterTitle || "RSVP mode"}</span>
        <span>{Math.round(Math.max(0, Math.min(1, percentFinished)) * 100)}%</span>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4">
        {prefs.showGuideLine && (
          <>
            <span aria-hidden="true" className="absolute inset-x-0 h-px bg-current/25" style={{ top: `calc(50% - ${Math.round(fontSize / 2 + 18)}px)` }} />
            <span aria-hidden="true" className="absolute inset-x-0 h-px bg-current/25" style={{ top: `calc(50% + ${Math.round(fontSize / 2 + 18)}px)` }} />
          </>
        )}
        <span aria-hidden="true" className="absolute left-1/2 w-px bg-current/25" style={{ top: `calc(50% - ${Math.round(fontSize / 2 + 18)}px)`, height: 10 }} />
        <span aria-hidden="true" className="absolute left-1/2 w-px bg-current/25" style={{ top: `calc(50% + ${Math.round(fontSize / 2 + 8)}px)`, height: 10 }} />

        {isLoading ? (
          <p className="text-sm opacity-70">Preparing RSVP…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : isCompleted ? (
          <p className="text-lg">Book complete</p>
        ) : word ? (
          <button
            type="button"
            aria-label={isPlaying ? "Pause RSVP playback" : "Play RSVP playback"}
            onClick={onTogglePlay}
            className="grid w-full max-w-4xl grid-cols-[1fr_auto_1fr] items-baseline whitespace-pre font-serif leading-none"
            style={{ fontSize }}
          >
            <span className="justify-self-end opacity-90">{word.prefix}</span>
            <strong className="text-red-500">{word.focus}</strong>
            <span className="justify-self-start opacity-90">{word.suffix}</span>
          </button>
        ) : (
          <p className="text-sm opacity-70">No readable text in this book section.</p>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-current/15 px-4 py-3">
        <div className="flex flex-wrap items-center justify-center gap-2" aria-label="RSVP navigation">
          <button type="button" className={BUTTON} onClick={() => onJumpSentence("previous")} disabled={!token} title="Previous sentence">
            Sentence −
          </button>
          <button type="button" className={BUTTON} onClick={() => onJumpWords(-10)} disabled={!token} title="Back ten words">
            −10
          </button>
          <button type="button" className={cn(BUTTON, "min-w-20 bg-current/10 font-medium")} onClick={onTogglePlay} disabled={!token || Boolean(error)} aria-pressed={isPlaying}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button type="button" className={BUTTON} onClick={() => onJumpWords(10)} disabled={!token} title="Forward ten words">
            +10
          </button>
          <button type="button" className={BUTTON} onClick={() => onJumpSentence("next")} disabled={!token} title="Next sentence">
            Sentence +
          </button>
          <button type="button" className={BUTTON} onClick={onExit}>
            Page View
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span>
              Speed <strong>{prefs.wpm} WPM</strong>
            </span>
            <input type="range" min={MIN_RSVP_WPM} max={MAX_RSVP_WPM} step={RSVP_WPM_STEP} value={prefs.wpm} onChange={(event) => onPrefsChange({ wpm: Number(event.target.value) })} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span>
              Text size <strong>{prefs.textScale}%</strong>
            </span>
            <input
              type="range"
              min={MIN_RSVP_TEXT_SCALE}
              max={MAX_RSVP_TEXT_SCALE}
              step={RSVP_TEXT_SCALE_STEP}
              value={prefs.textScale}
              onChange={(event) => onPrefsChange({ textScale: Number(event.target.value) })}
              aria-label="RSVP text size"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={prefs.showGuideLine} onChange={(event) => onPrefsChange({ showGuideLine: event.target.checked })} />
            Horizontal guide
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={prefs.autoAnnotateLastWord} onChange={(event) => onPrefsChange({ autoAnnotateLastWord: event.target.checked })} />
            Save last word as note
          </label>
        </div>
        <p className="text-center text-xs opacity-60">Space play/pause · ←/→ ten words · Shift+←/→ sentence · ↑/↓ speed</p>
      </div>
    </section>
  );
}
