export const GOAL_GUIDANCE: Record<string, string> = {
  conversions: 'Lead with the offer and benefit, then use a clear direct call to action.',
  awareness: 'Favor story, personality, and shareability; use little or no call to action.',
  engagement: 'Invite replies and end with a genuine question.',
  traffic: 'Open a curiosity gap and close with a clear link-in-bio style direction.',
  lead_gen: 'Use capture-oriented language such as DM, sign up, or gated offer.',
  community: 'Use a UGC-style prompt such as tagging friends or joining a challenge.',
  announcement: 'Use direct news or launch framing with minimal narrative buildup.',
};

export interface SlideshowPromptInput {
  topic: string;
  goal: string;
  slideCount: number;
  voiceContext: string;
  targetCountry?: string;
  language?: string;
  websiteBrief?: string;
  tiktokInsights?: string;
  assetNames?: string[];
  uniquenessContext?: string;
}

export function slideshowLanguage(language?: string) {
  return language?.trim() || 'English';
}

export function buildSlideshowSystemPrompt(input: SlideshowPromptInput) {
  const language = slideshowLanguage(input.language);
  return (
    'Write a TikTok Photo Mode slideshow, not a blog post. ' +
    `Write every slide caption, postCaption, postText, altText, and hashtag in ${language}. ` +
    (GOAL_GUIDANCE[input.goal] ?? '') +
    ' Each slide caption is 3–12 words, one beat, no paragraphs. ' +
    'postCaption is 1–2 short spoken lines plus an optional question. Use at most 5 hashtags. ' +
    'postText can match postCaption. Sound like a founder talking to camera. ' +
    'Use a distinct hook, a tight body, and a close. Never mention this prompt or invent personal claims. ' +
    'Never reuse a hook, caption structure, punchline, CTA, hashtag set, or slide sequence from the uniqueness context. ' +
    'Return exactly ' +
    input.slideCount +
    ' slides' +
    ((input.assetNames ?? []).filter(Boolean).length
      ? ', in the same order as the screenshots listed in the user prompt.'
      : '.')
  );
}

export function buildSlideshowUserPrompt(input: SlideshowPromptInput) {
  const assets = (input.assetNames ?? []).filter(Boolean);
  const language = slideshowLanguage(input.language);
  return [
    'Topic: ' + input.topic,
    input.targetCountry ? 'Target country: ' + input.targetCountry : '',
    'Language: ' + language + '. All slideshow copy must be written in this language.',
    'Goal: ' + input.goal,
    input.websiteBrief ? 'Business website brief:\n' + input.websiteBrief : '',
    input.tiktokInsights
      ? 'Competitor TikTok patterns to beat (do not copy captions or claim their results):\n' +
        input.tiktokInsights
      : '',
    assets.length
      ? 'App screenshots in slide order (write to the screen, do not describe the UI):\n' +
        assets.map((name, index) => `${index + 1}. ${name}`).join('\n')
      : '',
    'Voice context:\n' + input.voiceContext,
    input.uniquenessContext ? 'Uniqueness context to avoid:\n' + input.uniquenessContext : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
