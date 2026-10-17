import { listLibraryRatingsUseCase } from "@/lib/server/application/composition";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

// Pública, sin requireSession() — igual que el original (isPublicApiRoute
// permite GET /api/library/ratings sin sesión).
export async function GET() {
  try {
    const result = await listLibraryRatingsUseCase.execute();
    if (!result.ok) {
      logger.warn({ event: "library.ratings.use_case_failed", statusCode: result.error.status, reason: result.error.message }, "List library ratings rejected");
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "library.ratings.failed", error: toLogError(cause) }, "Failed to fetch library ratings");
    return errorResponse("Failed to fetch library ratings", 500);
  }
}
