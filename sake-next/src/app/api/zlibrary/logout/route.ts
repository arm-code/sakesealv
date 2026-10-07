import { zlibraryLogoutUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { clearZLibraryCookies } from "@/lib/server/auth/cookies";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const logoutResult = await zlibraryLogoutUseCase.execute();
    if (!logoutResult.ok) {
      logger.warn(
        { event: "zlibrary.logout.use_case_failed", statusCode: logoutResult.error.status, reason: logoutResult.error.message },
        "Logout rejected",
      );
      return errorResponse(logoutResult.error.message, logoutResult.error.status);
    }

    await clearZLibraryCookies();
    return Response.json(logoutResult.value);
  } catch (cause) {
    logger.error({ event: "zlibrary.logout.failed", error: toLogError(cause) }, "Logout failed");
    return errorResponse("Logout failed", 500);
  }
}
