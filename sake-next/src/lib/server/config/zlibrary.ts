export const DEFAULT_ZLIBRARY_BASE_URL = "https://z-lib.gl";
export const MAX_ZLIBRARY_MIRRORS = 5;
export const MAX_ZLIBRARY_MIRROR_URL_LENGTH = 2048;

export function resolveZLibraryMirrorUrls(rawValue: string | undefined | null): string[] {
  const values = rawValue?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  if (values.length === 0) return [DEFAULT_ZLIBRARY_BASE_URL];
  return normalizeZLibraryMirrorUrls(values);
}

export function normalizeZLibraryMirrorUrls(values: readonly string[]): string[] {
  if (values.length === 0) {
    throw new Error("At least one Z-Library mirror URL is required");
  }
  if (values.length > MAX_ZLIBRARY_MIRRORS) {
    throw new Error(`At most ${MAX_ZLIBRARY_MIRRORS} Z-Library mirror URLs are allowed`);
  }

  const normalized = [...new Set(values.map(normalizeZLibraryUrl))];
  if (normalized.length > MAX_ZLIBRARY_MIRRORS) {
    throw new Error(`At most ${MAX_ZLIBRARY_MIRRORS} Z-Library mirror URLs are allowed`);
  }
  return normalized;
}

export function normalizeZLibraryUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Z-Library mirror URL is required");
  if (trimmed.length > MAX_ZLIBRARY_MIRROR_URL_LENGTH) {
    throw new Error(`Z-Library mirror URLs must be at most ${MAX_ZLIBRARY_MIRROR_URL_LENGTH} characters`);
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Z-Library mirror URLs must be absolute HTTPS URLs");
  }

  if (url.protocol !== "https:" || !url.hostname) {
    throw new Error("Z-Library mirror URLs must be absolute HTTPS URLs");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Z-Library mirror URLs must not include query strings, fragments, or credentials");
  }

  const normalized = url.toString().replace(/\/$/, "");
  if (normalized.length > MAX_ZLIBRARY_MIRROR_URL_LENGTH) {
    throw new Error(`Z-Library mirror URLs must be at most ${MAX_ZLIBRARY_MIRROR_URL_LENGTH} characters`);
  }
  return normalized;
}
