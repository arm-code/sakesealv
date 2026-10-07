import { SAKE_CLEAR_ZLIBRARY_AUTH_HEADER_NAME, ZLIBRARY_AUTH_CLEARED_EVENT_NAME } from "@/lib/auth-response-signals";

export function applyAuthResponseSignals(response: Pick<Response, "headers">): void {
  if (typeof window === "undefined") {
    return;
  }

  if (response.headers.get(SAKE_CLEAR_ZLIBRARY_AUTH_HEADER_NAME) === "true") {
    window.dispatchEvent(new CustomEvent(ZLIBRARY_AUTH_CLEARED_EVENT_NAME));
  }
}
