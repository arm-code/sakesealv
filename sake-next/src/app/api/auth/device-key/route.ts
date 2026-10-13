import { createDeviceApiKeyUseCase } from "@/lib/server/application/composition";
import { SAKE_VERSION_HEADER_NAME } from "@/lib/server/auth/constants";
import { buildRateLimitKeyPart, enforceAuthRateLimits } from "@/lib/server/auth/rate-limit";
import { getRequestIp } from "@/lib/server/auth/request-metadata";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

// Pública (el plugin KOReader se empareja con username+password, no tiene
// sesión ni API key todavía) — igual que isPublicApiRoute en el original.
export async function POST(request: Request) {
  const ipAddress = getRequestIp(request);
  let body: { username?: unknown; password?: unknown; deviceId?: unknown };

  try {
    body = (await request.json()) as typeof body;
  } catch (cause: unknown) {
    logger.warn({ event: "auth.device_key.invalid_json", error: toLogError(cause) }, "Invalid device-key request body");
    return errorResponse("Invalid JSON body", 400);
  }

  const username = typeof body.username === "string" ? body.username : "";
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  const rateLimitResponse = enforceAuthRateLimits([
    { policyName: "deviceKeyIp", key: buildRateLimitKeyPart(ipAddress, "unknown-ip") },
    {
      policyName: "deviceKeyUserDevice",
      key: `${buildRateLimitKeyPart(username, "missing-username")}::${buildRateLimitKeyPart(deviceId, "missing-device")}`,
    },
  ]);
  if (rateLimitResponse) {
    logger.warn(
      { event: "auth.device_key.rate_limited", ipAddress, username: username.trim() || null, deviceId: deviceId.trim() || null },
      "Device key creation rate limited",
    );
    return rateLimitResponse;
  }

  try {
    const result = await createDeviceApiKeyUseCase.execute({
      username,
      password: typeof body.password === "string" ? body.password : "",
      deviceId,
      pluginVersion: request.headers.get(SAKE_VERSION_HEADER_NAME),
    });

    if (!result.ok) {
      logger.warn(
        { event: "auth.device_key.use_case_failed", statusCode: result.error.status, reason: result.error.message },
        "Device key creation rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    return Response.json(result.value, { status: 201 });
  } catch (cause: unknown) {
    logger.error({ event: "auth.device_key.failed", error: toLogError(cause) }, "Failed to create device key");
    return errorResponse("Failed to create device key", 500);
  }
}
