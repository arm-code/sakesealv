import type {
  ZLibraryPasswordLoginInput,
  ZLibraryTokenLoginInput,
} from "@/lib/server/application/use-cases/zlibrary-auth";

const MAX_CREDENTIAL_LENGTH = 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequiredString(raw: Record<string, unknown>, field: string, maxLength: number): string {
  const value = raw[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  if (value.length > maxLength) {
    throw new Error(`${field} is too long`);
  }
  return value.trim();
}

export function parseZTokenLoginRequest(raw: unknown): ZLibraryTokenLoginInput {
  if (!isRecord(raw)) {
    throw new Error("Body must be a JSON object");
  }
  return {
    userId: parseRequiredString(raw, "userId", MAX_CREDENTIAL_LENGTH),
    userKey: parseRequiredString(raw, "userKey", MAX_CREDENTIAL_LENGTH),
  };
}

export function parseZPasswordLoginRequest(raw: unknown): ZLibraryPasswordLoginInput {
  if (!isRecord(raw)) {
    throw new Error("Body must be a JSON object");
  }
  return {
    email: parseRequiredString(raw, "email", 320),
    password: parseRequiredString(raw, "password", MAX_CREDENTIAL_LENGTH),
  };
}
