import { loginLocalAccountUseCase } from "@/lib/server/application/composition";
import { setSakeSessionCookie } from "@/lib/server/auth/cookies";
import { buildRateLimitKeyPart, enforceAuthRateLimits } from "@/lib/server/auth/rate-limit";
import { getRequestIp, getRequestUserAgent } from "@/lib/server/auth/request-metadata";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function POST(request: Request) {
  const ipAddress = getRequestIp(request);
  let body: { username?: unknown; password?: unknown };

  try {
    body = (await request.json()) as { username?: unknown; password?: unknown };
  } catch (err: unknown) {
    logger.warn({ event: "auth.login.invalid_json", error: toLogError(err) }, "Invalid login request body");
    return errorResponse("Invalid JSON body", 400);
  }

  const username = typeof body.username === "string" ? body.username : "";
  const rateLimitResponse = enforceAuthRateLimits([
    { policyName: "loginIp", key: buildRateLimitKeyPart(ipAddress, "unknown-ip") },
    { policyName: "loginUsername", key: buildRateLimitKeyPart(username, "missing-username") },
  ]);
  if (rateLimitResponse) {
    logger.warn({ event: "auth.login.rate_limited", ipAddress, username: username.trim() || null }, "Login rate limited");
    return rateLimitResponse;
  }

  try {
    const result = await loginLocalAccountUseCase.execute({
      username,
      password: typeof body.password === "string" ? body.password : "",
      userAgent: getRequestUserAgent(request),
      ipAddress,
    });

    if (!result.ok) {
      logger.warn(
        { event: "auth.login.use_case_failed", statusCode: result.error.status, reason: result.error.message },
        "Login rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    await setSakeSessionCookie(request, result.value.sessionToken, result.value.sessionExpiresAt);

    return Response.json({ success: true, user: result.value.user });
  } catch (err: unknown) {
    logger.error({ event: "auth.login.failed", error: toLogError(err) }, "Login failed");
    return errorResponse("Login failed", 500);
  }
}
