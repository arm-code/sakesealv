import { logoutAllLocalSessionsUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { clearSakeSessionCookie } from "@/lib/server/auth/cookies";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function POST() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const result = await logoutAllLocalSessionsUseCase.execute({ userId: auth.actor.user.id });
    if (!result.ok) {
      logger.warn(
        { event: "auth.logout_all.use_case_failed", statusCode: result.error.status, reason: result.error.message },
        "Log out all sessions rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    await clearSakeSessionCookie();

    return Response.json({ success: true });
  } catch (err: unknown) {
    logger.error({ event: "auth.logout_all.failed", error: toLogError(err) }, "Log out all sessions failed");
    return errorResponse("Log out all sessions failed", 500);
  }
}
