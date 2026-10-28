import { QuizPost, SocialConfig } from "../types";
import { updateUserPost } from "./firestoreService";
import { postToBuffer, postToAllBufferChannels, getBufferChannels, BufferChannel } from "./bufferService";

export function getCategoryHeader(category?: string): string {
  switch (category) {
    case 'Riddles':
      return '🧩 RIDDLE';
    case 'Logic & Math':
      return '🔢 LOGIC & MATH PUZZLE';
    case 'General Knowledge':
      return '💡 GENERAL KNOWLEDGE QUIZ';
    case 'Science & Tech':
      return '🔬 SCIENCE & TECH QUIZ';
    case 'Language & Literature':
      return '📚 LANGUAGE & LITERATURE QUIZ';
    case 'Nature & Animals':
      return '🌿 NATURE & ANIMALS TRIVIA';
    case 'Psychology':
      return '🧠 PSYCHOLOGY TRIVIA';
    case 'Would you rather':
      return '💭 WOULD YOU RATHER?';
    default:
      return category ? `🧠 ${category.toUpperCase()}` : '🧠 QUIZ';
  }
}

/**
 * Strips leading viral hook prefixes like "Only 1% can solve this fast"
 * from question text so the image graphic remains clean.
 */
export function stripHookFromQuestion(rawText: string): { hook?: string; cleanQuestion: string } {
  if (!rawText) return { cleanQuestion: '' };

  const hookPattern = /^(only\s+\d+%\s+[^.?!:]+[.?!:]*|99%\s+[^.?!:]+[.?!:]*|can\s+you\s+(solve|figure|answer)[^.?!:]+[.?!:]*|brain[- ]?teaser\s*:?|riddle\s+me\s+this\s*:?|most\s+people\s+get\s+this\s+wrong[.?!:]*|test\s+your\s+iq\s*:?|solve\s+this\s+if\s+you\s+can\s*:?)/i;

  // If delimited by pipe, e.g. "Only 1% can solve this! | What has to be broken..."
  if (rawText.includes('|')) {
    const parts = rawText.split('|').map(s => s.trim());
    if (hookPattern.test(parts[0])) {
      return {
        hook: parts[0],
        cleanQuestion: parts.slice(1).join(' | ').trim(),
      };
    }
  }

  // If hook is prefixed to the text
  const match = rawText.match(hookPattern);
  if (match) {
    const hook = match[0].trim();
    const clean = rawText.slice(match[0].length).replace(/^[:\-\s]+/, '').trim();
    if (clean) {
      return {
        hook,
        cleanQuestion: clean,
      };
    }
  }

  return { cleanQuestion: rawText.trim() };
}

/**
 * Strips category header prefixes like "[🧠 QUIZ]" or "[Riddles]" from question text
 */
export function stripCategoryHeaderFromQuestion(rawText: string): string {
  if (!rawText) return '';
  return rawText.replace(/^\[[^\]]+\]\s*:?\s*/i, '').trim();
}

/**
 * Cleans option text by removing choice label prefixes like "A)", "B.", etc.
 */
export function stripOptionLabel(rawOption: string): string {
  if (!rawOption) return '';
  return rawOption.replace(/^(?:[A-D\d][\.\)\-\:]\s*|\([A-D\d]\)\s*)/i, '').trim();
}

/**
 * Parses "Would you rather" options cleanly
 */
export function parseWouldYouRatherChoices(questionText: string, options?: string[]): { optionA: string; optionB: string } {
  const cleanOpt = (s: string) => s.replace(/^(?:[A-B\d][\.\)\-\:]\s*|\([A-B\d]\)\s*)/i, '').replace(/^(?:be\s+a\s+|have\s+a\s+|be\s+|have\s+)/i, (m) => m).trim();

  if (Array.isArray(options) && options.length >= 2) {
    return {
      optionA: cleanOpt(options[0]),
      optionB: cleanOpt(options[1]),
    };
  }

  let clean = (questionText || '').replace(/^would you rather\s*:?\s*/i, '').trim();
  clean = clean.replace(/[?.!]+$/, '').trim();

  // Split on " or "
  const orRegex = /\s+or\s+/i;
  if (orRegex.test(clean)) {
    const parts = clean.split(orRegex);
    const a = parts[0].trim();
    const bParts = parts.slice(1);
    return {
      optionA: cleanOpt(a),
      optionB: cleanOpt(bParts.join(' or ')),
    };
  }

  return {
    optionA: cleanOpt(clean),
    optionB: '',
  };
}

export const parseWyr = parseWouldYouRatherChoices;

/**
 * Returns a punchy teaser hook based on category (never repeats the question!)
 */
export function getDefaultCategoryHook(category?: string): string {
  switch (category) {
    case 'Riddles':
      return 'Only 5% can solve this riddle on the first try — can you?';
    case 'Logic & Math':
      return "Only 1% can solve this fast — what's your answer?";
    case 'General Knowledge':
      return 'Most people get this wrong — do you know the answer?';
    case 'Science & Tech':
      return 'Mind-blowing trivia of the day — can you guess it?';
    case 'Language & Literature':
      return 'Wordplay test — can you figure this out?';
    case 'Nature & Animals':
      return 'Crazy nature trivia — do you know this one?';
    case 'Psychology':
      return 'Your brain might trick you on this one — what do you think?';
    case 'Would you rather':
      return 'Which one are you choosing?';
    default:
      return 'Can you solve this?';
  }
}

/**
 * Builds standard social caption:
 * Format: [Category Header] + [Teaser Hook]
 */
