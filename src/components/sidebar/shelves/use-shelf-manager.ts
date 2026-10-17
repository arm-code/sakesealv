"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { countRuleConditions, type LibraryShelf, type RuleGroup } from "@/lib/types/library";
import { ShelvesApi } from "@/lib/client/shelves-api";
import { errorMessage } from "@/lib/client/api-client";

export const SHELF_EMOJI_OPTIONS = [
  "📚", "⭐", "🚀", "📌", "🔥", "💎", "🎯", "📖", "🌙", "🎨", "💡", "🏆", "❤️", "🌊", "⚡", "🦋",
];

const SHELF_REORDER_LONG_PRESS_MS = 360;
const SHELF_DRAG_CANCEL_DISTANCE_PX = 8;

interface UseShelfManagerOptions {
  selectedShelfId: number | null;
  onSelectedShelfRemoved: () => void;
}

// Fase 3a: el CRUD y el reorder pegan contra /api/library/shelves de verdad
// (ver src/app/api/library/shelves/). El reorder sigue siendo optimista
// durante el drag (igual que en 2c) pero ahora persiste al soltar, con
// revert local si la llamada falla.
export function useShelfManager({ selectedShelfId, onSelectedShelfRemoved }: UseShelfManagerOptions) {
  const [shelves, setShelves] = useState<LibraryShelf[]>([]);
  const [shelvesExpanded, setShelvesExpanded] = useState(true);

  const [showCreateShelf, setShowCreateShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState("");
  const [newShelfIcon, setNewShelfIcon] = useState("📚");
  const [showCreateEmojiPicker, setShowCreateEmojiPicker] = useState(false);
  const [isMutatingShelves, setIsMutatingShelves] = useState(false);

  const [editingShelfId, setEditingShelfId] = useState<number | null>(null);
  const [editShelfName, setEditShelfName] = useState("");
  const [editShelfIcon, setEditShelfIcon] = useState("📚");
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);

  const [menuOpenShelfId, setMenuOpenShelfId] = useState<number | null>(null);
  const [showDeleteShelfModal, setShowDeleteShelfModal] = useState(false);
  const [pendingDeleteShelfId, setPendingDeleteShelfId] = useState<number | null>(null);
  const [isDeletingShelf, setIsDeletingShelf] = useState(false);
  const [rulesModalShelfId, setRulesModalShelfId] = useState<number | null>(null);
  const [isSavingShelfRules, setIsSavingShelfRules] = useState(false);

  const [draggingShelfId, setDraggingShelfId] = useState<number | null>(null);
  const [shelfDragOverId, setShelfDragOverId] = useState<number | null>(null);

  const shelvesRef = useRef(shelves);
  shelvesRef.current = shelves;
  const draggingShelfIdRef = useRef<number | null>(null);
  draggingShelfIdRef.current = draggingShelfId;
  const shelfOrderBeforeDrag = useRef<LibraryShelf[] | null>(null);

  const pressedShelfId = useRef<number | null>(null);
  const pressedPointerId = useRef<number | null>(null);
  const pressedStart = useRef({ x: 0, y: 0 });
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockClickUntil = useRef(0);

  useEffect(() => {
    ShelvesApi.list()
      .then((result) => setShelves(result.shelves))
      .catch((cause: unknown) => {
        toast.error(`Failed to load shelves: ${errorMessage(cause, "unknown error")}`);
      });
  }, []);

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

  async function handleCreateShelf(): Promise<void> {
    const name = newShelfName.trim();
    if (!name || isMutatingShelves) return;

    setIsMutatingShelves(true);
    try {
      const result = await ShelvesApi.create({ name, icon: newShelfIcon });
      setShelves((prev) => [...prev, result.shelf]);
      cancelCreateShelf();
      toast.success(`Shelf "${name}" created`);
    } catch (cause: unknown) {
      toast.error(`Failed to create shelf: ${errorMessage(cause, "unknown error")}`);
    } finally {
      setIsMutatingShelves(false);
    }
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

  async function handleRenameShelf(shelfId: number): Promise<void> {
    const name = editShelfName.trim();
    if (!name || isMutatingShelves) return;

    setIsMutatingShelves(true);
    try {
      const result = await ShelvesApi.update(shelfId, { name, icon: editShelfIcon });
      setShelves((prev) => prev.map((shelf) => (shelf.id === shelfId ? result.shelf : shelf)));
      cancelRenameShelf();
      toast.success(`Shelf renamed to "${name}"`);
    } catch (cause: unknown) {
      toast.error(`Failed to rename shelf: ${errorMessage(cause, "unknown error")}`);
    } finally {
      setIsMutatingShelves(false);
    }
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

  async function confirmDeleteShelf(): Promise<void> {
    const shelf = shelvesRef.current.find((item) => item.id === pendingDeleteShelfId);
    if (!shelf || isDeletingShelf) {
      cancelDeleteShelf();
      return;
    }

    setIsDeletingShelf(true);
    try {
      await ShelvesApi.remove(shelf.id);
      setShelves((prev) => prev.filter((item) => item.id !== shelf.id));
      if (selectedShelfId === shelf.id) {
        onSelectedShelfRemoved();
      }
      cancelDeleteShelf();
      toast.success(`Shelf "${shelf.name}" deleted`);
    } catch (cause: unknown) {
      toast.error(`Failed to delete shelf: ${errorMessage(cause, "unknown error")}`);
    } finally {
      setIsDeletingShelf(false);
    }
  }

  function openRulesModal(shelfId: number): void {
    if (draggingShelfIdRef.current !== null) return;
    setRulesModalShelfId(shelfId);
    closeAllShelfMenus();
  }

  function closeRulesModal(): void {
    if (!isSavingShelfRules) setRulesModalShelfId(null);
  }

  async function handleSaveShelfRules(ruleGroup: RuleGroup): Promise<void> {
    if (rulesModalShelfId === null || isSavingShelfRules) return;

    setIsSavingShelfRules(true);
    try {
      const result = await ShelvesApi.updateRules(rulesModalShelfId, ruleGroup);
      setShelves((prev) => prev.map((shelf) => (shelf.id === result.shelf.id ? result.shelf : shelf)));
      setRulesModalShelfId(null);
      toast.success(`Rules updated for "${result.shelf.name}"`);
    } catch (cause: unknown) {
      toast.error(`Failed to update shelf rules: ${errorMessage(cause, "unknown error")}`);
    } finally {
      setIsSavingShelfRules(false);
    }
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
    shelfOrderBeforeDrag.current = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }

  function startShelfDrag(shelfId: number): void {
    if (draggingShelfIdRef.current !== null) return;
    setDraggingShelfId(shelfId);
    setShelfDragOverId(shelfId);
    shelfOrderBeforeDrag.current = shelvesRef.current;
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

  async function persistShelfReorder(previousShelves: LibraryShelf[]): Promise<void> {
    const shelfIds = shelvesRef.current.map((shelf) => shelf.id);
    try {
      const result = await ShelvesApi.reorder(shelfIds);
      setShelves(result.shelves);
    } catch (cause: unknown) {
      setShelves(previousShelves);
      toast.error(`Failed to reorder shelves: ${errorMessage(cause, "unknown error")}`);
    } finally {
      resetDragState();
    }
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
      const previousShelves = shelfOrderBeforeDrag.current;
      resetPressState();
      if (!wasDragging) return;
      blockClickUntil.current = Date.now() + 500;

      const orderChanged =
        previousShelves !== null &&
        (previousShelves.length !== shelvesRef.current.length ||
          previousShelves.some((shelf, index) => shelf.id !== shelvesRef.current[index]?.id));

      if (!orderChanged || previousShelves === null) {
        resetDragState();
        return;
      }

      void persistShelfReorder(previousShelves);
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
    isMutatingShelves,

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
    isDeletingShelf,
    requestDeleteShelf,
    cancelDeleteShelf,
    confirmDeleteShelf,

    rulesModalShelf,
    isSavingShelfRules,
    openRulesModal,
    closeRulesModal,
    handleSaveShelfRules,

    draggingShelfId,
    shelfDragOverId,
    handleShelfPointerDown,
    shouldIgnoreShelfClick,
  };
}
