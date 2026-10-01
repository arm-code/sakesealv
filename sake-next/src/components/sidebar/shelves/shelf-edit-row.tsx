"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ShelfEditRowProps {
  name: string;
  onNameChange: (name: string) => void;
  icon: string;
  onIconChange: (icon: string) => void;
  showEmojiPicker: boolean;
  onShowEmojiPickerChange: (open: boolean) => void;
  emojiOptions: string[];
  placeholder?: string;
  confirmLabel: string;
  disabled?: boolean;
  autofocus?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ShelfEditRow({
  name,
  onNameChange,
  icon,
  onIconChange,
  showEmojiPicker,
  onShowEmojiPickerChange,
  emojiOptions,
  placeholder = "Shelf name",
  confirmLabel,
  disabled = false,
  autofocus = false,
  onConfirm,
  onCancel,
}: ShelfEditRowProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autofocus) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-1.5 rounded-md px-1 py-1">
      <Popover open={showEmojiPicker} onOpenChange={onShowEmojiPickerChange}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label="Select shelf icon"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-base hover:bg-sidebar-accent"
            />
          }
        >
          {icon}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-1.5">
          <div className="grid grid-cols-8 gap-0.5">
            {emojiOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onIconChange(emoji);
                  onShowEmojiPickerChange(false);
                }}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md text-base hover:bg-accent",
                  icon === emoji && "bg-accent",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Input
        ref={inputRef}
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder={placeholder}
        className="h-7 flex-1 px-2 text-sm"
        onKeyDown={(event) => {
          if (event.key === "Enter") onConfirm();
          if (event.key === "Escape") onCancel();
        }}
      />
      <Button type="button" size="sm" className="h-7 px-2" onClick={onConfirm} disabled={disabled}>
        {confirmLabel}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-7"
        onClick={onCancel}
        aria-label="Cancel"
      >
        <X className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
