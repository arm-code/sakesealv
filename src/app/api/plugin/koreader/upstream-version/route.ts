import { getKoreaderPluginUpstreamVersionUseCase } from "@/lib/server/application/composition";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function GET() {
  try {
    const result = await getKoreaderPluginUpstreamVersionUseCase.execute();
    if (!result.ok) {
      logger.warn(
        { event: "plugin.upstream_version.use_case_failed", statusCode: result.error.status, reason: result.error.message },
        "Fetch upstream KOReader plugin version rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (err: unknown) {
    logger.error({ event: "plugin.upstream_version.failed", error: toLogError(err) }, "Failed to fetch upstream KOReader plugin version");
    return errorResponse("Failed to fetch upstream plugin version", 500);
  }
}
