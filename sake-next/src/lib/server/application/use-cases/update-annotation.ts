import type { AnnotationMutationService } from "@/lib/server/application/services/annotation-mutation-service";
import type { UpdateAnnotationRequest } from "@/lib/types/annotation";

export class UpdateAnnotationUseCase {
  constructor(private readonly mutationService: AnnotationMutationService) {}

  execute(id: number, request: UpdateAnnotationRequest) {
    return this.mutationService.update({ id, ...request });
  }
}
