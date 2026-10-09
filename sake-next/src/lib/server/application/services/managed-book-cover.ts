// Recortado a lo que usa GetLibraryCoverUseCase (Fase 3f),
// DeleteTrashedLibraryBookUseCase/PurgeExpiredTrashUseCase
// (deleteManagedBookCoversForStorageKey, Fase 3h), Upload/
// ImportLibraryBookCoverUseCase (storeManagedBookCoverFromBuffer/
// storeManagedBookCoverFromExternalUrl, Fase 3i), y desde la pieza C de
// adquisición Z-Library (DownloadBookUseCase) storeManagedBookCoverFromSearchImport
// — funciones sueltas, sin la clase `ManagedBookCoverService` completa.
import type { StoragePort, ZLibraryCredentials } from "@/lib/server/application/ports";
import { buildZLibraryUrl, DEFAULT_ZLIBRARY_BASE_URL } from "@/lib/server/config/zlibrary";
import type { SearchProviderId } from "@/lib/types/search";
import { createChildLogger, toLogError } from "@/lib/server/infrastructure/logging/logger";
import { createHash } from "node:crypto";

const ANNA_ARCHIVE_COVER_HOST = "annas-archive.gl";
const OPEN_LIBRARY_COVER_HOST = "covers.openlibrary.org";

const LIBRARY_COVER_ROUTE_PREFIX = "/api/library/covers/";
const LIBRARY_COVER_STORAGE_PREFIX = "covers/";
const DEFAULT_USER_AGENT = "Sake/1.0 (+https://github.com/Sudashiii/Sake)";
const MANAGED_COVER_FILE_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpg|png|gif|webp|avif)$/i;

const IMAGE_CONTENT_TYPE_TO_EXTENSION = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

export const MIN_MANAGED_BOOK_COVER_BYTES = 1024;
export const MAX_MANAGED_BOOK_COVER_BYTES = 10 * 1024 * 1024;

export interface ManagedBookCoverResult {
  managedUrl: string | null;
  sourceUrl: string | null;
}

export interface StoreExternalBookCoverInput {
  bookStorageKey: string;
  coverUrl: string | null | undefined;
}

export interface StoreManagedBookCoverInput {
  bookStorageKey: string;
  provider: SearchProviderId;
  coverUrl: string | null | undefined;
  zlibraryCredentials?: ZLibraryCredentials;
}

export interface StoreManagedBookCoverBufferInput {
  bookStorageKey: string;
  coverBuffer: Buffer;
  contentType: string;
}

type FetchLike = typeof fetch;

const coverServiceLogger = createChildLogger({ service: "ManagedBookCoverService" });

export function buildManagedBookCoverFileName(bookStorageKey: string, extension: string): string {
  return `${bookStorageKey}.${extension}`;
}

export function buildManagedBookCoverStorageKey(fileName: string): string {
  return `${LIBRARY_COVER_STORAGE_PREFIX}${fileName}`;
}

export function buildManagedBookCoverUrl(fileName: string): string {
  return `${LIBRARY_COVER_ROUTE_PREFIX}${encodeURIComponent(fileName)}`;
}

export function buildManagedBookCoverVersionToken(coverBuffer: Buffer): string {
  return createHash("sha256").update(coverBuffer).digest("hex").slice(0, 12);
}

export function buildVersionedManagedBookCoverUrl(fileName: string, versionToken: string): string {
  return `${buildManagedBookCoverUrl(fileName)}?v=${encodeURIComponent(versionToken)}`;
}

export function buildManagedBookCoverPrefix(bookStorageKey: string): string {
  return `${LIBRARY_COVER_STORAGE_PREFIX}${bookStorageKey}.`;
}

export function isManagedBookCoverUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith(LIBRARY_COVER_ROUTE_PREFIX);
}

export function isValidManagedBookCoverFileName(fileName: string): boolean {
  return MANAGED_COVER_FILE_NAME_REGEX.test(fileName);
}

