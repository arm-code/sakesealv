import { cookies } from "next/headers";
import { resolveRequestAuthUseCase } from "@/lib/server/application/composition";
import { errorResponse } from "@/lib/server/http/api";
import type { SessionAuthActor } from "@/lib/server/domain/auth";
import { SAKE_SESSION_COOKIE_NAME } from "./constants";

// Reemplaza el gate centralizado que SvelteKit resolvía una vez en
// hooks.server.ts (event.locals.auth): en Next.js App Router, proxy.ts
// (antes middleware.ts) no puede compartir objetos tipados con los Route
// Handlers — solo headers/cookies — así que cada ruta protegida resuelve su
// propia sesión llamando a este helper. Mismo resultado, sin la complejidad
// de serializar el actor a través de un header.
export async function requireSession(): Promise<{ actor: SessionAuthActor } | { response: Response }> {
  const sessionToken = (await cookies()).get(SAKE_SESSION_COOKIE_NAME)?.value ?? null;

  if (!sessionToken) {
    return { response: errorResponse("Authentication required", 401) };
  }

  const actor = await resolveRequestAuthUseCase.execute({ sessionToken });
  if (!actor || actor.type !== "session") {
    return { response: errorResponse("Authentication required", 401) };
  }

  return { actor };
}