export function buildSocialCaption(post: QuizPost): string {
  const header = getCategoryHeader(post.category);
  let mainText = '';

  if (post.category === 'Would you rather') {
    mainText = 'Which one are you choosing?';
  } else if (post.caption_hook && post.caption_hook.trim()) {
    mainText = post.caption_hook.trim();
  } else {
    const { hook } = stripHookFromQuestion(post.question || '');
    mainText = hook || getDefaultCategoryHook(post.category);
  }

  let caption = `${header}\n\n${mainText}`;

  // If a WordPress article is published or scheduled, add the teaser CTA link!
  if (post.wpPostUrl && post.wpPostUrl.startsWith('http')) {
    caption += `\n\n👉 Full explanation & answer breakdown: ${post.wpPostUrl}`;
  }

  return caption;
}

/**
 * Dispatches a post via Buffer to all connected social channels:
 * - Instagram (quiz_riddles_ -> automatically cross-posts to Facebook Page)
 * - TikTok (quiz_riddles1)
 * - Twitter / X (quiz_riddles)
 */
export async function dispatchPostDirectly(
  post: QuizPost,
  social: SocialConfig,
  userId: string
): Promise<{ success: boolean; platforms: string[]; errors: string[] }> {
  const imageUrl = post.renderedImageUrl || post.imageUrl;
  if (!imageUrl) {
    throw new Error("No image available to post. Please queue or upload an image first.");
  }

  const caption = buildSocialCaption(post);
  const bufferTokens: string[] = [];
  const primaryToken =
    social.buffer?.accessToken ||
    (typeof process !== 'undefined' && process.env?.VITE_BUFFER_ACCESS_TOKEN) ||
    '';
  if (primaryToken) bufferTokens.push(primaryToken);

  const secondaryToken =
    social.bufferSecondary?.accessToken ||
    (typeof process !== 'undefined' && process.env?.VITE_BUFFER_SECONDARY_TOKEN);
  if (secondaryToken && social.bufferSecondary?.enabled !== false) {
    bufferTokens.push(secondaryToken);
  }

  const res = await postToAllBufferChannels(
    bufferTokens,
    caption,
    imageUrl.startsWith('http') ? imageUrl : undefined,
    'shareNow',
    undefined,
    post.wpPostUrl
  );

  const isSuccess = res.platforms.length > 0;
  const updatedPost: QuizPost = {
    ...post,
    scheduleStatus: isSuccess ? 'posted' : 'failed',
    postedPlatforms: res.platforms,
  };

  if (isSuccess) {
    updatedPost.postedAt = Date.now();
  }
  if (res.errors.length > 0) {
    updatedPost.postError = res.errors.join(' | ');
  } else {
    delete updatedPost.postError;
  }

  if (userId) {
    await updateUserPost(userId, updatedPost);
  }

  return {
    success: isSuccess,
    platforms: res.platforms,
    errors: res.errors,
  };
}

export interface SocialTestResult {
  platform: 'buffer';
  name: string;
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Verifies connection to all Buffer channels across Account 1 (IG, TikTok, X) and Account 2 (FB, Pinterest)
 */
export async function testAllSocialIntegrations(social: SocialConfig): Promise<SocialTestResult[]> {
  const primaryToken =
    social.buffer?.accessToken ||
    (typeof process !== 'undefined' && process.env?.VITE_BUFFER_ACCESS_TOKEN) ||
    '';

  const secondaryToken =
    social.bufferSecondary?.accessToken ||
    (typeof process !== 'undefined' && process.env?.VITE_BUFFER_SECONDARY_TOKEN);

  const results: SocialTestResult[] = [];

  // 1. Test Primary Account (Instagram, TikTok, Twitter/X)
  try {
    const channels1 = await getBufferChannels(primaryToken);
    for (const ch of channels1) {
      const label = ch.service === 'instagram' ? 'Instagram'
                  : ch.service === 'tiktok' ? 'TikTok'
                  : ch.service === 'twitter' ? 'Twitter / X'
                  : `${ch.name} (${ch.service})`;
      results.push({
        platform: 'buffer',
        name: `[Acct 1] ${label}`,
        success: true,
        id: ch.id,
      });
    }
  } catch (err: any) {
    results.push({
      platform: 'buffer',
      name: '[Acct 1] Buffer Primary Account',
      success: false,
      error: err?.message || String(err),
    });
  }

  // 2. Test Secondary Account (Pinterest, Facebook Page)
  if (secondaryToken && secondaryToken.trim()) {
    try {
      const channels2 = await getBufferChannels(secondaryToken);
      for (const ch of channels2) {
        if (ch.service === 'pinterest') {
          const hasBoard = Array.isArray(ch.boards) && ch.boards.length > 0;
          results.push({
            platform: 'buffer',
            name: `[Acct 2] Pinterest${hasBoard ? ` (${ch.boards[0].name})` : ''}`,
            success: hasBoard,
            id: ch.id,
            error: hasBoard ? undefined : 'No board synced. Reconnect Pinterest in Buffer to sync your board.',
          });
        } else {
          const label = ch.service === 'facebook' ? 'Facebook Page'
                      : `${ch.name} (${ch.service})`;
          results.push({
            platform: 'buffer',
            name: `[Acct 2] ${label}`,
            success: true,
            id: ch.id,
          });
        }
      }
    } catch (err: any) {
      results.push({
        platform: 'buffer',
        name: '[Acct 2] Buffer Secondary Account',
        success: false,
        error: err?.message || String(err),
      });
    }
  }

  return results;
}
