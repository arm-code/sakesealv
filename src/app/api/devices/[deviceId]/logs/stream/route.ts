import { observeDeviceLogsUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { createLogStreamResponse } from "@/lib/server/http/sse";
import { logger } from "@/lib/server/infrastructure/logging/logger";

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { deviceId } = await params;
  const result = await observeDeviceLogsUseCase.execute({ userId: auth.actor.user.id, deviceId });
  if (!result.ok) {
    logger.warn(
      { event: "device.logs.observe.use_case_failed", deviceId, statusCode: result.error.status, reason: result.error.message },
      "Observe device logs rejected",
    );
    return errorResponse(result.error.message, result.error.status);
  }

  return createLogStreamResponse(request, result.value);
}
