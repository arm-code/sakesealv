import { updateShelfRulesUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";
import { parseRuleGroup } from "@/lib/types/library";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const shelfId = Number(id);
  if (!Number.isInteger(shelfId) || shelfId <= 0) {
    return errorResponse("Invalid shelf id", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (err: unknown) {
    logger.warn({ event: "library.shelf_rules.update.invalid_json", error: toLogError(err), shelfId }, "Invalid JSON body");
    return errorResponse("Invalid JSON body", 400);
  }

  const parsedRuleGroup = parseRuleGroup((body as { ruleGroup?: unknown }).ruleGroup);
  if (!parsedRuleGroup.ok) {
    return errorResponse(parsedRuleGroup.error, 400);
  }

  try {
    const result = await updateShelfRulesUseCase.execute({ shelfId, ruleGroup: parsedRuleGroup.value });

    if (!result.ok) {
      logger.warn(
        {
          event: "library.shelf_rules.update.use_case_failed",
          shelfId,
          statusCode: result.error.status,
          reason: result.error.message,
        },
        "Update shelf rules rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    return Response.json(result.value);
  } catch (err: unknown) {
    logger.error({ event: "library.shelf_rules.update.failed", error: toLogError(err), shelfId }, "Failed to update shelf rules");
    return errorResponse("Failed to update shelf rules", 500);
  }
}
