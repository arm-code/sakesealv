import type { ZLibraryPort } from "@/lib/server/application/ports";
import { apiOk, type ApiResult } from "@/lib/server/http/api";
import type { ZLoginResponse } from "@/lib/types/zlibrary";

export interface ZLibraryTokenLoginInput {
  userId: string;
  userKey: string;
}

interface ZLibraryTokenLoginResult {
  success: true;
  userId: string;
  userKey: string;
}

export class ZLibraryTokenLoginUseCase {
  constructor(private readonly zlibrary: ZLibraryPort) {}

  async execute(request: ZLibraryTokenLoginInput): Promise<ApiResult<ZLibraryTokenLoginResult>> {
    const loginResult = await this.zlibrary.tokenLogin(request.userId, request.userKey);
    if (!loginResult.ok) {
      return loginResult;
    }

    return apiOk({ success: true, userId: request.userId, userKey: request.userKey });
  }
}

export interface ZLibraryPasswordLoginInput {
  email: string;
  password: string;
}

export class ZLibraryPasswordLoginUseCase {
  constructor(private readonly zlibrary: ZLibraryPort) {}

  async execute(request: ZLibraryPasswordLoginInput): Promise<ApiResult<ZLoginResponse>> {
    return this.zlibrary.passwordLogin(request.email, request.password);
  }
}

interface ZLibraryLogoutResult {
  success: true;
}

export class ZLibraryLogoutUseCase {
  async execute(): Promise<ApiResult<ZLibraryLogoutResult>> {
    return apiOk({ success: true });
  }
}
