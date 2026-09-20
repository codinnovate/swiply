"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Bot,
  CalendarDays,
  ChevronDown,
  CircleGauge,
  FileCode2,
  Images,
  Library,
  Menu,
  MessageCircleReply,
  Moon,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Brand } from "@/components/brand";
import { WorkspaceCreateDialog } from "@/components/app/workspace-create-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { User, Workspace } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { useAppStore } from "@/providers/app-providers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const navigation = [
  {
    label: "Workspace",
    items: [
      { href: "/app", label: "Overview", icon: CircleGauge },
      { href: "/app/content", label: "Content", icon: Library },
      { href: "/app/media", label: "Media", icon: Images },
      { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/app/schedules", label: "Schedules", icon: Zap },
    ],
  },
  {
    label: "Automate",
    items: [
      {
        href: "/app/engagement",
        label: "Engagement",
        icon: MessageCircleReply,
      },
      { href: "/app/automation", label: "Activity", icon: Bot },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/app/accounts", label: "Social accounts", icon: Users },
      { href: "/app/settings", label: "Settings", icon: Settings },
      { href: "/app/developer", label: "Developer", icon: FileCode2 },
    ],
  },
];

export function useWorkspace() {
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const setActive = useAppStore((s) => s.setActiveWorkspaceId);
  const workspaces = useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: () => api<Workspace[]>("/workspaces"),
  });
  const current =
    workspaces.data?.find((w) => w.id === activeWorkspaceId) ||
    workspaces.data?.[0] ||
    null;
  if (current && !activeWorkspaceId) setTimeout(() => setActive(current.id), 0);
  return {
    workspace: current,
    workspaces: workspaces.data || [],
    isLoading: workspaces.isLoading,
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebar = useAppStore((s) => s.setSidebarOpen);
  const modal = useAppStore((s) => s.modal);
  const openModal = useAppStore((s) => s.openModal);
  const closeModal = useAppStore((s) => s.closeModal);
  const { workspace, workspaces } = useWorkspace();
  const setWorkspace = useAppStore((s) => s.setActiveWorkspaceId);
  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<User>("/auth/me"),
  });
  const { resolvedTheme, setTheme } = useTheme();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className="min-h-dvh bg-background">
      <div
        className={cn(
          "fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm lg:hidden",
          sidebarOpen ? "block" : "hidden",
        )}
        onClick={() => setSidebar(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-card transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-5">
          <Brand />
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebar(false)}
          >
            <X className="size-5" />
          </Button>
        </div>
        <div className="border-b p-3">
          <button
            className="flex w-full items-center gap-3 rounded-xl border bg-background p-2.5 text-left hover:bg-muted"
            onClick={() => openModal("workspace")}
          >
            <span className="grid size-8 place-items-center rounded-lg bg-secondary text-xs font-bold text-secondary-foreground">
              {initials(workspace?.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {workspace?.name || "Loading workspace"}
              </span>
              <span className="block text-[11px] capitalize text-muted-foreground">
                {workspace?.planId || "free"} plan
              </span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {navigation.map((group) => (
            <div key={group.label} className="mb-6">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    item.href === "/app"
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebar(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <item.icon className="size-4.5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted">
            <span className="grid size-9 place-items-center rounded-full bg-accent text-xs font-bold">
              {initials(me.data?.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {me.data?.name || "Your account"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {me.data?.email}
              </span>
            </span>
            <button
              type="button"
              onClick={logout}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Exit
            </button>
          </div>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-xl sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebar(true)}
          >
            <Menu className="size-5" />
          </Button>
          <button
            onClick={() => openModal("command")}
            className="hidden h-9 w-full max-w-sm items-center gap-2 rounded-xl border bg-card px-3 text-sm text-muted-foreground sm:flex"
          >
            <Search className="size-4" />
            Search or jump to…
            <kbd className="ml-auto rounded-md border bg-muted px-1.5 py-0.5 text-[10px]">
              ⌘K
            </kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "dark" ? (
                <Sun className="size-4.5" />
              ) : (
                <Moon className="size-4.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon">
              <Bell className="size-4.5" />
            </Button>
            <Button asChild size="sm">
              <Link href="/app/content/new">
                <Plus className="size-4" />
                Create
              </Link>
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <Dialog
        open={modal === "workspace"}
        onOpenChange={(open) => !open && closeModal()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a workspace</DialogTitle>
            <DialogDescription>
              Everything in the dashboard follows the selected workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {workspaces.map((item) => (
              <button
                key={item.id}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left",
                  item.id === workspace?.id && "border-primary bg-primary/5",
                )}
                onClick={() => {
                  setWorkspace(item.id);
                  closeModal();
                }}
              >
                <span className="grid size-9 place-items-center rounded-lg bg-secondary text-xs font-bold text-white">
                  {initials(item.name)}
                </span>
                <span className="flex-1 text-sm font-semibold">
                  {item.name}
                </span>
                <span className="text-xs capitalize text-muted-foreground">
                  {item.role}
                </span>
              </button>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => openModal("workspace-create")}
            >
              <Plus className="size-4" />
              New workspace
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <WorkspaceCreateDialog
        open={modal === "workspace-create"}
        onOpenChange={(open) => !open && closeModal()}
        onCreated={(created) => {
          setWorkspace(created.id);
          closeModal();
        }}
      />
      <Dialog
        open={modal === "command"}
        onOpenChange={(open) => !open && closeModal()}
      >
        <DialogContent className="p-0">
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-5 text-muted-foreground" />
            <input
              autoFocus
              className="h-14 flex-1 bg-transparent text-sm outline-none"
              placeholder="Search content, posts, and settings…"
            />
          </div>
          <div className="p-3">
            <p className="px-2 py-2 text-xs font-bold text-muted-foreground">
              QUICK ACTIONS
            </p>
            {[
              {
                label: "Create content",
                href: "/app/content/new",
                icon: Sparkles,
              },
              { label: "Upload media", href: "/app/media", icon: Images },
              { label: "Open settings", href: "/app/settings", icon: Settings },
            ].map((x) => (
              <Link
                key={x.href}
                href={x.href}
                onClick={closeModal}
                className="flex items-center gap-3 rounded-xl p-3 text-sm hover:bg-muted"
              >
                <x.icon className="size-4" />
                {x.label}
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
