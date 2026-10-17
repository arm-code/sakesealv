import { appendDeviceLogUseCase } from "@/lib/server/application/composition";
import { resolveAuthorizedDeviceId } from "@/lib/server/auth/device-binding";
import { requireActor } from "@/lib/server/auth/require-actor";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function POST(request: Request) {
  const auth = await requireActor(request);
  if ("response" in auth) return auth.response;

  if (auth.actor.type !== "api_key") {
    return errorResponse("API key authentication required", 403);
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (cause: unknown) {
      logger.warn({ event: "device.logs.invalid_json", error: toLogError(cause) }, "Invalid JSON body");
      return errorResponse("Invalid JSON body", 400);
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      logger.warn(
        { event: "device.logs.invalid_body_shape", bodyType: Array.isArray(body) ? "array" : body === null ? "null" : typeof body },
        "Invalid JSON body",
      );
      return errorResponse("Invalid JSON body", 400);
    }

    const payload = body as Record<string, unknown>;
    const str = (key: string): string | null => (typeof payload[key] === "string" ? (payload[key] as string) : null);
    const suppliedDeviceId = str("deviceId") ?? undefined;
    const deviceResult = resolveAuthorizedDeviceId(auth.actor, suppliedDeviceId, { required: true });
    const timestamp = str("timestamp");
    const level = str("level");
    const message = str("message");
    const source = str("source");

    if (!deviceResult.ok || !timestamp || !level || !message || !source) {
      const reason = deviceResult.ok ? "timestamp, level, message, and source are required" : deviceResult.message;
      const status = deviceResult.ok ? 400 : deviceResult.status;
      logger.warn({ event: "device.logs.validation_failed", deviceId: suppliedDeviceId, statusCode: status, reason }, reason);
      return errorResponse(reason, status);
    }

    const deviceId = deviceResult.deviceId;
    const result = await appendDeviceLogUseCase.execute({
      userId: auth.actor.user.id,
      deviceId,
      timestamp,
      level,
      message,
      source,
    });
    if (!result.ok) {
      logger.warn(
        { event: "device.logs.use_case_failed", deviceId, statusCode: result.error.status, reason: result.error.message },
        "Append device log rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    return new Response(null, { status: 204 });
  } catch (cause: unknown) {
    logger.error({ event: "device.logs.failed", error: toLogError(cause) }, "Failed to append device log");
    return errorResponse("Failed to append device log", 500);
  }
}
