import { observeWebappLogsUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { createLogStreamResponse } from "@/lib/server/http/sse";
import { logger } from "@/lib/server/infrastructure/logging/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const result = await observeWebappLogsUseCase.execute();
  if (!result.ok) {
    logger.warn(
      { event: "logs.webapp.observe.use_case_failed", statusCode: result.error.status, reason: result.error.message },
      "Observe webapp logs rejected",
    );
    return errorResponse(result.error.message, result.error.status);
  }

  return createLogStreamResponse(request, result.value);
}
