"use client";

import { Archive, CheckCheck, FolderMinus, FolderPlus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LibraryShelf } from "@/lib/types/library";

interface LibraryBulkBarProps {
  count: number;
  visibleCount: number;
  shelves: LibraryShelf[];
  isWorking: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onExit: () => void;
  onAddToShelf: (shelfId: number) => void;
  onRemoveFromShelf: (shelfId: number) => void;
  onMarkRead: (isRead: boolean) => void;
  onArchive: () => void;
  onTrash: () => void;
}

const SELECT_CLASS =
  "h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ShelfPicker({
  label,
  icon,
  shelves,
  disabled,
  onPick,
}: {
  label: string;
  icon: React.ReactNode;
  shelves: LibraryShelf[];
  disabled: boolean;
  onPick: (shelfId: number) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      {icon}
      <select
        aria-label={label}
        value=""
        disabled={disabled || shelves.length === 0}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (Number.isInteger(value) && value > 0) onPick(value);
        }}
        className={SELECT_CLASS}
      >
        <option value="">{label}</option>
        {shelves.map((shelf) => (
          <option key={shelf.id} value={shelf.id}>
            {shelf.icon} {shelf.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LibraryBulkBar({
  count,
  visibleCount,
  shelves,
  isWorking,
  onSelectAll,
  onClear,
  onExit,
  onAddToShelf,
  onRemoveFromShelf,
  onMarkRead,
  onArchive,
  onTrash,
}: LibraryBulkBarProps) {
  const disabled = isWorking || count === 0;
  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur"
    >
      <span className="mr-1 text-sm font-medium text-foreground">{count} selected</span>
      <Button variant="ghost" size="sm" disabled={isWorking || count === visibleCount} onClick={onSelectAll}>
        Select all
      </Button>
      <Button variant="ghost" size="sm" disabled={isWorking || count === 0} onClick={onClear}>
        Clear
      </Button>
      <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
      <ShelfPicker label="Add to shelf" icon={<FolderPlus className="size-4" aria-hidden="true" />} shelves={shelves} disabled={disabled} onPick={onAddToShelf} />
      <ShelfPicker label="Remove from shelf" icon={<FolderMinus className="size-4" aria-hidden="true" />} shelves={shelves} disabled={disabled} onPick={onRemoveFromShelf} />
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onMarkRead(true)}>
        <CheckCheck className="size-4" aria-hidden="true" />
        Mark read
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onMarkRead(false)}>
        Mark unread
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={onArchive}>
        <Archive className="size-4" aria-hidden="true" />
        Archive
      </Button>
      <Button variant="destructive" size="sm" disabled={disabled} onClick={onTrash}>
        <Trash2 className="size-4" aria-hidden="true" />
        Trash
      </Button>
      <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Exit selection mode" onClick={onExit}>
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
