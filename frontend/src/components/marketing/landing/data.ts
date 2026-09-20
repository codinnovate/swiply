export type Platform = "TikTok" | "Instagram";

export interface ReelPost {
  platform: Platform;
  slideIndex: string;
  hook: string;
}

export const reelPosts: ReelPost[] = [
  { platform: "TikTok", slideIndex: "1/5", hook: "The onboarding flow that doubled activation" },
  { platform: "Instagram", slideIndex: "1/7", hook: "What $0 MRR taught us about pricing" },
  { platform: "TikTok", slideIndex: "1/5", hook: "5 SaaS pricing mistakes we made" },
  { platform: "Instagram", slideIndex: "1/4", hook: "Our dashboard, before → after" },
  { platform: "TikTok", slideIndex: "1/6", hook: "Ship changelogs people actually read" },
  { platform: "Instagram", slideIndex: "1/5", hook: "Founder POV: week one of building" },
];

export const platformStats = [
  { value: "7×", body: "cheaper reach than boosted video for early-stage SaaS", dark: false },
  { value: "90s", body: "from prompt to a queued, captioned, hashtagged post", dark: false },
  { value: "0", body: "manual uploads — Swiply publishes with native APIs", dark: false },
  { value: "30/mo", body: "posts shipped on a set-and-forget cadence", dark: true },
];

export const steps = [
  {
    step: "STEP 01",
    previewLabel: "brand kit import UI",
    title: "Drop in your product",
    body: "Paste your URL. Swiply pulls your screenshots, colors, type and value props into a reusable brand kit.",
  },
  {
    step: "STEP 02",
    previewLabel: "slide generation grid",
    title: "Generate a month of slides",
    body: "Hooks, captions, slide copy and hashtags — generated in your voice, batched 30 posts at a time.",
  },
  {
    step: "STEP 03",
    previewLabel: "auto-publish queue",
    title: "It posts itself",
    body: "Swiply publishes to TikTok and Instagram at your best-performing times. You get a Monday recap.",
  },
];

export const queue = [
  { title: "5 ways we cut churn", when: "Tue 9:10" },
  { title: "The dashboard rebuild", when: "Wed 18:40" },
  { title: "What $0 MRR taught us", when: "Fri 12:05" },
  { title: "Feature drop: filters", when: "Sat 11:20" },
];

export interface PriceCardData {
  name: string;
  monthly: string;
  annual: string;
  blurb: string;
  features: string[];
  featured?: boolean;
  ctaLabel: string;
}

export const priceCards: PriceCardData[] = [
  {
    name: "Solo",
    monthly: "$29",
    annual: "$23",
    blurb: "12 slideshows a month, one account per platform.",
    features: ["1 brand kit, pulled from your site", "TikTok + Instagram publishing", "Approve-first queue", "Weekly performance recap"],
    ctaLabel: "Start free",
  },
  {
    name: "Autopilot",
    monthly: "$79",
    annual: "$63",
    blurb: "Daily posting, best-time scheduling, performance loop.",
    features: [
      "Everything in Solo",
      "Unlimited slideshows, 30+ posts a month",
      "Best-time posting with auto-retry",
      "Hook testing across both platforms",
      "Performance feedback loop",
    ],
    featured: true,
    ctaLabel: "Start free",
  },
  {
    name: "Portfolio",
    monthly: "$199",
    annual: "$159",
    blurb: "Up to 5 products, shared brand kits, team seats.",
    features: ["Everything in Autopilot", "Up to 5 products and 10 accounts", "Shared brand kits and team seats", "Priority publishing support"],
    ctaLabel: "Talk to us",
  },
];

export const faqs = [
  {
    q: "Does it really post by itself?",
    a: "Yes. Swiply publishes through the official TikTok and Instagram APIs on the schedule you set — nothing lands in a reminder inbox waiting for you.",
  },
  {
    q: "Why only two platforms?",
    a: "Image slideshows behave differently on every feed. Doing TikTok and Instagram properly beats doing six platforms badly, so the layouts, captions and timing are tuned for exactly these two.",
  },
  {
    q: "Can I review before anything goes live?",
    a: "Approve-first is the default. Flip on full autopilot once you trust the output, and you can still pull any queued post back.",
  },
  {
    q: "What if I have no design assets?",
    a: "Paste your URL. Swiply pulls screenshots, colors and type from your site and builds a brand kit you can adjust once.",
  },
  {
    q: "Is there a free plan?",
    a: "Your first 5 slideshows are free, publishing included. No card required.",
  },
];
