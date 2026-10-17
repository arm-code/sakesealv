import { request } from "@/lib/client/api-client";
import type { LibraryShelf, RuleGroup } from "@/lib/types/library";

export const ShelvesApi = {
  list: () => request<{ success: true; shelves: LibraryShelf[] }>("/api/library/shelves"),

  create: (input: { name: string; icon?: string }) =>
    request<{ success: true; shelf: LibraryShelf }>("/api/library/shelves", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  update: (id: number, input: { name: string; icon?: string }) =>
    request<{ success: true; shelf: LibraryShelf }>(`/api/library/shelves/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  updateRules: (id: number, ruleGroup: RuleGroup) =>
    request<{ success: true; shelf: LibraryShelf }>(`/api/library/shelves/${id}/rules`, {
      method: "PUT",
      body: JSON.stringify({ ruleGroup }),
    }),

  reorder: (shelfIds: number[]) =>
    request<{ success: true; shelves: LibraryShelf[] }>("/api/library/shelves/reorder", {
      method: "PATCH",
      body: JSON.stringify({ shelfIds }),
    }),

  remove: (id: number) =>
    request<{ success: true; shelfId: number }>(`/api/library/shelves/${id}`, { method: "DELETE" }),
};
