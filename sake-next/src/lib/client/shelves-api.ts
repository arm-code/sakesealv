import type { LibraryShelf, RuleGroup } from "@/lib/types/library";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data;
}

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
