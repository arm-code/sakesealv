import { zlibraryPasswordLoginUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { setZLibraryCookies } from "@/lib/server/auth/cookies";
import { errorResponse } from "@/lib/server/http/api";
import { parseZPasswordLoginRequest } from "@/lib/server/http/zlibrary-auth-request";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: ReturnType<typeof parseZPasswordLoginRequest>;
  try {
    body = parseZPasswordLoginRequest(await request.json());
  } catch (cause) {
    logger.warn({ event: "zlibrary.passwordLogin.invalid_payload", error: toLogError(cause) }, "Invalid login payload");
    return errorResponse(cause instanceof Error ? cause.message : "Invalid JSON body", 400);
  }

  try {
    const loginResult = await zlibraryPasswordLoginUseCase.execute(body);
    if (!loginResult.ok) {
      logger.warn(
        {
          event: "zlibrary.passwordLogin.use_case_failed",
          statusCode: loginResult.error.status,
          reason: loginResult.error.message,
        },
        "Password login rejected",
      );
      return errorResponse(loginResult.error.message, loginResult.error.status);
    }

    await setZLibraryCookies(request, {
      userId: String(loginResult.value.user.id),
      userKey: loginResult.value.user.remix_userkey,
    });
    return Response.json(loginResult.value);
  } catch (cause) {
    logger.error({ event: "zlibrary.passwordLogin.failed", error: toLogError(cause) }, "Password login failed");
    return errorResponse("Password login failed", 500);
  }
}
