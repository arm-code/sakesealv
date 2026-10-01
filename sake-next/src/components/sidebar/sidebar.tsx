"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileText,
  Highlighter,
  Library,
  ListTodo,
  Search,
  Settings,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getMenuItems, type MenuItem } from "@/lib/types/navigation";

const NAV_ICONS: Record<string, LucideIcon> = {
  search: Search,
  library: Library,
  annotations: Highlighter,
  queue: ListTodo,
  stats: BarChart3,
  archive: Archive,
  trash: Trash2,
  logs: FileText,
};

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  searchEnabled?: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onOpenSettings: () => void;
}

function isItemActive(pathname: string, item: MenuItem): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function Sidebar({
  collapsed,
  mobileOpen,
  searchEnabled = true,
  onToggleCollapsed,
  onCloseMobile,
  onOpenSettings,
}: SidebarProps) {
  const pathname = usePathname();
  const menuItems = getMenuItems(searchEnabled);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-dvh w-[min(84vw,300px)] flex-col overflow-x-hidden border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:translate-x-0 lg:transition-[width]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "lg:w-18" : "lg:w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center justify-between border-b border-sidebar-border px-3",
          collapsed && "lg:justify-center lg:px-2",
        )}
      >
        <div className={cn("inline-flex min-w-0 items-center gap-2", collapsed && "lg:hidden")}>
          <SakeLogo className="h-7 w-auto shrink-0 text-sidebar-primary" />
          <span className="truncate text-sm font-semibold text-sidebar-foreground">
            Sake
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md border border-sidebar-border text-sidebar-foreground/70 hover:border-sidebar-ring hover:text-sidebar-foreground lg:inline-flex"
        >
          {collapsed ? (
            <ChevronRight className="size-[18px]" aria-hidden="true" />
          ) : (
            <ChevronLeft className="size-[18px]" aria-hidden="true" />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        <ul className="grid gap-1">
          {menuItems.map((item) => {
            const Icon = item.icon ? NAV_ICONS[item.icon] : undefined;
            const active = isItemActive(pathname, item);
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={onCloseMobile}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-[0.65rem] rounded-md border border-transparent px-3 py-[0.62rem] text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active && "bg-sidebar-accent text-sidebar-accent-foreground",
                    collapsed && "lg:justify-center lg:gap-0 lg:px-[0.62rem]",
                  )}
                >
                  {Icon ? <Icon className="size-[1.1rem] shrink-0" aria-hidden="true" /> : null}
                  <span className={cn("truncate", collapsed && "lg:hidden")}>
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          // El modal de ajustes se conecta en la Fase 2b; por ahora el botón es solo visual.
          onClick={onOpenSettings}
          title={collapsed ? "Settings" : undefined}
          aria-label="Open settings"
          className={cn(
            "flex w-full items-center gap-[0.65rem] rounded-md px-3 py-[0.62rem] text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "lg:w-auto lg:justify-center lg:gap-0 lg:px-[0.62rem]",
          )}
        >
          <Settings className="size-5 shrink-0" aria-hidden="true" />
          <span className={cn(collapsed && "lg:hidden")}>Settings</span>
        </button>
      </div>
    </aside>
  );
}

function SakeLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 200"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path d="M0 6C0 2 2 0 6 0H74C78 0 80 2 80 6V200L40 172L0 200V6Z" fill="currentColor" />
    </svg>
  );
}
