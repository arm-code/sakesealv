import { isAuthenticationFailureStatus, SAKE_CLEAR_ZLIBRARY_AUTH_HEADER_NAME } from "@/lib/auth-response-signals";
import { clearZLibraryCookies } from "@/lib/server/auth/cookies";
import { errorResponse, withResponseHeader } from "@/lib/server/http/api";

export async function zlibraryAuthFailureResponse(message: string, status: number): Promise<Response> {
  const response = errorResponse(message, status);

  if (!isAuthenticationFailureStatus(status)) {
    return response;
  }

  await clearZLibraryCookies();
  return withResponseHeader(response, SAKE_CLEAR_ZLIBRARY_AUTH_HEADER_NAME, "true");
}
