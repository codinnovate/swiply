import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app/app-shell";
import { api } from "@/lib/api";
import type { User, Workspace } from "@/lib/types";
import { AppProviders } from "@/providers/app-providers";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  json: (value: unknown) => ({ body: JSON.stringify(value) }),
}));

const workspace: Workspace = {
  id: "workspace-1",
  name: "Existing",
  ownerId: "user-1",
  planId: "free",
  timezone: "UTC",
  role: "owner",
  createdAt: "2026-09-11T00:00:00.000Z",
  updatedAt: "2026-09-11T00:00:00.000Z",
};

const user: User = {
  id: "user-1",
  email: "owner@example.com",
  name: "Workspace Owner",
  avatarUrl: null,
  emailVerified: true,
  defaultWorkspaceId: workspace.id,
};

describe("AppShell workspace switcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api).mockImplementation((path) => {
      if (path === "/workspaces") return Promise.resolve([workspace]);
      if (path === "/auth/me") return Promise.resolve(user);
      return Promise.reject(new Error(`Unexpected API path: ${path}`));
    });
  });

  it("opens the creation form from the New workspace button", async () => {
    render(
      <AppProviders>
        <AppShell>
          <div>Dashboard</div>
        </AppShell>
      </AppProviders>,
    );

    const workspaceName = await screen.findByText("Existing");
    fireEvent.click(workspaceName.closest("button")!);
    fireEvent.click(
      await screen.findByRole("button", { name: "New workspace" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Create a workspace" }),
    ).toBeVisible();
    expect(screen.getByLabelText(/Workspace name/)).toHaveFocus();
  });
});
