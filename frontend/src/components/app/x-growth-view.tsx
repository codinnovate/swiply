"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Clock,
  Copy,
  Eye,
  Flame,
  Heart,
  MessageCircle,
  Pencil,
  RefreshCw,
  Repeat2,
  Send,
  Sparkles,
  ThermometerSun,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/states";
import { cn, formatDate } from "@/lib/utils";
import {
  getBestTimes,
  getDailyPlan,
  getNicheDataset,
  getNicheOptions,
  getOpportunities,
  getRecommendedPosts,
  type ContentOpportunity,
  type RecommendedPost,
  type Trend,
  type TrendStatus,
} from "@/lib/mock-x-growth";

const statusMeta: Record<TrendStatus, { label: string; badge: "default" | "secondary" | "success" | "warning"; icon: typeof Flame }> = {
  hot: { label: "Hot", badge: "warning", icon: Flame },
  rising: { label: "Rising", badge: "success", icon: TrendingUp },
  cooling: { label: "Cooling", badge: "secondary", icon: TrendingDown },
};

const sections = [
  { id: "trends", label: "Trending" },
  { id: "opportunities", label: "Opportunities" },
  { id: "recommended", label: "Recommended posts" },
  { id: "plan", label: "Daily plan" },
  { id: "timing", label: "Best time to post" },
  { id: "learning", label: "What we're learning" },
  { id: "analytics", label: "Analytics" },
];

export function XGrowthView() {
  const [nicheId, setNicheId] = useState("frontend");
  const [loading, setLoading] = useState(false);
  const [openTrend, setOpenTrend] = useState<Trend | null>(null);

  const dataset = useMemo(() => getNicheDataset(nicheId), [nicheId]);
  const opportunities = useMemo(() => getOpportunities(dataset.trends), [dataset]);
  const recommended = useMemo(() => getRecommendedPosts(dataset.trends), [dataset]);
  const dailyPlan = useMemo(() => getDailyPlan(recommended), [recommended]);
  const bestTimes = useMemo(() => getBestTimes(), []);
  const niches = useMemo(() => getNicheOptions(), []);

  function changeNiche(value: string) {
    setLoading(true);
    setNicheId(value);
    setTimeout(() => setLoading(false), 550);
  }

  return (
    <>
      <PageHeader
        eyebrow="X Growth Engine"
        title="Today's Growth Briefing"
        description={`${formatDate(new Date().toISOString())} · Tracking what's happening in ${dataset.label} on X.`}
        actions={
          <Select value={nicheId} onValueChange={changeNiche}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Choose a niche" />
            </SelectTrigger>
            <SelectContent>
              {niches.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Card className="mb-6 overflow-hidden bg-foreground text-background">
        <CardContent className="relative pt-6">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-background/60">
                <Sparkles className="size-3.5 text-primary" />
                Today&apos;s briefing
              </div>
              <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
                {loading ? "Refreshing your briefing…" : dataset.briefingSummary}
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-4 lg:gap-8">
              <Stat label="Niche" value={dataset.label.split(" ")[0]} />
              <Stat label="Trends detected" value={String(dataset.trends.length)} />
              <Stat
                label="Status"
                value={dataset.trends.filter((t) => t.status === "hot").length > 0 ? "Active" : "Steady"}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <nav className="sticky top-16 z-20 -mx-4 mb-7 flex gap-1 overflow-x-auto border-b bg-background/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {loading ? (
        <XGrowthSkeleton />
      ) : (
        <div className="space-y-10">
          <TrendingSection trends={dataset.trends} onView={setOpenTrend} />
          <OpportunitiesSection opportunities={opportunities} />
          <RecommendedSection posts={recommended} />
          <DailyPlanSection items={dailyPlan} />
          <BestTimeSection windows={bestTimes} />
          <LearningSection learning={dataset.learning} />
          <AnalyticsSection analytics={dataset.analytics} />
        </div>
      )}

      <TrendDialog trend={openTrend} onOpenChange={(open) => !open && setOpenTrend(null)} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-background/55">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold capitalize">{value}</p>
    </div>
  );
}

function SectionHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div id={id} className="scroll-mt-32">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

// ---------- 1. Trending in Your Niche ----------

