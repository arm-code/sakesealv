import { updateLibraryBookStateUseCase } from "@/lib/server/application/composition";
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
    logger.warn({ event: "library.book.state.invalid_json", error: toLogError(cause) }, "Invalid JSON body");
    return errorResponse("Invalid JSON body", 400);
  }

  const isRead = (body as { isRead?: unknown }).isRead;
  const excludeFromNewBooks = (body as { excludeFromNewBooks?: unknown }).excludeFromNewBooks;
  const archived = (body as { archived?: unknown }).archived;

  if (isRead !== undefined && typeof isRead !== "boolean") {
    return errorResponse("isRead must be a boolean", 400);
  }
  if (excludeFromNewBooks !== undefined && typeof excludeFromNewBooks !== "boolean") {
    return errorResponse("excludeFromNewBooks must be a boolean", 400);
  }
  if (archived !== undefined && typeof archived !== "boolean") {
    return errorResponse("archived must be a boolean", 400);
  }

  try {
    const result = await updateLibraryBookStateUseCase.execute({ bookId, isRead, excludeFromNewBooks, archived });
    if (!result.ok) {
      logger.warn(
        { event: "library.book.state.use_case_failed", bookId, statusCode: result.error.status, reason: result.error.message },
        "Update book state rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "library.book.state.failed", error: toLogError(cause), bookId }, "Failed to update book state");
    return errorResponse("Failed to update book state", 500);
  }
}
