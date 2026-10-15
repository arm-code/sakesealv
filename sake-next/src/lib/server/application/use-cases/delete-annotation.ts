import type { AnnotationMutationService } from "@/lib/server/application/services/annotation-mutation-service";

export class DeleteAnnotationUseCase {
  constructor(private readonly mutationService: AnnotationMutationService) {}

  execute(id: number, expectedVersion: string) {
    return this.mutationService.delete({ id, expectedVersion });
  }
}
