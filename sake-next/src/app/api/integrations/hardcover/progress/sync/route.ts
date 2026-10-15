import { triggerHardcoverProgressSyncUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const result = await triggerHardcoverProgressSyncUseCase.execute();
    return result.ok ? Response.json(result.value) : errorResponse(result.error.message, result.error.status);
  } catch (cause) {
    logger.error({ event: "hardcover.progress.trigger.failed", error: toLogError(cause) }, "Failed to trigger Hardcover progress sync");
    return errorResponse("Failed to trigger Hardcover progress sync", 500);
  }
}
