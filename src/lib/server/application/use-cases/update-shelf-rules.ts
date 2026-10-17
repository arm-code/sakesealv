import type { ShelfRepositoryPort } from "@/lib/server/application/ports";
import { apiError, apiOk, type ApiResult } from "@/lib/server/http/api";
import type { LibraryShelf, RuleGroup } from "@/lib/types/library";

interface UpdateShelfRulesInput {
  shelfId: number;
  ruleGroup: RuleGroup;
}

interface UpdateShelfRulesResult {
  success: true;
  shelf: LibraryShelf;
}

export class UpdateShelfRulesUseCase {
  constructor(private readonly shelfRepository: ShelfRepositoryPort) {}

  async execute(input: UpdateShelfRulesInput): Promise<ApiResult<UpdateShelfRulesResult>> {
    const existing = await this.shelfRepository.getById(input.shelfId);
    if (!existing) return apiError("Shelf not found", 404);

    const updated = await this.shelfRepository.update(input.shelfId, {
      name: existing.name,
      icon: existing.icon,
      ruleGroup: input.ruleGroup,
    });

    if (!updated) return apiError("Shelf not found", 404);

    return apiOk({ success: true, shelf: updated });
  }
}
