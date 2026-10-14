import { removeDeviceDownloadUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

interface RouteParams {
  params: Promise<{ id: string; deviceId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id, deviceId: rawDeviceId } = await params;
  const bookId = Number(id);
  const deviceId = rawDeviceId?.trim();

  if (!Number.isFinite(bookId)) {
    logger.warn({ event: "library.download.device.remove.validation_failed", rawId: id }, "Invalid book id");
    return errorResponse("Invalid book id", 400);
  }
  if (!deviceId) {
    logger.warn({ event: "library.download.device.remove.validation_failed", bookId }, "Missing device id");
    return errorResponse("Missing device id", 400);
  }

  try {
    const result = await removeDeviceDownloadUseCase.execute({ bookId, deviceId });
    if (!result.ok) {
      logger.warn(
        { event: "library.download.device.remove.use_case_failed", bookId, deviceId, statusCode: result.error.status, reason: result.error.message },
        "Remove device download rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause: unknown) {
    logger.error({ event: "library.download.device.remove.failed", error: toLogError(cause), bookId, deviceId }, "Failed to remove device download");
    return errorResponse("Failed to remove device download", 500);
  }
}
