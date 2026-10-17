import { lookupSearchBookMetadataUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { isSearchEnabled } from "@/lib/server/config/activated-search-providers";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

interface MetadataLookupBody {
  title: string;
  author?: string | null;
  identifier?: string | null;
  language?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOptionalNullableString(body: Record<string, unknown>, key: "author" | "identifier" | "language"): string | null | undefined {
  if (!(key in body)) {
    return undefined;
  }
  const value = body[key];
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  throw new Error(`${key} must be a string or null`);
}

function parseBody(raw: unknown): MetadataLookupBody {
  if (!isRecord(raw)) {
    throw new Error("Body must be a JSON object");
  }

  const title = raw.title;
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("title is required");
  }

  return {
    title,
    author: parseOptionalNullableString(raw, "author"),
    identifier: parseOptionalNullableString(raw, "identifier"),
    language: parseOptionalNullableString(raw, "language"),
  };
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  if (!isSearchEnabled()) {
    logger.warn({ event: "search.disabled" }, "Search API is disabled");
    return errorResponse("Search is disabled", 404);
  }

  let parsedBody: MetadataLookupBody;
  try {
    const raw = await request.json();
    parsedBody = parseBody(raw);
  } catch (cause: unknown) {
    logger.warn(
      { event: "zlibrary.search.metadata.invalid_payload", error: toLogError(cause) },
      "Search metadata payload validation failed",
    );
    return errorResponse(cause instanceof Error ? cause.message : "Invalid JSON body", 400);
  }

  try {
    const result = await lookupSearchBookMetadataUseCase.execute(parsedBody);
    if (!result.ok) {
      logger.warn(
        { event: "zlibrary.search.metadata.use_case_failed", statusCode: result.error.status, reason: result.error.message },
        "Search metadata lookup rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    return Response.json(result.value);
  } catch (cause: unknown) {
    logger.error({ event: "zlibrary.search.metadata.failed", error: toLogError(cause) }, "Search metadata lookup failed");
    return errorResponse("Failed to lookup external metadata", 500);
  }
}
