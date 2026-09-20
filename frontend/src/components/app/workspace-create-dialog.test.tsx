import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceCreateDialog } from "@/components/app/workspace-create-dialog";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { Workspace } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  json: (value: unknown) => ({ body: JSON.stringify(value) }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const existingWorkspace: Workspace = {
  id: "workspace-1",
  name: "Existing",
  ownerId: "user-1",
  planId: "free",
  timezone: "UTC",
  role: "owner",
  createdAt: "2026-09-11T00:00:00.000Z",
  updatedAt: "2026-09-11T00:00:00.000Z",
};

const createdWorkspace: Workspace = {
  id: "workspace-2",
  name: "Acme Social",
  ownerId: "user-1",
  planId: "free",
  timezone: "Africa/Lagos",
  createdAt: "2026-09-11T00:00:00.000Z",
  updatedAt: "2026-09-11T00:00:00.000Z",
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.workspaces, [existingWorkspace]);
  const onCreated = vi.fn();
  const onOpenChange = vi.fn();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  render(
    <WorkspaceCreateDialog
      open
      onOpenChange={onOpenChange}
      onCreated={onCreated}
    />,
    { wrapper: Wrapper },
  );

  return { queryClient, onCreated, onOpenChange };
}

describe("WorkspaceCreateDialog", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("rejects empty and whitespace-only names", async () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(await screen.findByText("Enter a workspace name")).toBeVisible();

    fireEvent.change(screen.getByLabelText(/Workspace name/), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));

    await waitFor(() => expect(api).not.toHaveBeenCalled());
  });

  it("rejects names longer than 80 characters", async () => {
    setup();

    fireEvent.change(screen.getByLabelText(/Workspace name/), {
      target: { value: "a".repeat(81) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(await screen.findByText("Use 80 characters or fewer")).toBeVisible();
    expect(api).not.toHaveBeenCalled();
  });

  it("creates, caches, and returns an owner workspace", async () => {
    vi.mocked(api).mockResolvedValue(createdWorkspace);
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: "Africa/Lagos" }),
        }) as Intl.DateTimeFormat,
    );
    const { queryClient, onCreated } = setup();

    fireEvent.change(screen.getByLabelText(/Workspace name/), {
      target: { value: "  Acme Social  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: "Acme Social",
          timezone: "Africa/Lagos",
        }),
      }),
    );

    const ownedWorkspace = { ...createdWorkspace, role: "owner" };
    expect(onCreated).toHaveBeenCalledWith(ownedWorkspace);
    expect(queryClient.getQueryData<Workspace[]>(queryKeys.workspaces)).toEqual([
      existingWorkspace,
      ownedWorkspace,
    ]);
    expect(toast.success).toHaveBeenCalledWith("Acme Social created");
  });

  it("keeps the dialog open and preserves the cache when creation fails", async () => {
    vi.mocked(api).mockRejectedValue(new Error("Workspace could not be created"));
    const { queryClient, onCreated, onOpenChange } = setup();

    fireEvent.change(screen.getByLabelText(/Workspace name/), {
      target: { value: "Acme Social" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Workspace could not be created"),
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.workspaces)).toEqual([
      existingWorkspace,
    ]);
  });
});
