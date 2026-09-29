import { CATEGORY_RANGES, type ScoreCategory, type ViralityScore } from './virality-score';
import type { LinkLocation } from './post-features';

export const MINIMUM_POSTS_FOR_INSIGHTS = 10;

export interface InsightPost {
  text: string;
  postedAt: Date;
  isThread: boolean;
  linkLocation: LinkLocation;
  hashtagCount: number;
  mediaType: 'none' | 'image' | 'video' | 'gif';
  score: ViralityScore;
}

export interface Insight {
  id: string;
  kind: 'weakness' | 'opportunity' | 'warning';
  title: string;
  message: string;
}

export interface InsightsResult {
  status: 'ready' | 'needs_more_posts';
  scoredPostCount: number;
  minimumPosts: number;
  insights: Insight[];
}

const CATEGORY_LABELS: Record<Exclude<ScoreCategory, 'risk_factors'>, string> = {
  hook_strength: 'Hook strength',
  reply_bait: 'Reply-bait',
  emotional_charge: 'Emotional charge',
  format_structure: 'Format & structure',
  niche_consistency: 'Niche consistency',
  timing: 'Timing',
};

const CATEGORY_ADVICE: Record<Exclude<ScoreCategory, 'risk_factors'>, string> = {
  hook_strength: 'Open with a bold claim, a specific number, or a question instead of easing in.',
  reply_bait: 'End with a genuine question or a take people will want to push back on.',
  emotional_charge: 'Say what surprised, annoyed, or delighted you, not just what happened.',
  format_structure: 'Break posts into short lines with whitespace and keep each post to one idea.',
  niche_consistency: 'Keep most posts in the lane you want to be known for.',
  timing: 'Post when your audience is awake and scrolling.',
};

/** A difference smaller than this is noise, not a pattern worth coaching on. */
const MEANINGFUL_GAP = 5;

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const round = (value: number) => Math.round(value);

function endsWithQuestion(text: string): boolean {
  const lastLine =
    text
      .trim()
      .split('\n')
      .filter((line) => line.trim())
      .pop() ?? '';
  return /\?\s*\S{0,4}$/.test(lastLine.trim());
}

/**
 * Pattern-level coaching across a user's scored history. Pure aggregation over
 * stored breakdowns — ordered most-actionable first and capped at four so the
 * card stays glanceable.
 */
export function buildInsights(posts: InsightPost[], now = new Date()): InsightsResult {
  if (posts.length < MINIMUM_POSTS_FOR_INSIGHTS) {
    return {
      status: 'needs_more_posts',
      scoredPostCount: posts.length,
      minimumPosts: MINIMUM_POSTS_FOR_INSIGHTS,
      insights: [],
    };
  }

  const newestFirst = [...posts].sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
  const totals = (group: InsightPost[]) => average(group.map((post) => post.score.total_score));
  const insights: Insight[] = [];

  // 1. The weakest category, relative to its maximum.
  const weakest = (Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>)
    .map((category) => {
      const avg = average(posts.map((post) => post.score.breakdown[category].score));
      return { category, avg, ratio: avg / CATEGORY_RANGES[category].max };
    })
    .sort((a, b) => a.ratio - b.ratio)[0];
  if (weakest.ratio < 0.6) {
    insights.push({
      id: `weakest_category:${weakest.category}`,
      kind: 'weakness',
      title: `${CATEGORY_LABELS[weakest.category]} is your lowest category`,
      message: `You average ${round(weakest.avg)}/${CATEGORY_RANGES[weakest.category].max} on ${CATEGORY_LABELS[weakest.category].toLowerCase()}. ${CATEGORY_ADVICE[weakest.category]}`,
    });
  }

  // 2. Links in the main post body, recently.
  const recent = newestFirst.slice(0, 5);
  const recentMainLinks = recent.filter((post) => post.linkLocation === 'main_post').length;
  if (recentMainLinks >= 2) {
    insights.push({
      id: 'links_in_main_post',
      kind: 'warning',
      title: 'Links are costing you reach',
      message: `${recentMainLinks} of your last ${recent.length} posts put a link in the main post. Move links into a reply to stop dragging down your risk score.`,
    });
  }

  // 3. Questions at the end.
  const withQuestion = posts.filter((post) => endsWithQuestion(post.text));
  const withoutQuestion = posts.filter((post) => !endsWithQuestion(post.text));
  if (withQuestion.length >= 3 && withoutQuestion.length >= 3) {
    const gap = totals(withQuestion) - totals(withoutQuestion);
    if (gap >= MEANINGFUL_GAP) {
      insights.push({
        id: 'question_endings',
        kind: 'opportunity',
        title: 'Questions work for you',
        message: `Posts that end with a question score ${round(gap)} points higher on average than posts that don't.`,
      });
    }
  }

  // 4. Threads versus single posts.
  const threads = posts.filter((post) => post.isThread);
  const singles = posts.filter((post) => !post.isThread);
  if (threads.length >= 2 && singles.length >= 3) {
    const threadAvg = round(totals(threads));
    const singleAvg = round(totals(singles));
    if (threadAvg - singleAvg >= MEANINGFUL_GAP) {
      const lastThread = newestFirst.find((post) => post.isThread)!;
      const daysSince = Math.floor((now.getTime() - lastThread.postedAt.getTime()) / 86_400_000);
      insights.push({
        id: 'threads_outperform',
        kind: 'opportunity',
        title: 'Threads are your best format',
        message:
          daysSince >= 7
            ? `You haven't posted a thread in ${daysSince} days, and threads are your highest-scoring format (avg ${threadAvg} vs ${singleAvg} for single posts).`
            : `Threads average ${threadAvg} versus ${singleAvg} for your single posts.`,
      });
    }
  }

  // 5. Native media versus text-only.
  const withMedia = posts.filter((post) => post.mediaType !== 'none');
  const textOnly = posts.filter((post) => post.mediaType === 'none');
  if (withMedia.length >= 3 && textOnly.length >= 3) {
    const gap = totals(withMedia) - totals(textOnly);
    if (gap >= MEANINGFUL_GAP) {
      insights.push({
        id: 'media_outperforms',
        kind: 'opportunity',
        title: 'Media lifts your posts',
        message: `Posts with an image or video score ${round(gap)} points higher on average than text-only posts.`,
      });
    }
  }

  // 6. Hashtag stuffing, recently.
  const stuffed = recent.filter((post) => post.hashtagCount >= 3).length;
  if (stuffed >= 1) {
    insights.push({
      id: 'hashtag_stuffing',
      kind: 'warning',
      title: 'Too many hashtags',
      message: `${stuffed} of your last ${recent.length} posts used 3 or more hashtags. Use one at most, or none.`,
    });
  }

  const priority: Record<Insight['kind'], number> = { warning: 0, weakness: 1, opportunity: 2 };
  return {
    status: 'ready',
    scoredPostCount: posts.length,
    minimumPosts: MINIMUM_POSTS_FOR_INSIGHTS,
    insights: insights.sort((a, b) => priority[a.kind] - priority[b.kind]).slice(0, 4),
  };
}
