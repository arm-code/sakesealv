import { listLibraryUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const result = await listLibraryUseCase.execute();
    if (!result.ok) {
      logger.warn(
        { event: "library.list.use_case_failed", statusCode: result.error.status, reason: result.error.message },
        "List library rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "library.list.failed", error: toLogError(cause) }, "Failed to fetch library books");
    return errorResponse("Failed to fetch library books", 500);
  }
}
