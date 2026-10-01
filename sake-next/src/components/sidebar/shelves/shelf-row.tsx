"use client";

import { Filter, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LibraryShelf } from "@/lib/types/library";

interface ShelfRowProps {
  shelf: LibraryShelf;
  active?: boolean;
  dragging?: boolean;
  dragOver?: boolean;
  ruleCount?: number;
  menuOpen: boolean;
  menuDisabled?: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
  onSelect: () => void;
  onMenuOpenChange: (open: boolean) => void;
  onRename: () => void;
  onRules: () => void;
  onDelete: () => void;
}

export function ShelfRow({
  shelf,
  active = false,
  dragging = false,
  dragOver = false,
  ruleCount = 0,
  menuOpen,
  menuDisabled = false,
  onPointerDown,
  onSelect,
  onMenuOpenChange,
  onRename,
  onRules,
  onDelete,
}: ShelfRowProps) {
  return (
    <div
      data-shelf-id={shelf.id}
      className={cn(
        "group flex items-center gap-1 rounded-md",
        dragging && "opacity-50",
        dragOver && "bg-sidebar-accent",
      )}
    >
      <button
        type="button"
        onPointerDown={onPointerDown}
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active && "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
      >
        <span className="shrink-0">{shelf.icon}</span>
        <span className="truncate">{shelf.name}</span>
        {ruleCount > 0 && <Filter className="size-2.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
      </button>

      <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              disabled={menuDisabled}
              aria-label={`Open menu for ${shelf.name}`}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover:opacity-100 data-[popup-open]:opacity-100 disabled:pointer-events-none"
            />
          }
        >
          <MoreHorizontal className="size-3.5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={onRename}>
            <Pencil className="size-3.5" aria-hidden="true" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRules}>
            <Filter className="size-3.5" aria-hidden="true" />
            Rules
            {ruleCount > 0 && <span className="ml-auto text-xs text-muted-foreground">{ruleCount}</span>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="size-3.5" aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
