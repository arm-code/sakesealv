import { ListDavDirectoryUseCase } from "@/lib/server/application/use-cases/list-dav-directory";
import { requireBasicAuth } from "@/lib/server/auth/basic-auth";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";
import { S3Storage } from "@/lib/server/infrastructure/storage/s3-storage";
import { createLazySingleton } from "@/lib/server/utils/createLazySingleton";

// DAV vive en proxy.ts porque los Route Handlers de Next.js solo aceptan
// GET/HEAD/OPTIONS/POST/PUT/DELETE/PATCH (cualquier otro método → 400, ver
// resolveHandler en app-route/module.js). Por eso este módulo arma su propio
// use-case en vez de importar composition.ts (que arrastraría todo el grafo
// al proxy).
const listDavDirectoryUseCase = createLazySingleton(() => new ListDavDirectoryUseCase(new S3Storage()));

const DAV_PREFIX = /^\/api\/dav\/?/;

export async function handleDavRequest(request: Request): Promise<Response> {
  if (request.method !== "PROPFIND") {
    logger.warn({ event: "dav.propfind.method_not_allowed", method: request.method }, "Method not allowed");
    const response = errorResponse("Method not allowed", 405);
    response.headers.set("Allow", "PROPFIND");
    return response;
  }

  const authResponse = await requireBasicAuth(request, "WebDAV");
  if (authResponse) return authResponse;

  try {
    const rawPath = new URL(request.url).pathname.replace(DAV_PREFIX, "");
    const result = await listDavDirectoryUseCase.execute({ path: rawPath });
    if (!result.ok) {
      logger.warn(
        { event: "dav.propfind.use_case_failed", path: rawPath, statusCode: result.error.status, reason: result.error.message },
        "PROPFIND rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }

    return new Response(result.value.xml, {
      status: 207,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  } catch (cause: unknown) {
    logger.error({ event: "dav.propfind.failed", error: toLogError(cause) }, "PROPFIND error");
    return errorResponse("Failed to list directory", 500);
  }
}
