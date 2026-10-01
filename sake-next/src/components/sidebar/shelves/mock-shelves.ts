import type { LibraryShelf } from "@/lib/types/library";
import { createEmptyRuleGroup } from "@/lib/types/library";

// Datos de ejemplo para la Fase 2c — reemplazados por shelfStore + /api/shelves en Fase 3.
export const mockShelves: LibraryShelf[] = [
  {
    id: 1,
    name: "Currently Reading",
    icon: "📖",
    sortOrder: 0,
    ruleGroup: {
      id: "root",
      type: "group",
      connector: "AND",
      children: [
        { id: "cond-1", type: "condition", field: "status", operator: "equals", value: "reading" },
      ],
    },
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    name: "Favorites",
    icon: "⭐",
    sortOrder: 1,
    ruleGroup: createEmptyRuleGroup(),
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    name: "Sci-Fi",
    icon: "🚀",
    sortOrder: 2,
    ruleGroup: {
      id: "root",
      type: "group",
      connector: "OR",
      children: [
        { id: "cond-2", type: "condition", field: "series", operator: "contains", value: "Dune" },
        {
          id: "grp-1",
          type: "group",
          connector: "AND",
          children: [
            { id: "cond-3", type: "condition", field: "rating", operator: "gte", value: "4" },
            { id: "cond-4", type: "condition", field: "format", operator: "equals", value: "epub" },
          ],
        },
      ],
    },
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];
