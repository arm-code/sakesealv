import { getCurrentUserUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const result = await getCurrentUserUseCase.execute({ userId: auth.actor.user.id });
    if (!result.ok) {
      logger.warn(
        { event: "auth.me.use_case_failed", statusCode: result.error.status, reason: result.error.message },
        "Fetch current user rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (err: unknown) {
    logger.error({ event: "auth.me.failed", error: toLogError(err) }, "Failed to fetch current user");
    return errorResponse("Failed to fetch current user", 500);
  }
}
