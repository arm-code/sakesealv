import { revokeApiKeyUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const apiKeyId = Number.parseInt(id, 10);
  if (!Number.isInteger(apiKeyId) || apiKeyId <= 0) {
    return errorResponse("Invalid API key id", 400);
  }

  try {
    const result = await revokeApiKeyUseCase.execute({ userId: auth.actor.user.id, apiKeyId });
    if (!result.ok) {
      logger.warn(
        {
          event: "auth.api_keys.revoke.use_case_failed",
          statusCode: result.error.status,
          reason: result.error.message,
          apiKeyId,
        },
        "Revoke API key rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    logger.error({ event: "auth.api_keys.revoke.failed", error: toLogError(err), apiKeyId }, "Failed to revoke API key");
    return errorResponse("Failed to revoke API key", 500);
  }
}
