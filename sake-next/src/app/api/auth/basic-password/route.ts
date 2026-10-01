import { clearBasicAuthPasswordUseCase, setBasicAuthPasswordUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

export async function PUT(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: { password?: unknown };
  try {
    body = (await request.json()) as { password?: unknown };
  } catch (err: unknown) {
    logger.warn({ event: "auth.basic_password.invalid_json", error: toLogError(err) }, "Invalid basic password request body");
    return errorResponse("Invalid JSON body", 400);
  }

  if (!Object.hasOwn(body, "password")) return errorResponse("Password is required", 400);
  if (typeof body.password !== "string") return errorResponse("Password must be a string", 400);
  if (body.password.length === 0) return errorResponse("Password is required", 400);

  try {
    const result = await setBasicAuthPasswordUseCase.execute({ userId: auth.actor.user.id, password: body.password });
    if (!result.ok) {
      logger.warn(
        { event: "auth.basic_password.set.use_case_failed", statusCode: result.error.status, reason: result.error.message },
        "Set basic password rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (err: unknown) {
    logger.error({ event: "auth.basic_password.set.failed", error: toLogError(err) }, "Failed to set basic password");
    return errorResponse("Failed to set basic password", 500);
  }
}

export async function DELETE() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const result = await clearBasicAuthPasswordUseCase.execute({ userId: auth.actor.user.id });
    if (!result.ok) {
      logger.warn(
        { event: "auth.basic_password.clear.use_case_failed", statusCode: result.error.status, reason: result.error.message },
        "Clear basic password rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (err: unknown) {
    logger.error({ event: "auth.basic_password.clear.failed", error: toLogError(err) }, "Failed to clear basic password");
    return errorResponse("Failed to clear basic password", 500);
  }
}
