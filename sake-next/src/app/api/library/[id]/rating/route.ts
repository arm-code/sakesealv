import { updateBookRatingUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isFinite(bookId)) {
    return errorResponse("Invalid book id", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (cause) {
    logger.warn({ event: "library.book.rating.invalid_json", error: toLogError(cause) }, "Invalid JSON body");
    return errorResponse("Invalid JSON body", 400);
  }

  const rating = (body as { rating?: unknown }).rating;
  if (!(rating === null || typeof rating === "number")) {
    logger.warn({ event: "library.book.rating.validation_failed", bookId, rating }, "Missing or invalid rating value");
    return errorResponse("rating must be null or a number", 400);
  }

  try {
    const result = await updateBookRatingUseCase.execute({ bookId, rating });
    if (!result.ok) {
      logger.warn(
        { event: "library.book.rating.use_case_failed", bookId, rating, statusCode: result.error.status, reason: result.error.message },
        "Update book rating rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "library.book.rating.failed", error: toLogError(cause), bookId, rating }, "Failed to update book rating");
    return errorResponse("Failed to update book rating", 500);
  }
}
