// Composition root — Fase 3a..3j: auth local, shelves, Account/Devices (API
// keys, logout-all, basic auth password, devices), el Plugin pane, los
// mirrors de Z-Library, el App pane, el núcleo de library/books (listar/ver
// detalle/leer EPUB/portada/asignar a estantes), progreso/rating (ratings,
// progress-history, rating, state, autosave del lector web), papelera
// (listar/mover/restaurar/borrar permanente + purga de expirados), portadas
// upload/import (subir una imagen propia o importar desde una URL externa),
// y el dominio completo de metadata providers (3j-3m: núcleo — los 4
// proveedores + agregador/ranking + búsqueda de candidatos —, edición
// manual, refetch automático, y aplicar candidato) están wireados. El
// sync de progreso de dispositivos KOReader (PutProgress/GetProgress)
// sigue fuera a propósito — necesita un mecanismo de auth dual (sesión o
// API key de dispositivo) ligado al device-pairing todavía sin portar
// (CreateDeviceApiKeyUseCase). `purgeExpiredTrashUseCase` está wireado
// pero sin ruta ni cron — en el original se dispara desde hooks.server.ts
// por intervalo, mismo hueco de arquitectura que el sync del plugin
// (3c)/Hardcover. `applyMetadataCandidateUseCase` (3m) se invoca desde una
// ruta HTTP nueva inventada (POST /api/library/[id]/metadata/apply) — el
// use-case original estaba huérfano, sin ruta en sake/. Tampoco se tocó
// "search providers" (Anna's Archive/Gutenberg/OpenLibrary-search/
// Z-Library-search) — es un subsistema aparte para *buscar libros para
// descargar*, pertenece a la adquisición Z-Library real, no a metadata
// providers. Cuando se migren más features, extender este archivo (igual
// que el original `composition.ts` barrel, pero sin arrastrar subsistemas
// que aún no existen en sake-next: search providers, adquisición
// Z-Library, annotations, sync de dispositivos...).
import { UserRepository } from "@/lib/server/infrastructure/repositories/user-repository";
import { UserSessionRepository } from "@/lib/server/infrastructure/repositories/user-session-repository";
import { UserApiKeyRepository } from "@/lib/server/infrastructure/repositories/user-api-key-repository";
import { ShelfRepository } from "@/lib/server/infrastructure/repositories/shelf-repository";
import { DeviceRepository } from "@/lib/server/infrastructure/repositories/device-repository";
import { DeviceDownloadRepository } from "@/lib/server/infrastructure/repositories/device-download-repository";
import { DeviceProgressDownloadRepository } from "@/lib/server/infrastructure/repositories/device-progress-download-repository";
import { PluginReleaseRepository } from "@/lib/server/infrastructure/repositories/plugin-release-repository";
import { S3Storage } from "@/lib/server/infrastructure/storage/s3-storage";
import { KoreaderPluginArtifactService } from "@/lib/server/application/services/koreader-plugin-artifact-service";
import { ZLibraryMirrorSettingsRepository } from "@/lib/server/infrastructure/repositories/zlibrary-mirror-settings-repository";
import { MigrationStatusRepository } from "@/lib/server/infrastructure/repositories/migration-status-repository";
import { BookRepository } from "@/lib/server/infrastructure/repositories/book-repository";
import { BookProgressHistoryRepository } from "@/lib/server/infrastructure/repositories/book-progress-history-repository";
import { createLazySingleton } from "@/lib/server/utils/createLazySingleton";
import { resolveZLibraryMirrorUrls } from "@/lib/server/config/zlibrary";
import { ProgressBookResolver } from "@/lib/server/application/services/progress-book-resolver";
import { ProgressPersistenceService } from "@/lib/server/application/services/progress-persistence-service";
import { SidecarWriteCoordinator } from "@/lib/server/application/services/sidecar-write-coordinator";

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
import { SyncKoreaderPluginReleaseUseCase } from "@/lib/server/application/use-cases/sync-koreader-plugin-release";
import { GetLatestKoreaderPluginUseCase } from "@/lib/server/application/use-cases/get-latest-koreader-plugin";
import { ListKoreaderPluginReleasesUseCase } from "@/lib/server/application/use-cases/list-koreader-plugin-releases";
import { GetKoreaderPluginUpstreamVersionUseCase } from "@/lib/server/application/use-cases/get-koreader-plugin-upstream-version";
import { GetKoreaderPluginDownloadUseCase } from "@/lib/server/application/use-cases/get-koreader-plugin-download";
import { GetZLibraryMirrorSettingsUseCase, UpdateZLibraryMirrorSettingsUseCase } from "@/lib/server/application/use-cases/zlibrary-mirror-settings";
import { GetAppVersionUseCase } from "@/lib/server/application/use-cases/get-app-version";
import { ListLibraryUseCase } from "@/lib/server/application/use-cases/list-library";
import { GetLibraryBookDetailUseCase } from "@/lib/server/application/use-cases/get-library-book-detail";
import { GetLibraryBookContentUseCase } from "@/lib/server/application/use-cases/get-library-book-content";
import { GetLibraryCoverUseCase } from "@/lib/server/application/use-cases/get-library-cover";
import { SetBookShelvesUseCase } from "@/lib/server/application/use-cases/set-book-shelves";
import { ListLibraryRatingsUseCase } from "@/lib/server/application/use-cases/list-library-ratings";
import { GetBookProgressHistoryUseCase } from "@/lib/server/application/use-cases/get-book-progress-history";
import { UpdateBookRatingUseCase } from "@/lib/server/application/use-cases/update-book-rating";
import { UpdateLibraryBookStateUseCase } from "@/lib/server/application/use-cases/update-library-book-state";
import { PutWebReaderProgressUseCase } from "@/lib/server/application/use-cases/put-web-reader-progress";
import { ListLibraryTrashUseCase } from "@/lib/server/application/use-cases/list-library-trash";
import { MoveLibraryBookToTrashUseCase } from "@/lib/server/application/use-cases/move-library-book-to-trash";
import { RestoreLibraryBookUseCase } from "@/lib/server/application/use-cases/restore-library-book";
import { DeleteTrashedLibraryBookUseCase } from "@/lib/server/application/use-cases/delete-trashed-library-book";
import { PurgeExpiredTrashUseCase } from "@/lib/server/application/use-cases/purge-expired-trash";
import { UploadLibraryBookCoverUseCase } from "@/lib/server/application/use-cases/upload-library-book-cover";
import { ImportLibraryBookCoverUseCase } from "@/lib/server/application/use-cases/import-library-book-cover";
import { createMetadataProviders } from "@/lib/server/infrastructure/metadata-providers/metadata-provider-factory";
import { getActivatedMetadataProviders } from "@/lib/server/config/activated-metadata-providers";
import { MetadataAggregatorService } from "@/lib/server/application/services/metadata-aggregator-service";
import { SearchMetadataCandidatesUseCase } from "@/lib/server/application/use-cases/search-metadata-candidates";
import { UpdateLibraryBookMetadataUseCase } from "@/lib/server/application/use-cases/update-library-book-metadata";
import { ExternalBookMetadataService } from "@/lib/server/application/services/external-book-metadata-service";
import { RefetchLibraryBookMetadataUseCase } from "@/lib/server/application/use-cases/refetch-library-book-metadata";
import { ApplyMetadataCandidateUseCase } from "@/lib/server/application/use-cases/apply-metadata-candidate";
import { ZLibraryClient } from "@/lib/server/infrastructure/clients/zlibrary-client";
import {
  ZLibraryLogoutUseCase,
  ZLibraryPasswordLoginUseCase,
  ZLibraryTokenLoginUseCase,
} from "@/lib/server/application/use-cases/zlibrary-auth";
import { createSearchProviders } from "@/lib/server/infrastructure/search-providers/search-provider-factory";
import { getActivatedSearchProviders } from "@/lib/server/config/activated-search-providers";
import { SearchBooksUseCase } from "@/lib/server/application/use-cases/search-books";
import { LookupSearchBookMetadataUseCase } from "@/lib/server/application/use-cases/lookup-search-book-metadata";

