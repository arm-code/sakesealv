import { updateLibraryBookMetadataUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { parseLibraryMetadataUpdateInput, type LibraryMetadataUpdateInput } from "@/lib/server/http/library-metadata-update";
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
    logger.warn({ event: "library.metadata.update.invalid_json", error: toLogError(cause), bookId }, "Invalid JSON body");
    return errorResponse("Invalid JSON body", 400);
  }

  let metadata: LibraryMetadataUpdateInput;
  try {
    metadata = parseLibraryMetadataUpdateInput(body);
  } catch (cause) {
    logger.warn({ event: "library.metadata.update.validation_failed", error: toLogError(cause), bookId }, "Metadata update validation failed");
    return errorResponse(cause instanceof Error ? cause.message : "Invalid metadata payload", 400);
  }

  try {
    const result = await updateLibraryBookMetadataUseCase.execute({ bookId, metadata });
    if (!result.ok) {
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "library.metadata.update.failed", error: toLogError(cause), bookId }, "Failed to update metadata");
    return errorResponse("Failed to update metadata", 500);
  }
}
