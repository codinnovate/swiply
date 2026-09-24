// Mock data for the X Growth Engine dashboard tab. This models the shape a future
// X API + AI backend integration would return, so the UI can be built against it now
// and swapped for real queries later without changing component structure.

export type TrendStatus = "rising" | "hot" | "cooling";
export type EngagementLevel = "Low" | "Medium" | "High" | "Very High";
export type Relevance = "Low" | "Medium" | "High" | "Very High";
export type ContentAngle =
  | "Educational"
  | "Contrarian"
  | "Personal experience"
  | "Story"
  | "Tutorial"
  | "List"
  | "Opinion"
  | "Question"
  | "Build-in-public";

export interface TopPost {
  handle: string;
  name: string;
  content: string;
  likes: number;
  reposts: number;
  replies: number;
}

export interface TrendDetail {
  whatIsHappening: string;
  whyTrending: string;
  keyOpinions: string[];
  topPosts: TopPost[];
  commonViewpoints: string[];
  contrarianViewpoints: string[];
  contentGaps: string[];
  suggestedAngles: ContentAngle[];
}

export interface Trend {
  id: string;
  topic: string;
  summary: string;
  status: TrendStatus;
  momentum: string;
  relevantPosts: number;
  engagementLevel: EngagementLevel;
  whyItMatters: string;
  detail: TrendDetail;
}

export interface ContentOpportunity {
  id: string;
  trendId: string;
  trendTopic: string;
  angle: ContentAngle;
  why: string;
}

export interface RecommendedPost {
  id: string;
  trendId: string;
  hook: string;
  fullPost: string;
  postType: ContentAngle;
  topic: string;
  why: string;
  trendRelevance: Relevance;
  audienceRelevance: Relevance;
  suggestedTime: string;
}

export interface DailyPlanItem {
  time: string;
  strategy: string;
  content: string;
}

export interface BestTimeWindow {
  window: string;
  audienceActivity: string;
  historicalPerformance: string;
  confidence: "Initial estimate" | "Medium confidence" | "High confidence";
  reason: string;
}

export interface OutperformingPost {
  content: string;
  multiplier: string;
}

export interface LearningProfile {
  topTopics: string[];
  topFormats: string[];
  topHooks: string[];
  bestTimes: string[];
  avgEngagementRate: number;
  profileVisits: number;
  followersGained: number;
  outperformingPosts: OutperformingPost[];
  hasEnoughData: boolean;
}

export interface AnalyticsPoint {
  date: string;
  impressions: number;
  engagements: number;
}

export interface TopPerformingPost {
  content: string;
  impressions: number;
  engagementRate: number;
  followersGained: number;
}

export interface AnalyticsSummary {
  totalImpressions: number;
  engagementRate: number;
  likes: number;
  replies: number;
  reposts: number;
  bookmarks: number;
  profileVisits: number;
  followersGained: number;
  postsPublished: number;
  avgPerformancePerPost: number;
  series: AnalyticsPoint[];
  topPosts: TopPerformingPost[];
}

export interface NicheDataset {
  id: string;
  label: string;
  briefingSummary: string;
  trends: Trend[];
  learning: LearningProfile;
  analytics: AnalyticsSummary;
}

function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function buildSeries(seed: string, days: number, base: number): AnalyticsPoint[] {
  const rand = seededRandom(seed);
  const today = new Date();
  const points: AnalyticsPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const wobble = 0.65 + rand() * 0.7;
    const impressions = Math.round(base * wobble * (1 + i * -0.01));
    points.push({
      date: d.toISOString().slice(0, 10),
      impressions: Math.max(120, impressions),
      engagements: Math.round(Math.max(120, impressions) * (0.02 + rand() * 0.035)),
    });
  }
  return points;
}

