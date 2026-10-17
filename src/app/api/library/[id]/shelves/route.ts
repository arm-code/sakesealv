import { setBookShelvesUseCase } from "@/lib/server/application/composition";
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
  if (!Number.isInteger(bookId) || bookId <= 0) {
    return errorResponse("Invalid book id", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (cause) {
    logger.warn({ event: "library.book.shelves.invalid_json", error: toLogError(cause), bookId }, "Invalid JSON body");
    return errorResponse("Invalid JSON body", 400);
  }

  const shelfIds = (body as { shelfIds?: unknown }).shelfIds;
  if (!Array.isArray(shelfIds)) {
    return errorResponse("shelfIds is required and must be an array", 400);
  }
  if (!shelfIds.every((value) => Number.isInteger(value) && Number(value) > 0)) {
    return errorResponse("shelfIds must contain positive integer IDs only", 400);
  }

  try {
    const result = await setBookShelvesUseCase.execute({ bookId, shelfIds: shelfIds.map((value) => Number(value)) });
    if (!result.ok) {
      logger.warn(
        { event: "library.book.shelves.use_case_failed", bookId, statusCode: result.error.status, reason: result.error.message, shelfIds },
        "Set book shelves rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "library.book.shelves.failed", error: toLogError(cause), bookId, shelfIds }, "Failed to set book shelves");
    return errorResponse("Failed to set book shelves", 500);
  }
}
