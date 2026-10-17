import { listAnnotationsUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { parseAnnotationQuery } from "@/lib/server/http/annotation-query";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let query;
  try {
    query = parseAnnotationQuery(new URL(request.url).searchParams);
  } catch (cause) {
    return errorResponse(cause instanceof Error ? cause.message : "Invalid annotation query", 400);
  }

  try {
    const result = await listAnnotationsUseCase.execute(query);
    return result.ok ? Response.json(result.value) : errorResponse(result.error.message, result.error.status);
  } catch (cause) {
    logger.error({ event: "annotations.list.failed", error: toLogError(cause) }, "Failed to list annotations");
    return errorResponse("Failed to list annotations", 500);
  }
}
