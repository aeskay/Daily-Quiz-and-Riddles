import { QuizPost, SocialConfig } from "../types";
import { updateUserPost } from "./firestoreService";
import { postToBuffer } from "./bufferService";

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

  return {
    cleanQuestion: rawText.trim(),
  };
}

/**
 * Parses Would You Rather questions into clean Option A and Option B
 */
export function parseWyr(rawText: string): { optionA: string; optionB: string } {
  if (!rawText) return { optionA: '', optionB: '' };

  const cleanOpt = (s: string) => {
    let t = s
      .replace(/^would you rather\s*:?\s*/i, '')
      .replace(/^(or\s+)?would you rather\s*:?\s*/i, '')
      .replace(/\?+$/, '')
      .trim();
    if (!t) return '';
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  // If delimited by pipe: "Option A | Option B"
  if (rawText.includes('|')) {
    const parts = rawText.split('|').map(s => s.trim());
    return {
      optionA: cleanOpt(parts[0]),
      optionB: cleanOpt(parts.slice(1).join(' | ')),
    };
  }

  // Strip leading "Would you rather" and trailing punctuation
  let clean = rawText
    .replace(/^would you rather\s*:?\s*/i, '')
    .replace(/\?+$/, '')
    .trim();

  // Try splitting by comma + "or" (e.g. "whisper, or shout")
  if (clean.toLowerCase().includes(', or ')) {
    const [a, ...bParts] = clean.split(/,\s+or\s+/i);
    return {
      optionA: cleanOpt(a),
      optionB: cleanOpt(bParts.join(', or ')),
    };
  }

  // Try splitting by " or "
  if (/\s+or\s+/i.test(clean)) {
    const [a, ...bParts] = clean.split(/\s+or\s+/i);
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
 * NEVER repeats the question text, because the attached image card already displays it!
 */
export function buildSocialCaption(post: QuizPost): string {
  const header = getCategoryHeader(post.category);

  // If Would You Rather, always use the choice question
  if (post.category === 'Would you rather') {
    return `${header}\n\nWhich one are you choosing?`;
  }

  // 1. If post has a dedicated caption_hook from Gemini, use it!
  if (post.caption_hook && post.caption_hook.trim()) {
    return `${header}\n\n${post.caption_hook.trim()}`;
  }

  // 2. If an embedded hook was in visual_text, extract and use that hook
  const { hook } = stripHookFromQuestion(post.visual_text || '');
  if (hook) {
    return `${header}\n\n${hook}`;
  }

  // 3. Fallback to category teaser hook (never repeats the question!)
  const fallbackHook = getDefaultCategoryHook(post.category);
  return `${header}\n\n${fallbackHook}`;
}

/**
 * Publishes a photo directly to Facebook Page via Meta Graph API v21.0
 * Supports both public HTTPS URLs and direct binary file upload (Blob/dataUrl) via 'source'.
 */
export async function directPostToFacebook(
  pageId: string,
  accessToken: string,
  caption: string,
  imageUrl: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/photos`;
    const formData = new FormData();

    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
      // Direct binary upload to Facebook (no external image hosting needed!)
      const blobRes = await fetch(imageUrl);
      const blob = await blobRes.blob();
      formData.append('source', blob, 'post.png');
    } else {
      formData.append('url', imageUrl);
    }

    formData.append('caption', caption);
    formData.append('access_token', accessToken);
    formData.append('published', 'true');

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (data.id) {
      return { success: true, id: data.id };
    } else {
      return { success: false, error: data?.error?.message || 'Facebook API error' };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Publishes a 1:1 square photo directly to Instagram Business/Creator account
 */
export async function directPostToInstagram(
  instagramAccountId: string,
  accessToken: string,
  caption: string,
  imageUrl: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // 1. Create Media Container
    const containerUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(instagramAccountId)}/media`;
    const containerParams = new URLSearchParams();
    containerParams.append('image_url', imageUrl);
    containerParams.append('caption', caption);
    containerParams.append('access_token', accessToken);

    const containerRes = await fetch(containerUrl, {
      method: 'POST',
      body: containerParams,
    });
    const containerData = await containerRes.json();
    if (!containerData.id) {
      return { success: false, error: containerData?.error?.message || 'Instagram container creation failed' };
    }

    const creationId = containerData.id;

    // Wait 4s for Instagram server processing
    await new Promise((r) => setTimeout(r, 4000));

    // 2. Publish container
    const publishUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(instagramAccountId)}/media_publish`;
    const pubParams = new URLSearchParams();
    pubParams.append('creation_id', creationId);
    pubParams.append('access_token', accessToken);

    const pubRes = await fetch(publishUrl, {
      method: 'POST',
      body: pubParams,
    });
    const pubData = await pubRes.json();
    if (pubData.id) {
      return { success: true, id: pubData.id };
    } else {
      return { success: false, error: pubData?.error?.message || 'Instagram publish failed' };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Dispatches a post directly to all enabled social accounts
 */
export async function dispatchPostDirectly(
  post: QuizPost,
  social: SocialConfig,
  userId: string
): Promise<{ success: boolean; platforms: string[]; errors: string[] }> {
  let imageUrl = post.renderedImageUrl || post.imageUrl;
  if (!imageUrl) {
    throw new Error("No image available to post. Please queue or upload an image first.");
  }

  const caption = buildSocialCaption(post);
  const platforms: string[] = [];
  const errors: string[] = [];
  let publicHttpsUrl = imageUrl.startsWith('http') ? imageUrl : '';

  // 1. Facebook Page First (Binary upload works with dataUrl!)
  if (social.meta.postToFacebook && social.meta.pageId && social.meta.accessToken) {
    const fbRes = await directPostToFacebook(
      social.meta.pageId,
      social.meta.accessToken,
      caption,
      imageUrl
    );
    if (fbRes.success) {
      platforms.push("facebook");
      // If we uploaded a dataUrl, fetch the newly created high-res Meta CDN photo URL
      // so Instagram can publish it seamlessly!
      if (fbRes.id) {
        try {
          const photoRes = await fetch(`https://graph.facebook.com/v21.0/${fbRes.id}?fields=images&access_token=${encodeURIComponent(social.meta.accessToken)}`);
          const photoData = await photoRes.json();
          if (photoData.images && photoData.images.length > 0) {
            publicHttpsUrl = photoData.images[0].source;
            post.renderedImageUrl = publicHttpsUrl;
            if (userId) {
              updateUserPost(userId, { ...post, renderedImageUrl: publicHttpsUrl });
            }
          }
        } catch (e) {
          console.warn("Could not retrieve Facebook CDN image URL:", e);
        }
      }
    } else {
      errors.push(`Facebook: ${fbRes.error}`);
    }
  }

  // 2. Instagram (Requires a public HTTPS image URL)
  if (social.meta.postToInstagram && social.meta.instagramAccountId && social.meta.accessToken) {
    const targetIgUrl = publicHttpsUrl || (imageUrl.startsWith('http') ? imageUrl : '');
    if (!targetIgUrl) {
      errors.push("Instagram: A public HTTPS image URL is required. (Enable Facebook to auto-generate a Meta CDN image)");
    } else {
      const igRes = await directPostToInstagram(
        social.meta.instagramAccountId,
        social.meta.accessToken,
        caption,
        targetIgUrl
      );
      if (igRes.success) {
        platforms.push("instagram");
      } else {
        errors.push(`Instagram: ${igRes.error}`);
      }
    }
  }

  // 3. Twitter / X via Buffer (100% Free, no X developer API credits needed)
  if (social.buffer?.enabled && social.buffer?.accessToken) {
    const channelId = social.buffer.channelId || '6ada7779778b240e2f9221b8';
    const bufferRes = await postToBuffer(
      social.buffer.accessToken,
      channelId,
      caption,
      publicHttpsUrl,
      'shareNow'
    );
    if (bufferRes.success) {
      platforms.push("Twitter (via Buffer)");
    } else {
      errors.push(`Twitter (Buffer): ${bufferRes.error}`);
    }
  }

  if (platforms.length === 0 && errors.length === 0) {
    errors.push("No platforms enabled or credentials missing. Please check Settings.");
  }

  const isSuccess = platforms.length > 0;
  const updatedPost: QuizPost = {
    ...post,
    scheduleStatus: isSuccess ? 'posted' : 'failed',
    postedPlatforms: platforms,
  };

  if (isSuccess) {
    updatedPost.postedAt = Date.now();
  }
  if (errors.length > 0) {
    updatedPost.postError = errors.join(' | ');
  } else {
    delete updatedPost.postError;
  }

  if (userId) {
    await updateUserPost(userId, updatedPost);
  }

  return {
    success: isSuccess,
    platforms,
    errors,
  };
}

