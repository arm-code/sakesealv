import type { BookRepositoryPort } from "@/lib/server/application/ports";
import type { Book } from "@/lib/server/domain/book";
import { drizzleDb } from "@/lib/server/infrastructure/db/client";
import { books } from "@/lib/server/infrastructure/db/schema";
import { bookSelection, bookSelectionWithDownloadState, mapBookRow, mapBookWithDownloadRow } from "./book-repository.helpers";
import { and, desc, eq, isNull } from "drizzle-orm";

export class BookRepository implements BookRepositoryPort {
  async getAll(): Promise<Book[]> {
    const rows = await drizzleDb
      .select(bookSelectionWithDownloadState)
      .from(books)
      .where(isNull(books.deletedAt))
      .orderBy(desc(books.createdAt));

    return rows.map((row) => mapBookWithDownloadRow(row));
  }

  async getById(id: number): Promise<Book | undefined> {
    const [row] = await drizzleDb
      .select(bookSelection)
      .from(books)
      .where(and(eq(books.id, id), isNull(books.deletedAt)))
      .limit(1);
    return row ? mapBookRow(row) : undefined;
  }
}
