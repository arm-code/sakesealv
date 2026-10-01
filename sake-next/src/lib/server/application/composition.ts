// Composition root — Fase 3a: solo auth local y shelves están wireados.
// Cuando se migren más features, extender este archivo (igual que el original
// `composition.ts` barrel, pero sin arrastrar subsistemas que aún no existen
// en sake-next: library/books, zlibrary, metadata providers, annotations...).
import { UserRepository } from "@/lib/server/infrastructure/repositories/user-repository";
import { UserSessionRepository } from "@/lib/server/infrastructure/repositories/user-session-repository";
import { UserApiKeyRepository } from "@/lib/server/infrastructure/repositories/user-api-key-repository";
import { ShelfRepository } from "@/lib/server/infrastructure/repositories/shelf-repository";

import { ResolveRequestAuthUseCase } from "@/lib/server/application/use-cases/resolve-request-auth";
import { GetAuthStatusUseCase } from "@/lib/server/application/use-cases/get-auth-status";
import { BootstrapLocalAccountUseCase } from "@/lib/server/application/use-cases/bootstrap-local-account";
import { LoginLocalAccountUseCase } from "@/lib/server/application/use-cases/login-local-account";
import { LogoutLocalAccountUseCase } from "@/lib/server/application/use-cases/logout-local-account";
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

export const resolveRequestAuthUseCase = new ResolveRequestAuthUseCase(userRepository, userSessionRepository, userApiKeyRepository);
export const getAuthStatusUseCase = new GetAuthStatusUseCase(userRepository);
export const bootstrapLocalAccountUseCase = new BootstrapLocalAccountUseCase(userRepository, userSessionRepository);
export const loginLocalAccountUseCase = new LoginLocalAccountUseCase(userRepository, userSessionRepository);
export const logoutLocalAccountUseCase = new LogoutLocalAccountUseCase(userSessionRepository);

export const listShelvesUseCase = new ListShelvesUseCase(shelfRepository);
export const createShelfUseCase = new CreateShelfUseCase(shelfRepository);
export const updateShelfUseCase = new UpdateShelfUseCase(shelfRepository);
export const updateShelfRulesUseCase = new UpdateShelfRulesUseCase(shelfRepository);
export const reorderShelvesUseCase = new ReorderShelvesUseCase(shelfRepository);
export const deleteShelfUseCase = new DeleteShelfUseCase(shelfRepository);