export const userRepository = new UserRepository();
export const userSessionRepository = new UserSessionRepository();
export const userApiKeyRepository = new UserApiKeyRepository();
export const shelfRepository = new ShelfRepository();
export const deviceRepository = new DeviceRepository();
export const deviceDownloadRepository = new DeviceDownloadRepository();
export const deviceProgressDownloadRepository = new DeviceProgressDownloadRepository();
export const pluginReleaseRepository = new PluginReleaseRepository();
export const storage = createLazySingleton(() => new S3Storage());
export const koreaderPluginArtifactService = new KoreaderPluginArtifactService();
export const zlibraryMirrorSettingsRepository = new ZLibraryMirrorSettingsRepository(
  resolveZLibraryMirrorUrls(process.env.ZLIBRARY_BASE_URL),
);
export const migrationStatusRepository = new MigrationStatusRepository();
export const bookRepository = new BookRepository();
export const bookProgressHistoryRepository = new BookProgressHistoryRepository();
export const sidecarWriteCoordinator = new SidecarWriteCoordinator();

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

export const syncKoreaderPluginReleaseUseCase = new SyncKoreaderPluginReleaseUseCase(
  storage,
  pluginReleaseRepository,
  koreaderPluginArtifactService,
);
export const getLatestKoreaderPluginUseCase = new GetLatestKoreaderPluginUseCase(pluginReleaseRepository);
export const listKoreaderPluginReleasesUseCase = new ListKoreaderPluginReleasesUseCase(pluginReleaseRepository);
export const getKoreaderPluginUpstreamVersionUseCase = new GetKoreaderPluginUpstreamVersionUseCase(pluginReleaseRepository);
export const getKoreaderPluginDownloadUseCase = new GetKoreaderPluginDownloadUseCase(storage, pluginReleaseRepository);