const frontendTrends: Trend[] = [
  {
    id: "rsc-debate",
    topic: "React Server Components",
    summary:
      "Developers are debating whether the latest changes make RSC more practical for production apps.",
    status: "rising",
    momentum: "Rising quickly — up 3.2x in the last 24 hours",
    relevantPosts: 1840,
    engagementLevel: "High",
    whyItMatters:
      "Your audience is mostly React/frontend engineers actively deciding their next-stack bets — this is the exact conversation they're already in.",
    detail: {
      whatIsHappening:
        "A wave of posts followed a framework maintainer's thread arguing RSC's mental model finally 'clicked' after a caching fix shipped this week. Threads are splitting into camps for and against adoption in mid-size apps.",
      whyTrending:
        "The fix addressed the most-cited complaint from the last six months (stale cache on revalidation), so it reopened a debate a lot of people had quietly shelved.",
      keyOpinions: [
        "\"RSC's DX finally matches the pitch — the caching model was the missing piece.\"",
        "\"This is still too much complexity for teams under 20 engineers.\"",
        "\"Nobody is talking about the migration cost from a client-heavy app.\"",
      ],
      topPosts: [
        { handle: "@sebastianlp", name: "Sebastian", content: "Ran the new revalidation model in prod for a week. This is the first time RSC has felt boring — in a good way.", likes: 4200, reposts: 610, replies: 320 },
        { handle: "@devkat", name: "Kat Chen", content: "Hot take: RSC solved a problem most teams don't have yet. The complexity tax is still real for < 20 person teams.", likes: 2100, reposts: 240, replies: 480 },
      ],
      commonViewpoints: [
        "The caching fix is a meaningful, not cosmetic, improvement.",
        "Adoption still makes most sense for large, content-heavy apps.",
      ],
      contrarianViewpoints: [
        "Some argue the fix just moves complexity from the client to the build layer, not away.",
        "A few maintainers of competing frameworks say the debate is overheated relative to real-world usage.",
      ],
      contentGaps: [
        "Almost nobody has posted a real before/after migration story with numbers.",
        "No one is addressing how this affects teams already mid-migration.",
      ],
      suggestedAngles: ["Personal experience", "Tutorial", "Contrarian", "Opinion"],
    },
  },
  {
    id: "ai-code-review",
    topic: "AI code review tools replacing first-pass human review",
    summary:
      "Engineering leads are sharing internal data on AI review tools catching more bugs than junior reviewers.",
    status: "hot",
    momentum: "Hot — sustained high volume for 3 days",
    relevantPosts: 2960,
    engagementLevel: "Very High",
    whyItMatters:
      "This sits directly at the intersection of your two strongest topics — AI tooling and day-to-day engineering workflow — where your past posts have overperformed.",
    detail: {
      whatIsHappening:
        "Multiple eng leads at mid-size startups posted internal metrics showing AI-first review catching a higher percentage of real bugs than the median junior engineer's first pass, sparking both excitement and pushback about what it means for junior hiring.",
      whyTrending:
        "It combines a hot topic (AI capability) with a career-anxiety topic (junior engineer relevance), which reliably drives high engagement on X.",
      keyOpinions: [
        "\"We're not removing human review, we're removing the boring 40% of it.\"",
        "\"This is how you end up with a generation of engineers who can't review code.\"",
      ],
      topPosts: [
        { handle: "@priyaeng", name: "Priya R.", content: "3 months of data: AI-first review catches 31% more logic bugs pre-merge than our junior-first process did. Sharing the breakdown.", likes: 6100, reposts: 890, replies: 540 },
      ],
      commonViewpoints: [
        "AI review is best as a first pass, not a replacement for senior sign-off.",
        "The bug-catching data is compelling even to skeptics.",
      ],
      contrarianViewpoints: [
        "Some argue this quietly guts the junior-to-senior pipeline that produces good reviewers later.",
      ],
      contentGaps: [
        "Nobody has written the 'how we actually rolled this out to the team' operational post.",
      ],
      suggestedAngles: ["Opinion", "List", "Build-in-public", "Question"],
    },
  },
  {
    id: "local-first",
    topic: "Local-first apps and sync engines",
    summary:
      "A new crop of sync-engine libraries is pulling local-first architecture back into mainstream conversation.",
    status: "rising",
    momentum: "Rising — 2.1x posts week-over-week",
    relevantPosts: 970,
    engagementLevel: "Medium",
    whyItMatters:
      "Recurring interest topic for your audience whenever a new sync engine ships — good evergreen angle to revisit with a fresh hook.",
    detail: {
      whatIsHappening:
        "A newly released sync engine gained fast adoption in side-project circles, reviving discussion about when local-first is worth the complexity versus a standard server-driven CRUD app.",
      whyTrending:
        "Developers love a concrete, runnable example more than a manifesto, and this release shipped with a five-minute demo that spread quickly.",
      keyOpinions: [
        "\"The offline-first UX gap between this and a normal SPA is bigger than I expected.\"",
        "\"Conflict resolution is still the hard 20% nobody's library really solves.\"",
      ],
      topPosts: [
        { handle: "@n_ordstrom", name: "Nils O.", content: "Rebuilt a small CRUD app local-first over the weekend. The instant-UI feel alone might be worth the added complexity.", likes: 1800, reposts: 260, replies: 140 },
      ],
      commonViewpoints: ["Great for prosumer/creative tools, overkill for typical CRUD SaaS."],
      contrarianViewpoints: ["A few argue it's a solution looking for a problem outside of niche categories."],
      contentGaps: ["No one has written a plain-language 'when NOT to use local-first' post."],
      suggestedAngles: ["Educational", "Tutorial", "Personal experience"],
    },
  },
  {
    id: "burnout-thread",
    topic: "\"Ship less, think more\" productivity pushback",
    summary:
      "A viral thread pushing back on hustle-coded shipping culture is generating strong agree/disagree engagement.",
    status: "cooling",
    momentum: "Cooling — peaked yesterday, volume down 18%",
    relevantPosts: 3210,
    engagementLevel: "High",
    whyItMatters:
      "Still has reach, but window is closing — a personal, specific take posted today can still ride the tail before it fades.",
    detail: {
      whatIsHappening:
        "An indie developer's thread arguing that constant shipping culture is producing worse products went viral, drawing both strong agreement from burned-out builders and pushback from build-in-public advocates.",
      whyTrending:
        "It taps a recurring, emotionally-loaded tension in the dev community between visible output and sustainable pace.",
      keyOpinions: [
        "\"Every 'ship fast' post I see is from someone about to burn out or already has.\"",
        "\"Shipping slower didn't make my last three products better, it made them later.\"",
      ],
      topPosts: [
        { handle: "@marcusbuilds", name: "Marcus T.", content: "Took 3 weeks off from shipping anything public. My actual product got better. My timeline engagement did not.", likes: 5400, reposts: 710, replies: 690 },
      ],
      commonViewpoints: ["Both sides agree burnout is real; disagreement is about the cause."],
      contrarianViewpoints: ["Some builders say slower shipping is a privilege not everyone can afford."],
      contentGaps: ["Nobody has posted actual before/after output data comparing paces."],
      suggestedAngles: ["Personal experience", "Story", "Question"],
    },
  },
];

