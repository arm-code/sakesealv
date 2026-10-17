"use client";

import { useRef } from "react";
import { ArrowDown, ArrowUp, CheckSquare, LayoutGrid, List, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  LIBRARY_SORT_FIELD_OPTIONS,
  LIBRARY_STATUS_OPTIONS,
  type LibrarySortDirection,
  type LibrarySortField,
  type LibrarySortPreference,
  type LibraryStatusFilter,
  type LibraryVisualMode,
} from "@/lib/library/types";

interface LibraryToolbarProps {
  search: string;
  status: LibraryStatusFilter;
  sort: LibrarySortPreference;
  mode: LibraryVisualMode;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: LibraryStatusFilter) => void;
  onSortFieldChange: (value: LibrarySortField) => void;
  onSortDirectionChange: (value: LibrarySortDirection) => void;
  onModeChange: (value: LibraryVisualMode) => void;
  selectionMode: boolean;
  isUploading: boolean;
  onToggleSelection: () => void;
  onFilesChosen: (files: File[]) => void;
}

const SELECT_CLASS =
  "h-9 rounded-md border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ToggleButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex size-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
        active && "bg-secondary text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function LibraryToolbar({
  search,
  status,
  sort,
  mode,
  onSearchChange,
  onStatusChange,
  onSortFieldChange,
  onSortDirectionChange,
  onModeChange,
  selectionMode,
  isUploading,
  onToggleSelection,
  onFilesChosen,
}: LibraryToolbarProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <section className="flex flex-col gap-3 xl:flex-row xl:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search your library..."
          aria-label="Search your library"
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".epub,.pdf,.mobi,.azw3,.cbz,.fb2,.txt"
          className="hidden"
          aria-label="Upload books"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) onFilesChosen(files);
          }}
        />
        <Button variant="outline" disabled={isUploading} onClick={() => fileInput.current?.click()}>
          <Upload className="size-4" aria-hidden="true" />
          {isUploading ? "Uploading..." : "Upload"}
        </Button>
        <Button variant={selectionMode ? "secondary" : "outline"} aria-pressed={selectionMode} onClick={onToggleSelection}>
          <CheckSquare className="size-4" aria-hidden="true" />
          Select
        </Button>
        <select
          aria-label="Filter by reading status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as LibraryStatusFilter)}
          className={SELECT_CLASS}
        >
          {LIBRARY_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Sort by"
          value={sort.field}
          onChange={(event) => onSortFieldChange(event.target.value as LibrarySortField)}
          className={SELECT_CLASS}
        >
          {LIBRARY_SORT_FIELD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div role="group" aria-label="Sort direction" className="flex overflow-hidden rounded-md border border-border">
          <ToggleButton active={sort.direction === "asc"} label="Sort ascending" onClick={() => onSortDirectionChange("asc")}>
            <ArrowUp className="size-4" aria-hidden="true" />
          </ToggleButton>
          <ToggleButton active={sort.direction === "desc"} label="Sort descending" onClick={() => onSortDirectionChange("desc")}>
            <ArrowDown className="size-4" aria-hidden="true" />
          </ToggleButton>
        </div>

        <div role="group" aria-label="Display mode" className="flex overflow-hidden rounded-md border border-border">
          <ToggleButton active={mode === "grid"} label="Grid view" onClick={() => onModeChange("grid")}>
            <LayoutGrid className="size-4" aria-hidden="true" />
          </ToggleButton>
          <ToggleButton active={mode === "list"} label="List view" onClick={() => onModeChange("list")}>
            <List className="size-4" aria-hidden="true" />
          </ToggleButton>
        </div>
      </div>
    </section>
  );
}
