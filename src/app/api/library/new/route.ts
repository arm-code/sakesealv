import { getNewBooksForDeviceUseCase } from "@/lib/server/application/composition";
import { resolveAuthorizedDeviceId } from "@/lib/server/auth/device-binding";
import { requireActor } from "@/lib/server/auth/require-actor";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function GET(request: Request) {
  const auth = await requireActor(request);
  if ("response" in auth) return auth.response;

  const requestedDeviceId = new URL(request.url).searchParams.get("deviceId");
  const deviceResult = resolveAuthorizedDeviceId(auth.actor, requestedDeviceId, { required: true });
  if (!deviceResult.ok) {
    logger.warn(
      { event: "library.new.validation_failed", statusCode: deviceResult.status, reason: deviceResult.message, requestedDeviceId },
      deviceResult.message,
    );
    return errorResponse(deviceResult.message, deviceResult.status);
  }
  const { deviceId } = deviceResult;

  try {
    const result = await getNewBooksForDeviceUseCase.execute(deviceId);
    if (!result.ok) {
      logger.warn(
        { event: "library.new.use_case_failed", deviceId, statusCode: result.error.status, reason: result.error.message },
        "Fetch new books rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause: unknown) {
    logger.error({ event: "library.new.failed", error: toLogError(cause), deviceId }, "Failed to fetch new books for device");
    return errorResponse("Failed to fetch new books", 500);
  }
}