const indieTrends: Trend[] = [
  {
    id: "mrr-milestones",
    topic: "Solo founders sharing first $10k MRR breakdowns",
    summary: "A cluster of transparent revenue breakdown posts is driving unusually high saves and bookmarks.",
    status: "hot",
    momentum: "Hot — 4x normal volume for this topic",
    relevantPosts: 1540,
    engagementLevel: "Very High",
    whyItMatters: "Revenue-transparency posts consistently outperform your account's baseline — this format is proven for your audience.",
    detail: {
      whatIsHappening: "Several solo founders posted detailed $10k MRR breakdowns in the same week, including channel mix and churn, which spread widely as a comparable reference set.",
      whyTrending: "Concrete numbers plus specificity (channel-by-channel) make the posts highly saveable and referenceable, which the algorithm rewards.",
      keyOpinions: ["\"Paid acquisition is finally working again for small SaaS.\"", "\"Everyone shares the win, nobody shares the 8 months before it.\""],
      topPosts: [{ handle: "@laurabuilds", name: "Laura K.", content: "Full $10,412 MRR breakdown: channels, churn, CAC. No fluff, just the numbers.", likes: 3900, reposts: 520, replies: 310 }],
      commonViewpoints: ["Specific numbers build more trust than vague growth claims."],
      contrarianViewpoints: ["Some argue MRR screenshots without churn context are misleading."],
      contentGaps: ["Almost nobody shows the pre-revenue months in the same detail."],
      suggestedAngles: ["Story", "List", "Build-in-public"],
    },
  },
  {
    id: "ai-wrapper-fatigue",
    topic: "\"AI wrapper\" fatigue among indie hackers",
    summary: "Growing pushback against thin AI-wrapper products is reshaping what gets positive reception.",
    status: "rising",
    momentum: "Rising — sentiment shift accelerating this week",
    relevantPosts: 2280,
    engagementLevel: "High",
    whyItMatters: "Directly affects how you should position any AI-adjacent product launch this month.",
    detail: {
      whatIsHappening: "Indie hacker timelines are showing rising criticism of undifferentiated 'ChatGPT wrapper' products, with builders calling for products with a real moat.",
      whyTrending: "It follows a wave of near-identical AI tool launches, making the critique feel earned rather than cynical.",
      keyOpinions: ["\"If your product is a prompt and a Stripe key, it's not a business yet.\"", "\"Distribution is the moat now, not the model.\""],
      topPosts: [{ handle: "@ryanmakes", name: "Ryan D.", content: "Counted 14 nearly identical 'AI resume wrapper' launches this month. The market is telling us something.", likes: 2700, reposts: 340, replies: 410 }],
      commonViewpoints: ["Differentiation now has to come from workflow/data, not the model itself."],
      contrarianViewpoints: ["Some say wrapper products are a fine, fast way to validate demand before building deeper."],
      contentGaps: ["No one has written a practical 'how to actually differentiate' framework post."],
      suggestedAngles: ["Opinion", "Contrarian", "Educational"],
    },
  },
  {
    id: "cold-outbound-revival",
    topic: "Cold outbound making a comeback for early SaaS",
    summary: "Founders report better response rates from manual cold outbound than content marketing this quarter.",
    status: "rising",
    momentum: "Rising — 1.8x posts this week",
    relevantPosts: 860,
    engagementLevel: "Medium",
    whyItMatters: "A tactical, numbers-driven angle that fits your build-in-public voice well.",
    detail: {
      whatIsHappening: "Several early-stage founders posted that hand-written cold outbound is outperforming content and paid acquisition for their first 20 customers.",
      whyTrending: "It contradicts the dominant 'content is king' narrative, which makes it inherently shareable.",
      keyOpinions: ["\"100 personalized emails beat 10,000 impressions for my first customers.\"", "\"This doesn't scale past customer 30, but it's the fastest way to customer 1.\""],
      topPosts: [{ handle: "@omarsells", name: "Omar F.", content: "Sent 63 personalized cold emails this month. 11 replies, 4 demos, 2 customers. Content marketing gave me 0.", likes: 1500, reposts: 190, replies: 220 }],
      commonViewpoints: ["Best for pre-PMF founders, not a long-term channel."],
      contrarianViewpoints: ["A few argue it doesn't scale and distracts from building repeatable channels."],
      contentGaps: ["Nobody has shared an actual template + response rate breakdown."],
      suggestedAngles: ["Tutorial", "List", "Personal experience"],
    },
  },
];

