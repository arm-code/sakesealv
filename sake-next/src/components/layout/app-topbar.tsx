"use client";

import { Menu } from "lucide-react";

interface AppTopBarProps {
  currentSection: string;
  onToggleMobileSidebar: () => void;
}

export function AppTopBar({ currentSection, onToggleMobileSidebar }: AppTopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 sm:px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          aria-label="Toggle navigation"
          className="inline-flex size-[2.1rem] items-center justify-center rounded-md border border-border bg-secondary text-secondary-foreground hover:text-foreground lg:hidden"
        >
          <Menu className="size-[18px]" strokeWidth={2.5} aria-hidden="true" />
        </button>
        <span className="text-sm capitalize text-muted-foreground">{currentSection}</span>
      </div>
    </header>
  );
}
