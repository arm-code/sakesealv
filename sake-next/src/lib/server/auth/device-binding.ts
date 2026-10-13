import type { AuthActor } from "@/lib/server/domain/auth";

interface ResolveDeviceIdOptions {
  required?: boolean;
}

export type ResolveDeviceIdResult = { ok: true; deviceId: string | null } | { ok: false; status: 400 | 403; message: string };
export type ResolveDeviceIdRequiredResult = { ok: true; deviceId: string } | { ok: false; status: 400 | 403; message: string };

function normalizeDeviceId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

// Un actor api_key solo puede operar sobre el device al que está atada su
// clave: si manda otro deviceId es 403, si no manda ninguno se usa el atado.
// Un actor de sesión puede indicar cualquier deviceId (o ninguno).
export function resolveAuthorizedDeviceId(
  actor: AuthActor,
  suppliedDeviceId: string | null | undefined,
  options: { required: true },
): ResolveDeviceIdRequiredResult;
export function resolveAuthorizedDeviceId(
  actor: AuthActor,
  suppliedDeviceId: string | null | undefined,
  options?: ResolveDeviceIdOptions,
): ResolveDeviceIdResult;
export function resolveAuthorizedDeviceId(
  actor: AuthActor,
  suppliedDeviceId: string | null | undefined,
  options: ResolveDeviceIdOptions = {},
): ResolveDeviceIdResult {
  const requestedDeviceId = normalizeDeviceId(suppliedDeviceId);

  if (actor.type === "api_key") {
    const boundDeviceId = normalizeDeviceId(actor.deviceId);
    if (!boundDeviceId || (requestedDeviceId && requestedDeviceId !== boundDeviceId)) {
      return { ok: false, status: 403, message: "API key is not allowed for this device" };
    }
    return { ok: true, deviceId: boundDeviceId };
  }

  if (!requestedDeviceId) {
    if (options.required) {
      return { ok: false, status: 400, message: "Missing deviceId parameter" };
    }
    return { ok: true, deviceId: null };
  }

  return { ok: true, deviceId: requestedDeviceId };
}
