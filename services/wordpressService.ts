import { QuizPost, WordPressConfig } from "../types";

export const WP_CATEGORY_MAP: Record<string, number> = {
  'Quiz': 10,
  'Riddles': 11,
  'Puzzles': 9,
  'Brain Teasers': 4,
  'Find the Mistake': 6,
  'Misconceptions': 8,
  'Controversial': 5,
  'Fun Facts': 7,
  'Blogs': 16,
  // Backward compatibility aliases
  'Logic & Math': 9,
  'Science & Tech': 10,
  'General Knowledge': 10,
  'Language & Literature': 11,
  'Nature & Animals': 7,
  'Psychology': 8,
  'Would you rather': 5,
};

export const DEFAULT_WP_CONFIG: WordPressConfig = {
  siteUrl: 'https://quizandriddles.com',
  username: 'aeskay',
  applicationPassword: (typeof process !== 'undefined' && process.env?.VITE_WP_APP_PASSWORD) || 
                       (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_WP_APP_PASSWORD) || 
                       '',
  enabled: true,
  autoPublishWithQueue: false,
};

const WP_STORAGE_KEY = 'dqr_wordpress_config';

export function getLocalWordPressConfig(): WordPressConfig {
  try {
    const raw = localStorage.getItem(WP_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_WP_CONFIG,
        ...parsed,
      };
    }
  } catch (e) {
    console.warn("Could not load WP config from localStorage:", e);
  }
  return DEFAULT_WP_CONFIG;
}

export function saveLocalWordPressConfig(config: WordPressConfig): void {
  try {
    localStorage.setItem(WP_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save WP config:", e);
  }
}

export function getWordPressCategoryId(categoryName?: string): number {
  if (!categoryName) return 10; // Default to Quiz
  return WP_CATEGORY_MAP[categoryName.trim()] || 10;
}

/**
 * Builds HTTP Basic Authentication header for WordPress Application Password
 */
function getAuthHeader(config: WordPressConfig): string {
  const creds = `${config.username.trim()}:${config.applicationPassword.trim()}`;
  if (typeof btoa !== 'undefined') {
    return `Basic ${btoa(creds)}`;
  }
  return `Basic ${Buffer.from(creds).toString('base64')}`;
}

/**
 * Converts a base64/dataURL or fetches an image URL to a binary Blob
 */
async function getMediaBlob(imageSource: string): Promise<{ blob: Blob; mimeType: string }> {
  if (imageSource.startsWith('data:')) {
    const arr = imageSource.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return { blob: new Blob([u8arr], { type: mime }), mimeType: mime };
  } else {
    // Public URL: fetch image bytes
    const res = await fetch(imageSource);
    const blob = await res.blob();
    return { blob, mimeType: blob.type || 'image/jpeg' };
  }
}

/**
 * Uploads an image card to WordPress Media Library as Featured Media
 */
export async function uploadWordPressMedia(
  config: WordPressConfig,
  imageSource: string,
  filename: string = `dqr-card-${Date.now()}.jpg`
): Promise<{ id: number; url: string }> {
  const site = config.siteUrl.replace(/\/+$/, '');
  const endpoint = `${site}/wp-json/wp/v2/media`;
  const { blob, mimeType } = await getMediaBlob(imageSource);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(config),
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
    body: blob,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`WordPress Media Upload Failed (${res.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    url: data.source_url || data.guid?.rendered || '',
  };
}

export interface PublishArticleParams {
  post: QuizPost;
  htmlContent: string;
  status?: 'publish' | 'draft' | 'future';
  scheduledIso?: string;
  featuredMediaId?: number;
}

/**
 * Creates and publishes or schedules an article to WordPress
 */
export async function publishToWordPress(
  config: WordPressConfig,
  params: PublishArticleParams
): Promise<{ id: number; link: string; status: string }> {
  const site = config.siteUrl.replace(/\/+$/, '');
  const endpoint = `${site}/wp-json/wp/v2/posts`;

  // Determine post title: use visual text with clean formatting
  let title = params.post.visual_text || 'Daily Quiz & Riddles';
  if (title.includes('|')) {
    title = title.split('|').map(s => s.trim()).join(' — ');
  }

  const categoryId = getWordPressCategoryId(params.post.category);

  // If a featured image card isn't uploaded yet and an image exists, upload it now
  let mediaId = params.featuredMediaId;
  const imageSource = params.post.renderedImageUrl || params.post.imageUrl;
  if (!mediaId && imageSource && (imageSource.startsWith('http') || imageSource.startsWith('data:'))) {
    try {
      const uploaded = await uploadWordPressMedia(config, imageSource, `dqr-${params.post.id}.jpg`);
      mediaId = uploaded.id;
    } catch (err) {
      console.warn("Could not upload featured media to WordPress, proceeding without media:", err);
    }
  }

  const payload: any = {
    title: title,
    content: params.htmlContent,
    status: params.status || 'publish',
    categories: [categoryId],
  };

  if (mediaId) {
    payload.featured_media = mediaId;
  }

  if (params.status === 'future' && params.scheduledIso) {
    payload.status = 'future';
    // WordPress REST API uses date_gmt (YYYY-MM-DDTHH:MM:SS) for UTC ISO timestamps
    payload.date_gmt = new Date(params.scheduledIso).toISOString().slice(0, 19);
  }

  // If a post ID already exists, update the existing post instead of creating a duplicate
  let targetUrl = params.post.wpPostId ? `${endpoint}/${params.post.wpPostId}` : endpoint;

  let res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // If updating failed with 404 (post deleted from WP), fall back to creating a new post
  if (!res.ok && res.status === 404 && params.post.wpPostId) {
    console.warn(`Post ID ${params.post.wpPostId} not found on WordPress. Creating as new post instead.`);
    targetUrl = endpoint;
    res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(config),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`WordPress Post ${params.post.wpPostId ? 'Update' : 'Creation'} Failed (${res.status}): ${errorText.substring(0, 250)}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    link: data.link || data.guid?.rendered || `${site}/?p=${data.id}`,
    status: data.status,
  };
}

/**
 * Updates an existing WordPress post's status (e.g. to draft or trash)
 */
export async function updateWordPressPostStatus(
  config: WordPressConfig,
  wpPostId: number,
  status: 'publish' | 'draft' | 'trash'
): Promise<boolean> {
  const site = config.siteUrl.replace(/\/+$/, '');
  const endpoint = `${site}/wp-json/wp/v2/posts/${wpPostId}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(config),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`Failed to update WP post ${wpPostId} status to ${status}:`, err);
    return false;
  }
}

/**
 * Tests WordPress connection and validates application credentials
 */
export async function testWordPressConnection(
  config: WordPressConfig
): Promise<{ success: boolean; message: string }> {
  try {
    const site = config.siteUrl.replace(/\/+$/, '');
    const res = await fetch(`${site}/wp-json/wp/v2/categories?per_page=1`, {
      headers: {
        'Authorization': getAuthHeader(config),
      },
    });

    if (res.status === 200) {
      return {
        success: true,
        message: `Successfully connected to ${site}! Application credentials verified.`,
      };
    } else {
      return {
        success: false,
        message: `Connection failed with HTTP ${res.status}. Please check your username and application password.`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Could not reach WordPress site.',
    };
  }
}
