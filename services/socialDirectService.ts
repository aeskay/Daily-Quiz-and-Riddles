import { QuizPost, SocialConfig } from "../types";
import { updateUserPost } from "./firestoreService";
import { postToBuffer } from "./bufferService";

/**
 * Builds standard social caption
 */
export function buildSocialCaption(post: QuizPost): string {
  const parts = (post.visual_text || "").split(" | ");
  let body = "";
  if (parts.length > 1) {
    body = `${parts[0]}\n\n${parts.slice(1).join("\n\n")}`;
  } else {
    body = post.visual_text || "";
  }

  return `🧠 DAILY QUIZ & RIDDLES\n\n${body}\n\n👇 Drop your guess in the comments!`;
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

    // Small delay for processing
    await new Promise((r) => setTimeout(r, 3000));

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
  const imageUrl = post.renderedImageUrl || post.imageUrl;
  if (!imageUrl) {
    throw new Error("No image available to post. Please queue or upload an image first.");
  }

  const caption = buildSocialCaption(post);
  const platforms: string[] = [];
  const errors: string[] = [];

  // 1. Facebook Page
  if (social.meta.postToFacebook && social.meta.pageId && social.meta.accessToken) {
    const fbRes = await directPostToFacebook(
      social.meta.pageId,
      social.meta.accessToken,
      caption,
      imageUrl
    );
    if (fbRes.success) {
      platforms.push("facebook");
    } else {
      errors.push(`Facebook: ${fbRes.error}`);
    }
  }

  // 2. Instagram
  if (social.meta.postToInstagram && social.meta.instagramAccountId && social.meta.accessToken) {
    const igRes = await directPostToInstagram(
      social.meta.instagramAccountId,
      social.meta.accessToken,
      caption,
      imageUrl
    );
    if (igRes.success) {
      platforms.push("instagram");
    } else {
      errors.push(`Instagram: ${igRes.error}`);
    }
  }

  // 3. Twitter / X via Buffer (100% Free, no X developer API credits needed)
  if (social.buffer?.enabled && social.buffer?.accessToken) {
    const channelId = social.buffer.channelId || '6ada7779778b240e2f9221b8';
    const bufferRes = await postToBuffer(
      social.buffer.accessToken,
      channelId,
      caption,
      'shareNow'
    );
    if (bufferRes.success) {
      platforms.push("Twitter (via Buffer)");
    } else {
      errors.push(`Twitter (Buffer): ${bufferRes.error}`);
    }
  }

  if (platforms.length === 0 && errors.length === 0) {
    errors.push("No platforms enabled or credentials missing. Please check 'FB Page' in Settings and ensure your Page Access Token and Page ID are saved.");
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

  await updateUserPost(userId, updatedPost);

  return {
    success: isSuccess,
    platforms,
    errors,
  };
}
