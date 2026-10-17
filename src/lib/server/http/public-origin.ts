// En el build standalone `request.url` trae el host de bind (0.0.0.0:3000),
// no el que vio el cliente. Se reconstruye desde los headers del proxy / Host.
export function getPublicOrigin(request: Request): string {
  const first = (name: string) => request.headers.get(name)?.split(",")[0]?.trim() || null;
  const fallback = new URL(request.url);
  const host = first("x-forwarded-host") ?? first("host") ?? fallback.host;
  const proto = first("x-forwarded-proto")?.toLowerCase();
  const protocol = proto === "http" || proto === "https" ? proto : fallback.protocol.replace(":", "");
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return fallback.origin;
  }
}
