import { reorderShelvesUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

function parseShelfIds(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;

  const parsed: number[] = [];
  for (const value of raw) {
    if (!Number.isInteger(value) || value <= 0) return null;
    parsed.push(value);
  }
  return parsed;
}

export async function PATCH(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch (err: unknown) {
    logger.warn({ event: "library.shelves.reorder.invalid_json", error: toLogError(err) }, "Invalid JSON body");
    return errorResponse("Invalid JSON body", 400);
  }

  const shelfIds = parseShelfIds((body as { shelfIds?: unknown }).shelfIds);
  if (!shelfIds) {
    return errorResponse("shelfIds must be an array of positive integer ids", 400);
  }

  try {
    const result = await reorderShelvesUseCase.execute({ shelfIds });
    if (!result.ok) {
      logger.warn(
        { event: "library.shelves.reorder.use_case_failed", statusCode: result.error.status, reason: result.error.message, shelfIds },
        "Reorder shelves rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    return Response.json(result.value);
  } catch (err: unknown) {
    logger.error({ event: "library.shelves.reorder.failed", error: toLogError(err), shelfIds }, "Failed to reorder shelves");
    return errorResponse("Failed to reorder shelves", 500);
  }
}
