import { getAuthStatusUseCase } from "@/lib/server/application/composition";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function GET() {
  try {
    const result = await getAuthStatusUseCase.execute();
    if (!result.ok) {
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (err: unknown) {
    logger.error({ event: "auth.status.failed", error: toLogError(err) }, "Failed to fetch auth status");
    return errorResponse("Failed to fetch auth status", 500);
  }
}
