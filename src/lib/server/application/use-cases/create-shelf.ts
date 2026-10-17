import type { ShelfRepositoryPort } from "@/lib/server/application/ports";
import { apiError, apiOk, type ApiResult } from "@/lib/server/http/api";
import { createEmptyRuleGroup } from "@/lib/types/library";
import type { LibraryShelf } from "@/lib/types/library";

interface CreateShelfInput {
  name: string;
  icon?: string;
}

interface CreateShelfResult {
  success: true;
  shelf: LibraryShelf;
}

function normalizeShelfIcon(icon?: string): string {
  const trimmed = (icon ?? "").trim();
  return trimmed.length > 0 ? trimmed : "📚";
}

export class CreateShelfUseCase {
  constructor(private readonly shelfRepository: ShelfRepositoryPort) {}

  async execute(input: CreateShelfInput): Promise<ApiResult<CreateShelfResult>> {
    const name = input.name.trim();
    if (!name) return apiError("Shelf name is required", 400);
    if (name.length > 80) return apiError("Shelf name is too long", 400);

    const shelf = await this.shelfRepository.create({
      name,
      icon: normalizeShelfIcon(input.icon),
      ruleGroup: createEmptyRuleGroup(),
    });

    return apiOk({ success: true, shelf });
  }
}