const aiTrends: Trend[] = [
  {
    id: "small-model-momentum",
    topic: "Small, fine-tuned models beating general models on narrow tasks",
    summary: "New benchmark posts show small fine-tuned models outperforming flagship models on specific tasks at a fraction of the cost.",
    status: "hot",
    momentum: "Hot — top ML topic for 2 days straight",
    relevantPosts: 3400,
    engagementLevel: "Very High",
    whyItMatters: "This is the exact practical-application angle your audience engages with most, versus pure research takes.",
    detail: {
      whatIsHappening: "A widely shared benchmark thread showed a fine-tuned small model beating a much larger general-purpose model on a narrow classification task at 1/20th the inference cost.",
      whyTrending: "It's a concrete, reproducible result that challenges the 'bigger is always better' narrative dominating the last year.",
      keyOpinions: ["\"Most teams don't need a frontier model, they need the right eval and a small fine-tune.\"", "\"This only works because the task was narrow — don't overgeneralize.\""],
      topPosts: [{ handle: "@zoeai", name: "Zoe M.", content: "Fine-tuned a 3B model to beat GPT-class performance on our exact task, 22x cheaper per call. Full writeup coming.", likes: 5200, reposts: 780, replies: 390 }],
      commonViewpoints: ["Task-specific fine-tuning is underrated relative to prompting frontier models."],
      contrarianViewpoints: ["Some argue the result doesn't generalize and the eval was cherry-picked."],
      contentGaps: ["No one has published the actual fine-tuning cost and time breakdown."],
      suggestedAngles: ["Tutorial", "Educational", "List"],
    },
  },
  {
    id: "agent-reliability",
    topic: "Agent reliability in production, not demos",
    summary: "Builders are comparing notes on what actually breaks AI agents once real users touch them.",
    status: "rising",
    momentum: "Rising — 2.4x week-over-week",
    relevantPosts: 1920,
    engagementLevel: "High",
    whyItMatters: "High-trust, practitioner-only conversation where a credible, specific post can build real authority fast.",
    detail: {
      whatIsHappening: "A thread cataloguing the top 5 ways production agents fail (not the ones shown in demos) sparked a wave of practitioners sharing their own failure modes.",
      whyTrending: "It's a rare honest-failure thread in a space usually dominated by demo hype, which makes it stand out and feel trustworthy.",
      keyOpinions: ["\"Every agent demo is a happy path. Production is all the unhappy paths.\"", "\"Retry logic and guardrails matter more than model choice at this point.\""],
      topPosts: [{ handle: "@devondoesai", name: "Devon P.", content: "Our agent's #1 failure mode in production isn't the model, it's silently malformed tool calls. Here's how we caught it.", likes: 2600, reposts: 310, replies: 260 }],
      commonViewpoints: ["Reliability work is unglamorous but where the real product value is."],
      contrarianViewpoints: ["Some argue this is premature optimization before most agent products have real usage."],
      contentGaps: ["Nobody has published a reusable checklist for pre-launch agent reliability testing."],
      suggestedAngles: ["List", "Personal experience", "Build-in-public"],
    },
  },
];