function TrendingSection({ trends, onView }: { trends: Trend[]; onView: (trend: Trend) => void }) {
  return (
    <section>
      <SectionHeading
        id="trends"
        title="Trending in your niche"
        description="Topics currently gaining traction on X among accounts like yours."
      />
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {trends.map((trend) => (
          <TrendCard key={trend.id} trend={trend} onView={() => onView(trend)} />
        ))}
      </div>
    </section>
  );
}

function TrendCard({ trend, onView }: { trend: Trend; onView: () => void }) {
  const meta = statusMeta[trend.status];
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant={meta.badge}>
            <meta.icon className="mr-1 size-3" />
            {meta.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{trend.relevantPosts.toLocaleString()} posts</span>
        </div>
        <CardTitle className="pt-2 text-base leading-snug">{trend.topic}</CardTitle>
        <p className="text-xs font-semibold text-primary">{trend.momentum}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-0">
        <p className="text-sm leading-6 text-muted-foreground">&ldquo;{trend.summary}&rdquo;</p>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ThermometerSun className="size-3.5" />
          Engagement: <span className="font-semibold text-foreground">{trend.engagementLevel}</span>
        </div>
        <p className="mt-3 rounded-xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">Why it matters: </span>
          {trend.whyItMatters}
        </p>
        <Button variant="outline" size="sm" className="mt-4 self-start" onClick={onView}>
          View trend
          <ArrowUpRight className="size-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

function TrendDialog({ trend, onOpenChange }: { trend: Trend | null; onOpenChange: (open: boolean) => void }) {
  if (!trend) return <Dialog open={false} onOpenChange={onOpenChange} />;
  const meta = statusMeta[trend.status];
  return (
    <Dialog open={!!trend} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant={meta.badge}>
              <meta.icon className="mr-1 size-3" />
              {meta.label}
            </Badge>
            <span className="text-xs text-muted-foreground">{trend.relevantPosts.toLocaleString()} relevant posts</span>
          </div>
          <DialogTitle>{trend.topic}</DialogTitle>
          <DialogDescription>{trend.momentum}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm">
          <DialogBlock title="What's happening">{trend.detail.whatIsHappening}</DialogBlock>
          <DialogBlock title="Why it's trending">{trend.detail.whyTrending}</DialogBlock>
          <DialogListBlock title="Key opinions being discussed" items={trend.detail.keyOpinions} />
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Top-performing posts</p>
            <div className="space-y-2">
              {trend.detail.topPosts.map((post, i) => (
                <div key={i} className="rounded-xl border p-3">
                  <p className="text-xs font-semibold">{post.name} <span className="font-normal text-muted-foreground">{post.handle}</span></p>
                  <p className="mt-1 text-sm leading-5">{post.content}</p>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Heart className="size-3" />{post.likes.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Repeat2 className="size-3" />{post.reposts.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="size-3" />{post.replies.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DialogListBlock title="Common viewpoints" items={trend.detail.commonViewpoints} />
            <DialogListBlock title="Contrarian viewpoints" items={trend.detail.contrarianViewpoints} />
          </div>
          <DialogListBlock title="Content gaps" items={trend.detail.contentGaps} />
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Suggested content angles</p>
            <div className="flex flex-wrap gap-2">
              {trend.detail.suggestedAngles.map((angle) => (
                <Badge key={angle} variant="secondary">{angle}</Badge>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => toast.success("Draft started from this trend")}>
            <Wand2 className="size-4" />
            Generate post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="leading-6 text-foreground">{children}</p>
    </div>
  );
}

function DialogListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 leading-5">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- 2. Content Opportunities ----------

function OpportunitiesSection({ opportunities }: { opportunities: ContentOpportunity[] }) {
  return (
    <section>
      <SectionHeading
        id="opportunities"
        title="Content opportunities"
        description="Possible angles for your strongest trends, ranked by how underrepresented they are right now."
      />
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {opportunities.slice(0, 9).map((opp) => (
          <Card key={opp.id}>
            <CardContent className="flex h-full flex-col pt-5">
              <div className="flex items-center justify-between">
                <Badge>{opp.angle}</Badge>
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{opp.trendTopic}</p>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{opp.why}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4 self-start"
                onClick={() => toast.success(`Drafting a ${opp.angle.toLowerCase()} post about ${opp.trendTopic}`)}
              >
                <Wand2 className="size-3.5" />
                Generate post
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ---------- 3. Recommended Posts ----------

function RecommendedSection({ posts }: { posts: RecommendedPost[] }) {
  if (!posts.length) {
    return (
      <section>
        <SectionHeading id="recommended" title="What you should post today" description="Your strongest content opportunities, turned into ready-to-publish posts." />
        <EmptyState className="mt-4" title="No posts generated yet" description="Once trends are detected, your strongest opportunities will turn into ready-to-publish drafts here." icon={Sparkles} />
      </section>
    );
  }
  return (
    <section>
      <SectionHeading
        id="recommended"
        title="What you should post today"
        description="Your strongest content opportunities, already written and ranked by expected impact."
      />
      <div className="mt-4 space-y-4">
        {posts.map((post, index) => (
          <RecommendedCard key={post.id} post={post} rank={index + 1} />
        ))}
      </div>
    </section>
  );
}

function RecommendedCard({ post, rank }: { post: RecommendedPost; rank: number }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(post.fullPost).catch(() => {});
    setCopied(true);
    toast.success("Post copied to clipboard");
    setTimeout(() => setCopied(false), 1600);
  }
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">#{rank}</span>
              <Badge variant="secondary">{post.postType}</Badge>
              <span className="text-xs text-muted-foreground">{post.topic}</span>
            </div>
            <p className="mt-3 font-display text-lg font-semibold leading-snug">{post.hook}</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{post.fullPost}</p>
            <p className="mt-3 rounded-xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
              <span className="font-semibold text-foreground">Why this post: </span>
              {post.why}
            </p>
          </div>
          <div className="w-full shrink-0 space-y-4 rounded-2xl border bg-muted/20 p-4 lg:w-64">
            <RelevanceRow label="Best time" value={post.suggestedTime} icon={Clock} />
            <RelevanceRow label="Trend relevance" value={post.trendRelevance} icon={TrendingUp} />
            <RelevanceRow label="Audience relevance" value={post.audienceRelevance} icon={Users} />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                Copy
              </Button>
              <Button size="sm" variant="outline" onClick={() => toast("Editing coming soon — opens in the post composer")}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => toast.success("Generated a fresh take on this angle")}>
                <RefreshCw className="size-3.5" />
                Regenerate
              </Button>
              <Button size="sm" variant="outline" onClick={() => toast.success("Created 3 variations")}>
                <Sparkles className="size-3.5" />
                Variations
              </Button>
            </div>
            <Button size="sm" className="w-full" onClick={() => toast.success(`Scheduled for ${post.suggestedTime}`)}>
              <Send className="size-3.5" />
              Schedule for {post.suggestedTime}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RelevanceRow({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

// ---------- 4. Daily Content Plan ----------

function DailyPlanSection({ items }: { items: { time: string; strategy: string; content: string }[] }) {
  return (
    <section>
      <SectionHeading id="plan" title="Daily content plan" description="A simple, paced schedule so you're posting consistently without overposting." />
      <Card className="mt-4">
        <CardContent className="pt-5">
          <div className="relative space-y-0">
            {items.map((item, i) => (
              <div key={i} className="relative flex gap-4 pb-6 last:pb-0">
                {i < items.length - 1 && <span className="absolute left-3.75 top-8 h-full w-px bg-border" />}
                <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Clock className="size-4" />
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{item.time}</p>
                    <Badge variant="secondary">{item.strategy}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.content}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ---------- 5. Best Time to Post ----------

function BestTimeSection({ windows }: { windows: ReturnType<typeof getBestTimes> }) {
  return (
    <section>
      <SectionHeading id="timing" title="Best time to post" description="Recommended posting windows based on your audience's historical activity and today's trends." />
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {windows.map((w, i) => (
          <Card key={w.window} className={cn(i === 0 && "border-primary/40 bg-primary/5")}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                {i === 0 && <Badge>Best opportunity</Badge>}
                {i !== 0 && <span />}
                <Badge variant={w.confidence === "Initial estimate" ? "warning" : w.confidence === "High confidence" ? "success" : "secondary"}>
                  {w.confidence}
                </Badge>
              </div>
              <p className="mt-3 font-display text-xl font-semibold">{w.window}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{w.reason}</p>
              <div className="mt-4 space-y-2 border-t pt-3 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Audience activity</span><span className="font-semibold">{w.audienceActivity}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Historical performance</span><span className="font-semibold">{w.historicalPerformance}</span></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ---------- 6. Performance Feedback Loop ----------

function LearningSection({ learning }: { learning: ReturnType<typeof getNicheDataset>["learning"] }) {
  return (
    <section>
      <SectionHeading id="learning" title="What we're learning about you" description="Patterns Swiply is tracking from your posting history to sharpen future recommendations." />
      {!learning.hasEnoughData ? (
        <EmptyState className="mt-4" title="Still learning" description="Publish a few more posts and we'll start surfacing patterns in what performs best for your account." icon={Sparkles} />
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Your audience responds well to</CardTitle>
              <CardDescription>Ranked by consistency of overperformance across your recent posts.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ol className="space-y-2">
                {learning.topTopics.map((topic, i) => (
                  <li key={topic} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    {topic}
                  </li>
                ))}
              </ol>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Best formats</p>
                  <div className="flex flex-wrap gap-1.5">
                    {learning.topFormats.map((f) => <Badge key={f} variant="secondary">{f}</Badge>)}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Best hooks</p>
                  <div className="flex flex-wrap gap-1.5">
                    {learning.topHooks.map((h) => <Badge key={h} variant="secondary">{h}</Badge>)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardContent className="grid grid-cols-2 gap-4 pt-5">
                <MiniStat icon={ThermometerSun} label="Avg engagement" value={`${learning.avgEngagementRate}%`} />
                <MiniStat icon={Eye} label="Profile visits" value={learning.profileVisits.toLocaleString()} />
                <MiniStat icon={UserPlus} label="Followers gained" value={`+${learning.followersGained}`} />
                <MiniStat icon={Clock} label="Best times" value={learning.bestTimes[0]} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Outperforming posts</CardTitle>
                <CardDescription>Posts that significantly beat your account average.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {learning.outperformingPosts.map((p, i) => (
                  <div key={i} className="rounded-xl border p-3">
                    <p className="text-sm leading-5">{p.content}</p>
                    <Badge variant="success" className="mt-2">{p.multiplier}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div>
      <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
      <p className="mt-2 font-display text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ---------- 7. Analytics ----------

function AnalyticsSection({ analytics }: { analytics: ReturnType<typeof getNicheDataset>["analytics"] }) {
  const stats: Array<[typeof Eye, string, string]> = [
    [Eye, "Impressions", analytics.totalImpressions.toLocaleString()],
    [ThermometerSun, "Engagement rate", `${analytics.engagementRate}%`],
    [Heart, "Likes", analytics.likes.toLocaleString()],
    [MessageCircle, "Replies", analytics.replies.toLocaleString()],
    [Repeat2, "Reposts", analytics.reposts.toLocaleString()],
    [Bookmark, "Bookmarks", analytics.bookmarks.toLocaleString()],
    [Users, "Profile visits", analytics.profileVisits.toLocaleString()],
    [UserPlus, "Followers gained", `+${analytics.followersGained}`],
  ];
  return (
    <section>
      <SectionHeading id="analytics" title="Analytics" description="A lightweight performance view across your last 14 days on X." />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([Icon, label, value]) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 pt-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4.5" /></span>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-display text-lg font-semibold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Impressions over time</CardTitle>
          <CardDescription>{analytics.postsPublished} posts published · ~{analytics.avgPerformancePerPost.toLocaleString()} impressions per post on average</CardDescription>
        </CardHeader>
        <CardContent className="h-72 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="impressionsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatDate(v).replace(/,.*/, "")}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
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
                labelFormatter={(v) => formatDate(String(v))}
                formatter={(value, name) => [Number(value).toLocaleString(), name === "impressions" ? "Impressions" : "Engagements"]}
              />
              <Area type="monotone" dataKey="impressions" stroke="var(--color-primary)" strokeWidth={2} fill="url(#impressionsFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Top performing posts</CardTitle>
          <CardDescription>Ranked by impressions this period.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {analytics.topPosts.map((post, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex-1 text-sm leading-5">{post.content}</p>
              <div className="flex shrink-0 gap-5 text-xs">
                <div><p className="text-muted-foreground">Impressions</p><p className="font-semibold">{post.impressions.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Engagement</p><p className="font-semibold">{post.engagementRate}%</p></div>
                <div><p className="text-muted-foreground">Followers</p><p className="font-semibold">+{post.followersGained}</p></div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

// ---------- Loading skeleton ----------

function XGrowthSkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-64" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-64" />
    </div>
  );
}