export async function deleteManagedBookCoversForStorageKey(storage: StoragePort, bookStorageKey: string): Promise<void> {
  try {
    const objects = await storage.list(buildManagedBookCoverPrefix(bookStorageKey));
    for (const object of objects) {
      try {
        await storage.delete(object.key);
      } catch (error: unknown) {
        coverServiceLogger.warn(
          { event: "library.cover.delete.failed", bookStorageKey, coverKey: object.key, error: toLogError(error) },
          "Managed cover delete failed, continuing",
        );
      }
    }
  } catch (error: unknown) {
    coverServiceLogger.warn({ event: "library.cover.list.failed", bookStorageKey, error: toLogError(error) }, "Managed cover lookup failed, continuing");
  }
}

async function deleteOtherManagedCovers(storage: StoragePort, bookStorageKey: string, keepFileName: string): Promise<void> {
  try {
    const objects = await storage.list(buildManagedBookCoverPrefix(bookStorageKey));
    const keepKey = buildManagedBookCoverStorageKey(keepFileName);
    for (const object of objects) {
      if (object.key === keepKey) {
        continue;
      }
      try {
        await storage.delete(object.key);
      } catch (error: unknown) {
        coverServiceLogger.warn(
          { event: "library.cover.delete.failed", bookStorageKey, coverKey: object.key, error: toLogError(error) },
          "Managed cover delete failed, continuing",
        );
      }
    }
  } catch (error: unknown) {
    coverServiceLogger.warn({ event: "library.cover.list.failed", bookStorageKey, error: toLogError(error) }, "Managed cover lookup failed, continuing");
  }
}

function normalizeContentType(value: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function extensionFromImageContentType(contentType: string | null): string | null {
  if (contentType === null) {
    return null;
  }

  return IMAGE_CONTENT_TYPE_TO_EXTENSION.get(contentType) ?? null;
}

function hasImageMagicBytes(buffer: Buffer, contentType: string): boolean {
  switch (contentType) {
    case "image/jpeg":
    case "image/jpg":
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case "image/gif": {
      if (buffer.length < 6) {
        return false;
      }
      const signature = buffer.subarray(0, 6).toString("ascii");
      return signature === "GIF87a" || signature === "GIF89a";
    }
    case "image/webp":
      return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    case "image/avif":
      return (
        buffer.length >= 12 &&
        buffer.subarray(4, 8).toString("ascii") === "ftyp" &&
        (buffer.subarray(8, 12).toString("ascii") === "avif" || buffer.subarray(8, 12).toString("ascii") === "avis")
      );
    default:
      return false;
  }
}

function parseProtocolRelativeOrAbsoluteUrl(value: string): URL | null {
  try {
    if (value.startsWith("//")) {
      return new URL(`https:${value}`);
    }
    return new URL(value);
  } catch {
    return null;
  }
}

function parseIpv4Octets(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => Number(part));
  return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) ? octets : null;
}

function isBlockedManualImportHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local") || normalized === "0.0.0.0" || normalized === "::1" || normalized === "[::1]") {
    return true;
  }

  const ipv4 = parseIpv4Octets(normalized);
  if (ipv4 !== null) {
    const [a, b] = ipv4;
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
  }

  const bareIpv6 = normalized.startsWith("[") && normalized.endsWith("]") ? normalized.slice(1, -1) : normalized;
  return bareIpv6.startsWith("fc") || bareIpv6.startsWith("fd") || bareIpv6.startsWith("fe80:");
}

function normalizePublicExternalUrl(coverUrl: string | null | undefined): string | null {
  const normalized = typeof coverUrl === "string" ? coverUrl.trim() : "";
  if (!normalized) {
    return null;
  }

  const url = parseProtocolRelativeOrAbsoluteUrl(normalized);
  if (url === null || (url.protocol !== "https:" && url.protocol !== "http:") || isBlockedManualImportHostname(url.hostname)) {
    return null;
  }

  return url.toString();
}

function buildDefaultFetchHeaders(): Headers {
  return new Headers({
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "User-Agent": DEFAULT_USER_AGENT,
  });
}

