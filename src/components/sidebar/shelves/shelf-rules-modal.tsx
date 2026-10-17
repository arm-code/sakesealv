"use client";

import { useEffect, useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createEmptyRuleGroup, countRuleConditions, type RuleGroup, type RuleNode } from "@/lib/types/library";
import { createRuleCondition, createRuleGroup } from "@/lib/shelf-rules";
import { ShelfRulesTreeNode } from "./shelf-rules-tree-node";

interface ShelfRulesModalProps {
  open: boolean;
  shelfName: string;
  shelfIcon: string;
  initialRuleGroup: RuleGroup;
  pending?: boolean;
  onClose: () => void;
  onSave: (ruleGroup: RuleGroup) => void;
}

function cleanGroup(group: RuleGroup): RuleGroup {
  return {
    ...group,
    children: group.children
      .map((child) => {
        if (child.type === "condition") {
          return child.value.trim().length > 0 ? child : null;
        }
        const cleaned = cleanGroup(child);
        return cleaned.children.length > 0 ? cleaned : null;
      })
      .filter((child): child is RuleNode => child !== null),
  };
}

export function ShelfRulesModal({
  open,
  shelfName,
  shelfIcon,
  initialRuleGroup,
  pending = false,
  onClose,
  onSave,
}: ShelfRulesModalProps) {
  const [ruleGroup, setRuleGroup] = useState<RuleGroup>(createEmptyRuleGroup());

  useEffect(() => {
    if (open) setRuleGroup(JSON.parse(JSON.stringify(initialRuleGroup)) as RuleGroup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalConditions = countRuleConditions(ruleGroup);

  function addRootCondition(): void {
    setRuleGroup((prev) => ({ ...prev, children: [...prev.children, createRuleCondition()] }));
  }

  function addRootGroup(): void {
    setRuleGroup((prev) => ({
      ...prev,
      children: [...prev.children, createRuleGroup(prev.connector === "AND" ? "OR" : "AND")],
    }));
  }

  function handleSave(): void {
    if (pending) return;
    onSave(cleanGroup(ruleGroup));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border px-5 py-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Filter className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Shelf Rules</DialogTitle>
            <p className="truncate text-sm text-muted-foreground">
              {shelfIcon} {shelfName}
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-4 text-sm text-muted-foreground">
            Build a rule tree to automatically include books on this shelf. Nested groups are
            supported. Manually assigned books always appear regardless of rules.
          </p>

          {ruleGroup.children.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center">
              <div>
                <p className="text-sm font-medium text-foreground">No rules defined</p>
                <p className="text-sm text-muted-foreground">
                  Add conditions or groups to automatically include matching books.
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addRootCondition}>
                  Add Condition
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addRootGroup}>
                  Add Group
                </Button>
              </div>
            </div>
          ) : (
            <ShelfRulesTreeNode group={ruleGroup} isRoot onChange={setRuleGroup} />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <p className="text-sm text-muted-foreground">
            {totalConditions > 0
              ? `${totalConditions} condition${totalConditions === 1 ? "" : "s"}`
              : "Manual assignment only"}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={pending}>
              {pending ? "Saving..." : "Save Rules"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
