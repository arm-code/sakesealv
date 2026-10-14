import { reportDeviceVersionUseCase } from "@/lib/server/application/composition";
import { resolveAuthorizedDeviceId } from "@/lib/server/auth/device-binding";
import { requireActor } from "@/lib/server/auth/require-actor";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function POST(request: Request) {
  const auth = await requireActor(request);
  if ("response" in auth) return auth.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (cause: unknown) {
      logger.warn({ event: "device.version.invalid_json", error: toLogError(cause) }, "Invalid JSON body");
      return errorResponse("Invalid JSON body", 400);
    }

    const payload = (body ?? {}) as { deviceId?: unknown; version?: unknown };
    const suppliedDeviceId = typeof payload.deviceId === "string" ? payload.deviceId : undefined;
    const deviceResult = resolveAuthorizedDeviceId(auth.actor, suppliedDeviceId, { required: true });
    const version = typeof payload.version === "string" ? payload.version : null;

    if (!deviceResult.ok || !version) {
      const message = deviceResult.ok ? "deviceId and version are required" : deviceResult.message;
      const status = deviceResult.ok ? 400 : deviceResult.status;
      logger.warn(
        { event: "device.version.validation_failed", deviceId: suppliedDeviceId, version, statusCode: status, reason: message },
        message,
      );
      return errorResponse(message, status);
    }

    const deviceId = deviceResult.deviceId;
    const result = await reportDeviceVersionUseCase.execute({ userId: auth.actor.user.id, deviceId, version });
    if (!result.ok) {
      logger.warn(
        { event: "device.version.use_case_failed", deviceId, version, statusCode: result.error.status, reason: result.error.message },
        "Report device version rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    logger.info({ event: "device.version.recorded", deviceId, version: result.value.version }, "Device version recorded");
    return Response.json(result.value, { status: 200 });
  } catch (cause: unknown) {
    logger.error({ event: "device.version.failed", error: toLogError(cause) }, "Failed to record device version");
    return errorResponse("Failed to record device version", 500);
  }
}
