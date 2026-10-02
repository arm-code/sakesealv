import { getLibraryCoverUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

interface RouteParams {
  params: Promise<{ fileName: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { fileName } = await params;
  if (!fileName) {
    logger.warn({ event: "library.cover.fetch.validation_failed" }, "Missing file name parameter");
    return errorResponse("Missing file name parameter", 400);
  }

  try {
    const result = await getLibraryCoverUseCase.execute(fileName);
    if (!result.ok) {
      logger.warn(
        { event: "library.cover.fetch.use_case_failed", fileName, statusCode: result.error.status, reason: result.error.message },
        "Fetch library cover rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    return new Response(result.value.data, {
      headers: {
        "Cache-Control": result.value.cacheControl,
        "Content-Length": result.value.contentLength,
        "Content-Type": result.value.contentType,
      },
    });
  } catch (cause) {
    logger.error({ event: "library.cover.fetch.failed", error: toLogError(cause), fileName }, "Fetch library cover failed");
    return errorResponse("Cover not found", 404);
  }
}
