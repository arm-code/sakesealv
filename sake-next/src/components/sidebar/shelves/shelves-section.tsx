"use client";

import { Plus } from "lucide-react";
import type { useShelfManager } from "./use-shelf-manager";
import { ShelfRow } from "./shelf-row";
import { ShelfEditRow } from "./shelf-edit-row";

interface ShelvesSectionProps {
  manager: ReturnType<typeof useShelfManager>;
  selectedShelfId: number | null;
  isLibraryActive: boolean;
  onSelectShelf: (shelfId: number) => void;
}

export function ShelvesSection({ manager, selectedShelfId, isLibraryActive, onSelectShelf }: ShelvesSectionProps) {
  return (
    <div className="pl-2">
      <div className="flex items-center justify-between px-2.5 py-1">
        <span className="text-xs font-medium text-sidebar-foreground/50">Shelves</span>
        <button
          type="button"
          onClick={manager.startCreateShelf}
          disabled={manager.draggingShelfId !== null}
          aria-label="Create shelf"
          className="flex size-5 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:pointer-events-none"
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        {manager.shelves.map((shelf) =>
          manager.editingShelfId === shelf.id ? (
            <ShelfEditRow
              key={shelf.id}
              name={manager.editShelfName}
              onNameChange={manager.setEditShelfName}
              icon={manager.editShelfIcon}
              onIconChange={manager.setEditShelfIcon}
              showEmojiPicker={manager.showEditEmojiPicker}
              onShowEmojiPickerChange={manager.setShowEditEmojiPicker}
              emojiOptions={manager.emojiOptions}
              confirmLabel="Save"
              autofocus
              onConfirm={() => manager.handleRenameShelf(shelf.id)}
              onCancel={manager.cancelRenameShelf}
            />
          ) : (
            <ShelfRow
              key={shelf.id}
              shelf={shelf}
              active={isLibraryActive && selectedShelfId === shelf.id}
              dragging={manager.draggingShelfId === shelf.id}
              dragOver={
                manager.draggingShelfId !== null &&
                manager.shelfDragOverId === shelf.id &&
                manager.draggingShelfId !== shelf.id
              }
              ruleCount={manager.getShelfRuleCount(shelf)}
              menuOpen={manager.menuOpenShelfId === shelf.id}
              menuDisabled={manager.draggingShelfId !== null}
              onPointerDown={(event) => manager.handleShelfPointerDown(event, shelf.id)}
              onSelect={() => {
                if (manager.shouldIgnoreShelfClick()) return;
                onSelectShelf(shelf.id);
              }}
              onMenuOpenChange={(isOpen) => manager.setMenuOpenShelfId(isOpen ? shelf.id : null)}
              onRename={() => manager.startRenameShelf(shelf)}
              onRules={() => manager.openRulesModal(shelf.id)}
              onDelete={() => manager.requestDeleteShelf(shelf)}
            />
          ),
        )}

        {manager.showCreateShelf && (
          <ShelfEditRow
            name={manager.newShelfName}
            onNameChange={manager.setNewShelfName}
            icon={manager.newShelfIcon}
            onIconChange={manager.setNewShelfIcon}
            showEmojiPicker={manager.showCreateEmojiPicker}
            onShowEmojiPickerChange={manager.setShowCreateEmojiPicker}
            emojiOptions={manager.emojiOptions}
            confirmLabel="Add"
            placeholder="Shelf name"
            autofocus
            onConfirm={manager.handleCreateShelf}
            onCancel={manager.cancelCreateShelf}
          />
        )}
      </div>
    </div>
  );
}
