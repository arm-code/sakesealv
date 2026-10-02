import { getKoreaderPluginDownloadUseCase } from "@/lib/server/application/composition";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function GET(request: Request) {
  const version = new URL(request.url).searchParams.get("version")?.trim() || undefined;
  try {
    const result = await getKoreaderPluginDownloadUseCase.execute(version);
    if (!result.ok) {
      logger.warn(
        { event: "plugin.download.use_case_failed", version, statusCode: result.error.status, reason: result.error.message },
        "Download KOReader plugin rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    return new Response(new Uint8Array(result.value.data), {
      headers: {
        "Content-Type": result.value.contentType,
        "Content-Length": String(result.value.data.length),
        "Cache-Control": "public, max-age=300",
        "Content-Disposition": `attachment; filename="${result.value.fileName}"`,
        "X-Plugin-Sha256": result.value.sha256,
      },
    });
  } catch (err: unknown) {
    logger.error({ event: "plugin.download.failed", version, error: toLogError(err) }, "Failed to download KOReader plugin");
    return errorResponse("Failed to download plugin", 500);
  }
}