export const getZLibraryMirrorSettingsUseCase = new GetZLibraryMirrorSettingsUseCase(zlibraryMirrorSettingsRepository);
export const updateZLibraryMirrorSettingsUseCase = new UpdateZLibraryMirrorSettingsUseCase(zlibraryMirrorSettingsRepository);

export const getAppVersionUseCase = new GetAppVersionUseCase(migrationStatusRepository);

export const listLibraryUseCase = new ListLibraryUseCase(bookRepository, shelfRepository);
export const getLibraryBookDetailUseCase = new GetLibraryBookDetailUseCase(bookRepository, deviceDownloadRepository, shelfRepository);
export const getLibraryBookContentUseCase = new GetLibraryBookContentUseCase(bookRepository, storage);
export const getLibraryCoverUseCase = new GetLibraryCoverUseCase(storage);
export const setBookShelvesUseCase = new SetBookShelvesUseCase(bookRepository, shelfRepository);

export const listLibraryRatingsUseCase = new ListLibraryRatingsUseCase(bookRepository);
export const getBookProgressHistoryUseCase = new GetBookProgressHistoryUseCase(bookRepository, bookProgressHistoryRepository);
export const updateBookRatingUseCase = new UpdateBookRatingUseCase(bookRepository);
export const updateLibraryBookStateUseCase = new UpdateLibraryBookStateUseCase(bookRepository);

const progressBookResolver = new ProgressBookResolver(bookRepository);
const progressPersistenceService = new ProgressPersistenceService(bookRepository, bookProgressHistoryRepository, storage, deviceProgressDownloadRepository);
export const putWebReaderProgressUseCase = new PutWebReaderProgressUseCase(progressBookResolver, storage, progressPersistenceService, sidecarWriteCoordinator);

export const listLibraryTrashUseCase = new ListLibraryTrashUseCase(bookRepository);
export const moveLibraryBookToTrashUseCase = new MoveLibraryBookToTrashUseCase(bookRepository);
export const restoreLibraryBookUseCase = new RestoreLibraryBookUseCase(bookRepository);
export const deleteTrashedLibraryBookUseCase = new DeleteTrashedLibraryBookUseCase(bookRepository, storage);
export const purgeExpiredTrashUseCase = new PurgeExpiredTrashUseCase(bookRepository, storage);

