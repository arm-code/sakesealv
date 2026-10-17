import type { BookRepositoryPort } from "@/lib/server/application/ports";
import type { Book } from "@/lib/server/domain/book";
import { apiOk, type ApiResult } from "@/lib/server/http/api";

interface TrashBookWithProgress extends Book {
  progressPercent: number | null;
}

interface ListLibraryTrashResult {
  success: true;
  books: TrashBookWithProgress[];
}

export class ListLibraryTrashUseCase {
  constructor(private readonly bookRepository: BookRepositoryPort) {}

  async execute(): Promise<ApiResult<ListLibraryTrashResult>> {
    const books = await this.bookRepository.getTrashed();
    const withProgress = books.map((book) => ({
      ...book,
      progressPercent: typeof book.progress_percent === "number" ? Math.max(0, Math.min(100, book.progress_percent * 100)) : null,
    }));

    return apiOk({ success: true, books: withProgress });
  }
}
