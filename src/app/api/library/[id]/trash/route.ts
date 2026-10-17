import { deleteTrashedLibraryBookUseCase, moveLibraryBookToTrashUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isFinite(bookId)) {
    return errorResponse("Invalid book id", 400);
  }

  try {
    const result = await moveLibraryBookToTrashUseCase.execute({ bookId });
    if (!result.ok) {
      logger.warn(
        { event: "library.book.trash.use_case_failed", bookId, statusCode: result.error.status, reason: result.error.message },
        "Move book to trash rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "library.book.trash.failed", error: toLogError(cause), bookId }, "Failed to move book to trash");
    return errorResponse("Failed to move book to trash", 500);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isFinite(bookId)) {
    return errorResponse("Invalid book id", 400);
  }

  try {
    const result = await deleteTrashedLibraryBookUseCase.execute({ bookId });
    if (!result.ok) {
      logger.warn(
        { event: "library.book.delete.use_case_failed", bookId, statusCode: result.error.status, reason: result.error.message },
        "Delete trashed book rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "library.book.delete.failed", error: toLogError(cause), bookId }, "Failed to delete trashed book");
    return errorResponse("Failed to delete trashed book", 500);
  }
}
