import type { ShelfRepositoryPort } from "@/lib/server/application/ports";
import { apiError, apiOk, type ApiResult } from "@/lib/server/http/api";
import type { LibraryShelf } from "@/lib/types/library";

interface UpdateShelfInput {
  shelfId: number;
  name: string;
  icon?: string;
}

interface UpdateShelfResult {
  success: true;
  shelf: LibraryShelf;
}

function normalizeShelfIcon(icon?: string): string {
  const trimmed = (icon ?? "").trim();
  return trimmed.length > 0 ? trimmed : "📚";
}

export class UpdateShelfUseCase {
  constructor(private readonly shelfRepository: ShelfRepositoryPort) {}

  async execute(input: UpdateShelfInput): Promise<ApiResult<UpdateShelfResult>> {
    const name = input.name.trim();
    if (!name) return apiError("Shelf name is required", 400);
    if (name.length > 80) return apiError("Shelf name is too long", 400);

    const existing = await this.shelfRepository.getById(input.shelfId);
    if (!existing) return apiError("Shelf not found", 404);

    const shelf = await this.shelfRepository.update(input.shelfId, {
      name,
      icon: normalizeShelfIcon(input.icon),
      ruleGroup: existing.ruleGroup,
    });

    if (!shelf) return apiError("Shelf not found", 404);

    return apiOk({ success: true, shelf });
  }
}
