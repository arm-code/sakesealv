import { queueDownloadUseCase } from "@/lib/server/application/composition";
import { getZLibraryCredentials } from "@/lib/server/auth/cookies";
import { zlibraryAuthFailureResponse } from "@/lib/server/auth/response-signals";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { getQueueStatusResponse } from "@/lib/server/http/get-queue-status-response";
import { parseZDownloadBookRequest } from "@/lib/server/http/zlibrary-download-request";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";
import type { ZDownloadBookRequest } from "@/lib/types/zlibrary";

export const dynamic = "force-dynamic";

/** Encola una descarga de Z-Library hacia la biblioteca (asíncrona, responde de inmediato). */
export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: ZDownloadBookRequest;
  try {
    body = parseZDownloadBookRequest(await request.json());
  } catch (cause: unknown) {
    logger.warn({ event: "zlibrary.queue.invalid_payload", error: toLogError(cause) }, "Queue payload validation failed");
    return errorResponse(cause instanceof Error ? cause.message : "Invalid JSON body", 400);
  }
  const { bookId, hash } = body;

  const credentials = await getZLibraryCredentials();
  if (!credentials) {
    logger.warn({ event: "zlibrary.queue.auth_missing", bookId }, "Z-Library login is not valid");
    return errorResponse("Z-Library login is not valid", 400);
  }

  if (!bookId || !hash) {
    logger.warn({ event: "zlibrary.queue.validation_failed", bookId, hash }, "Missing bookId or hash parameter");
    return errorResponse("Missing bookId or hash parameter", 400);
  }

  try {
    const result = await queueDownloadUseCase.execute({ request: body, credentials });
    if (!result.ok) {
      logger.warn(
        { event: "zlibrary.queue.use_case_failed", bookId, hash, statusCode: result.error.status, reason: result.error.message },
        "Queue request rejected",
      );
      return zlibraryAuthFailureResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause: unknown) {
    logger.error({ event: "zlibrary.queue.failed", error: toLogError(cause), bookId, hash }, "Failed to queue download");
    return errorResponse("Failed to queue download", 500);
  }
}

export async function GET() {
  return getQueueStatusResponse();
}
