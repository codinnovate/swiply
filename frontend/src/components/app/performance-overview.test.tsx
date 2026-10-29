import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatCount, PerformanceOverview } from "@/components/app/performance-overview";
import { api } from "@/lib/api";
import type { AnalyticsOverview } from "@/lib/types";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));

// Recharts' ResponsiveContainer needs layout measurements jsdom doesn't have.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return { ...actual, ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div> };
});

const apiMock = vi.mocked(api);

const overview = (overrides: Partial<AnalyticsOverview> = {}): AnalyticsOverview => ({
  days: 30,
  totals: { posts: 2, views: 125_400, likes: 8_210, comments: 96, shares: 41 },
  daily: [
    { date: "2026-10-01", posts: 1, views: 100_000, likes: 7_000, comments: 80, shares: 30 },
    { date: "2026-10-02", posts: 1, views: 25_400, likes: 1_210, comments: 16, shares: 11 },
  ],
  topPosts: [
    {
      id: "m1",
      platform: "tiktok",
      accountName: "Creator",
      title: "How we ship slideshows",
      postedAt: "2026-10-01T10:00:00.000Z",
      coverImageUrl: null,
      shareUrl: "https://www.tiktok.com/@creator/video/1",
      views: 100_000,
      likes: 7_000,
      comments: 80,
      shares: 30,
      viaSwiply: true,
    },
  ],
  accounts: [{ id: "a1", platform: "tiktok", displayName: "Creator", lastSyncedAt: "2026-10-02T10:00:00.000Z", syncError: null }],
  ...overrides,
});

function renderPerformance() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PerformanceOverview workspaceId="workspace-1" />
    </QueryClientProvider>,
  );
}

describe("PerformanceOverview", () => {
  beforeEach(() => apiMock.mockReset());

  it("shows view, like, comment and share totals and the top posts", async () => {
    apiMock.mockResolvedValue(overview());
    renderPerformance();

    const metrics = await screen.findByRole("tablist", { name: "Metric" });
    expect(within(metrics).getByRole("tab", { name: /Views\s*125\.4K/ })).toHaveAttribute("aria-selected", "true");
    expect(within(metrics).getByRole("tab", { name: /Likes\s*8,210/ })).toBeInTheDocument();
    expect(within(metrics).getByRole("tab", { name: /Comments\s*96/ })).toBeInTheDocument();
    expect(within(metrics).getByRole("tab", { name: /Shares\s*41/ })).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith("/analytics/overview?days=30", {}, "workspace-1");

    const top = screen.getByText("How we ship slideshows").closest("li")!;
    expect(within(top).getByText("Swiply")).toBeInTheDocument();
    expect(within(top).getByText("100K")).toBeInTheDocument();
    expect(within(top).getByRole("link", { name: "Open on TikTok" })).toHaveAttribute("href", "https://www.tiktok.com/@creator/video/1");
  });

  it("switches the charted metric and refetches for a new range", async () => {
    apiMock.mockResolvedValue(overview());
    renderPerformance();

    const likes = await screen.findByRole("tab", { name: /Likes/ });
    fireEvent.click(likes);
    expect(likes).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/analytics/overview?days=7", {}, "workspace-1"));
    expect(screen.getByRole("button", { name: "7d" })).toHaveAttribute("aria-pressed", "true");
  });

  it("asks to connect an account when none can report analytics", async () => {
    apiMock.mockResolvedValue(overview({ accounts: [], topPosts: [], daily: [], totals: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 } }));
    renderPerformance();

    expect(await screen.findByText("Connect TikTok to see your numbers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect an account" })).toHaveAttribute("href", "/app/accounts");
  });

  it("says so when nothing was posted in the range, and flags a failed refresh", async () => {
    apiMock.mockResolvedValue(
      overview({
        totals: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 },
        topPosts: [],
        accounts: [{ id: "a1", platform: "tiktok", displayName: "Creator", lastSyncedAt: null, syncError: "TikTok said no" }],
      }),
    );
    renderPerformance();

    expect(await screen.findByText("No videos in the last 30 days")).toBeInTheDocument();
    expect(screen.getByText(/couldn’t be refreshed/)).toBeInTheDocument();
  });
});

describe("formatCount", () => {
  it("keeps small numbers exact and compacts large ones", () => {
    expect(formatCount(9_999)).toBe("9,999");
    expect(formatCount(125_400)).toBe("125.4K");
    expect(formatCount(2_000_000)).toBe("2M");
  });
});
