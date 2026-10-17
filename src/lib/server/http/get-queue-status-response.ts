import { getQueueStatusUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function getQueueStatusResponse(): Promise<Response> {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const result = await getQueueStatusUseCase.execute();
    if (!result.ok) {
      logger.warn({ event: "queue.status.use_case_failed", statusCode: result.error.status, reason: result.error.message }, "Queue status rejected");
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "queue.status.failed", error: toLogError(cause) }, "Failed to fetch queue status");
    return errorResponse("Failed to fetch queue status", 500);
  }
}
