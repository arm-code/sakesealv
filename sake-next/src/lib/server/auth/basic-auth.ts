import { userRepository } from "@/lib/server/application/composition";
import { verifyPassword } from "@/lib/server/application/local-auth-service";

function unauthorizedResponse(realm: string): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${realm}"` },
  });
}

// Basic auth para OPDS/DAV (clientes de lectura externos que no manejan la
// cookie de sesión). Acepta la contraseña de la cuenta o, si está definida,
// la contraseña Basic dedicada. Devuelve null si autoriza, o la Response 401.
export async function requireBasicAuth(request: Request, realm: string): Promise<Response | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return unauthorizedResponse(realm);
  }

  const credentials = Buffer.from(authHeader.substring(6), "base64").toString("utf-8");
  const [username, ...passwordParts] = credentials.split(":");
  const password = passwordParts.join(":");

  if (!username || !password) {
    return unauthorizedResponse(realm);
  }

  const user = await userRepository.getByUsername(username);
  if (!user || user.isDisabled) {
    return unauthorizedResponse(realm);
  }

  if (await verifyPassword(password, user.passwordHash)) {
    return null;
  }

  if (!user.basicAuthPasswordHash) {
    return unauthorizedResponse(realm);
  }

  if (!(await verifyPassword(password, user.basicAuthPasswordHash))) {
    return unauthorizedResponse(realm);
  }

  return null;
}