const niches: Record<string, { label: string; briefingSummary: string; trends: Trend[]; seed: string; base: number; topTopics: string[]; topFormats: string[]; topHooks: string[] }> = {
  frontend: {
    label: "Frontend Engineering & AI Dev Tools",
    briefingSummary:
      "Your niche is buzzing around the RSC caching fix and AI-assisted code review — both align tightly with what's worked for you before.",
    trends: frontendTrends,
    seed: "frontend-niche",
    base: 8400,
    topTopics: ["React / frontend architecture", "AI developer tools", "Building in public", "Personal engineering stories"],
    topFormats: ["Personal experience threads", "Short opinion takes", "Tutorial breakdowns"],
    topHooks: ["\"I spent N hours debugging...\"", "\"Unpopular opinion: ...\"", "\"Here's what nobody tells you about...\""],
  },
  indie: {
    label: "Indie SaaS & Build in Public",
    briefingSummary:
      "Revenue-transparency posts are having a moment in your niche today, alongside rising skepticism toward generic AI-wrapper launches.",
    trends: indieTrends,
    seed: "indie-niche",
    base: 6100,
    topTopics: ["Revenue transparency", "Launch retrospectives", "Pricing experiments", "Cold outbound tactics"],
    topFormats: ["Numbers-driven breakdowns", "Build-in-public updates", "Contrarian takes"],
    topHooks: ["\"Full breakdown: how I got to $X MRR\"", "\"I was wrong about...\"", "\"Here's exactly what I sent...\""],
  },
  ai: {
    label: "AI & Machine Learning",
    briefingSummary:
      "Practical, benchmark-backed posts are outperforming theory today — small-model efficiency and agent reliability are the two hot threads.",
    trends: aiTrends,
    seed: "ai-niche",
    base: 9200,
    topTopics: ["Applied fine-tuning", "Agent reliability", "Model benchmarks", "Cost-efficiency tradeoffs"],
    topFormats: ["Benchmark writeups", "Failure-mode threads", "Practitioner checklists"],
    topHooks: ["\"We benchmarked X vs Y so you don't have to\"", "\"Our agent's #1 failure mode was...\"", "\"Most teams don't need...\""],
  },
};

function buildOpportunities(trends: Trend[]): ContentOpportunity[] {
  const opportunities: ContentOpportunity[] = [];
  for (const trend of trends) {
    trend.detail.suggestedAngles.forEach((angle, index) => {
      opportunities.push({
        id: `${trend.id}-opp-${index}`,
        trendId: trend.id,
        trendTopic: trend.topic,
        angle,
        why: angleRationale(angle, trend),
      });
    });
  }
  return opportunities;
}

