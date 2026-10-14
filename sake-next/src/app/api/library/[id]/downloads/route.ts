import { resetDownloadStatusUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const bookId = Number(id);
  if (!id || !Number.isFinite(bookId)) {
    logger.warn({ event: "library.download.reset.validation_failed", rawId: id }, "Invalid book id");
    return errorResponse("Invalid book id", 400);
  }

  try {
    const result = await resetDownloadStatusUseCase.execute(bookId);
    if (!result.ok) {
      logger.warn(
        { event: "library.download.reset.use_case_failed", bookId, statusCode: result.error.status, reason: result.error.message },
        "Reset download status rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause: unknown) {
    logger.error({ event: "library.download.reset.failed", error: toLogError(cause), bookId }, "Failed to reset download status");
    return errorResponse("Failed to reset download status", 500);
  }
}
