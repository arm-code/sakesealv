import { getLatestKoreaderPluginUseCase } from "@/lib/server/application/composition";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function GET(request: Request) {
  try {
    const result = await getLatestKoreaderPluginUseCase.execute();
    if (!result.ok) {
      logger.warn(
        { event: "plugin.latest.use_case_failed", statusCode: result.error.status, reason: result.error.message },
        "Fetch KOReader plugin metadata rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    const origin = new URL(request.url).origin;
    return Response.json({
      version: result.value.version,
      fileName: result.value.fileName,
      sha256: result.value.sha256,
      updatedAt: result.value.updatedAt,
      downloadUrl: `${origin}/api/plugin/koreader/download`,
    });
  } catch (err: unknown) {
    logger.error({ event: "plugin.latest.failed", error: toLogError(err) }, "Failed to fetch KOReader plugin metadata");
    return errorResponse("Failed to fetch plugin metadata", 500);
  }
}
