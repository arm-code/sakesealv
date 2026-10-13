import { confirmProgressDownloadUseCase } from "@/lib/server/application/composition";
import { resolveAuthorizedDeviceId } from "@/lib/server/auth/device-binding";
import { requireActor } from "@/lib/server/auth/require-actor";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function POST(request: Request) {
  const auth = await requireActor(request);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch (cause: unknown) {
    logger.warn({ event: "progress.confirm.invalid_json", error: toLogError(cause) }, "Invalid JSON body");
    return errorResponse("Invalid JSON body", 400);
  }

  const payload = (body ?? {}) as { deviceId?: string; bookId?: unknown };
  const { bookId } = payload;
  const deviceResult = resolveAuthorizedDeviceId(auth.actor, payload.deviceId, { required: true });

  if (!deviceResult.ok || typeof bookId !== "number") {
    const status = deviceResult.ok ? 400 : deviceResult.status;
    const message = deviceResult.ok ? "deviceId and bookId are required" : deviceResult.message;
    logger.warn(
      { event: "progress.confirm.validation_failed", deviceId: payload.deviceId, bookId, statusCode: status, reason: message },
      message,
    );
    return errorResponse(message, status);
  }
  const { deviceId } = deviceResult;

  try {
    const result = await confirmProgressDownloadUseCase.execute({ deviceId, bookId });
    if (!result.ok) {
      logger.warn(
        { event: "progress.confirm.use_case_failed", deviceId, bookId, statusCode: result.error.status, reason: result.error.message },
        "Confirm progress download rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value, { status: 200 });
  } catch (cause: unknown) {
    logger.error({ event: "progress.confirm.failed", error: toLogError(cause) }, "Failed to confirm progress download");
    return errorResponse("Failed to confirm progress download", 500);
  }
}
