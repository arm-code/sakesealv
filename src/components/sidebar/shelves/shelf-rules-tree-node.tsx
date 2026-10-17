"use client";

import { cn } from "@/lib/utils";
import { countRuleConditions, type RuleGroup, type RuleNode } from "@/lib/types/library";
import { createRuleCondition, createRuleGroup } from "@/lib/shelf-rules";
import { ShelfRuleConditionRow } from "./shelf-rule-condition-row";
import { ShelfRuleGroupHeader } from "./shelf-rule-group-header";

interface ShelfRulesTreeNodeProps {
  group: RuleGroup;
  isRoot?: boolean;
  onChange: (updated: RuleGroup) => void;
  onRemove?: () => void;
}

export function ShelfRulesTreeNode({ group, isRoot = false, onChange, onRemove }: ShelfRulesTreeNodeProps) {
  const conditionCount = countRuleConditions(group);

  function toggleConnector(): void {
    onChange({ ...group, connector: group.connector === "AND" ? "OR" : "AND" });
  }

  function addCondition(): void {
    onChange({ ...group, children: [...group.children, createRuleCondition()] });
  }

  function addSubGroup(): void {
    onChange({ ...group, children: [...group.children, createRuleGroup(group.connector === "AND" ? "OR" : "AND")] });
  }

  function updateChild(childId: string, updater: (node: RuleNode) => RuleNode | null): void {
    const updatedChildren = group.children
      .map((child) => (child.id === childId ? updater(child) : child))
      .filter((child): child is RuleNode => child !== null);
    onChange({ ...group, children: updatedChildren });
  }

  return (
    <div className={cn(!isRoot && "rounded-lg border border-border bg-muted/30 p-3")}>
      <ShelfRuleGroupHeader
        connector={group.connector}
        conditionCount={conditionCount}
        isRoot={isRoot}
        onToggleConnector={toggleConnector}
        onAddCondition={addCondition}
        onAddGroup={addSubGroup}
        onRemove={onRemove}
      />

      {group.children.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Empty group — add a condition or sub-group</p>
      ) : (
        <div className={cn("mt-2.5 flex flex-col gap-2.5", !isRoot && "border-l border-border pl-3")}>
          {group.children.map((child) =>
            child.type === "condition" ? (
              <ShelfRuleConditionRow
                key={child.id}
                condition={child}
                onChange={(updated) => updateChild(child.id, () => updated)}
                onRemove={() => updateChild(child.id, () => null)}
              />
            ) : (
              <ShelfRulesTreeNode
                key={child.id}
                group={child}
                isRoot={false}
                onChange={(updated) => updateChild(child.id, () => updated)}
                onRemove={() => updateChild(child.id, () => null)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
