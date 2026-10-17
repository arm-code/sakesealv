import { getLibraryBookContentUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isInteger(bookId) || bookId <= 0) {
    return errorResponse("Invalid book id", 400);
  }

  try {
    const result = await getLibraryBookContentUseCase.execute(bookId);
    if (!result.ok) {
      return errorResponse(result.error.message, result.error.status);
    }

    return new Response(result.value.data, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${result.value.fileName.replaceAll('"', "")}"`,
        "Content-Length": result.value.contentLength,
        "Content-Type": "application/epub+zip",
      },
    });
  } catch (cause) {
    logger.error({ event: "library.reader.content.failed", error: toLogError(cause), bookId }, "Failed to fetch EPUB reader content");
    return errorResponse("Failed to fetch book content", 500);
  }
}
