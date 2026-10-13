import { getProgressUseCase, putProgressUseCase } from "@/lib/server/application/composition";
import { resolveAuthorizedDeviceId } from "@/lib/server/auth/device-binding";
import { requireActor } from "@/lib/server/auth/require-actor";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

// Sync de progreso de dispositivos KOReader: acepta sesión O API key.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const auth = await requireActor(request);
  if ("response" in auth) return auth.response;

  const fileName = new URL(request.url).searchParams.get("fileName");
  if (!fileName) {
    logger.warn({ event: "progress.fetch.validation_failed" }, "Missing fileName parameter");
    return errorResponse("Missing fileName parameter", 400);
  }

  try {
    const result = await getProgressUseCase.execute({ fileName });
    if (!result.ok) {
      logger.warn(
        { event: "progress.fetch.use_case_failed", fileName, statusCode: result.error.status, reason: result.error.message },
        "Progress fetch rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    return new Response(new Uint8Array(result.value.data), {
      headers: {
        "Content-Type": "application/x-lua",
        "Content-Disposition": `attachment; filename="${result.value.metadataFileName}"`,
      },
    });
  } catch (cause: unknown) {
    logger.error({ event: "progress.fetch.failed", error: toLogError(cause), fileName }, "Progress fetch failed");
    return errorResponse("Progress file not found", 404);
  }
}

export async function PUT(request: Request) {
  const auth = await requireActor(request);
  if ("response" in auth) return auth.response;

  try {
    const formData = await request.formData();
    const fileName = formData.get("fileName");
    const file = formData.get("file");
    const deviceId = formData.get("deviceId");
    const readerSessionId = formData.get("readerSessionId");
    const percentFinishedRaw = formData.get("percentFinished");

    if (typeof fileName !== "string" || fileName.length === 0) {
      logger.warn({ event: "progress.upload.validation_failed", reason: "fileName missing" }, "Missing fileName in form data");
      return errorResponse("Missing fileName in form data", 400);
    }
    if (!file || typeof (file as File).arrayBuffer !== "function") {
      logger.warn({ event: "progress.upload.validation_failed", reason: "file missing" }, "Missing file in form data");
      return errorResponse("Missing file in form data", 400);
    }
    if (typeof percentFinishedRaw !== "string" || percentFinishedRaw.trim() === "") {
      logger.warn({ event: "progress.upload.validation_failed", reason: "percentFinished missing" }, "Missing percentFinished in form data");
      return errorResponse("Missing percentFinished in form data", 400);
    }

    const percentFinished = Number.parseFloat(percentFinishedRaw);
    if (!Number.isFinite(percentFinished) || percentFinished < 0 || percentFinished > 1) {
      logger.warn(
        { event: "progress.upload.validation_failed", reason: "percentFinished invalid", percentFinishedRaw },
        "Invalid percentFinished in form data",
      );
      return errorResponse("percentFinished must be a number between 0 and 1", 400);
    }
    if (readerSessionId !== null && (typeof readerSessionId !== "string" || !UUID_PATTERN.test(readerSessionId))) {
      logger.warn({ event: "progress.upload.validation_failed", reason: "readerSessionId invalid" }, "Invalid readerSessionId in form data");
      return errorResponse("readerSessionId must be a UUID", 400);
    }

    const deviceResult = resolveAuthorizedDeviceId(auth.actor, typeof deviceId === "string" ? deviceId : null);
    if (!deviceResult.ok) {
      logger.warn(
        { event: "progress.upload.validation_failed", reason: deviceResult.message, statusCode: deviceResult.status, deviceId },
        deviceResult.message,
      );
      return errorResponse(deviceResult.message, deviceResult.status);
    }

    const result = await putProgressUseCase.execute({
      fileName,
      fileData: await (file as File).arrayBuffer(),
      percentFinished,
      deviceId: deviceResult.deviceId ?? undefined,
      readerSessionId: readerSessionId || undefined,
    });

    if (!result.ok) {
      logger.warn(
        { event: "progress.upload.use_case_failed", fileName, deviceId, statusCode: result.error.status, reason: result.error.message },
        "Progress upload rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    return Response.json({ success: true, progressKey: result.value.progressKey });
  } catch (cause: unknown) {
    logger.error({ event: "progress.upload.failed", error: toLogError(cause) }, "Progress upload failed");
    return errorResponse("Progress upload failed", 500);
  }
}
