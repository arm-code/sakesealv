import { handleDavRequest } from "@/lib/server/dav/propfind";

// Único uso de proxy.ts: WebDAV (PROPFIND), porque los Route Handlers de
// Next.js rechazan métodos HTTP no estándar. El resto de la auth sigue
// resolviéndose por ruta (requireSession/requireActor), no aquí.
export function proxy(request: Request): Promise<Response> {
  return handleDavRequest(request);
}

export const config = {
  matcher: ["/api/dav", "/api/dav/:path*"],
};
