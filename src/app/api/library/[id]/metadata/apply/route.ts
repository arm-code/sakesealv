import { applyMetadataCandidateUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { parseApplyMetadataCandidateRequest } from "@/lib/server/http/apply-metadata-candidate-request";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Ruta inventada en Fase 3m: ApplyMetadataCandidateUseCase está huérfano en
// el original (sin ruta HTTP ni UI que lo invoque) — ver sección "Fase 3j"
// del handoff. Forma elegida: el cliente manda de vuelta, tal cual, uno de
// los candidatos que ya recibió de POST /api/metadata/search (3j), más qué
// campos quiere aplicar y, opcionalmente, qué portada del candidato elegir.
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isFinite(bookId)) {
    return errorResponse("Invalid book id", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (cause) {
    logger.warn({ event: "library.metadata.apply.invalid_json", error: toLogError(cause), bookId }, "Invalid JSON body");
    return errorResponse("Invalid JSON body", 400);
  }

  let parsed: ReturnType<typeof parseApplyMetadataCandidateRequest>;
  try {
    parsed = parseApplyMetadataCandidateRequest(body);
  } catch (cause) {
    logger.warn({ event: "library.metadata.apply.validation_failed", error: toLogError(cause), bookId }, "Apply metadata candidate validation failed");
    return errorResponse(cause instanceof Error ? cause.message : "Invalid apply metadata payload", 400);
  }

  try {
    const result = await applyMetadataCandidateUseCase.execute({ bookId, ...parsed });
    if (!result.ok) {
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "library.metadata.apply.failed", error: toLogError(cause), bookId }, "Failed to apply metadata candidate");
    return errorResponse("Failed to apply metadata candidate", 500);
  }
}
