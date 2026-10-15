import { reindexAnnotationsUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return errorResponse("Invalid reindex request", 400);
  }
  const bookId = (body as { bookId?: unknown }).bookId;
  if (bookId !== undefined && (!Number.isInteger(bookId) || Number(bookId) <= 0)) {
    return errorResponse("bookId must be a positive integer", 400);
  }

  const result = await reindexAnnotationsUseCase.execute(bookId as number | undefined);
  return result.ok ? Response.json(result.value, { status: 202 }) : errorResponse(result.error.message, result.error.status);
}
