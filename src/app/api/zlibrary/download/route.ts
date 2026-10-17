import { downloadBookUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { getZLibraryCredentials } from "@/lib/server/auth/cookies";
import { zlibraryAuthFailureResponse } from "@/lib/server/auth/response-signals";
import { errorResponse } from "@/lib/server/http/api";
import { parseZDownloadBookRequest } from "@/lib/server/http/zlibrary-download-request";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";
import type { ZDownloadBookRequest } from "@/lib/types/zlibrary";

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: ZDownloadBookRequest;
  try {
    body = parseZDownloadBookRequest(await request.json());
  } catch (cause: unknown) {
    logger.warn({ event: "zlibrary.download.invalid_payload", error: toLogError(cause) }, "Download payload validation failed");
    return errorResponse(cause instanceof Error ? cause.message : "Invalid JSON body", 400);
  }
  const { bookId, hash } = body;

  const credentials = await getZLibraryCredentials();
  if (!credentials) {
    logger.warn({ event: "zlibrary.download.auth_missing", bookId }, "Z-Library login is not valid");
    return errorResponse("Z-Library login is not valid", 400);
  }

  if (!bookId || !hash) {
    logger.warn({ event: "zlibrary.download.validation_failed", bookId, hash }, "Missing bookId or hash parameter");
    return errorResponse("Missing bookId or hash parameter", 400);
  }

  try {
    const result = await downloadBookUseCase.execute({ request: body, credentials });
    if (!result.ok) {
      logger.warn(
        { event: "zlibrary.download.use_case_failed", bookId, hash, statusCode: result.error.status, reason: result.error.message },
        "Download rejected",
      );
      return zlibraryAuthFailureResponse(result.error.message, result.error.status);
    }

    if (body.downloadToDevice === false) {
      return Response.json(result.value);
    }

    return new Response(result.value.fileData, { headers: result.value.responseHeaders });
  } catch (cause: unknown) {
    logger.error({ event: "zlibrary.download.failed", error: toLogError(cause), bookId, hash }, "Download failed");
    return errorResponse("Download failed", 500);
  }
}
