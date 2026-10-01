"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFieldType, getOperatorsForField, getRulePlaceholder } from "@/lib/shelf-rules";
import { RULE_FIELD_OPTIONS, type RuleField, type RuleOperator, type ShelfCondition } from "@/lib/types/library";

interface ShelfRuleConditionRowProps {
  condition: ShelfCondition;
  onChange: (updated: ShelfCondition) => void;
  onRemove: () => void;
}

const selectClassName =
  "h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ShelfRuleConditionRow({ condition, onChange, onRemove }: ShelfRuleConditionRowProps) {
  const fieldType = getFieldType(condition.field);
  const operators = getOperatorsForField(condition.field);

  function handleFieldChange(event: React.ChangeEvent<HTMLSelectElement>): void {
    const nextField = event.target.value as RuleField;
    const nextType = getFieldType(nextField);
    const previousType = getFieldType(condition.field);
    onChange({ ...condition, field: nextField, operator: nextType !== previousType ? "equals" : condition.operator });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        <select value={condition.field} onChange={handleFieldChange} className={selectClassName}>
          {RULE_FIELD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={condition.operator}
          onChange={(event) => onChange({ ...condition, operator: event.target.value as RuleOperator })}
          className={selectClassName}
        >
          {operators.map((operator) => (
            <option key={operator.value} value={operator.value}>
              {operator.label}
            </option>
          ))}
        </select>

        <input
          type={fieldType === "number" ? "number" : "text"}
          value={condition.value}
          placeholder={getRulePlaceholder(condition.field)}
          onChange={(event) => onChange({ ...condition, value: event.target.value })}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove condition">
        <X className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
