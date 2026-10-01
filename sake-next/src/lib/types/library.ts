export const RULE_FIELDS = [
  "title",
  "author",
  "series",
  "format",
  "language",
  "status",
  "seriesIndex",
  "rating",
  "readingProgress",
  "year",
  "pages",
] as const;

export const RULE_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "gt",
  "lt",
  "gte",
  "lte",
] as const;

export const RULE_CONNECTORS = ["AND", "OR"] as const;

export type RuleField = (typeof RULE_FIELDS)[number];
export type RuleOperator = (typeof RULE_OPERATORS)[number];
export type RuleConnector = (typeof RULE_CONNECTORS)[number];

export const RULE_FIELD_OPTIONS: readonly {
  value: RuleField;
  label: string;
  type: "string" | "number";
}[] = [
  { value: "title", label: "Title", type: "string" },
  { value: "author", label: "Author", type: "string" },
  { value: "series", label: "Series", type: "string" },
  { value: "format", label: "Format", type: "string" },
  { value: "language", label: "Language", type: "string" },
  { value: "status", label: "Status", type: "string" },
  { value: "seriesIndex", label: "Series Index", type: "number" },
  { value: "rating", label: "Rating", type: "number" },
  { value: "readingProgress", label: "Progress", type: "number" },
  { value: "year", label: "Year", type: "number" },
  { value: "pages", label: "Pages", type: "number" },
];

export interface ShelfCondition {
  id: string;
  type: "condition";
  field: RuleField;
  operator: RuleOperator;
  value: string;
}

export interface RuleGroup {
  id: string;
  type: "group";
  connector: RuleConnector;
  children: RuleNode[];
}

export type RuleNode = ShelfCondition | RuleGroup;

export function createEmptyRuleGroup(id = "root", connector: RuleConnector = "AND"): RuleGroup {
  return { id, type: "group", connector, children: [] };
}

export function countRuleConditions(node: RuleNode): number {
  if (node.type === "condition") return 1;
  return node.children.reduce((sum, child) => sum + countRuleConditions(child), 0);
}

export interface LibraryShelf {
  id: number;
  name: string;
  icon: string;
  sortOrder: number;
  ruleGroup: RuleGroup;
  createdAt: string;
  updatedAt: string;
}
