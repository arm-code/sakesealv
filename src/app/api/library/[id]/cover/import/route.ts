import { importLibraryBookCoverUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function parseCoverUrl(body: unknown): string | null | undefined {
  if (body === null || body === undefined) {
    return undefined;
  }

  if (typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Body must be a JSON object");
  }

  const raw = (body as Record<string, unknown>).coverUrl;
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  if (typeof raw === "string") {
    return raw;
  }
  throw new Error("coverUrl must be a string or null");
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isFinite(bookId)) {
    return errorResponse("Invalid book id", 400);
  }

  let coverUrl: string | null | undefined;
  try {
    coverUrl = parseCoverUrl(await request.json());
  } catch (cause) {
    logger.warn({ event: "library.cover.import.validation_failed", error: toLogError(cause), bookId }, "Cover import validation failed");
    return errorResponse(cause instanceof Error ? cause.message : "Invalid cover import payload", 400);
  }

  try {
    const result = await importLibraryBookCoverUseCase.execute({ bookId, coverUrl });
    if (!result.ok) {
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "library.cover.import.failed", error: toLogError(cause), bookId }, "Failed to import library cover");
    return errorResponse("Failed to import library cover", 500);
  }
}
