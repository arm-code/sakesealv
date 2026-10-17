import { listLibraryTrashUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const result = await listLibraryTrashUseCase.execute();
    if (!result.ok) {
      logger.warn({ event: "library.trash.list.use_case_failed", statusCode: result.error.status, reason: result.error.message }, "List trash rejected");
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "library.trash.list.failed", error: toLogError(cause) }, "Failed to fetch trash books");
    return errorResponse("Failed to fetch trash books", 500);
  }
}