export const uploadLibraryBookCoverUseCase = new UploadLibraryBookCoverUseCase(bookRepository, storage);
export const importLibraryBookCoverUseCase = new ImportLibraryBookCoverUseCase(bookRepository, storage);

// Fase 3j: los 4 proveedores de metadata (Google Books/OpenLibrary/ISBNdb/
// Hardcover-metadata) + el agregador/ranking + la búsqueda de candidatos.
// Deliberadamente NO incluye "search providers" (Anna's Archive/Gutenberg/
// OpenLibrary-search/Z-Library-search, ~1,502 líneas) — ese es un subsistema
// aparte para *encontrar libros para descargar*, pertenece a la mini-fase de
// adquisición, no a esta. Tampoco incluye ApplyMetadataCandidateUseCase
// (huérfano en el original, decisión pendiente para 3m) ni
// RefetchLibraryBookMetadataUseCase/UpdateLibraryBookMetadataUseCase (3l/3k).
export const activatedMetadataProviders = createMetadataProviders(getActivatedMetadataProviders(), {
  googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY,
  isbnDbApiKey: process.env.ISBNDB_API_KEY,
});
export const activatedMetadataAggregator = new MetadataAggregatorService(activatedMetadataProviders);
export const searchMetadataCandidatesUseCase = new SearchMetadataCandidatesUseCase(activatedMetadataAggregator, bookRepository);

// Fase 3k: edición manual de metadata — sin providers externos, reusa
// deleteManagedBookCoversForStorageKey (3h) directo sobre storage.
export const updateLibraryBookMetadataUseCase = new UpdateLibraryBookMetadataUseCase(bookRepository, storage);

// Fase 3l: refetch automático — reusa el agregador real de 3j
// (activatedMetadataAggregator) en vez de un ExternalBookMetadataService
// con providers vacíos.
export const externalBookMetadataService = new ExternalBookMetadataService(activatedMetadataAggregator);
export const refetchLibraryBookMetadataUseCase = new RefetchLibraryBookMetadataUseCase(bookRepository, externalBookMetadataService);

// Fase 3m: aplicar candidato — huérfano en el original (ver sección "Fase
// 3j" del handoff), portado igual e invocado desde una ruta nueva
// inventada (POST /api/library/[id]/metadata/apply). Usa
// storeManagedBookCoverFromExternalUrl (3i) directo, no necesita nada de
// Z-Library/mirrors.
export const applyMetadataCandidateUseCase = new ApplyMetadataCandidateUseCase(bookRepository, storage);

// Fase 3n: login real de Z-Library (reemplaza el submit mock de la Fase 2d).
// zlibraryClient reusa zlibraryMirrorSettingsRepository (3d) como fuente de
// mirrors en vez de una URL fija, igual que el original.
export const zlibraryClient = new ZLibraryClient(() => zlibraryMirrorSettingsRepository.get());
export const zlibraryTokenLoginUseCase = new ZLibraryTokenLoginUseCase(zlibraryClient);
export const zlibraryPasswordLoginUseCase = new ZLibraryPasswordLoginUseCase(zlibraryClient);
export const zlibraryLogoutUseCase = new ZLibraryLogoutUseCase();

// Fase 3o: pieza B del troceo de adquisición Z-Library — búsqueda
// multi-provider (sin descarga/importación todavía, eso es la pieza C).
// `activeSearchProviderInstances` solo instancia los providers activados por
// ACTIVATED_PROVIDERS (igual que ACTIVATED_METADATA_PROVIDERS en 3j); el
// provider de Z-Library reusa el mismo `zlibraryClient` de 3n.
export const activeSearchProviders = getActivatedSearchProviders();
export const activeSearchProviderInstances = createSearchProviders(activeSearchProviders, { zlibrary: zlibraryClient });
export const searchBooksUseCase = new SearchBooksUseCase(activeSearchProviderInstances, activeSearchProviders);
export const lookupSearchBookMetadataUseCase = new LookupSearchBookMetadataUseCase(externalBookMetadataService);
