import { putWebReaderProgressUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { parseWebProgressRequest } from "@/lib/server/http/web-reader-progress-request";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function PUT(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch (cause) {
    logger.warn({ event: "progress.web.invalid_json", error: toLogError(cause) }, "Invalid web reader progress JSON");
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = parseWebProgressRequest(body);
  if (!parsed.ok) {
    logger.warn({ event: "progress.web.validation_failed", reason: parsed.message }, parsed.message);
    return errorResponse(parsed.message, 400);
  }

  try {
    const result = await putWebReaderProgressUseCase.execute(parsed.value);
    if (!result.ok) {
      logger.warn(
        { event: "progress.web.use_case_failed", fileName: parsed.value.fileName, statusCode: result.error.status, reason: result.error.message },
        "Web reader progress update rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json({ success: true, progressKey: result.value.progressKey, sidecar: result.value.sidecar });
  } catch (cause) {
    logger.error({ event: "progress.web.failed", error: toLogError(cause) }, "Web reader progress update failed");
    return errorResponse("Web reader progress update failed", 500);
  }
}
