"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bookmark,
  CalendarClock,
  ExternalLink,
  Eye,
  Hash,
  Heart,
  Info,
  Megaphone,
  MessageCircle,
  Pin,
  Play,
  Radar,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useWorkspace } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, json } from "@/lib/api";
import {
  competitorNetworks,
  filterVideos,
  formatCount,
  formatDuration,
  formatHourUtc,
  formatPercent,
  formatWeekday,
  guessHandle,
  performanceVsMedian,
  sortHashtags,
  sortVideos,
  type CompetitorListItem,
  type CompetitorNetwork,
  type CompetitorReport,
  type CompetitorSourceAvailability,
  type CompetitorVideo,
  type HashtagSort,
  type SourceStatus,
  type VideoSort,
} from "@/lib/competitors";
import { queryKeys } from "@/lib/query-keys";
import { cn, formatDate } from "@/lib/utils";

type Tab = "videos" | "hashtags" | "ads" | "performance";

const tabs: { id: Tab; label: string }[] = [
  { id: "videos", label: "Videos" },
  { id: "hashtags", label: "Hashtags" },
  { id: "ads", label: "Ads" },
  { id: "performance", label: "Performance" },
];

export function CompetitorAnalysisView() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? "";
  const qc = useQueryClient();
  const [network, setNetwork] = useState<CompetitorNetwork>("tiktok");
  const [company, setCompany] = useState("");
  const [handle, setHandle] = useState("");
  const [report, setReport] = useState<CompetitorReport | null>(null);
  const [tab, setTab] = useState<Tab>("videos");
  const [hashtagFilter, setHashtagFilter] = useState<string | null>(null);

  const sources = useQuery({
    queryKey: queryKeys.competitorSources(workspaceId),
    queryFn: () => api<CompetitorSourceAvailability[]>("/competitors/sources", {}, workspaceId),
    enabled: !!workspace,
  });
  const saved = useQuery({
    queryKey: queryKeys.competitors(workspaceId),
    queryFn: () => api<CompetitorListItem[]>("/competitors", {}, workspaceId),
    enabled: !!workspace,
  });

  function show(next: CompetitorReport) {
    setReport(next);
    setTab("videos");
    setHashtagFilter(null);
  }

  const research = useMutation({
    mutationFn: (input: { company: string; handle?: string; refresh?: boolean }) =>
      api<CompetitorReport>("/competitors/research", { method: "POST", ...json({ network, ...input }) }, workspaceId),
    onSuccess: (next) => {
      show(next);
      qc.invalidateQueries({ queryKey: queryKeys.competitors(workspaceId) });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Research failed"),
  });
  const open = useMutation({
    mutationFn: (id: string) => api<CompetitorReport>(`/competitors/${id}`, {}, workspaceId),
    onSuccess: show,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not open report"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/competitors/${id}`, { method: "DELETE" }, workspaceId),
    onSuccess: (_, id) => {
      if (report?.id === id) setReport(null);
      qc.invalidateQueries({ queryKey: queryKeys.competitors(workspaceId) });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not remove competitor"),
  });

  const guessed = guessHandle(company, handle);
  const availability = sources.data?.find((source) => source.network === network);
  const nothingConfigured = availability ? !availability.videos && !availability.ads : false;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (company.trim().length < 2) return toast.error("Enter a company name or TikTok handle");
    if (!guessed) return toast.error("Add the company's TikTok username");
    research.mutate({ company: company.trim(), handle: handle.trim() || undefined });
  }

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="Competitor analysis"
        description="Look up any company to see every TikTok video they've posted, the hashtags they use, how each post performed, and the ads they're running."
      />

      <Card className="mb-6">
        <CardContent className="pt-5">
          <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[180px_1fr_1fr_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="competitor-network">Social network</Label>
              <Select value={network} onValueChange={(value) => setNetwork(value as CompetitorNetwork)}>
                <SelectTrigger id="competitor-network" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {competitorNetworks.map((item) => (
                    <SelectItem key={item.id} value={item.id} disabled={!item.available}>
                      {item.label}
                      {!item.available && " · soon"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="competitor-company">Company</Label>
              <Input
                id="competitor-company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Gymshark, @duolingo or a TikTok profile link"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="competitor-handle">TikTok username (optional)</Label>
              <Input
                id="competitor-handle"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                placeholder={guessed ? `@${guessed}` : "@username"}
                maxLength={200}
              />
            </div>
            <Button type="submit" disabled={research.isPending || !workspace} className="lg:w-36">
              {research.isPending ? <RefreshCw className="size-4 animate-spin" /> : <Search className="size-4" />}
              {research.isPending ? "Researching" : "Analyze"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            {guessed ? (
              <>
                We&apos;ll analyze <span className="font-semibold text-foreground">@{guessed}</span>. If that isn&apos;t
                their account, enter the exact username.
              </>
            ) : (
              "Enter a company name. We guess the TikTok username from it; add it yourself if it's different."
            )}
          </p>
          {availability && (!availability.videos || !availability.ads) && (
            <SetupNotice videos={availability.videos} ads={availability.ads} />
          )}
        </CardContent>
      </Card>

      {!!saved.data?.length && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Tracked competitors</p>
          <div className="flex flex-wrap gap-2">
            {saved.data.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-2 text-sm transition",
                  report?.id === item.id && "border-primary ring-2 ring-primary/15",
                )}
              >
                <button type="button" className="flex items-center gap-2" onClick={() => open.mutate(item.id)}>
                  <Avatar url={item.avatarUrl} name={item.displayName} size="sm" />
                  <span className="font-semibold">{item.displayName}</span>
                  <span className="text-xs text-muted-foreground">@{item.handle}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${item.displayName}`}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => remove.mutate(item.id)}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {research.isPending || open.isPending ? (
        <ReportSkeleton handle={research.isPending ? guessed : null} />
      ) : research.isError && !report ? (
        <ErrorState message={research.error.message} retry={() => research.reset()} />
      ) : report ? (
        <ReportView
          report={report}
          tab={tab}
          onTab={setTab}
          hashtagFilter={hashtagFilter}
          onHashtag={(tag) => {
            setHashtagFilter(tag);
            setTab("videos");
          }}
          onClearHashtag={() => setHashtagFilter(null)}
          refreshing={research.isPending}
          onRefresh={() => research.mutate({ company: report.company, handle: report.handle, refresh: true })}
          onRemove={() => remove.mutate(report.id)}
        />
      ) : (
        <EmptyState
          icon={Radar}
          title={nothingConfigured ? "Connect a data source to start" : "Research your first competitor"}
          description={
            nothingConfigured
              ? "Add APIFY_TOKEN to the backend to pull competitors' TikTok videos for free, and TikTok Ad Library credentials to see their ads."
              : "Enter a company above. You'll get their recent TikTok videos, hashtag performance, posting rhythm and ads in one place."
          }
        />
      )}
    </>
  );
}

function SetupNotice({ videos, ads }: { videos: boolean; ads: boolean }) {
  return (
    <div className="mt-4 flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5">
      <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <div className="space-y-1">
        {!videos && (
          <p>
            <span className="font-semibold">Videos &amp; hashtags are off.</span> Set <code>APIFY_TOKEN</code> on the
            backend. Apify&apos;s free plan covers about 2,900 TikTok videos a month.
          </p>
        )}
        {!ads && (
          <p>
            <span className="font-semibold">Ad Library is off.</span> Apply for TikTok&apos;s free Commercial Content API,
            then set <code>TIKTOK_AD_LIBRARY_CLIENT_KEY</code> and <code>TIKTOK_AD_LIBRARY_CLIENT_SECRET</code>. Promoted
            posts on a competitor&apos;s profile still show without it.
          </p>
        )}
      </div>
    </div>
  );
}

function ReportView({
  report,
  tab,
  onTab,
  hashtagFilter,
  onHashtag,
  onClearHashtag,
  refreshing,
  onRefresh,
  onRemove,
}: {
  report: CompetitorReport;
  tab: Tab;
  onTab: (tab: Tab) => void;
  hashtagFilter: string | null;
  onHashtag: (tag: string) => void;
  onClearHashtag: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  onRemove: () => void;
}) {
  const { profile, summary } = report;
  const promoted = report.videos.filter((video) => video.isPromoted);
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-foreground text-background">
        <CardContent className="relative pt-6">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <Avatar url={profile?.avatarUrl ?? null} name={profile?.displayName ?? report.company} size="lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-display text-2xl font-normal">{profile?.displayName ?? report.company}</h2>
                  {profile?.verified && <BadgeCheck className="size-5 shrink-0 text-sky-400" aria-label="Verified" />}
                </div>
                <a
                  href={profile?.profileUrl ?? `https://www.tiktok.com/@${report.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-background/70 hover:text-background"
                >
                  @{report.handle} on TikTok <ExternalLink className="size-3" />
                </a>
                {profile?.bio && <p className="mt-2 line-clamp-2 max-w-xl text-sm text-background/70">{profile.bio}</p>}
                <p className="mt-2 text-xs text-background/50">
                  Updated {formatDate(report.fetchedAt, true)}
                  {report.cached && " · saved report"}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid grid-cols-3 gap-6">
                <HeroStat label="Followers" value={formatCount(profile?.followers)} />
                <HeroStat label="Total likes" value={formatCount(profile?.likes)} />
                <HeroStat label="Videos" value={formatCount(profile?.videoCount)} />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing}>
                  <RefreshCw className={cn("size-4", refreshing && "animate-spin")} /> Refresh
                </Button>
                <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove competitor" className="text-background/70 hover:text-background">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <SourceNotices sources={report.sources} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Avg views" value={formatCount(summary.avgViews)} hint={`${summary.videosAnalyzed} recent videos`} />
        <Kpi label="Median views" value={formatCount(summary.medianViews)} hint="A typical post" />
        <Kpi label="Engagement" value={formatPercent(summary.avgEngagementRate)} hint="Likes, comments, shares, saves ÷ views" />
        <Kpi label="Posts / week" value={String(summary.postsPerWeek)} hint={summary.lastPostAt ? `Last ${formatDate(summary.lastPostAt)}` : "-"} />
        <Kpi label="Best slot" value={formatWeekday(summary.bestWeekday).slice(0, 3)} hint={`Around ${formatHourUtc(summary.bestHourUtc)} your time`} />
        <Kpi label="Promoted" value={String(summary.promotedCount + report.ads.length)} hint={`${report.ads.length} in Ad Library · ${summary.promotedCount} on profile`} />
      </div>

      <div role="tablist" aria-label="Report sections" className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((item) => {
          const count =
            item.id === "videos" ? report.videos.length : item.id === "hashtags" ? report.hashtags.length : item.id === "ads" ? report.ads.length + promoted.length : null;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => onTab(item.id)}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition",
                tab === item.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              {count !== null && <span className="ml-1.5 text-xs text-muted-foreground">{count}</span>}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {tab === "videos" && (
          <VideosPanel
            videos={report.videos}
            medianViews={summary.medianViews}
            hashtagFilter={hashtagFilter}
            onHashtag={onHashtag}
            onClearHashtag={onClearHashtag}
          />
        )}
        {tab === "hashtags" && <HashtagsPanel report={report} onHashtag={onHashtag} />}
        {tab === "ads" && <AdsPanel report={report} promoted={promoted} />}
        {tab === "performance" && <PerformancePanel report={report} />}
      </div>
    </div>
  );
}

function SourceNotices({ sources }: { sources: CompetitorReport["sources"] }) {
  const notes: { key: string; status: SourceStatus; label: string }[] = [
    { key: "videos", status: sources.videos, label: "Videos" },
    { key: "ads", status: sources.ads, label: "Ad Library" },
  ].filter(({ status }) => status.state === "failed");
  if (!notes.length) return null;
  return (
    <div className="space-y-2">
      {notes.map(({ key, status, label }) => (
        <div key={key} className="flex gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            <span className="font-semibold">{label} unavailable.</span> {status.message}
          </p>
        </div>
      ))}
    </div>
  );
}

function VideosPanel({
  videos,
  medianViews,
  hashtagFilter,
  onHashtag,
  onClearHashtag,
}: {
  videos: CompetitorVideo[];
  medianViews: number;
  hashtagFilter: string | null;
  onHashtag: (tag: string) => void;
  onClearHashtag: () => void;
}) {
  const [sort, setSort] = useState<VideoSort>("latest");
  const [promotedOnly, setPromotedOnly] = useState(false);
  const shown = useMemo(
    () => sortVideos(filterVideos(videos, { hashtag: hashtagFilter, promotedOnly }), sort),
    [videos, hashtagFilter, promotedOnly, sort],
  );
  if (!videos.length) {
    return <EmptyState icon={Play} title="No videos to show" description="The video source didn't return any posts for this account." />;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Sort videos"
          value={sort}
          onChange={setSort}
          options={[
            { value: "latest", label: "Latest" },
            { value: "views", label: "Most viewed" },
            { value: "engagement", label: "Top engagement" },
          ]}
        />
        <Button variant={promotedOnly ? "default" : "outline"} size="sm" onClick={() => setPromotedOnly((value) => !value)} aria-pressed={promotedOnly}>
          <Megaphone className="size-3.5" /> Promoted only
        </Button>
        {hashtagFilter && (
          <Badge className="gap-1 normal-case">
            #{hashtagFilter}
            <button type="button" aria-label="Clear hashtag filter" onClick={onClearHashtag}>
              <X className="size-3" />
            </button>
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {shown.length} of {videos.length} videos
        </span>
      </div>
      {shown.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((video) => (
            <VideoCard key={video.id} video={video} medianViews={medianViews} onHashtag={onHashtag} />
          ))}
        </div>
      ) : (
        <EmptyState title="No matching videos" description="Clear the filters to see every video." />
      )}
    </div>
  );
}

function VideoCard({ video, medianViews, onHashtag }: { video: CompetitorVideo; medianViews: number; onHashtag: (tag: string) => void }) {
  const vs = performanceVsMedian(video.views, medianViews);
  const duration = formatDuration(video.durationSeconds);
  return (
    <Card className="flex flex-col overflow-hidden">
      <a href={video.url} target="_blank" rel="noreferrer" className="group relative block aspect-[4/5] bg-muted">
        {video.coverUrl ? (
          // TikTok CDN covers are signed, short-lived URLs; next/image would cache them past expiry.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover transition group-hover:scale-[1.02]" />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <Play className="size-8" />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex gap-1.5 p-2">
          {video.isPromoted && (
            <Badge variant="warning" className="bg-amber-100 dark:bg-amber-950">
              <Megaphone className="mr-1 size-3" /> Promoted
            </Badge>
          )}
          {video.isPinned && (
            <Badge variant="secondary">
              <Pin className="mr-1 size-3" /> Pinned
            </Badge>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-2 text-xs font-semibold text-white">
          <span className="flex items-center gap-1">
            <Eye className="size-3.5" /> {formatCount(video.views)}
          </span>
          {duration && <span>{duration}</span>}
        </div>
      </a>
      <CardContent className="flex flex-1 flex-col gap-3 pt-3">
        <p className="line-clamp-3 text-sm">{video.caption || <span className="text-muted-foreground">No caption</span>}</p>
        {!!video.hashtags.length && (
          <div className="flex flex-wrap gap-1">
            {video.hashtags.slice(0, 6).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onHashtag(tag)}
                className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20"
              >
                #{tag}
              </button>
            ))}
            {video.hashtags.length > 6 && <span className="text-[11px] text-muted-foreground">+{video.hashtags.length - 6}</span>}
          </div>
        )}
        <div className="mt-auto grid grid-cols-4 gap-1 text-xs text-muted-foreground">
          <Metric icon={Heart} value={video.likes} label="Likes" />
          <Metric icon={MessageCircle} value={video.comments} label="Comments" />
          <Metric icon={Share2} value={video.shares} label="Shares" />
          <Metric icon={Bookmark} value={video.saves} label="Saves" />
        </div>
        <div className="flex items-center justify-between border-t pt-2 text-xs">
          <span className="text-muted-foreground">{formatDate(video.createdAt)}</span>
          <span className="font-semibold">{formatPercent(video.engagementRate)} eng.</span>
          <span
            className={cn(
              "font-semibold",
              vs.tone === "up" && "text-emerald-600 dark:text-emerald-400",
              vs.tone === "down" && "text-muted-foreground",
            )}
          >
            {vs.label}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function HashtagsPanel({ report, onHashtag }: { report: CompetitorReport; onHashtag: (tag: string) => void }) {
  const [sort, setSort] = useState<HashtagSort>("uses");
  const rows = useMemo(() => sortHashtags(report.hashtags, sort), [report.hashtags, sort]);
  if (!rows.length) {
    return <EmptyState icon={Hash} title="No hashtags found" description="None of the analyzed videos used hashtags." />;
  }
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Hashtags</CardTitle>
          <CardDescription>
            Every hashtag across {report.summary.videosAnalyzed} videos. Click one to see the videos that used it.
          </CardDescription>
        </div>
        <Segmented
          label="Sort hashtags"
          value={sort}
          onChange={setSort}
          options={[
            { value: "uses", label: "Most used" },
            { value: "avgViews", label: "Avg views" },
            { value: "engagement", label: "Engagement" },
          ]}
        />
      </CardHeader>
      <CardContent className="overflow-x-auto pt-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 font-semibold">Hashtag</th>
              <th className="py-2 text-right font-semibold">Uses</th>
              <th className="py-2 text-right font-semibold">Avg views</th>
              <th className="py-2 text-right font-semibold">Total views</th>
              <th className="py-2 text-right font-semibold">Engagement</th>
              <th className="py-2 text-right font-semibold">Last used</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tag} className="border-b last:border-0 hover:bg-muted/40">
                <td className="py-2">
                  <button type="button" className="font-semibold text-primary hover:underline" onClick={() => onHashtag(row.tag)}>
                    #{row.tag}
                  </button>
                </td>
                <td className="py-2 text-right tabular-nums">{row.uses}</td>
                <td className="py-2 text-right tabular-nums">{formatCount(row.avgViews)}</td>
                <td className="py-2 text-right tabular-nums">{formatCount(row.totalViews)}</td>
                <td className="py-2 text-right tabular-nums">{formatPercent(row.avgEngagementRate)}</td>
                <td className="py-2 text-right text-muted-foreground">{formatDate(row.lastUsedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function AdsPanel({ report, promoted }: { report: CompetitorReport; promoted: CompetitorVideo[] }) {
  const adsState = report.sources.ads.state;
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-display text-lg font-normal">TikTok Ad Library</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Ads TikTok has published for this advertiser in the last 12 months. The library covers ads shown in the EEA,
          Switzerland and the UK.
        </p>
        {report.ads.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {report.ads.map((ad) => (
              <Card key={ad.id}>
                <CardContent className="space-y-3 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{ad.advertiserName}</p>
                      {ad.paidFor && <p className="truncate text-xs text-muted-foreground">Paid for by {ad.paidFor}</p>}
                    </div>
                    {ad.status && <Badge variant={ad.status.toLowerCase() === "active" ? "success" : "secondary"}>{ad.status}</Badge>}
                  </div>
                  {ad.videoUrls[0] ? (
                    <video src={ad.videoUrls[0]} controls preload="none" className="aspect-[9/16] max-h-80 w-full rounded-xl bg-black object-contain" />
                  ) : ad.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ad.imageUrls[0]} alt="" className="max-h-80 w-full rounded-xl object-contain" referrerPolicy="no-referrer" />
                  ) : null}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Field label="First shown" value={formatDate(ad.firstShownAt)} />
                    <Field label="Last shown" value={formatDate(ad.lastShownAt)} />
                    <Field label="Reach" value={ad.reach ?? "-"} />
                    <Field label="Creatives" value={String(ad.videoUrls.length + ad.imageUrls.length)} />
                  </div>
                  <a href={ad.libraryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    View in Ad Library <ExternalLink className="size-3" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Megaphone}
            className="min-h-40"
            title={adsState === "not_configured" ? "Ad Library not connected" : adsState === "failed" ? "Ad Library unavailable" : "No ads found"}
            description={
              adsState === "not_configured"
                ? "Apply for TikTok's free Commercial Content API and add the research client key and secret to the backend."
                : adsState === "failed"
                  ? report.sources.ads.message ?? "The Ad Library didn't respond."
                  : `TikTok hasn't published ads for "${report.company}" in the last year.`
            }
          />
        )}
      </section>

      <section>
        <h3 className="font-display text-lg font-normal">Promoted posts on their profile</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Posts TikTok labels as ads or paid partnerships, usually boosted with Spark Ads. These show worldwide.
        </p>
        {promoted.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {promoted.map((video) => (
              <VideoCard key={video.id} video={video} medianViews={report.summary.medianViews} onHashtag={() => undefined} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            None of the {report.videos.length} recent videos are labeled as promoted.
          </p>
        )}
      </section>
    </div>
  );
}

function PerformancePanel({ report }: { report: CompetitorReport }) {
  const top = useMemo(() => sortVideos(report.videos, "views").slice(0, 5), [report.videos]);
  if (!report.performance.length) {
    return <EmptyState icon={CalendarClock} title="No performance data" description="There are no dated videos to chart." />;
  }
  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Views per week</CardTitle>
          <CardDescription>Total views of the videos posted each week, by the week they were posted.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={report.performance} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="competitorViewsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
              <XAxis
                dataKey="weekStart"
                tickFormatter={(value: string) => formatDate(`${value}T00:00:00`).replace(/,.*/, "")}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(value: number) => formatCount(value)}
              />
              <Tooltip
                cursor={{ stroke: "var(--color-border)" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-card)",
                  fontSize: 12,
                  boxShadow: "0 12px 32px rgba(36,24,44,.12)",
                }}
                labelFormatter={(value) => `Week of ${formatDate(`${value}T00:00:00`)}`}
                formatter={(value, _name, item) => [
                  `${formatCount(Number(value))} views · ${(item.payload as { videos: number }).videos} videos`,
                  "",
                ]}
              />
              <Area type="monotone" dataKey="views" stroke="var(--color-primary)" strokeWidth={2} fill="url(#competitorViewsFill)" activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Top videos</CardTitle>
          <CardDescription>Their five most-viewed recent posts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {top.map((video, index) => (
            <a key={video.id} href={video.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-muted/50">
              <span className="w-4 text-center text-xs font-bold text-muted-foreground">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{video.caption || "No caption"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCount(video.views)} views · {formatPercent(video.engagementRate)} eng. · {formatDate(video.createdAt)}
                </p>
              </div>
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl border bg-muted/40 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-[10px] px-3 py-1.5 text-xs font-semibold transition",
            value === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Avatar({ url, name, size }: { url: string | null; name: string; size: "sm" | "lg" }) {
  const classes = size === "lg" ? "size-16 rounded-2xl text-lg" : "size-7 rounded-full text-[10px]";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" referrerPolicy="no-referrer" className={cn("shrink-0 object-cover", classes)} />
  ) : (
    <span aria-hidden className={cn("grid shrink-0 place-items-center bg-primary font-bold text-primary-foreground", classes)}>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-background/55">{label}</p>
      <p className="mt-1 font-display text-xl font-normal">{value}</p>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-2xl font-normal tabular-nums">{value}</p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground" title={hint}>
          {hint}
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({ icon: Icon, value, label }: { icon: typeof Heart; value: number; label: string }) {
  return (
    <span className="flex items-center gap-1" title={label}>
      <Icon className="size-3.5" aria-label={label} /> {formatCount(value)}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function ReportSkeleton({ handle }: { handle: string | null }) {
  return (
    <div className="space-y-6" aria-busy="true">
      {handle && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="size-4 animate-spin text-primary" />
          Pulling @{handle}&apos;s videos, hashtags and ads. This can take up to a minute.
        </p>
      )}
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="aspect-[4/5] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
