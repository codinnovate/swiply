import { describe, expect, it } from "vitest";

import {
  filterVideos,
  formatCount,
  formatDuration,
  formatPercent,
  formatWeekday,
  guessHandle,
  performanceVsMedian,
  sortHashtags,
  sortVideos,
  type CompetitorVideo,
  type HashtagStat,
} from "@/lib/competitors";

const video = (id: string, overrides: Partial<CompetitorVideo> = {}): CompetitorVideo => ({
  id,
  url: `https://www.tiktok.com/@brand/video/${id}`,
  caption: "",
  hashtags: [],
  coverUrl: null,
  durationSeconds: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  engagementRate: 0,
  isPromoted: false,
  isPinned: false,
  music: null,
  ...overrides,
});

const tag = (name: string, uses: number, avgViews: number, avgEngagementRate: number): HashtagStat => ({
  tag: name,
  uses,
  avgViews,
  totalViews: uses * avgViews,
  avgEngagementRate,
  lastUsedAt: "2026-09-01T00:00:00.000Z",
});

describe("guessHandle", () => {
  it("matches the backend's handle rules", () => {
    expect(guessHandle("Blue Apron")).toBe("blueapron");
    expect(guessHandle("Duolingo", "@Duo_Owl")).toBe("duo_owl");
    expect(guessHandle("https://www.tiktok.com/@gymshark?lang=en")).toBe("gymshark");
    expect(guessHandle("!")).toBeNull();
    expect(guessHandle("x".repeat(25))).toBeNull();
  });
});

describe("formatters", () => {
  it("formats counts, rates, weekdays and durations", () => {
    expect(formatCount(1_250_000)).toBe("1.3M");
    expect(formatCount(950)).toBe("950");
    expect(formatCount(null)).toBe("—");
    expect(formatPercent(0.1234)).toBe("12.3%");
    expect(formatPercent(0.0456)).toBe("4.56%");
    expect(formatWeekday(6)).toBe("Saturday");
    expect(formatWeekday(null)).toBe("—");
    expect(formatDuration(75)).toBe("1:15");
    expect(formatDuration(null)).toBeNull();
  });
});

describe("sortVideos / filterVideos", () => {
  const videos = [
    video("old-viral", { createdAt: "2026-08-01T00:00:00.000Z", views: 9000, engagementRate: 0.02, hashtags: ["fyp"] }),
    video("new", { createdAt: "2026-09-10T00:00:00.000Z", views: 100, engagementRate: 0.2, isPromoted: true, hashtags: ["sale"] }),
    video("mid", { createdAt: "2026-09-01T00:00:00.000Z", views: 500, engagementRate: 0.05, hashtags: ["fyp", "sale"] }),
  ];

  it("sorts by date, views or engagement without mutating the input", () => {
    expect(sortVideos(videos, "latest").map((v) => v.id)).toEqual(["new", "mid", "old-viral"]);
    expect(sortVideos(videos, "views").map((v) => v.id)).toEqual(["old-viral", "mid", "new"]);
    expect(sortVideos(videos, "engagement").map((v) => v.id)).toEqual(["new", "mid", "old-viral"]);
    expect(videos[0].id).toBe("old-viral");
  });

  it("filters by hashtag and promoted flag together", () => {
    expect(filterVideos(videos, { hashtag: "fyp" }).map((v) => v.id)).toEqual(["old-viral", "mid"]);
    expect(filterVideos(videos, { hashtag: "sale", promotedOnly: true }).map((v) => v.id)).toEqual(["new"]);
    expect(filterVideos(videos, {})).toHaveLength(3);
  });
});

describe("sortHashtags", () => {
  it("ranks by uses, average views or engagement", () => {
    const tags = [tag("a", 5, 100, 0.01), tag("b", 2, 900, 0.03), tag("c", 5, 300, 0.08)];
    expect(sortHashtags(tags, "uses").map((t) => t.tag)).toEqual(["c", "a", "b"]);
    expect(sortHashtags(tags, "avgViews").map((t) => t.tag)).toEqual(["b", "c", "a"]);
    expect(sortHashtags(tags, "engagement").map((t) => t.tag)).toEqual(["c", "b", "a"]);
  });
});

describe("performanceVsMedian", () => {
  it("flags breakouts and underperformers against the median", () => {
    expect(performanceVsMedian(3000, 1000)).toEqual({ label: "3.0× median", tone: "up" });
    expect(performanceVsMedian(400, 1000)).toEqual({ label: "0.4× median", tone: "down" });
    expect(performanceVsMedian(1100, 1000)).toEqual({ label: "Typical", tone: "flat" });
    expect(performanceVsMedian(10, 0)).toEqual({ label: "—", tone: "flat" });
  });
});
