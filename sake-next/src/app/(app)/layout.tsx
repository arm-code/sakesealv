"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar/sidebar";
import { AppTopBar } from "@/components/layout/app-topbar";
import { MobileSidebarBackdrop } from "@/components/layout/mobile-sidebar-backdrop";
import { SettingsModal } from "@/components/sidebar/settings/settings-modal";
import { ZLibraryAuthModal } from "@/components/zlibrary-auth-modal";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";

function getSectionLabel(pathname: string): string {
  switch (pathname) {
    case "/library":
      // La resolución del nombre de shelf activo llega con la capa de datos en Fase 3.
      return "Library";
    case "/annotations":
      return "Annotations";
    case "/queue":
      return "Queue";
    case "/search":
      return "Search";
    case "/stats":
      return "Stats";
    case "/archived":
      return "Archived";
    case "/trash":
      return "Trash";
    case "/logs":
      return "Logs";
    default:
      return pathname.slice(1).replace(/-/g, " ");
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zlibModalOpen, setZlibModalOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
  }

  return (
    <div className="min-h-dvh">
      <Suspense fallback={null}>
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggleCollapsed={toggleCollapsed}
          onCloseMobile={() => setMobileOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </Suspense>

      <div
        className={cn(
          "flex min-h-dvh flex-col transition-[margin-left] duration-200",
          collapsed ? "lg:ml-18" : "lg:ml-64",
        )}
      >
        <AppTopBar
          currentSection={getSectionLabel(pathname)}
          onToggleMobileSidebar={() => setMobileOpen((open) => !open)}
        />

        <main className="flex-1 overflow-y-auto px-[0.85rem] sm:px-4">{children}</main>
      </div>

      {mobileOpen && <MobileSidebarBackdrop onClose={() => setMobileOpen(false)} />}

      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onOpenZLibraryLogin={() => setZlibModalOpen(true)}
      />
      <ZLibraryAuthModal open={zlibModalOpen} onOpenChange={setZlibModalOpen} />
    </div>
  );
}
