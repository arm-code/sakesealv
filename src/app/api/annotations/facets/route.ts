import { getAnnotationFacetsUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const result = await getAnnotationFacetsUseCase.execute();
    return result.ok ? Response.json(result.value) : errorResponse(result.error.message, result.error.status);
  } catch (cause) {
    logger.error({ event: "annotations.facets.failed", error: toLogError(cause) }, "Failed to fetch annotation facets");
    return errorResponse("Failed to fetch annotation facets", 500);
  }
}