function angleRationale(angle: ContentAngle, trend: Trend): string {
  switch (angle) {
    case "Personal experience":
      return `Most current posts on "${trend.topic}" are announcements or hot takes — a specific, lived account is underrepresented and tends to earn more trust.`;
    case "Contrarian":
      return `The dominant narrative around "${trend.topic}" hasn't been seriously challenged yet — a well-argued contrarian take can stand out in a crowded conversation.`;
    case "Tutorial":
      return `People are discussing "${trend.topic}" conceptually, but almost nobody has published a concrete, step-by-step walkthrough.`;
    case "Educational":
      return `A lot of the discussion assumes context newer followers don't have — a clear explainer on "${trend.topic}" can capture that audience.`;
    case "List":
      return `This topic is generating scattered individual takes — a structured list format can become the reference post people bookmark.`;
    case "Opinion":
      return `Your audience engages well with clear, specific stances — "${trend.topic}" is actively being debated right now, which rewards a strong point of view.`;
    case "Question":
      return `Open questions about "${trend.topic}" tend to drive high reply counts, which helps visibility beyond your existing followers.`;
    case "Build-in-public":
      return `Tying "${trend.topic}" to your own current build gives you a timely, credible way to share progress.`;
    case "Story":
      return `A narrative post about "${trend.topic}" stands out against the mostly announcement-style posts currently in the conversation.`;
    default:
      return `This angle is currently underrepresented in the "${trend.topic}" conversation.`;
  }
}

function buildRecommendedPosts(trends: Trend[]): RecommendedPost[] {
  const templates: Array<{ trend: Trend; hook: string; fullPost: string; postType: ContentAngle; relevance: Relevance; audience: Relevance; time: string }> = [];
  trends.forEach((trend, i) => {
    if (i === 0) {
      templates.push({
        trend,
        hook: `I spent 3 hours debugging ${trend.topic.toLowerCase()} this week so you don't have to.`,
        fullPost: `I spent 3 hours debugging ${trend.topic.toLowerCase()} this week so you don't have to.\n\nHere's what actually happened, what I tried that didn't work, and the one change that fixed it.\n\n(thread)`,
        postType: "Personal experience",
        relevance: "High",
        audience: "Very High",
        time: "9:15 AM",
      });
    }
    if (i === 1) {
      templates.push({
        trend,
        hook: `Unpopular opinion: most of the "${trend.topic}" discourse is missing the actual tradeoff.`,
        fullPost: `Unpopular opinion: most of the "${trend.topic}" discourse is missing the actual tradeoff.\n\nEveryone's arguing about whether it's good. Nobody's talking about what it costs the team that adopts it too early.\n\nHere's what I'd actually check first.`,
        postType: "Opinion",
        relevance: "High",
        audience: "High",
        time: "12:40 PM",
      });
    }
    if (i === 2) {
      templates.push({
        trend,
        hook: `Quick thread on ${trend.topic.toLowerCase()} — what's actually happening and why it matters.`,
        fullPost: `Quick thread on ${trend.topic.toLowerCase()} — what's actually happening and why it matters for teams like ours.\n\n1/ ${trend.detail.whatIsHappening}`,
        postType: "Educational",
        relevance: "Medium",
        audience: "High",
        time: "3:30 PM",
      });
    }
  });
  return templates.map((t, index) => ({
    id: `rec-${index}`,
    trendId: t.trend.id,
    hook: t.hook,
    fullPost: t.fullPost,
    postType: t.postType,
    topic: t.trend.topic,
    why: `${t.trend.topic} is ${t.trend.status === "hot" ? "peaking right now" : t.trend.status === "rising" ? "gaining momentum" : "still active but cooling"}, and this angle is underrepresented in the current conversation.`,
    trendRelevance: t.relevance,
    audienceRelevance: t.audience,
    suggestedTime: t.time,
  }));
}

function buildDailyPlan(recommended: RecommendedPost[]): DailyPlanItem[] {
  const base: DailyPlanItem[] = [
    { time: "9:15 AM", strategy: "Educational post", content: recommended[2]?.hook || "Share a clear explainer on today's top trend." },
    { time: "12:40 PM", strategy: "Short opinion", content: recommended[1]?.hook || "Post a concise, specific take on a debated topic." },
    { time: "3:30 PM", strategy: "Reply to trending conversation", content: "Jump into the highest-engagement thread in your niche with a substantive reply, not just agreement." },
    { time: "6:45 PM", strategy: "Personal / build-in-public post", content: recommended[0]?.hook || "Share a specific, concrete update from your own work this week." },
    { time: "9:10 PM", strategy: "Engagement / question post", content: "Ask your audience a direct question tied to today's top trend to drive replies overnight." },
  ];
  return base;
}

