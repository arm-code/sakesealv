import { cookies } from "next/headers";
import { logoutLocalAccountUseCase } from "@/lib/server/application/composition";
import { clearSakeSessionCookie } from "@/lib/server/auth/cookies";
import { SAKE_SESSION_COOKIE_NAME } from "@/lib/server/auth/constants";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function POST() {
  const sessionToken = (await cookies()).get(SAKE_SESSION_COOKIE_NAME)?.value ?? null;

  try {
    const result = await logoutLocalAccountUseCase.execute({ sessionToken });

    if (!result.ok) {
      logger.warn(
        { event: "auth.logout.use_case_failed", statusCode: result.error.status, reason: result.error.message },
        "Logout rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    await clearSakeSessionCookie();

    return Response.json({ success: true });
  } catch (err: unknown) {
    logger.error({ event: "auth.logout.failed", error: toLogError(err) }, "Logout failed");
    return errorResponse("Logout failed", 500);
  }
}