function parseDeclaredSize(value: string | null): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function readResponseBufferWithinLimit(input: { response: Response; maxBytes: number }): Promise<{ buffer: Buffer; byteLength: number; exceededLimit: boolean }> {
  if (input.response.body === null) {
    const buffer = Buffer.from(await input.response.arrayBuffer());
    return { buffer, byteLength: buffer.byteLength, exceededLimit: buffer.byteLength > input.maxBytes };
  }

  const reader = input.response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!value || value.byteLength === 0) {
        continue;
      }

      total += value.byteLength;
      if (total > input.maxBytes) {
        try {
          await reader.cancel("Managed cover payload exceeded the maximum size");
        } catch {
          // Ignore cancellation errors from already-closed streams.
        }

        return { buffer: Buffer.alloc(0), byteLength: total, exceededLimit: true };
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return { buffer: Buffer.concat(chunks, total), byteLength: total, exceededLimit: false };
}

async function uploadManagedCover(
  storage: StoragePort,
  input: { bookStorageKey: string; provider: SearchProviderId | "manual" | "epub"; contentType: string; coverBuffer: Buffer; sourceUrl: string | null },
): Promise<ManagedBookCoverResult> {
  const extension = extensionFromImageContentType(input.contentType);
  if (extension === null) {
    coverServiceLogger.warn(
      { event: "library.cover.upload.unsupported_image_type", bookStorageKey: input.bookStorageKey, provider: input.provider, sourceUrl: input.sourceUrl, contentType: input.contentType },
      "Managed cover upload used an unsupported image type",
    );
    return { managedUrl: null, sourceUrl: input.sourceUrl };
  }

  try {
    const fileName = buildManagedBookCoverFileName(input.bookStorageKey, extension);
    const versionToken = buildManagedBookCoverVersionToken(input.coverBuffer);
    await storage.put(buildManagedBookCoverStorageKey(fileName), input.coverBuffer, input.contentType);
    await deleteOtherManagedCovers(storage, input.bookStorageKey, fileName);

    coverServiceLogger.info(
      {
        event: "library.cover.uploaded",
        bookStorageKey: input.bookStorageKey,
        provider: input.provider,
        sourceUrl: input.sourceUrl,
        fileName,
        contentType: input.contentType,
        byteLength: input.coverBuffer.byteLength,
      },
      "Managed cover uploaded to storage",
    );

    return { managedUrl: buildVersionedManagedBookCoverUrl(fileName, versionToken), sourceUrl: input.sourceUrl };
  } catch (error: unknown) {
    coverServiceLogger.warn(
      {
        event: "library.cover.upload.failed",
        bookStorageKey: input.bookStorageKey,
        provider: input.provider,
        sourceUrl: input.sourceUrl,
        contentType: input.contentType,
        error: toLogError(error),
      },
      "Managed cover upload failed",
    );
    return { managedUrl: null, sourceUrl: input.sourceUrl };
  }
}

export async function storeManagedBookCoverFromBuffer(storage: StoragePort, input: StoreManagedBookCoverBufferInput): Promise<ManagedBookCoverResult> {
  const contentType = normalizeContentType(input.contentType);
  if (contentType === null || !contentType.startsWith("image/")) {
    coverServiceLogger.warn(
      { event: "library.cover.buffer.unsupported_content_type", bookStorageKey: input.bookStorageKey, contentType: input.contentType },
      "Managed cover buffer used an unsupported content type",
    );
    return { managedUrl: null, sourceUrl: null };
  }

  if (extensionFromImageContentType(contentType) === null) {
    coverServiceLogger.warn({ event: "library.cover.buffer.unsupported_image_type", bookStorageKey: input.bookStorageKey, contentType }, "Managed cover buffer used an unsupported image type");
    return { managedUrl: null, sourceUrl: null };
  }

  if (input.coverBuffer.byteLength < MIN_MANAGED_BOOK_COVER_BYTES || input.coverBuffer.byteLength > MAX_MANAGED_BOOK_COVER_BYTES) {
    coverServiceLogger.warn(
      { event: "library.cover.buffer.invalid_size", bookStorageKey: input.bookStorageKey, byteLength: input.coverBuffer.byteLength },
      "Managed cover buffer was too small or too large",
    );
    return { managedUrl: null, sourceUrl: null };
  }

  if (!hasImageMagicBytes(input.coverBuffer, contentType)) {
    coverServiceLogger.warn(
      { event: "library.cover.buffer.invalid_signature", bookStorageKey: input.bookStorageKey, contentType, byteLength: input.coverBuffer.byteLength },
      "Managed cover buffer did not match the declared image type",
    );
    return { managedUrl: null, sourceUrl: null };
  }

  return uploadManagedCover(storage, { bookStorageKey: input.bookStorageKey, provider: "epub", contentType, coverBuffer: input.coverBuffer, sourceUrl: null });
}

