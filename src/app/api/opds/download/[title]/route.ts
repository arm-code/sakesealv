import { getLibraryFileUseCase } from "@/lib/server/application/composition";
import { requireBasicAuth } from "@/lib/server/auth/basic-auth";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

interface RouteParams {
  params: Promise<{ title: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const authResponse = await requireBasicAuth(request, "OPDS Catalog");
  if (authResponse) return authResponse;

  const { title } = await params;
  if (!title) {
    logger.warn({ event: "opds.file.fetch.validation_failed" }, "Missing title parameter");
    return errorResponse("Missing title parameter", 400);
  }

  try {
    const result = await getLibraryFileUseCase.execute(title);
    if (!result.ok) {
      logger.warn(
        { event: "opds.file.fetch.use_case_failed", title, statusCode: result.error.status, reason: result.error.message },
        "Fetch library file rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    return new Response(result.value.data, {
      headers: { "Content-Type": result.value.contentType, "Content-Length": result.value.contentLength },
    });
  } catch (cause: unknown) {
    logger.error({ event: "opds.file.fetch.failed", error: toLogError(cause), title }, "Fetch library file failed");
    return errorResponse("File not found", 404);
  }
}
