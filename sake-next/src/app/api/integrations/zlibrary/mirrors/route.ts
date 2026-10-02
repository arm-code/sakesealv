import { getZLibraryMirrorSettingsUseCase, updateZLibraryMirrorSettingsUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const result = await getZLibraryMirrorSettingsUseCase.execute();
    return result.ok ? Response.json(result.value) : errorResponse(result.error.message, result.error.status);
  } catch (cause) {
    logger.error({ event: "zlibrary.mirrors.get.failed", error: toLogError(cause) }, "Failed to load Z-Library mirror settings");
    return errorResponse("Failed to load Z-Library mirror settings", 500);
  }
}

export async function PUT(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch (cause) {
    logger.warn({ event: "zlibrary.mirrors.put.invalid_json", error: toLogError(cause) }, "Invalid JSON body");
    return errorResponse("Request body must be valid JSON", 400);
  }

  try {
    const result = await updateZLibraryMirrorSettingsUseCase.execute(body);
    return result.ok ? Response.json(result.value) : errorResponse(result.error.message, result.error.status);
  } catch (cause) {
    logger.error({ event: "zlibrary.mirrors.put.failed", error: toLogError(cause) }, "Failed to update Z-Library mirror settings");
    return errorResponse("Failed to update Z-Library mirror settings", 500);
  }
}
