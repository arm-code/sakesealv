import { exportDeviceLibraryBookUseCase } from "@/lib/server/application/composition";
import { resolveAuthorizedDeviceId } from "@/lib/server/auth/device-binding";
import { requireActor } from "@/lib/server/auth/require-actor";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

function isFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && typeof (value as File).arrayBuffer === "function";
}

export async function POST(request: Request) {
  const auth = await requireActor(request);
  if ("response" in auth) return auth.response;

  try {
    const formData = await request.formData();
    const fileName = formData.get("fileName");
    const file = formData.get("file");
    const sidecarFile = formData.get("sidecarFile");
    const deviceResult = resolveAuthorizedDeviceId(auth.actor, formData.get("deviceId")?.toString(), { required: true });

    if (!deviceResult.ok) {
      logger.warn(
        { event: "library.export.validation_failed", reason: deviceResult.message, statusCode: deviceResult.status },
        deviceResult.message,
      );
      return errorResponse(deviceResult.message, deviceResult.status);
    }
    if (typeof fileName !== "string" || fileName.trim().length === 0) {
      logger.warn({ event: "library.export.validation_failed", reason: "fileName missing" }, "Missing fileName in form data");
      return errorResponse("Missing fileName in form data", 400);
    }
    if (!isFile(file)) {
      logger.warn({ event: "library.export.validation_failed", reason: "file missing" }, "Missing file in form data");
      return errorResponse("Missing file in form data", 400);
    }
    if (sidecarFile !== null && !isFile(sidecarFile)) {
      logger.warn({ event: "library.export.validation_failed", reason: "sidecarFile invalid" }, "Invalid sidecarFile in form data");
      return errorResponse("Invalid sidecarFile in form data", 400);
    }

    const result = await exportDeviceLibraryBookUseCase.execute({
      deviceId: deviceResult.deviceId,
      fileName,
      fileData: await file.arrayBuffer(),
      sidecarData: sidecarFile ? await sidecarFile.arrayBuffer() : undefined,
    });

    if (!result.ok) {
      logger.warn(
        {
          event: "library.export.use_case_failed",
          fileName,
          deviceId: deviceResult.deviceId,
          statusCode: result.error.status,
          reason: result.error.message,
        },
        "Library export rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause: unknown) {
    logger.error({ event: "library.export.failed", error: toLogError(cause) }, "Library export failed");
    return errorResponse("Library export failed", 500);
  }
}
