import {
  deleteAnnotationUseCase,
  getAnnotationUseCase,
  updateAnnotationUseCase,
} from "@/lib/server/application/composition";
import { HIGHLIGHT_COLORS, type ReaderHighlightColor } from "@/lib/koreader/koreader-sidecar";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function annotationId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const id = annotationId((await params).id);
  if (!id) return errorResponse("Invalid annotation id", 400);

  try {
    const result = await getAnnotationUseCase.execute(id);
    return result.ok ? Response.json(result.value) : errorResponse(result.error.message, result.error.status);
  } catch (cause) {
    logger.error({ event: "annotations.get.failed", annotationId: id, error: toLogError(cause) }, "Failed to fetch annotation");
    return errorResponse("Failed to fetch annotation", 500);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const id = annotationId((await params).id);
  if (!id) return errorResponse("Invalid annotation id", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return errorResponse("Invalid annotation update", 400);
  }
  const value = body as { note?: unknown; color?: unknown; expectedVersion?: unknown };
  if (value.note !== null && typeof value.note !== "string") return errorResponse("note must be a string or null", 400);
  if (typeof value.note === "string" && value.note.length > 20_000) {
    return errorResponse("note must be at most 20000 characters", 400);
  }
  if (typeof value.expectedVersion !== "string" || value.expectedVersion.length === 0) {
    return errorResponse("expectedVersion is required", 400);
  }
  if (value.color !== undefined && !HIGHLIGHT_COLORS.includes(value.color as ReaderHighlightColor)) {
    return errorResponse("Invalid annotation color", 400);
  }

  try {
    const result = await updateAnnotationUseCase.execute(id, {
      note: (value.note as string | null | undefined) ?? null,
      ...(value.color === undefined ? {} : { color: value.color as ReaderHighlightColor }),
      expectedVersion: value.expectedVersion,
    });
    return result.ok ? Response.json(result.value) : errorResponse(result.error.message, result.error.status);
  } catch (cause) {
    logger.error({ event: "annotations.update.failed", annotationId: id, error: toLogError(cause) }, "Failed to update annotation");
    return errorResponse("Failed to update annotation", 500);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const id = annotationId((await params).id);
  if (!id) return errorResponse("Invalid annotation id", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  const expectedVersion =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as { expectedVersion?: unknown }).expectedVersion
      : null;
  if (typeof expectedVersion !== "string" || expectedVersion.length === 0) {
    return errorResponse("expectedVersion is required", 400);
  }

  try {
    const result = await deleteAnnotationUseCase.execute(id, expectedVersion);
    return result.ok ? Response.json(result.value) : errorResponse(result.error.message, result.error.status);
  } catch (cause) {
    logger.error({ event: "annotations.delete.failed", annotationId: id, error: toLogError(cause) }, "Failed to delete annotation");
    return errorResponse("Failed to delete annotation", 500);
  }
}
