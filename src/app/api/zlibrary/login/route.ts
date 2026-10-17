import { zlibraryTokenLoginUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { setZLibraryCookies } from "@/lib/server/auth/cookies";
import { errorResponse } from "@/lib/server/http/api";
import { parseZTokenLoginRequest } from "@/lib/server/http/zlibrary-auth-request";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: ReturnType<typeof parseZTokenLoginRequest>;
  try {
    body = parseZTokenLoginRequest(await request.json());
  } catch (cause) {
    logger.warn({ event: "zlibrary.login.invalid_payload", error: toLogError(cause) }, "Invalid login payload");
    return errorResponse(cause instanceof Error ? cause.message : "Invalid JSON body", 400);
  }

  try {
    const loginResult = await zlibraryTokenLoginUseCase.execute(body);
    if (!loginResult.ok) {
      logger.warn(
        { event: "zlibrary.login.use_case_failed", statusCode: loginResult.error.status, reason: loginResult.error.message },
        "Z-Library login rejected",
      );
      return errorResponse(loginResult.error.message, loginResult.error.status);
    }

    await setZLibraryCookies(request, { userId: loginResult.value.userId, userKey: loginResult.value.userKey });
    return Response.json({ success: true });
  } catch (cause) {
    logger.error({ event: "zlibrary.login.failed", error: toLogError(cause) }, "Z-Library login failed");
    return errorResponse("Z-Library login failed", 500);
  }
}
