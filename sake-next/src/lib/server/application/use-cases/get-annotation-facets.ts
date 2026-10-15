import type { AnnotationRepositoryPort } from "@/lib/server/application/ports";
import { apiOk, type ApiResult } from "@/lib/server/http/api";
import type { AnnotationFacetsResponse } from "@/lib/types/annotation";

export class GetAnnotationFacetsUseCase {
  constructor(private readonly repository: AnnotationRepositoryPort) {}

  async execute(): Promise<ApiResult<AnnotationFacetsResponse>> {
    return apiOk(await this.repository.getFacets());
  }
}
