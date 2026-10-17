import type { UserRepositoryPort } from "@/lib/server/application/ports";
import { hashPassword } from "@/lib/server/application/local-auth-service";
import { apiError, apiOk, type ApiResult } from "@/lib/server/http/api";

interface SetBasicAuthPasswordInput {
  userId: number;
  password: string;
}

interface SetBasicAuthPasswordResult {
  success: true;
  hasBasicAuthPassword: true;
}

export class SetBasicAuthPasswordUseCase {
  constructor(private readonly userRepository: UserRepositoryPort) {}

  async execute(input: SetBasicAuthPasswordInput): Promise<ApiResult<SetBasicAuthPasswordResult>> {
    if (!input.password || input.password.length < 8) {
      return apiError("Password must be at least 8 characters", 400);
    }

    const user = await this.userRepository.getById(input.userId);
    if (!user) return apiError("User not found", 404);

    const passwordHash = await hashPassword(input.password);
    await this.userRepository.setBasicAuthPasswordHash(input.userId, passwordHash, new Date().toISOString());

    return apiOk({ success: true, hasBasicAuthPassword: true });
  }
}
