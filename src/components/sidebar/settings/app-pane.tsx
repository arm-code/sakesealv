import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { MetaList, MetaRow } from "./meta-row";
import { getDatabaseMigrationStatusNote } from "@/lib/utils/database-migration-status";
import type { AppVersionResponse } from "@/lib/types/app-version";

interface AppPaneProps {
  appVersion: string;
  databaseVersion: AppVersionResponse["database"] | null;
  appVersionError: string | null;
  isLoadingAppVersion?: boolean;
  appEnvironment: string;
  appSourceUrl: string;
  appSourceLabel: string;
}

function getDatabaseVersionLabel(
  version: AppVersionResponse["database"] | null,
  loading: boolean,
): string {
  if (loading && !version) return "Checking...";
  if (!version) return "Unavailable";
  if (version.currentMigrationTag) return version.currentMigrationTag;
  if (version.status === "untracked") return "Untracked";
  if (version.status === "unavailable") return "Unavailable";
  return "Unknown";
}

function getMigrationStatusLabel(
  version: AppVersionResponse["database"] | null,
  loading: boolean,
): string {
  if (loading && !version) return "Checking...";
  switch (version?.status) {
    case "up_to_date":
      return "Up to date";
    case "outdated":
      return "Migration required";
    case "untracked":
      return "Untracked";
    default:
      return "Unavailable";
  }
}

function getIssueUrl(sourceUrl: string): string {
  return `${sourceUrl.replace(/\/$/, "")}/issues/new`;
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

const subscribeNoop = () => () => {};

function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  // The stored theme is unknown on the server; avoid a hydration mismatch.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const active = mounted ? (theme ?? "system") : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Appearance</p>
        <p className="text-sm text-muted-foreground">Choose light, dark, or follow your system.</p>
      </div>
      <div className="flex gap-2" role="group" aria-label="Theme">
        {THEME_OPTIONS.map(({ value, label, Icon }) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={active === value ? "default" : "outline"}
            aria-pressed={active === value}
            onClick={() => setTheme(value)}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function AppPane({
  appVersion,
  databaseVersion,
  appVersionError,
  isLoadingAppVersion = false,
  appEnvironment,
  appSourceUrl,
  appSourceLabel,
}: AppPaneProps) {
  const statusNote = getDatabaseMigrationStatusNote(
    databaseVersion,
    appVersionError,
    isLoadingAppVersion,
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-foreground">Sake</h4>
          <p className="text-sm text-muted-foreground">Self-hosted e-book reading and sync platform</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={appSourceUrl} target="_blank" rel="noopener noreferrer" />}
          >
            Open GitHub
          </Button>
          <Button
            size="sm"
            nativeButton={false}
            render={<a href={getIssueUrl(appSourceUrl)} target="_blank" rel="noopener noreferrer" />}
          >
            Report a Bug
          </Button>
        </div>
      </div>

      <ThemeSelector />

      <MetaList>
        <MetaRow label="Version" value={<span className="font-mono text-xs">{appVersion}</span>} />
        <MetaRow
          label="Database Version"
          value={<span className="font-mono text-xs">{getDatabaseVersionLabel(databaseVersion, isLoadingAppVersion)}</span>}
        />
        <MetaRow label="Migration Status" value={getMigrationStatusLabel(databaseVersion, isLoadingAppVersion)} />
        <MetaRow label="Environment" value={appEnvironment} />
      </MetaList>
      {statusNote && <p className="text-sm text-destructive">{statusNote}</p>}

      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <p className="mb-1.5 text-sm font-medium text-foreground">About</p>
        <p className="text-sm text-muted-foreground">
          Sake is a self-hosted book management platform designed to work seamlessly with
          KOReader and Z-Library. It provides a unified interface for searching, downloading,
          organizing, and syncing your digital book collection across all your e-readers and
          devices.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Built with privacy in mind — all data stays on your server. No telemetry, no tracking,
          fully open source.
        </p>
      </div>

      <MetaList>
        <MetaRow label="License" value="AGPL-3.0-only" />
        <MetaRow
          label="Source"
          value={
            <a href={appSourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {appSourceLabel}
            </a>
          }
        />
      </MetaList>
    </section>
  );
}
