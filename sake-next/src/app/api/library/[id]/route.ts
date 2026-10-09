import { deleteLibraryFileUseCase, getLibraryFileUseCase, putLibraryFileUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

// Next.js exige el mismo nombre de segmento dinámico para todos los
// sibling routes bajo /api/library/ (el resto usa [id] para un bookId
// numérico) — este route.ts reutiliza esa misma carpeta aunque, a
// diferencia de sus hermanos (detail/content/shelves/...), el segmento
// aquí es un storage key/filename arbitrario (GetLibraryFileUseCase original
// lo llamaba "title"), no un id numérico. Intentar una carpeta `[title]`
// aparte compila limpio pero falla en runtime con "You cannot use
// different slug names for the same dynamic path ('id' !== 'title')".
interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET soporta sesión O API key de dispositivo en el original
// (isApiKeyAllowedRoute permite GET sobre /api/library/<archivo>). Solo se
// porta la rama de sesión aquí — la rama de API key queda diferida a la
// futura mini-fase de sync de dispositivos KOReader (mismo bloqueador que
// PutProgress/GetProgress en 3g: requireSession() rechaza actors que no
// sean "session").
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id: title } = await params;
  if (!title) {
    logger.warn({ event: "library.file.fetch.validation_failed" }, "Missing title parameter");
    return errorResponse("Missing title parameter", 400);
  }

  try {
    const result = await getLibraryFileUseCase.execute(title);
    if (!result.ok) {
      logger.warn(
        { event: "library.file.fetch.use_case_failed", title, statusCode: result.error.status, reason: result.error.message },
        "Fetch library file rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    return new Response(result.value.data, {
      headers: { "Content-Type": result.value.contentType, "Content-Length": result.value.contentLength },
    });
  } catch (cause: unknown) {
    logger.error({ event: "library.file.fetch.failed", error: toLogError(cause), title }, "Fetch library file failed");
    return errorResponse("File not found", 404);
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id: title } = await params;
  if (!title) {
    logger.warn({ event: "library.file.upload.validation_failed" }, "Missing title parameter");
    return errorResponse("Missing title parameter", 400);
  }

  try {
    const body = await request.arrayBuffer();
    const result = await putLibraryFileUseCase.execute(title, body);
    if (!result.ok) {
      logger.warn(
        { event: "library.file.upload.use_case_failed", title, statusCode: result.error.status, reason: result.error.message },
        "Upload library file rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause: unknown) {
    logger.error({ event: "library.file.upload.failed", error: toLogError(cause), title }, "Upload failed");
    return errorResponse("Upload failed", 500);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { id: title } = await params;
  if (!title) {
    logger.warn({ event: "library.file.delete.validation_failed" }, "Missing title parameter");
    return errorResponse("Missing title parameter", 400);
  }

  try {
    const result = await deleteLibraryFileUseCase.execute(title);
    if (!result.ok) {
      logger.warn(
        { event: "library.file.delete.use_case_failed", title, statusCode: result.error.status, reason: result.error.message },
        "Delete library file rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause: unknown) {
    logger.error({ event: "library.file.delete.failed", error: toLogError(cause), title }, "Delete failed");
    return errorResponse("Delete failed", 500);
  }
}