export async function storeManagedBookCoverFromExternalUrl(
  storage: StoragePort,
  input: StoreExternalBookCoverInput,
  fetchImpl: FetchLike = fetch,
): Promise<ManagedBookCoverResult> {
  const sourceUrl = normalizePublicExternalUrl(input.coverUrl);
  if (sourceUrl === null) {
    return { managedUrl: null, sourceUrl: null };
  }

  try {
    const response = await fetchImpl(sourceUrl, { method: "GET", headers: buildDefaultFetchHeaders() });

    if (!response.ok) {
      coverServiceLogger.warn(
        { event: "library.cover.fetch.rejected", bookStorageKey: input.bookStorageKey, provider: "manual", sourceUrl, status: response.status },
        "Managed cover fetch failed, falling back to source URL",
      );
      return { managedUrl: null, sourceUrl };
    }

    const resolvedSourceUrl = normalizePublicExternalUrl(response.url);
    if (resolvedSourceUrl === null) {
      coverServiceLogger.warn(
        { event: "library.cover.fetch.redirect_rejected", bookStorageKey: input.bookStorageKey, provider: "manual", sourceUrl, redirectUrl: response.url },
        "Managed cover fetch redirected to an untrusted URL",
      );
      return { managedUrl: null, sourceUrl };
    }

    const contentType = normalizeContentType(response.headers.get("content-type"));
    if (contentType === null || !contentType.startsWith("image/")) {
      coverServiceLogger.warn(
        { event: "library.cover.fetch.unsupported_content_type", bookStorageKey: input.bookStorageKey, provider: "manual", sourceUrl: resolvedSourceUrl, contentType },
        "Managed cover fetch returned a non-image response",
      );
      return { managedUrl: null, sourceUrl: resolvedSourceUrl };
    }

    const declaredSize = parseDeclaredSize(response.headers.get("content-length"));
    if (declaredSize !== null && declaredSize > MAX_MANAGED_BOOK_COVER_BYTES) {
      coverServiceLogger.warn(
        { event: "library.cover.fetch.too_large_declared", bookStorageKey: input.bookStorageKey, provider: "manual", sourceUrl: resolvedSourceUrl, declaredSize },
        "Managed cover fetch exceeded the size limit before download",
      );
      return { managedUrl: null, sourceUrl: resolvedSourceUrl };
    }

    const extension = extensionFromImageContentType(contentType);
    if (extension === null) {
      coverServiceLogger.warn(
        { event: "library.cover.fetch.unsupported_image_type", bookStorageKey: input.bookStorageKey, provider: "manual", sourceUrl: resolvedSourceUrl, contentType },
        "Managed cover fetch returned an unsupported image type",
      );
      return { managedUrl: null, sourceUrl: resolvedSourceUrl };
    }

    const coverRead = await readResponseBufferWithinLimit({ response, maxBytes: MAX_MANAGED_BOOK_COVER_BYTES });
    if (coverRead.exceededLimit || coverRead.byteLength < MIN_MANAGED_BOOK_COVER_BYTES) {
      coverServiceLogger.warn(
        { event: "library.cover.fetch.invalid_size", bookStorageKey: input.bookStorageKey, provider: "manual", sourceUrl: resolvedSourceUrl, byteLength: coverRead.byteLength },
        "Managed cover fetch returned a too-small or oversized payload",
      );
      return { managedUrl: null, sourceUrl: resolvedSourceUrl };
    }

    if (!hasImageMagicBytes(coverRead.buffer, contentType)) {
      coverServiceLogger.warn(
        {
          event: "library.cover.fetch.invalid_signature",
          bookStorageKey: input.bookStorageKey,
          provider: "manual",
          sourceUrl: resolvedSourceUrl,
          contentType,
          byteLength: coverRead.byteLength,
        },
        "Managed cover fetch returned bytes that did not match the declared image type",
      );
      return { managedUrl: null, sourceUrl: resolvedSourceUrl };
    }

    return uploadManagedCover(storage, { bookStorageKey: input.bookStorageKey, provider: "manual", contentType, coverBuffer: coverRead.buffer, sourceUrl: resolvedSourceUrl });
  } catch (error: unknown) {
    coverServiceLogger.warn(
      { event: "library.cover.fetch.failed", bookStorageKey: input.bookStorageKey, provider: "manual", sourceUrl, error: toLogError(error) },
      "Managed cover fetch failed, falling back to source URL",
    );
    return { managedUrl: null, sourceUrl };
  }
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function buildZLibraryCookie(credentials: ZLibraryCredentials): string {
  return ["siteLanguageV2=en", `remix_userid=${credentials.userId}`, `remix_userkey=${credentials.userKey}`].join("; ");
}

function normalizeSearchImportSourceUrl(provider: SearchProviderId, coverUrl: string | null | undefined, zlibraryMirrorUrls: readonly string[]): string | null {
  const normalized = typeof coverUrl === "string" ? coverUrl.trim() : "";
  if (!normalized) {
    return null;
  }

  if (provider === "gutenberg") {
    return null;
  }

  if (provider === "openlibrary") {
    const url = parseUrl(normalized);
    if (url === null || url.protocol !== "https:" || url.hostname !== OPEN_LIBRARY_COVER_HOST) {
      return null;
    }
    return url.toString();
  }

  if (provider === "anna") {
    const url = parseUrl(normalized);
    if (url === null || url.protocol !== "https:") {
      return null;
    }
    if (url.hostname !== ANNA_ARCHIVE_COVER_HOST && url.hostname !== OPEN_LIBRARY_COVER_HOST) {
      return null;
    }
    return url.toString();
  }

  if (provider === "zlibrary") {
    const baseUrl = parseUrl(zlibraryMirrorUrls[0] ?? DEFAULT_ZLIBRARY_BASE_URL);
    if (baseUrl === null) {
      return null;
    }

    let url = parseUrl(normalized);
    if (url === null) {
      try {
        url = normalized.startsWith("//") ? new URL(`https:${normalized}`) : new URL(buildZLibraryUrl(baseUrl.toString(), normalized));
      } catch {
        return null;
      }
    }

    if (url === null || url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  }

  return null;
}

function buildSearchImportFetchHeaders(
  provider: SearchProviderId,
  zlibraryCredentials: ZLibraryCredentials | undefined,
  targetUrl: string,
  zlibraryMirrorUrls: readonly string[],
): Headers {
  const headers = buildDefaultFetchHeaders();

  const requestUrl = parseUrl(targetUrl);
  const mirrorOrigins = new Set(
    zlibraryMirrorUrls
      .map(parseUrl)
      .filter((url): url is URL => url !== null)
      .map((url) => url.origin),
  );
  if (provider === "zlibrary" && zlibraryCredentials && requestUrl !== null && mirrorOrigins.has(requestUrl.origin)) {
    headers.set("Cookie", buildZLibraryCookie(zlibraryCredentials));
  }

  return headers;
}

export async function storeManagedBookCoverFromSearchImport(
  storage: StoragePort,
  input: StoreManagedBookCoverInput,
  getZLibraryMirrorUrls: () => Promise<readonly string[]>,
  fetchImpl: FetchLike = fetch,
): Promise<ManagedBookCoverResult> {
  const mirrorUrls = input.provider === "zlibrary" ? await getZLibraryMirrorUrls() : [DEFAULT_ZLIBRARY_BASE_URL];
  const sourceUrl = normalizeSearchImportSourceUrl(input.provider, input.coverUrl, mirrorUrls);
  if (sourceUrl === null) {
    return { managedUrl: null, sourceUrl: null };
  }

  const fetchHeaders = buildSearchImportFetchHeaders(input.provider, input.zlibraryCredentials, sourceUrl, mirrorUrls);

  try {
    const response = await fetchImpl(sourceUrl, { method: "GET", headers: fetchHeaders });

    if (!response.ok) {
      coverServiceLogger.warn(
        { event: "library.cover.fetch.rejected", bookStorageKey: input.bookStorageKey, provider: input.provider, sourceUrl, status: response.status },
        "Managed cover fetch failed, falling back to source URL",
      );
      return { managedUrl: null, sourceUrl };
    }

    const resolvedSourceUrl = normalizeSearchImportSourceUrl(input.provider, response.url, mirrorUrls);
    if (resolvedSourceUrl === null) {
      coverServiceLogger.warn(
        { event: "library.cover.fetch.redirect_rejected", bookStorageKey: input.bookStorageKey, provider: input.provider, sourceUrl, redirectUrl: response.url },
        "Managed cover fetch redirected to an untrusted URL",
      );
      return { managedUrl: null, sourceUrl };
    }

    const contentType = normalizeContentType(response.headers.get("content-type"));
    if (contentType === null || !contentType.startsWith("image/")) {
      coverServiceLogger.warn(
        { event: "library.cover.fetch.unsupported_content_type", bookStorageKey: input.bookStorageKey, provider: input.provider, sourceUrl: resolvedSourceUrl, contentType },
        "Managed cover fetch returned a non-image response",
      );
      return { managedUrl: null, sourceUrl: resolvedSourceUrl };
    }

    const declaredSize = parseDeclaredSize(response.headers.get("content-length"));
    if (declaredSize !== null && declaredSize > MAX_MANAGED_BOOK_COVER_BYTES) {
      coverServiceLogger.warn(
        { event: "library.cover.fetch.too_large_declared", bookStorageKey: input.bookStorageKey, provider: input.provider, sourceUrl: resolvedSourceUrl, declaredSize },
        "Managed cover fetch exceeded the size limit before download",
      );
      return { managedUrl: null, sourceUrl: resolvedSourceUrl };
    }

    const extension = extensionFromImageContentType(contentType);
    if (extension === null) {
      coverServiceLogger.warn(
        { event: "library.cover.fetch.unsupported_image_type", bookStorageKey: input.bookStorageKey, provider: input.provider, sourceUrl: resolvedSourceUrl, contentType },
        "Managed cover fetch returned an unsupported image type",
      );
      return { managedUrl: null, sourceUrl: resolvedSourceUrl };
    }

    const coverRead = await readResponseBufferWithinLimit({ response, maxBytes: MAX_MANAGED_BOOK_COVER_BYTES });
    if (coverRead.exceededLimit || coverRead.byteLength < MIN_MANAGED_BOOK_COVER_BYTES) {
      coverServiceLogger.warn(
        { event: "library.cover.fetch.invalid_size", bookStorageKey: input.bookStorageKey, provider: input.provider, sourceUrl: resolvedSourceUrl, byteLength: coverRead.byteLength },
        "Managed cover fetch returned a too-small or oversized payload",
      );
      return { managedUrl: null, sourceUrl: resolvedSourceUrl };
    }

    if (!hasImageMagicBytes(coverRead.buffer, contentType)) {
      coverServiceLogger.warn(
        {
          event: "library.cover.fetch.invalid_signature",
          bookStorageKey: input.bookStorageKey,
          provider: input.provider,
          sourceUrl: resolvedSourceUrl,
          contentType,
          byteLength: coverRead.byteLength,
        },
        "Managed cover fetch returned bytes that did not match the declared image type",
      );
      return { managedUrl: null, sourceUrl: resolvedSourceUrl };
    }

    return uploadManagedCover(storage, { bookStorageKey: input.bookStorageKey, provider: input.provider, contentType, coverBuffer: coverRead.buffer, sourceUrl: resolvedSourceUrl });
  } catch (error: unknown) {
    coverServiceLogger.warn(
      { event: "library.cover.fetch.failed", bookStorageKey: input.bookStorageKey, provider: input.provider, sourceUrl, error: toLogError(error) },
      "Managed cover fetch failed, falling back to source URL",
    );
    return { managedUrl: null, sourceUrl };
  }
}
