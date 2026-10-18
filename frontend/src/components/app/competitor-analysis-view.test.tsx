import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompetitorAnalysisView } from "@/components/app/competitor-analysis-view";
import { api } from "@/lib/api";
import type { CompetitorListItem, CompetitorReport, CompetitorSourceAvailability } from "@/lib/competitors";
import type { Workspace } from "@/lib/types";
import { AppProviders } from "@/providers/app-providers";

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  json: (value: unknown) => ({ body: JSON.stringify(value) }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() }, Toaster: () => null }));

// Recharts' ResponsiveContainer needs layout measurements jsdom doesn't have.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return { ...actual, ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div> };
});

const workspace: Workspace = {
  id: "workspace-1",
  name: "Acme",
  ownerId: "user-1",
  planId: "free",
  timezone: "UTC",
  role: "owner",
  createdAt: "2026-09-11T00:00:00.000Z",
  updatedAt: "2026-09-11T00:00:00.000Z",
};

const video = (id: string, overrides: Partial<CompetitorReport["videos"][number]>) => ({
  id,
  url: `https://www.tiktok.com/@gymshark/video/${id}`,
  caption: `Video ${id}`,
  hashtags: [] as string[],
  coverUrl: null,
  durationSeconds: 20,
  createdAt: "2026-09-10T18:00:00.000Z",
  views: 1000,
  likes: 100,
  comments: 5,
  shares: 3,
  saves: 2,
  engagementRate: 0.11,
  isPromoted: false,
  isPinned: false,
  music: null,
  ...overrides,
});

const report: CompetitorReport = {
  id: "report-1",
  cached: false,
  network: "tiktok",
  company: "Gymshark",
  handle: "gymshark",
  profile: {
    handle: "gymshark",
    displayName: "Gymshark",
    avatarUrl: null,
    bio: "Be a visionary.",
    verified: true,
    followers: 5_400_000,
    following: 10,
    likes: 98_000_000,
    videoCount: 2100,
    profileUrl: "https://www.tiktok.com/@gymshark",
  },
  summary: {
    videosAnalyzed: 2,
    totalViews: 51_000,
    avgViews: 25_500,
    medianViews: 25_500,
    avgEngagementRate: 0.11,
    postsPerWeek: 2,
    promotedCount: 1,
    topHashtag: "gymtok",
    bestWeekday: 4,
    bestHourUtc: 18,
    firstPostAt: "2026-09-03T18:00:00.000Z",
    lastPostAt: "2026-09-10T18:00:00.000Z",
  },
  hashtags: [
    { tag: "gymtok", uses: 2, totalViews: 51_000, avgViews: 25_500, avgEngagementRate: 0.11, lastUsedAt: "2026-09-10T18:00:00.000Z" },
    { tag: "legday", uses: 1, totalViews: 50_000, avgViews: 50_000, avgEngagementRate: 0.11, lastUsedAt: "2026-09-10T18:00:00.000Z" },
  ],
  videos: [
    video("viral", { caption: "Leg day #legday #gymtok", hashtags: ["legday", "gymtok"], views: 50_000, isPromoted: true }),
    video("quiet", { caption: "Rest day #gymtok", hashtags: ["gymtok"], createdAt: "2026-09-03T18:00:00.000Z" }),
  ],
  ads: [
    {
      id: "55",
      advertiserName: "Gymshark Ltd",
      paidFor: null,
      firstShownAt: "2026-09-01",
      lastShownAt: "2026-09-20",
      status: "active",
      reach: "10K-100K",
      videoUrls: [],
      imageUrls: [],
      libraryUrl: "https://library.tiktok.com/ads/detail/?ad_id=55",
    },
  ],
  performance: [
    { weekStart: "2026-09-01", videos: 1, views: 1000, engagementRate: 0.11 },
    { weekStart: "2026-09-08", videos: 1, views: 50_000, engagementRate: 0.11 },
  ],
  sources: { videos: { state: "ok" }, ads: { state: "ok" } },
  fetchedAt: "2026-09-28T12:00:00.000Z",
};

const saved: CompetitorListItem = {
  id: "report-1",
  network: "tiktok",
  company: "Gymshark",
  handle: "gymshark",
  displayName: "Gymshark",
  avatarUrl: null,
  followers: 5_400_000,
  videosAnalyzed: 2,
  adsFound: 1,
  fetchedAt: "2026-09-28T12:00:00.000Z",
};

