import { getBookProgressHistoryUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isFinite(bookId)) {
    return errorResponse("Invalid book id", 400);
  }

  try {
    const result = await getBookProgressHistoryUseCase.execute({ bookId });
    if (!result.ok) {
      logger.warn(
        { event: "library.progress_history.use_case_failed", bookId, statusCode: result.error.status, reason: result.error.message },
        "Fetch progress history rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "library.progress_history.failed", error: toLogError(cause), bookId }, "Failed to fetch progress history");
    return errorResponse("Failed to fetch progress history", 500);
  }
}
