import type { ShelfRepositoryPort } from "@/lib/server/application/ports";
import { apiOk, type ApiResult } from "@/lib/server/http/api";
import type { LibraryShelf } from "@/lib/types/library";

interface ListShelvesResult {
  success: true;
  shelves: LibraryShelf[];
}

export class ListShelvesUseCase {
  constructor(private readonly shelfRepository: ShelfRepositoryPort) {}

  async execute(): Promise<ApiResult<ListShelvesResult>> {
    const shelves = await this.shelfRepository.list();
    return apiOk({ success: true, shelves });
  }
}
