import { getAppVersionUseCase } from "@/lib/server/application/composition";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

// Público (sin requireSession): el original lo expone sin auth para que la
// pantalla de login pueda mostrar la versión antes de que exista sesión.
export async function GET() {
  try {
    const result = await getAppVersionUseCase.execute({
      version: process.env.PUBLIC_WEBAPP_VERSION,
      gitTag: process.env.PUBLIC_WEBAPP_GIT_TAG,
      commitSha: process.env.PUBLIC_WEBAPP_COMMIT_SHA,
      releasedAt: process.env.PUBLIC_WEBAPP_RELEASED_AT,
    });

    if (!result.ok) {
      logger.warn(
        { event: "app.version.fetch.rejected", statusCode: result.error.status, reason: result.error.message },
        "App version request rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "app.version.fetch.failed", error: toLogError(cause) }, "Failed to resolve app version metadata");
    return errorResponse("Failed to resolve app version metadata", 500);
  }
}
