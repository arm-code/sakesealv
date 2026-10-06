import type { MetadataCandidate, MetadataCoverCandidate } from "@/lib/server/application/ports";
import { METADATA_PROVIDER_IDS } from "@/lib/types/metadata-provider";
import { isApplyMetadataFieldSelection, type ApplyMetadataFieldSelection } from "@/lib/server/application/use-cases/apply-metadata-candidate";

export interface ApplyMetadataCandidateRequestBody {
  candidate: MetadataCandidate;
  fieldSelections: ApplyMetadataFieldSelection[];
  coverChoice?: MetadataCoverCandidate | null;
}

const METADATA_PROVIDER_ID_SET = new Set<string>(METADATA_PROVIDER_IDS);
const DESCRIPTION_FORMATS = new Set(["text", "html", "markdown"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  throw new Error(`${field} must be a string or null`);
}

function numberOrNull(value: unknown, field: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  throw new Error(`${field} must be a number or null`);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  return value;
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${field} must be an array of strings`);
  }
  return value as string[];
}

function parseIdentifiers(value: unknown): MetadataCandidate["identifiers"] {
  if (!isRecord(value)) {
    throw new Error("candidate.identifiers must be an object");
  }
  return {
    isbn10: stringOrNull(value.isbn10, "candidate.identifiers.isbn10"),
    isbn13: stringOrNull(value.isbn13, "candidate.identifiers.isbn13"),
    asin: stringOrNull(value.asin, "candidate.identifiers.asin"),
    googleBooksId: stringOrNull(value.googleBooksId, "candidate.identifiers.googleBooksId"),
    openLibraryKey: stringOrNull(value.openLibraryKey, "candidate.identifiers.openLibraryKey"),
    hardcoverId: stringOrNull(value.hardcoverId, "candidate.identifiers.hardcoverId"),
  };
}

function parsePublishedDate(value: unknown): MetadataCandidate["publishedDate"] {
  if (!isRecord(value)) {
    throw new Error("candidate.publishedDate must be an object");
  }
  return {
    year: numberOrNull(value.year, "candidate.publishedDate.year"),
    month: numberOrNull(value.month, "candidate.publishedDate.month"),
    day: numberOrNull(value.day, "candidate.publishedDate.day"),
  };
}

function parseRating(value: unknown): MetadataCandidate["rating"] {
  if (!isRecord(value)) {
    throw new Error("candidate.rating must be an object");
  }
  return {
    average: numberOrNull(value.average, "candidate.rating.average"),
    count: numberOrNull(value.count, "candidate.rating.count"),
  };
}

function parseCoverCandidate(value: unknown, field: string): MetadataCoverCandidate {
  if (!isRecord(value)) {
    throw new Error(`${field} must be an object`);
  }
  const url = requireString(value.url, `${field}.url`);
  const source = requireString(value.source, `${field}.source`);
  const width = value.width === undefined ? undefined : numberOrNull(value.width, `${field}.width`) ?? undefined;
  const height = value.height === undefined ? undefined : numberOrNull(value.height, `${field}.height`) ?? undefined;
  return { url, source, ...(width !== undefined ? { width } : {}), ...(height !== undefined ? { height } : {}) };
}

function parseCovers(value: unknown): MetadataCoverCandidate[] {
  if (!Array.isArray(value)) {
    throw new Error("candidate.covers must be an array");
  }
  return value.map((entry, index) => parseCoverCandidate(entry, `candidate.covers[${index}]`));
}

function parseCandidate(value: unknown): MetadataCandidate {
  if (!isRecord(value)) {
    throw new Error("candidate must be an object");
  }

  const providerId = requireString(value.providerId, "candidate.providerId");
  if (!METADATA_PROVIDER_ID_SET.has(providerId)) {
    throw new Error(`candidate.providerId must be one of ${[...METADATA_PROVIDER_ID_SET].join(", ")}`);
  }

  const descriptionFormat = requireString(value.descriptionFormat, "candidate.descriptionFormat");
  if (!DESCRIPTION_FORMATS.has(descriptionFormat)) {
    throw new Error("candidate.descriptionFormat must be one of text, html, markdown");
  }

  return {
    providerId: providerId as MetadataCandidate["providerId"],
    providerScore: numberOrNull(value.providerScore, "candidate.providerScore") ?? 0,
    identifiers: parseIdentifiers(value.identifiers),
    title: requireString(value.title, "candidate.title"),
    subtitle: stringOrNull(value.subtitle, "candidate.subtitle"),
    authors: requireStringArray(value.authors, "candidate.authors"),
    description: stringOrNull(value.description, "candidate.description"),
    descriptionFormat: descriptionFormat as MetadataCandidate["descriptionFormat"],
    subjects: requireStringArray(value.subjects, "candidate.subjects"),
    series: stringOrNull(value.series, "candidate.series"),
    seriesIndex: numberOrNull(value.seriesIndex, "candidate.seriesIndex"),
    publisher: stringOrNull(value.publisher, "candidate.publisher"),
    publishedDate: parsePublishedDate(value.publishedDate),
    language: stringOrNull(value.language, "candidate.language"),
    pageCount: numberOrNull(value.pageCount, "candidate.pageCount"),
    covers: parseCovers(value.covers),
    rating: parseRating(value.rating),
    sourceUrl: stringOrNull(value.sourceUrl, "candidate.sourceUrl"),
  };
}

function parseFieldSelections(value: unknown): ApplyMetadataFieldSelection[] {
  if (!Array.isArray(value)) {
    throw new Error("fieldSelections must be an array");
  }
  return value.map((entry, index) => {
    if (typeof entry !== "string" || !isApplyMetadataFieldSelection(entry)) {
      throw new Error(`fieldSelections[${index}] is not a valid field selection`);
    }
    return entry;
  });
}

function parseCoverChoice(value: unknown): MetadataCoverCandidate | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return parseCoverCandidate(value, "coverChoice");
}

export function parseApplyMetadataCandidateRequest(body: unknown): ApplyMetadataCandidateRequestBody {
  if (!isRecord(body)) {
    throw new Error("Body must be a JSON object");
  }

  return {
    candidate: parseCandidate(body.candidate),
    fieldSelections: parseFieldSelections(body.fieldSelections),
    coverChoice: parseCoverChoice(body.coverChoice),
  };
}
