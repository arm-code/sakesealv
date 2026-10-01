import { deleteDeviceUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { deviceId: rawDeviceId } = await params;
  const deviceId = rawDeviceId?.trim();
  if (!deviceId) return errorResponse("Invalid device id", 400);

  try {
    const result = await deleteDeviceUseCase.execute({ userId: auth.actor.user.id, deviceId });
    if (!result.ok) {
      logger.warn(
        {
          event: "devices.delete.use_case_failed",
          deviceId,
          statusCode: result.error.status,
          reason: result.error.message,
        },
        "Delete device rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    logger.info({ event: "devices.delete.succeeded", deviceId }, "Device deleted");
    return Response.json(result.value);
  } catch (err: unknown) {
    logger.error({ event: "devices.delete.failed", deviceId, error: toLogError(err) }, "Failed to delete device");
    return errorResponse("Failed to delete device", 500);
  }
}
