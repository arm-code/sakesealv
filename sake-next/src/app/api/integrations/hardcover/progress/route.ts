import {
  getHardcoverProgressSyncStatusUseCase,
  updateHardcoverProgressSyncSettingUseCase,
} from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const result = await getHardcoverProgressSyncStatusUseCase.execute();
    return result.ok ? Response.json(result.value) : errorResponse(result.error.message, result.error.status);
  } catch (cause) {
    logger.error({ event: "hardcover.progress.status.failed", error: toLogError(cause) }, "Failed to fetch Hardcover progress status");
    return errorResponse("Failed to fetch Hardcover progress status", 500);
  }
}

export async function PUT(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: { enabled?: unknown };
  try {
    body = (await request.json()) as { enabled?: unknown };
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  if (typeof body?.enabled !== "boolean") return errorResponse("enabled must be a boolean", 400);

  try {
    const result = await updateHardcoverProgressSyncSettingUseCase.execute({ enabled: body.enabled });
    return result.ok ? Response.json(result.value) : errorResponse(result.error.message, result.error.status);
  } catch (cause) {
    logger.error({ event: "hardcover.progress.setting.failed", error: toLogError(cause) }, "Failed to update Hardcover progress setting");
    return errorResponse("Failed to update Hardcover progress setting", 500);
  }
}
