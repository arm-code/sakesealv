import { ok, err, type Result } from "@/lib/types/result";

export interface ApiFailure {
  message: string;
  status: number;
  cause?: unknown;
}

export type ApiResult<T> = Result<T, ApiFailure>;

export function apiOk<T>(value: T): ApiResult<T> {
  return ok(value);
}

export function apiError(message: string, status = 500, cause?: unknown): ApiResult<never> {
  return err({ message, status, cause });
}

export function errorResponse(message: string, status = 500): Response {
  return Response.json({ error: message }, { status });
}
