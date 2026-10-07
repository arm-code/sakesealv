import { isAuthenticationFailureStatus } from "@/lib/auth-response-signals";
import { zlibraryAuthFailureResponse } from "@/lib/server/auth/response-signals";
import { searchBooksUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { getZLibraryCredentials } from "@/lib/server/auth/cookies";
import { isSearchEnabled } from "@/lib/server/config/activated-search-providers";
import { errorResponse } from "@/lib/server/http/api";
import { parseSearchBooksRequest } from "@/lib/server/http/search-books-request";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";
import type { SearchBooksRequest } from "@/lib/types/search";

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  if (!isSearchEnabled()) {
    logger.warn({ event: "search.disabled" }, "Search API is disabled");
    return errorResponse("Search is disabled", 404);
  }

  let parsedRequest: SearchBooksRequest;
  try {
    const raw = await request.json();
    parsedRequest = parseSearchBooksRequest(raw);
  } catch (cause: unknown) {
    logger.warn({ event: "search.invalid_payload", error: toLogError(cause) }, "Search payload validation failed");
    return errorResponse(cause instanceof Error ? cause.message : "Invalid JSON body", 400);
  }

  const zlibraryCredentials = await getZLibraryCredentials();

  try {
    const result = await searchBooksUseCase.execute({
      request: parsedRequest,
      context: { zlibraryCredentials },
    });
    if (!result.ok) {
      logger.warn(
        { event: "search.use_case_failed", statusCode: result.error.status, reason: result.error.message },
        "Search rejected",
      );
      if (zlibraryCredentials && isAuthenticationFailureStatus(result.error.status)) {
        return zlibraryAuthFailureResponse(result.error.message, result.error.status);
      }
      return errorResponse(result.error.message, result.error.status);
    }

    return Response.json(result.value);
  } catch (cause: unknown) {
    logger.error({ event: "search.failed", error: toLogError(cause) }, "Search failed");
    return errorResponse("Search failed", 500);
  }
}