export interface SocialTestResult {
  platform: 'facebook' | 'instagram' | 'buffer';
  name: string;
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Diagnostic test: publishes a verified test card to all 3 platforms and returns their live results
 */
export async function testAllSocialIntegrations(social: SocialConfig): Promise<SocialTestResult[]> {
  const results: SocialTestResult[] = [];
  const testCaption = `🧩 RIDDLE\n\nI speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?`;
  
  // Use our proven high-res Meta image
  let cdnUrl = 'https://scontent-dfw5-2.xx.fbcdn.net/v/t39.30808-6/365467817_114353981749580_8926697481991324250_n.png?_nc_cat=104&ccb=1-7&_nc_sid=585619&_nc_ohc=pEo2ALjso2AQ7kNvwG4aQBi&_nc_oc=AdoWLgnf8ztlvUWPNlXyMdlikUBRcexaiW9oY0aMtL4vC1egl1fUeU9jXFTbje71SiY&_nc_zt=23&_nc_ht=scontent-dfw5-2.xx&edm=AId9v20EAAAA&_nc_gid=SjAXKmiQTnB6qRqCtVhiSg&_nc_tpa=Q5bMBQLYbPa-AFpguGRIUH_AvaH4AFtQ_nweV-F9u1h2R_g09VmMnXqVY24x07CXE_zRn_uehJOVyKIheA&oh=00_AQOYLei3aPw2csbgKv2MIUfLmqkKWmBidebD-HCZ1HlaXQ&oe=6AE0694C';
  
  // 1. Facebook Test
  if (social.meta.postToFacebook && social.meta.pageId && social.meta.accessToken) {
    const fbRes = await directPostToFacebook(social.meta.pageId, social.meta.accessToken, testCaption, cdnUrl);
    results.push({
      platform: 'facebook',
      name: 'Facebook Page',
      success: fbRes.success,
      id: fbRes.id,
      error: fbRes.error,
    });
    if (fbRes.id) {
      try {
        const photoRes = await fetch(`https://graph.facebook.com/v21.0/${fbRes.id}?fields=images&access_token=${encodeURIComponent(social.meta.accessToken)}`);
        const photoData = await photoRes.json();
        if (photoData.images?.[0]?.source) {
          cdnUrl = photoData.images[0].source;
        }
      } catch (e) {}
    }
  } else {
    results.push({ platform: 'facebook', name: 'Facebook Page', success: false, error: 'Disabled or missing Page ID / Token' });
  }

  // 2. Instagram Test
  if (social.meta.postToInstagram && social.meta.instagramAccountId && social.meta.accessToken) {
    const igRes = await directPostToInstagram(social.meta.instagramAccountId, social.meta.accessToken, testCaption, cdnUrl);
    results.push({
      platform: 'instagram',
      name: 'Instagram Business',
      success: igRes.success,
      id: igRes.id,
      error: igRes.error,
    });
  } else {
    results.push({ platform: 'instagram', name: 'Instagram Business', success: false, error: 'Disabled or missing Instagram Account ID' });
  }

  // 3. Twitter / X via Buffer Test
  if (social.buffer?.enabled && social.buffer?.accessToken) {
    const channelId = social.buffer.channelId || '6ada7779778b240e2f9221b8';
    const bufRes = await postToBuffer(social.buffer.accessToken, channelId, testCaption, cdnUrl, 'shareNow');
    results.push({
      platform: 'buffer',
      name: 'Twitter / X (@quiz_riddles via Buffer)',
      success: bufRes.success,
      id: bufRes.id,
      error: bufRes.error,
    });
  } else {
    results.push({ platform: 'buffer', name: 'Twitter / X (Buffer)', success: false, error: 'Disabled or missing Buffer Token' });
  }

  return results;
}
