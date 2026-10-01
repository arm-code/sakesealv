"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { countRuleConditions, createEmptyRuleGroup, type LibraryShelf, type RuleGroup } from "@/lib/types/library";
import { mockShelves } from "./mock-shelves";

export const SHELF_EMOJI_OPTIONS = [
  "📚", "⭐", "🚀", "📌", "🔥", "💎", "🎯", "📖", "🌙", "🎨", "💡", "🏆", "❤️", "🌊", "⚡", "🦋",
];

const SHELF_REORDER_LONG_PRESS_MS = 360;
const SHELF_DRAG_CANCEL_DISTANCE_PX = 8;

interface UseShelfManagerOptions {
  selectedShelfId: number | null;
  onSelectedShelfRemoved: () => void;
}

// Fase 2c: CRUD y reorder son 100% locales (sin backend todavía). La Fase 3
// reemplaza el useState de shelves por shelfStore + llamadas a /api/shelves,
// manteniendo esta misma superficie de funciones.
export function useShelfManager({ selectedShelfId, onSelectedShelfRemoved }: UseShelfManagerOptions) {
  const [shelves, setShelves] = useState<LibraryShelf[]>(mockShelves);
  const [shelvesExpanded, setShelvesExpanded] = useState(true);

  const [showCreateShelf, setShowCreateShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState("");
  const [newShelfIcon, setNewShelfIcon] = useState("📚");
  const [showCreateEmojiPicker, setShowCreateEmojiPicker] = useState(false);

  const [editingShelfId, setEditingShelfId] = useState<number | null>(null);
  const [editShelfName, setEditShelfName] = useState("");
  const [editShelfIcon, setEditShelfIcon] = useState("📚");
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);

  const [menuOpenShelfId, setMenuOpenShelfId] = useState<number | null>(null);
  const [showDeleteShelfModal, setShowDeleteShelfModal] = useState(false);
  const [pendingDeleteShelfId, setPendingDeleteShelfId] = useState<number | null>(null);
  const [rulesModalShelfId, setRulesModalShelfId] = useState<number | null>(null);

  const [draggingShelfId, setDraggingShelfId] = useState<number | null>(null);
  const [shelfDragOverId, setShelfDragOverId] = useState<number | null>(null);

  const shelvesRef = useRef(shelves);
  shelvesRef.current = shelves;
  const draggingShelfIdRef = useRef<number | null>(null);
  draggingShelfIdRef.current = draggingShelfId;

  const pressedShelfId = useRef<number | null>(null);
  const pressedPointerId = useRef<number | null>(null);
  const pressedStart = useRef({ x: 0, y: 0 });
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockClickUntil = useRef(0);

  function getShelfRuleCount(shelf: LibraryShelf): number {
    return countRuleConditions(shelf.ruleGroup);
  }

  function closeAllShelfMenus(): void {
    setShowCreateEmojiPicker(false);
    setShowEditEmojiPicker(false);
    setMenuOpenShelfId(null);
  }

  function startCreateShelf(): void {
    if (draggingShelfIdRef.current !== null) return;
    setShowCreateShelf(true);
    setNewShelfName("");
    setNewShelfIcon("📚");
    setShowCreateEmojiPicker(false);
    setEditingShelfId(null);
  }

  function cancelCreateShelf(): void {
    setShowCreateShelf(false);
    setNewShelfName("");
    setShowCreateEmojiPicker(false);
  }

  function handleCreateShelf(): void {
    const name = newShelfName.trim();
    if (!name) return;
    const nextId = shelvesRef.current.reduce((max, shelf) => Math.max(max, shelf.id), 0) + 1;
    const now = new Date().toISOString();
    const shelf: LibraryShelf = {
      id: nextId,
      name,
      icon: newShelfIcon,
      sortOrder: shelvesRef.current.length,
      ruleGroup: createEmptyRuleGroup(),
      createdAt: now,
      updatedAt: now,
    };
    setShelves((prev) => [...prev, shelf]);
    cancelCreateShelf();
    toast.success(`Shelf "${name}" created`);
  }

  function startRenameShelf(shelf: LibraryShelf): void {
    if (draggingShelfIdRef.current !== null) return;
    setEditingShelfId(shelf.id);
    setEditShelfName(shelf.name);
    setEditShelfIcon(shelf.icon);
    setShowEditEmojiPicker(false);
    setMenuOpenShelfId(null);
  }

  function cancelRenameShelf(): void {
    setEditingShelfId(null);
    setEditShelfName("");
    setEditShelfIcon("📚");
    setShowEditEmojiPicker(false);
  }

  function handleRenameShelf(shelfId: number): void {
    const name = editShelfName.trim();
    if (!name) return;
    setShelves((prev) =>
      prev.map((shelf) =>
        shelf.id === shelfId
          ? { ...shelf, name, icon: editShelfIcon, updatedAt: new Date().toISOString() }
          : shelf,
      ),
    );
    cancelRenameShelf();
    toast.success(`Shelf renamed to "${name}"`);
  }

  function requestDeleteShelf(shelf: LibraryShelf): void {
    setPendingDeleteShelfId(shelf.id);
    setShowDeleteShelfModal(true);
    setMenuOpenShelfId(null);
  }

  function cancelDeleteShelf(): void {
    setShowDeleteShelfModal(false);
    setPendingDeleteShelfId(null);
  }

  function confirmDeleteShelf(): void {
    const shelf = shelvesRef.current.find((item) => item.id === pendingDeleteShelfId);
    if (!shelf) {
      cancelDeleteShelf();
      return;
    }
    setShelves((prev) => prev.filter((item) => item.id !== shelf.id));
    if (selectedShelfId === shelf.id) {
      onSelectedShelfRemoved();
    }
    cancelDeleteShelf();
    toast.success(`Shelf "${shelf.name}" deleted`);
  }

  function openRulesModal(shelfId: number): void {
    if (draggingShelfIdRef.current !== null) return;
    setRulesModalShelfId(shelfId);
    closeAllShelfMenus();
  }

  function closeRulesModal(): void {
    setRulesModalShelfId(null);
  }

  function handleSaveShelfRules(ruleGroup: RuleGroup): void {
    if (rulesModalShelfId === null) return;
    setShelves((prev) =>
      prev.map((shelf) =>
        shelf.id === rulesModalShelfId
          ? { ...shelf, ruleGroup, updatedAt: new Date().toISOString() }
          : shelf,
      ),
    );
    const shelf = shelvesRef.current.find((item) => item.id === rulesModalShelfId);
    setRulesModalShelfId(null);
    if (shelf) toast.success(`Rules updated for "${shelf.name}"`);
  }

  function shouldIgnoreShelfClick(): boolean {
    return Date.now() < blockClickUntil.current || draggingShelfIdRef.current !== null;
  }

  function clearPressTimer(): void {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function resetPressState(): void {
    clearPressTimer();
    pressedShelfId.current = null;
    pressedPointerId.current = null;
    pressedStart.current = { x: 0, y: 0 };
  }

  function resetDragState(): void {
    setDraggingShelfId(null);
    setShelfDragOverId(null);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }

  function startShelfDrag(shelfId: number): void {
    if (draggingShelfIdRef.current !== null) return;
    setDraggingShelfId(shelfId);
    setShelfDragOverId(shelfId);
    blockClickUntil.current = Date.now() + 500;
    closeAllShelfMenus();
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  }

  function getShelfIdFromPoint(clientX: number, clientY: number): number | null {
    const target = document.elementFromPoint(clientX, clientY);
    const shelfNode = target?.closest<HTMLElement>("[data-shelf-id]");
    const raw = shelfNode?.dataset.shelfId;
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function reorderShelvesLocally(draggedShelfId: number, targetShelfId: number): void {
    setShelves((prev) => {
      const fromIndex = prev.findIndex((shelf) => shelf.id === draggedShelfId);
      const toIndex = prev.findIndex((shelf) => shelf.id === targetShelfId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
      const next = [...prev];
      const [dragged] = next.splice(fromIndex, 1);
      if (!dragged) return prev;
      next.splice(toIndex, 0, dragged);
      return next;
    });
  }

  function handleShelfPointerDown(event: React.PointerEvent, shelfId: number): void {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (editingShelfId !== null || showCreateShelf) return;
    resetPressState();
    pressedShelfId.current = shelfId;
    pressedPointerId.current = event.pointerId;
    pressedStart.current = { x: event.clientX, y: event.clientY };
    pressTimer.current = setTimeout(() => {
      if (pressedShelfId.current === shelfId && pressedPointerId.current === event.pointerId) {
        startShelfDrag(shelfId);
      }
    }, SHELF_REORDER_LONG_PRESS_MS);
  }

  useEffect(() => {
    function handlePointerMove(event: PointerEvent): void {
      if (pressedPointerId.current === null || event.pointerId !== pressedPointerId.current) return;
      if (draggingShelfIdRef.current === null) {
        const movedX = Math.abs(event.clientX - pressedStart.current.x);
        const movedY = Math.abs(event.clientY - pressedStart.current.y);
        if (movedX > SHELF_DRAG_CANCEL_DISTANCE_PX || movedY > SHELF_DRAG_CANCEL_DISTANCE_PX) {
          resetPressState();
        }
        return;
      }
      event.preventDefault();
      const targetShelfId = getShelfIdFromPoint(event.clientX, event.clientY);
      if (targetShelfId === null) {
        setShelfDragOverId(null);
        return;
      }
      setShelfDragOverId(targetShelfId);
      if (targetShelfId !== draggingShelfIdRef.current) {
        reorderShelvesLocally(draggingShelfIdRef.current, targetShelfId);
      }
    }

    function handlePointerUp(event: PointerEvent): void {
      if (pressedPointerId.current === null || event.pointerId !== pressedPointerId.current) return;
      clearPressTimer();
      const wasDragging = draggingShelfIdRef.current !== null;
      resetPressState();
      if (!wasDragging) return;
      blockClickUntil.current = Date.now() + 500;
      resetDragState();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      resetPressState();
      resetDragState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rulesModalShelf = shelves.find((shelf) => shelf.id === rulesModalShelfId) ?? null;
  const pendingDeleteShelf = shelves.find((shelf) => shelf.id === pendingDeleteShelfId) ?? null;

  return {
    shelves,
    shelvesExpanded,
    setShelvesExpanded,
    emojiOptions: SHELF_EMOJI_OPTIONS,
    getShelfRuleCount,

    showCreateShelf,
    newShelfName,
    setNewShelfName,
    newShelfIcon,
    setNewShelfIcon,
    showCreateEmojiPicker,
    setShowCreateEmojiPicker,
    startCreateShelf,
    cancelCreateShelf,
    handleCreateShelf,

    editingShelfId,
    editShelfName,
    setEditShelfName,
    editShelfIcon,
    setEditShelfIcon,
    showEditEmojiPicker,
    setShowEditEmojiPicker,
    startRenameShelf,
    cancelRenameShelf,
    handleRenameShelf,

    menuOpenShelfId,
    setMenuOpenShelfId,
    closeAllShelfMenus,

    showDeleteShelfModal,
    pendingDeleteShelf,
    requestDeleteShelf,
    cancelDeleteShelf,
    confirmDeleteShelf,

    rulesModalShelf,
    openRulesModal,
    closeRulesModal,
    handleSaveShelfRules,

    draggingShelfId,
    shelfDragOverId,
    handleShelfPointerDown,
    shouldIgnoreShelfClick,
  };
}
