import { deleteShelfUseCase, updateShelfUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

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
    logger.warn({ event: "library.shelves.update.invalid_json", error: toLogError(err), shelfId }, "Invalid JSON body");
    return errorResponse("Invalid JSON body", 400);
  }

  const name = (body as { name?: unknown }).name;
  const icon = (body as { icon?: unknown }).icon;
  if (typeof name !== "string") return errorResponse("name is required", 400);
  if (icon !== undefined && typeof icon !== "string") return errorResponse("icon must be a string", 400);

  try {
    const result = await updateShelfUseCase.execute({ shelfId, name, icon: typeof icon === "string" ? icon : undefined });
    if (!result.ok) {
      logger.warn(
        { event: "library.shelves.update.use_case_failed", shelfId, statusCode: result.error.status, reason: result.error.message },
        "Update shelf rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (err: unknown) {
    logger.error({ event: "library.shelves.update.failed", error: toLogError(err), shelfId }, "Failed to update shelf");
    return errorResponse("Failed to update shelf", 500);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const shelfId = Number(id);
  if (!Number.isInteger(shelfId) || shelfId <= 0) {
    return errorResponse("Invalid shelf id", 400);
  }

  try {
    const result = await deleteShelfUseCase.execute({ shelfId });
    if (!result.ok) {
      logger.warn(
        { event: "library.shelves.delete.use_case_failed", shelfId, statusCode: result.error.status, reason: result.error.message },
        "Delete shelf rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (err: unknown) {
    logger.error({ event: "library.shelves.delete.failed", error: toLogError(err), shelfId }, "Failed to delete shelf");
    return errorResponse("Failed to delete shelf", 500);
  }
}
