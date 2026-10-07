export const SAKE_CLEAR_ZLIBRARY_AUTH_HEADER_NAME = "x-sake-clear-zlibrary-auth";
export const ZLIBRARY_AUTH_CLEARED_EVENT_NAME = "sake:zlibrary-auth-cleared";

export function isAuthenticationFailureStatus(status: number): boolean {
  return status === 401 || status === 403;
}
