import { queueSearchBookUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";
import type { QueueSearchBookRequest, QueueableSearchProviderId } from "@/lib/types/search";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQueueableProvider(value: string): value is QueueableSearchProviderId {
  return value === "anna" || value === "openlibrary" || value === "gutenberg";
}

function parseBody(raw: unknown): QueueSearchBookRequest {
  if (!isRecord(raw)) throw new Error("Body must be a JSON object");

  if (typeof raw.provider !== "string" || !isQueueableProvider(raw.provider)) throw new Error("provider is invalid");
  if (typeof raw.providerBookId !== "string" || raw.providerBookId.trim().length === 0) throw new Error("providerBookId is required");
  if (typeof raw.downloadRef !== "string" || raw.downloadRef.trim().length === 0) throw new Error("downloadRef is required");
  if (typeof raw.title !== "string" || raw.title.trim().length === 0) throw new Error("title is required");

  const optionalStringKeys = ["extension", "author", "series", "volume", "identifier", "description", "cover", "language"] as const;
  for (const key of optionalStringKeys) {
    const value = raw[key];
    if (value !== undefined && value !== null && typeof value !== "string") throw new Error(`${key} must be a string or null`);
  }

  for (const key of ["pages", "filesize", "year", "seriesIndex"] as const) {
    const value = raw[key];
    if (value !== undefined && value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new Error(`${key} must be a number or null`);
    }
  }

  if (typeof raw.seriesIndex === "number" && raw.seriesIndex < 0) {
    throw new Error("seriesIndex must be a non-negative number or null");
  }

  return {
    provider: raw.provider,
    providerBookId: raw.providerBookId.trim(),
    downloadRef: raw.downloadRef.trim(),
    title: raw.title.trim(),
    extension: (raw.extension as string | null | undefined) ?? null,
    author: (raw.author as string | null | undefined) ?? null,
    series: (raw.series as string | null | undefined) ?? null,
    volume: (raw.volume as string | null | undefined) ?? null,
    seriesIndex: (raw.seriesIndex as number | null | undefined) ?? null,
    identifier: (raw.identifier as string | null | undefined) ?? null,
    pages: (raw.pages as number | null | undefined) ?? null,
    description: (raw.description as string | null | undefined) ?? null,
    cover: (raw.cover as string | null | undefined) ?? null,
    filesize: (raw.filesize as number | null | undefined) ?? null,
    language: (raw.language as string | null | undefined) ?? null,
    year: (raw.year as number | null | undefined) ?? null,
  };
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: QueueSearchBookRequest;
  try {
    body = parseBody(await request.json());
  } catch (cause: unknown) {
    logger.warn({ event: "search.queue.invalid_payload", error: toLogError(cause) }, "Search queue payload validation failed");
    return errorResponse(cause instanceof Error ? cause.message : "Invalid JSON body", 400);
  }

  try {
    const result = await queueSearchBookUseCase.execute({ request: body, userId: String(auth.actor.user.id) });
    if (!result.ok) {
      logger.warn(
        { event: "search.queue.use_case_failed", provider: body.provider, statusCode: result.error.status, reason: result.error.message },
        "Search queue rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause: unknown) {
    logger.error({ event: "search.queue.failed", provider: body.provider, error: toLogError(cause) }, "Search queue failed");
    return errorResponse("Search queue failed", 500);
  }
}