function mockApi({
  sources = [{ network: "tiktok", videos: true, ads: true }],
  list = [],
}: { sources?: CompetitorSourceAvailability[]; list?: CompetitorListItem[] } = {}) {
  vi.mocked(api).mockImplementation((path, init) => {
    if (path === "/workspaces") return Promise.resolve([workspace]);
    if (path === "/competitors/sources") return Promise.resolve(sources);
    if (path === "/competitors" && !init?.method) return Promise.resolve(list);
    if (path === "/competitors/research") return Promise.resolve(report);
    if (path === "/competitors/report-1" && !init?.method) return Promise.resolve({ ...report, cached: true });
    if (path === "/competitors/report-1" && init?.method === "DELETE") return Promise.resolve(undefined);
    return Promise.reject(new Error(`Unexpected API path: ${path}`));
  });
}

function renderView() {
  return render(
    <AppProviders>
      <CompetitorAnalysisView />
    </AppProviders>,
  );
}

async function runResearch(company = "Gymshark") {
  fireEvent.change(screen.getByLabelText("Company"), { target: { value: company } });
  await waitFor(() => expect(screen.getByRole("button", { name: /Analyze/ })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: /Analyze/ }));
  await screen.findByRole("heading", { name: "Gymshark" });
}

describe("CompetitorAnalysisView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to TikTok and previews the handle it will look up", async () => {
    mockApi();
    renderView();

    expect(screen.getByRole("combobox")).toHaveTextContent("TikTok");
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Blue Apron" } });
    expect(screen.getByText("@blueapron")).toBeVisible();
    fireEvent.change(screen.getByLabelText("TikTok username (optional)"), { target: { value: "@blueapron_us" } });
    expect(screen.getByText("@blueapron_us")).toBeVisible();
  });

  it("researches a company and shows its videos, stats and hashtag filter", async () => {
    mockApi();
    renderView();
    await runResearch();

    expect(api).toHaveBeenCalledWith(
      "/competitors/research",
      { method: "POST", body: JSON.stringify({ network: "tiktok", company: "Gymshark" }) },
      "workspace-1",
    );
    expect(screen.getByText("5.4M")).toBeVisible();
    expect(screen.getByText("Leg day #legday #gymtok")).toBeVisible();
    expect(screen.getByText("Rest day #gymtok")).toBeVisible();
    expect(screen.getByText("2.0× median")).toBeVisible();

    fireEvent.click(screen.getAllByRole("button", { name: "#legday" })[0]);
    expect(screen.queryByText("Rest day #gymtok")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 2 videos")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear hashtag filter" }));
    expect(screen.getByText("2 of 2 videos")).toBeVisible();
  });

  it("lists hashtags and jumps to their videos", async () => {
    mockApi();
    renderView();
    await runResearch();

    fireEvent.click(screen.getByRole("tab", { name: /Hashtags/ }));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    fireEvent.click(within(table).getByRole("button", { name: "#legday" }));

    expect(screen.getByRole("tab", { name: /Videos/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("1 of 2 videos")).toBeVisible();
  });

  it("shows Ad Library ads and promoted profile posts", async () => {
    mockApi();
    renderView();
    await runResearch();

    fireEvent.click(screen.getByRole("tab", { name: /Ads/ }));
    expect(screen.getByText("Gymshark Ltd")).toBeVisible();
    expect(screen.getByText("10K-100K")).toBeVisible();
    expect(screen.getByRole("link", { name: /View in Ad Library/ })).toHaveAttribute(
      "href",
      "https://library.tiktok.com/ads/detail/?ad_id=55",
    );
    expect(screen.getByText("Leg day #legday #gymtok")).toBeVisible();
  });

  it("refreshes a report on demand", async () => {
    mockApi();
    renderView();
    await runResearch();

    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/competitors/research",
        { method: "POST", body: JSON.stringify({ network: "tiktok", company: "Gymshark", handle: "gymshark", refresh: true }) },
        "workspace-1",
      ),
    );
  });

  it("opens and removes tracked competitors", async () => {
    mockApi({ list: [saved] });
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /Gymshark\s*@gymshark/ }));
    expect(await screen.findByText(/saved report/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Remove Gymshark" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/competitors/report-1", { method: "DELETE" }, "workspace-1"));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Gymshark" })).not.toBeInTheDocument());
  });

  it("explains which data sources still need keys", async () => {
    mockApi({ sources: [{ network: "tiktok", videos: false, ads: false }] });
    renderView();

    expect(await screen.findByText("Connect a data source to start")).toBeVisible();
    expect(screen.getByText(/Videos & hashtags are off/)).toBeVisible();
    expect(screen.getByText(/Ad Library is off/)).toBeVisible();
  });
});
