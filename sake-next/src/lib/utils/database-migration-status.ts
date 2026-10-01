import type { DatabaseVersionInfo } from "@/lib/types/app-version";

export function getDatabaseMigrationStatusNote(
  version: DatabaseVersionInfo | null,
  errorMessage: string | null,
  loading = false,
): string | null {
  if (loading) {
    return null;
  }

  if (errorMessage || version?.status === "unavailable") {
    return "Could not inspect the database migration status right now.";
  }

  if (version?.status === "outdated" || version?.status === "untracked") {
    return "Run bun run db:migrate or restart the sake-migrator container to bring the database schema up to date.";
  }

  return null;
}
