import { request } from "@/lib/client/api-client";
import type { LibraryBook } from "@/lib/library/types";

export const LibraryApi = {
  list: () => request<{ success: true; books: LibraryBook[] }>("/api/library/list"),
};
