import { uploadLibraryBookCoverUseCase } from "@/lib/server/application/composition";
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
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof (file as File).arrayBuffer !== "function") {
      logger.warn({ event: "library.cover.upload.validation_failed", reason: "file missing", bookId }, "Missing file in cover upload form data");
      return errorResponse("Missing file in form data", 400);
    }

    const uploadedFile = file as File;
    const result = await uploadLibraryBookCoverUseCase.execute({
      bookId,
      fileData: await uploadedFile.arrayBuffer(),
      contentType: uploadedFile.type,
    });
    if (!result.ok) {
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "library.cover.upload.failed", error: toLogError(cause), bookId }, "Failed to upload library cover");
    return errorResponse("Failed to upload library cover", 500);
  }
}
