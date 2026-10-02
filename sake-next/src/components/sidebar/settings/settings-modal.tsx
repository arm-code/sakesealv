"use client";

import { useState } from "react";
import { AppWindow, CircleUserRound, Download, Share2, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppPane } from "./app-pane";
import { PluginPane } from "./plugin-pane";
import { IntegrationsPane } from "./integrations-pane";
import { AccountPane } from "./account-pane";
import { DevicesPane } from "./devices-pane";
import { notImplemented } from "./not-implemented";
import { useAccountData } from "./use-account-data";
import { useDevicesData } from "./use-devices-data";
import { usePluginData } from "./use-plugin-data";
import { mockAppVersion, mockHardcoverStatus, mockZlibraryMirrors } from "./mock-data";

const SECTIONS = [
  { id: "app", label: "App", Icon: AppWindow },
  { id: "plugin", label: "Plugin", Icon: Download },
  { id: "integrations", label: "Integrations", Icon: Share2 },
  { id: "account", label: "Account", Icon: CircleUserRound },
  { id: "devices", label: "Devices", Icon: Smartphone },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const APP_SOURCE_URL = "https://github.com/Sudashiii/Sake";

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenZLibraryLogin: () => void;
  onSessionEnded: () => void;
}

export function SettingsModal({ open, onOpenChange, onOpenZLibraryLogin, onSessionEnded }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("app");
  const account = useAccountData({ enabled: open, onSessionEnded });
  const devices = useDevicesData(open);
  const plugin = usePluginData(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeSection}
          onValueChange={(value) => setActiveSection(value as SectionId)}
          className="flex-1 gap-0 overflow-hidden"
        >
          <TabsList
            variant="line"
            className="h-auto w-full shrink-0 justify-start gap-1 overflow-x-auto border-b border-border bg-transparent px-3"
          >
            {SECTIONS.map(({ id, label, Icon }) => (
              <TabsTrigger key={id} value={id} className="gap-1.5 px-2.5">
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto p-5">
            <TabsContent value="app">
              <AppPane
                appVersion={mockAppVersion.version}
                databaseVersion={mockAppVersion.database}
                appVersionError={null}
                appEnvironment="Development"
                appSourceUrl={APP_SOURCE_URL}
                appSourceLabel={APP_SOURCE_URL}
              />
            </TabsContent>
            <TabsContent value="plugin">
              <PluginPane
                releasesInfo={plugin.releasesInfo}
                releasesError={plugin.releasesError}
                isLoadingPluginReleases={plugin.isLoadingPluginReleases}
                upstreamVersionInfo={plugin.upstreamVersionInfo}
                upstreamVersionError={plugin.upstreamVersionError}
                isCheckingPluginUpstreamVersion={plugin.isCheckingPluginUpstreamVersion}
                formatDateTime={formatDateTime}
                onRefresh={plugin.refreshReleases}
                onCheckUpstream={plugin.checkUpstreamVersion}
              />
            </TabsContent>
            <TabsContent value="integrations">
              <IntegrationsPane
                status={mockHardcoverStatus}
                error={null}
                zlibName=""
                showZLibraryLogin
                onOpenZLibraryLogin={onOpenZLibraryLogin}
                onLogoutZLibrary={() => notImplemented("Logging out of Z-Library (Phase 2d)")}
                formatDateTime={formatDateTime}
                initialMirrors={mockZlibraryMirrors}
              />
            </TabsContent>
            <TabsContent value="account">
              <AccountPane
                currentUser={account.currentUser}
                currentUserError={account.currentUserError}
                isLoadingCurrentUser={account.isLoadingCurrentUser}
                apiKeys={account.apiKeys}
                apiKeysError={account.apiKeysError}
                isLoadingApiKeys={account.isLoadingApiKeys}
                revokingApiKeyId={account.revokingApiKeyId}
                formatDateTime={formatDateTime}
                onRefreshApiKeys={account.refreshApiKeys}
                onRevokeApiKey={account.revokeApiKey}
                onLogout={account.logout}
                onLogoutAll={account.logoutAll}
                isLoggingOut={account.isLoggingOut}
                isLoggingOutEverywhere={account.isLoggingOutEverywhere}
                onSaveBasicAuthPassword={account.saveBasicAuthPassword}
                onRemoveBasicAuthPassword={account.removeBasicAuthPassword}
                isSavingBasicAuthPassword={account.isSavingBasicAuthPassword}
                isRemovingBasicAuthPassword={account.isRemovingBasicAuthPassword}
              />
            </TabsContent>
            <TabsContent value="devices">
              <DevicesPane
                devices={devices.devices}
                devicesError={devices.devicesError}
                isLoadingDevices={devices.isLoadingDevices}
                deletingDeviceId={devices.deletingDeviceId}
                formatDateTime={formatDateTime}
                onRefresh={devices.refreshDevices}
                onDelete={devices.deleteDevice}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
