"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CircleAlert, ExternalLink, Eye, Heart, MessageCircle, Share2, type LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { AnalyticsOverview } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

const METRICS = ["views", "likes", "comments", "shares"] as const;
type Metric = (typeof METRICS)[number];

const METRIC_ICONS: Record<Metric, LucideIcon> = { views: Eye, likes: Heart, comments: MessageCircle, shares: Share2 };

const chartConfig = {
  views: { label: "Views", color: "var(--primary)" },
  likes: { label: "Likes", color: "var(--secondary)" },
  comments: { label: "Comments", color: "var(--primary)" },
  shares: { label: "Shares", color: "var(--secondary)" },
} satisfies ChartConfig;

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const dayLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

export function formatCount(value: number) {
  return value < 10_000 ? value.toLocaleString("en") : compact.format(value);
}

export function PerformanceOverview({ workspaceId }: { workspaceId: string }) {
  const [days, setDays] = useState<Range>(30);
  const [metric, setMetric] = useState<Metric>("views");
  const analytics = useQuery({
    queryKey: queryKeys.analytics(workspaceId, days),
    queryFn: () => api<AnalyticsOverview>(`/analytics/overview?days=${days}`, {}, workspaceId),
    placeholderData: (previous) => previous,
  });
  const data = analytics.data;

  return (
    <Card className="mt-6">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Performance</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Views and engagement on your TikTok videos, by the day each was posted.</p>
        </div>
        <div className="flex rounded-lg border p-0.5" role="group" aria-label="Date range">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={days === range}
              onClick={() => setDays(range)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                days === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {range}d
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {analytics.isPending ? (
          <PerformanceSkeleton />
        ) : analytics.isError ? (
          <ErrorState message="We couldn’t load your analytics." retry={() => analytics.refetch()} />
        ) : !data?.accounts.length ? (
          <EmptyState
            icon={BarChart3}
            title="Connect TikTok to see your numbers"
            description="Once an account is connected, its views, likes, comments and shares show up here."
            action={<Button asChild size="sm"><Link href="/app/accounts">Connect an account</Link></Button>}
          />
        ) : (
          <>
            {data.accounts.some((account) => account.syncError) && (
              <p className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <CircleAlert className="size-3.5 shrink-0" />
                Some numbers couldn’t be refreshed, so you’re seeing the last ones we had.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="tablist" aria-label="Metric">
              {METRICS.map((key) => {
                const Icon = METRIC_ICONS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={metric === key}
                    onClick={() => setMetric(key)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      metric === key ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="size-3.5" />
                      {chartConfig[key].label}
                    </span>
                    <span className="mt-1 block font-display text-2xl font-normal tabular-nums">{formatCount(data.totals[key])}</span>
                  </button>
                );
              })}
            </div>

            {data.totals.posts === 0 ? (
              <EmptyState
                className="mt-4"
                icon={BarChart3}
                title={`No videos in the last ${days} days`}
                description="Post on TikTok, from Swiply or the app, and its numbers will appear here within the hour."
              />
            ) : (
              <ChartContainer config={chartConfig} className="mt-4 aspect-auto h-64 w-full">
                <BarChart data={data.daily} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                    tickFormatter={(value: string) => dayLabel.format(new Date(value))}
                  />
                  <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(value: number) => compact.format(value)} />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        nameKey={metric}
                        labelFormatter={(_, payload) => {
                          const date = payload[0]?.payload?.date;
                          return typeof date === "string" ? dayLabel.format(new Date(date)) : null;
                        }}
                      />
                    }
                  />
                  <Bar dataKey={metric} fill={`var(--color-${metric})`} radius={4} />
                </BarChart>
              </ChartContainer>
            )}

            {data.topPosts.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold">Top posts</h3>
                <ol className="mt-2 divide-y">
                  {data.topPosts.map((post) => (
                    <li key={post.id} className="flex items-center gap-3 py-3">
                      {post.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- TikTok CDN covers are signed, short-lived URLs
                        <img src={post.coverImageUrl} alt="" className="h-14 w-10 shrink-0 rounded-md bg-muted object-cover" />
                      ) : (
                        <span className="h-14 w-10 shrink-0 rounded-md bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{post.title || "Untitled video"}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          {post.accountName} · {formatDate(post.postedAt)}
                          {post.viaSwiply && <Badge className="px-1.5 py-0 text-[10px] normal-case">Swiply</Badge>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-4 text-xs tabular-nums">
                        <span className="flex items-center gap-1" title="Views"><Eye className="size-3.5 text-muted-foreground" />{formatCount(post.views)}</span>
                        <span className="flex items-center gap-1" title="Likes"><Heart className="size-3.5 text-muted-foreground" />{formatCount(post.likes)}</span>
                        {post.shareUrl && (
                          <a href={post.shareUrl} target="_blank" rel="noreferrer" aria-label="Open on TikTok" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PerformanceSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading analytics">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {METRICS.map((key) => <Skeleton key={key} className="h-[74px]" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
