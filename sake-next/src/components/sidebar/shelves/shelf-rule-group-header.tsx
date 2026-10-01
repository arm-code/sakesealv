"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { RuleConnector } from "@/lib/types/library";

interface ShelfRuleGroupHeaderProps {
  connector: RuleConnector;
  conditionCount: number;
  isRoot?: boolean;
  onToggleConnector: () => void;
  onAddCondition: () => void;
  onAddGroup: () => void;
  onRemove?: () => void;
}

export function ShelfRuleGroupHeader({
  connector,
  conditionCount,
  isRoot = false,
  onToggleConnector,
  onAddCondition,
  onAddGroup,
  onRemove,
}: ShelfRuleGroupHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggleConnector}
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
          connector === "AND"
            ? "bg-primary/10 text-primary"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        )}
      >
        {connector}
      </button>
      <span className="text-xs text-muted-foreground">
        {connector === "AND" ? "all must match" : "any can match"}
      </span>
      <div className="flex-1" />
      <span className="text-xs text-muted-foreground">{conditionCount}</span>
      <Button type="button" variant="outline" size="xs" onClick={onAddCondition}>
        + Condition
      </Button>
      <Button type="button" variant="outline" size="xs" onClick={onAddGroup}>
        + Group
      </Button>
      {!isRoot && onRemove && (
        <Button type="button" variant="ghost" size="icon-xs" onClick={onRemove} aria-label="Remove group">
          <X className="size-3" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
