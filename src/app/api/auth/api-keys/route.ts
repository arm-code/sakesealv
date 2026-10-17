import { listActiveApiKeysUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const result = await listActiveApiKeysUseCase.execute({ userId: auth.actor.user.id });
    if (!result.ok) {
      logger.warn(
        { event: "auth.api_keys.list.use_case_failed", statusCode: result.error.status, reason: result.error.message },
        "List API keys rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (err: unknown) {
    logger.error({ event: "auth.api_keys.list.failed", error: toLogError(err) }, "Failed to list API keys");
    return errorResponse("Failed to list API keys", 500);
  }
}
