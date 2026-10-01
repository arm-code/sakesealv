// Composition root — Fase 3a+3b: auth local, shelves, y ahora Account/Devices
// (API keys, logout-all, basic auth password, devices) están wireados.
// Cuando se migren más features, extender este archivo (igual que el original
// `composition.ts` barrel, pero sin arrastrar subsistemas que aún no existen
// en sake-next: library/books, zlibrary, metadata providers, annotations...).
import { UserRepository } from "@/lib/server/infrastructure/repositories/user-repository";
import { UserSessionRepository } from "@/lib/server/infrastructure/repositories/user-session-repository";
import { UserApiKeyRepository } from "@/lib/server/infrastructure/repositories/user-api-key-repository";
import { ShelfRepository } from "@/lib/server/infrastructure/repositories/shelf-repository";
import { DeviceRepository } from "@/lib/server/infrastructure/repositories/device-repository";
import { DeviceDownloadRepository } from "@/lib/server/infrastructure/repositories/device-download-repository";
import { DeviceProgressDownloadRepository } from "@/lib/server/infrastructure/repositories/device-progress-download-repository";

import { ResolveRequestAuthUseCase } from "@/lib/server/application/use-cases/resolve-request-auth";
import { GetAuthStatusUseCase } from "@/lib/server/application/use-cases/get-auth-status";
import { BootstrapLocalAccountUseCase } from "@/lib/server/application/use-cases/bootstrap-local-account";
import { LoginLocalAccountUseCase } from "@/lib/server/application/use-cases/login-local-account";
import { LogoutLocalAccountUseCase } from "@/lib/server/application/use-cases/logout-local-account";
import { LogoutAllLocalSessionsUseCase } from "@/lib/server/application/use-cases/logout-all-local-sessions";
import { GetCurrentUserUseCase } from "@/lib/server/application/use-cases/get-current-user";
import { SetBasicAuthPasswordUseCase } from "@/lib/server/application/use-cases/set-basic-auth-password";
import { ClearBasicAuthPasswordUseCase } from "@/lib/server/application/use-cases/clear-basic-auth-password";
import { ListActiveApiKeysUseCase } from "@/lib/server/application/use-cases/list-active-api-keys";
import { RevokeApiKeyUseCase } from "@/lib/server/application/use-cases/revoke-api-key";
import { ListDevicesUseCase } from "@/lib/server/application/use-cases/list-devices";
import { DeleteDeviceUseCase } from "@/lib/server/application/use-cases/delete-device";
import { ListShelvesUseCase } from "@/lib/server/application/use-cases/list-shelves";
import { CreateShelfUseCase } from "@/lib/server/application/use-cases/create-shelf";
import { UpdateShelfUseCase } from "@/lib/server/application/use-cases/update-shelf";
import { UpdateShelfRulesUseCase } from "@/lib/server/application/use-cases/update-shelf-rules";
import { ReorderShelvesUseCase } from "@/lib/server/application/use-cases/reorder-shelves";
import { DeleteShelfUseCase } from "@/lib/server/application/use-cases/delete-shelf";

export const userRepository = new UserRepository();
export const userSessionRepository = new UserSessionRepository();
export const userApiKeyRepository = new UserApiKeyRepository();
export const shelfRepository = new ShelfRepository();
export const deviceRepository = new DeviceRepository();
export const deviceDownloadRepository = new DeviceDownloadRepository();
export const deviceProgressDownloadRepository = new DeviceProgressDownloadRepository();

export const resolveRequestAuthUseCase = new ResolveRequestAuthUseCase(userRepository, userSessionRepository, userApiKeyRepository);
export const getAuthStatusUseCase = new GetAuthStatusUseCase(userRepository);
export const bootstrapLocalAccountUseCase = new BootstrapLocalAccountUseCase(userRepository, userSessionRepository);
export const loginLocalAccountUseCase = new LoginLocalAccountUseCase(userRepository, userSessionRepository);
export const logoutLocalAccountUseCase = new LogoutLocalAccountUseCase(userSessionRepository);
export const logoutAllLocalSessionsUseCase = new LogoutAllLocalSessionsUseCase(userSessionRepository);
export const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepository);
export const setBasicAuthPasswordUseCase = new SetBasicAuthPasswordUseCase(userRepository);
export const clearBasicAuthPasswordUseCase = new ClearBasicAuthPasswordUseCase(userRepository);
export const listActiveApiKeysUseCase = new ListActiveApiKeysUseCase(userApiKeyRepository);
export const revokeApiKeyUseCase = new RevokeApiKeyUseCase(userApiKeyRepository);
export const listDevicesUseCase = new ListDevicesUseCase(deviceRepository, userApiKeyRepository);
export const deleteDeviceUseCase = new DeleteDeviceUseCase(
  deviceRepository,
  userApiKeyRepository,
  deviceDownloadRepository,
  deviceProgressDownloadRepository,
);

export const listShelvesUseCase = new ListShelvesUseCase(shelfRepository);
export const createShelfUseCase = new CreateShelfUseCase(shelfRepository);
export const updateShelfUseCase = new UpdateShelfUseCase(shelfRepository);
export const updateShelfRulesUseCase = new UpdateShelfRulesUseCase(shelfRepository);
export const reorderShelvesUseCase = new ReorderShelvesUseCase(shelfRepository);
export const deleteShelfUseCase = new DeleteShelfUseCase(shelfRepository);