const bestTimes: BestTimeWindow[] = [
  {
    window: "9:00–9:30 AM",
    audienceActivity: "Peak — your followers' most active 30-minute window on weekdays",
    historicalPerformance: "38% above your account average engagement rate",
    confidence: "High confidence",
    reason: "Your audience has historically generated stronger engagement during this window, and today's top trend is currently accelerating.",
  },
  {
    window: "12:30–1:00 PM",
    audienceActivity: "Secondary peak — lunch-hour scroll window",
    historicalPerformance: "12% above your account average",
    confidence: "Medium confidence",
    reason: "Consistent but smaller lift across your last 30 days of posts in this slot.",
  },
  {
    window: "6:30–7:00 PM",
    audienceActivity: "Evening engagement window, higher reply rate than like rate",
    historicalPerformance: "Not enough historical data yet",
    confidence: "Initial estimate",
    reason: "Based on general X activity patterns for your audience's timezone mix — will refine as more of your posts land in this window.",
  },
];

export function getNicheOptions() {
  return Object.entries(niches).map(([id, n]) => ({ id, label: n.label }));
}

export function getNicheDataset(nicheId: string): NicheDataset {
  const config = niches[nicheId] || niches.frontend;
  const rand = seededRandom(config.seed);
  const series = buildSeries(config.seed, 14, config.base);
  const totalImpressions = series.reduce((sum, p) => sum + p.impressions, 0);
  const totalEngagements = series.reduce((sum, p) => sum + p.engagements, 0);
  const likes = Math.round(totalEngagements * 0.58);
  const replies = Math.round(totalEngagements * 0.16);
  const reposts = Math.round(totalEngagements * 0.14);
  const bookmarks = totalEngagements - likes - replies - reposts;

  return {
    id: config.seed,
    label: config.label,
    briefingSummary: config.briefingSummary,
    trends: config.trends,
    learning: {
      topTopics: config.topTopics,
      topFormats: config.topFormats,
      topHooks: config.topHooks,
      bestTimes: ["9:00–9:30 AM", "6:30–7:00 PM"],
      avgEngagementRate: Number((3.1 + rand() * 1.4).toFixed(1)),
      profileVisits: Math.round(1800 + rand() * 900),
      followersGained: Math.round(90 + rand() * 60),
      hasEnoughData: true,
      outperformingPosts: [
        { content: config.trends[0]?.detail.topPosts[0]?.content || "Your top post this month", multiplier: "4.2x your average" },
        { content: `A ${config.topFormats[0]?.toLowerCase() || "personal"} post about ${config.topTopics[1] || "your niche"}`, multiplier: "2.8x your average" },
      ],
    },
    analytics: {
      totalImpressions,
      engagementRate: Number(((totalEngagements / totalImpressions) * 100).toFixed(2)),
      likes,
      replies,
      reposts,
      bookmarks: Math.max(bookmarks, 0),
      profileVisits: Math.round(1800 + rand() * 900),
      followersGained: Math.round(90 + rand() * 60),
      postsPublished: 14,
      avgPerformancePerPost: Math.round(totalImpressions / 14),
      series,
      topPosts: [
        { content: config.trends[0]?.detail.topPosts[0]?.content || "Top post this period", impressions: Math.round(config.base * 3.4), engagementRate: 8.9, followersGained: 41 },
        { content: config.trends[1]?.detail.topPosts[0]?.content || "Second best post this period", impressions: Math.round(config.base * 2.6), engagementRate: 6.7, followersGained: 22 },
        { content: `Thread breaking down ${config.topTopics[0] || "a recent trend"}`, impressions: Math.round(config.base * 1.9), engagementRate: 5.4, followersGained: 15 },
      ],
    },
  };
}

export function getOpportunities(trends: Trend[]) {
  return buildOpportunities(trends);
}

export function getRecommendedPosts(trends: Trend[]) {
  return buildRecommendedPosts(trends);
}

export function getDailyPlan(recommended: RecommendedPost[]) {
  return buildDailyPlan(recommended);
}

export function getBestTimes() {
  return bestTimes;
}
