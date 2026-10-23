import { doc, getDoc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFunctions } from "firebase/functions";
import { firestore, app } from "./firebase";
import { SocialConfig, QuizPost } from "../types";
import { updateUserPost } from "./firestoreService";
import { postToAllBufferChannels } from "./bufferService";
import { buildSocialCaption } from "./socialDirectService";

const functions = getFunctions(app);

const DEFAULT_META_TOKEN = (typeof process !== 'undefined' && process.env?.VITE_META_ACCESS_TOKEN) || 
  (typeof atob !== 'undefined' ? atob('RUFBVWh0VFY4cHVFQlN4d1ZONVpDSERLdzRoWkFmZDNGazAwZUUxZkZCbUpCdTRwTGpQTG9WbEY1dkVaQklSUFdsTFVSV3dTWTIxYnRKM1ZjaFJyaG54dXZ5ZTVnT0pYSTh3OWNwRk9lUFFhRlNCZTNuRTZrUE9NZjJuc1ZjaFVVMjUwa29ya3RweUFzb1ZaQUhGdTl1ekRtQzFoR3E1enNHVTIxNzBhRHZlekdUYTZrbjJNaTYyWkJxanVTS2EzYmQyNVVaQ1RIUjlyaVl4akRSNkR2WkJ5azVlM1ZTRTJpNHpSRmk4aEl0Q2V3TmlFWkI0V1RNS1VFd2oxbzQyZnE=') : '');

const DEFAULT_BUFFER_TOKEN = (typeof process !== 'undefined' && process.env?.VITE_BUFFER_ACCESS_TOKEN) || 
  (typeof atob !== 'undefined' ? atob('aS1tTGxzcnVBVXI3ZkUzSHRZNHRrWlk1TDF0QXdMd2VVMWloWkszZXR3VA==') : '');

export const DEFAULT_SOCIAL_CONFIG: SocialConfig = {
  twitter: {
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    accessSecret: '',
    enabled: false,
  },
  meta: {
    pageId: (typeof process !== 'undefined' && process.env?.VITE_META_PAGE_ID) || '104499642745480',
    instagramAccountId: (typeof process !== 'undefined' && process.env?.VITE_INSTAGRAM_ACCOUNT_ID) || '17841471698421784',
    accessToken: DEFAULT_META_TOKEN,
    postToFacebook: true,
    postToInstagram: true,
  },
  tiktok: {
    accessToken: '',
    openId: '',
    enabled: false,
  },
  buffer: {
    accessToken: DEFAULT_BUFFER_TOKEN,
    channelId: (typeof process !== 'undefined' && process.env?.VITE_BUFFER_CHANNEL_ID) || '6ada7779778b240e2f9221b8',
    enabled: true,
  },
  scheduleTimes: ["10:00", "19:00"],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago",
  autopostEnabled: true,
};

const LOCAL_STORAGE_KEY = 'dqr_social_config';

export function getLocalSocialConfig(): SocialConfig {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_SOCIAL_CONFIG,
        ...parsed,
        buffer: {
          ...DEFAULT_SOCIAL_CONFIG.buffer,
          ...(parsed.buffer || {}),
          accessToken: parsed.buffer?.accessToken || DEFAULT_SOCIAL_CONFIG.buffer.accessToken,
          channelId: parsed.buffer?.channelId || DEFAULT_SOCIAL_CONFIG.buffer.channelId,
          enabled: parsed.buffer?.enabled ?? true,
        }
      };
    }
  } catch (e) {
    console.warn("Local social config load error:", e);
  }
  return DEFAULT_SOCIAL_CONFIG;
}

export function saveLocalSocialConfig(config: SocialConfig): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn("Local social config save error:", e);
  }
}

/**
 * Loads the user's social media configuration from localStorage & Firestore
 */
export async function getSocialConfig(userId?: string): Promise<SocialConfig> {
  const local = getLocalSocialConfig();
  if (!userId) return local;

  try {
    const configDocRef = doc(firestore, "users", userId, "settings", "social");
    const snap = await getDoc(configDocRef);
    if (snap.exists()) {
      const merged = { ...local, ...snap.data() } as SocialConfig;
      saveLocalSocialConfig(merged);
      return merged;
    }
  } catch (err) {
    console.warn("Could not load social config from cloud, using local:", err);
  }
  return local;
}

/**
 * Saves the user's social media configuration to both localStorage & Firestore
 */
export async function saveSocialConfig(userId: string | undefined, config: SocialConfig): Promise<void> {
  saveLocalSocialConfig(config);

  if (userId) {
    try {
      const userDocRef = doc(firestore, "users", userId);
      await setDoc(userDocRef, { uid: userId, lastUpdated: Date.now() }, { merge: true });

      const configDocRef = doc(firestore, "users", userId, "settings", "social");
      await setDoc(configDocRef, config, { merge: true });
    } catch (err) {
      console.warn("Cloud social config save warning:", err);
    }
  }
}

/**
 * Computes next available slot date based on user's configured schedule times
 */
export function calculateNextSlotDate(
  queueIndex: number = 0,
  scheduleTimes: string[] = ["10:00", "19:00"]
): Date {
  const now = new Date();
  const validTimes = (scheduleTimes && scheduleTimes.length > 0 ? scheduleTimes : ["10:00", "19:00"])
    .slice()
    .sort((a, b) => {
      const [hA, mA] = a.split(':').map(Number);
      const [hB, mB] = b.split(':').map(Number);
      return hA * 60 + mA - (hB * 60 + mB);
    });

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcomingSlots: Date[] = [];
  let dayOffset = 0;

  while (upcomingSlots.length <= queueIndex + 5 && dayOffset < 365) {
    for (const timeStr of validTimes) {
      const [h, m] = timeStr.split(':').map(Number);
      const slotMinutes = h * 60 + m;

      // Only take future slots with at least a 2-minute buffer today
      if (dayOffset === 0 && slotMinutes <= nowMinutes + 2) {
        continue;
      }

      const slotDate = new Date(now);
      slotDate.setDate(now.getDate() + dayOffset);
      slotDate.setHours(h, m, 0, 0);
      upcomingSlots.push(slotDate);
    }
    dayOffset++;
  }

  return upcomingSlots[queueIndex] || upcomingSlots[0] || new Date(Date.now() + 3600000);
}

/**
 * Queues a post directly into Buffer's calendar queue with custom scheduled timing
 */
export async function queuePostForAutopost(
  userId: string, 
  post: QuizPost, 
  renderedImageUrl?: string,
  scheduledTime?: string,
  queueIndex: number = 0
): Promise<{ post: QuizPost; platforms: string[]; errors: string[] }> {
  const social = getLocalSocialConfig();
  const targetDate = scheduledTime && scheduledTime.includes('-')
    ? new Date(scheduledTime)
    : calculateNextSlotDate(queueIndex, social.scheduleTimes);

  const dueAtIso = targetDate.toISOString();
  const imageUrl = renderedImageUrl || post.renderedImageUrl || post.imageUrl;
  const caption = buildSocialCaption(post);

  const bufferToken =
    social.buffer?.accessToken ||
    (typeof process !== 'undefined' && process.env?.VITE_BUFFER_ACCESS_TOKEN) ||
    'i-mLlsruAUr7fE3HtY4tkZY5L1tAwLweU1ihZK3etwT';

  // Push directly to Buffer with exact dueAt timestamp!
  const res = await postToAllBufferChannels(
    bufferToken,
    caption,
    imageUrl && imageUrl.startsWith('http') ? imageUrl : undefined,
    'customScheduled',
    dueAtIso
  );

  const updated: QuizPost = {
    ...post,
    scheduleStatus: 'queued',
    scheduledTime: dueAtIso,
    renderedImageUrl: imageUrl,
    postedPlatforms: res.platforms,
    postError: res.errors.length > 0 ? res.errors.join(' | ') : undefined,
  };

  await updateUserPost(userId, updated);
  return { post: updated, platforms: res.platforms, errors: res.errors };
}

/**
 * Immediately publishes a post to all enabled socials via Cloud Function
 */
export async function triggerPostNow(
  postId: string
): Promise<{ success: boolean; platforms: string[]; errors: string[] }> {
  const postNowFn = httpsCallable<{ postId: string }, { success: boolean; platforms: string[]; errors: string[] }>(
    functions, 
    "postNowCallable"
  );
  const result = await postNowFn({ postId });
  return result.data;
}

/**
 * Computes projected or explicit scheduled date and time for a queued post
 */
export function getQueuedScheduleInfo(
  post: QuizPost,
  queueIndex: number = 0,
  scheduleTimes: string[] = ["10:00", "19:00"]
): { label: string; dateStr: string; timeStr: string } {
  const now = new Date();

  // If post has an explicit ISO date string (contains '-' and parses to valid date)
  if (post.scheduledTime && post.scheduledTime.includes('-')) {
    const parsed = new Date(post.scheduledTime);
    if (!isNaN(parsed.getTime())) {
      const isToday = parsed.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const isTomorrow = parsed.toDateString() === tomorrow.toDateString();

      const dateStr = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : parsed.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const timeStr = parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      return { label: `${dateStr} at ${timeStr}`, dateStr, timeStr };
    }
  }

  const targetDate = calculateNextSlotDate(queueIndex, scheduleTimes);
  const isToday = targetDate.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = targetDate.toDateString() === tomorrow.toDateString();

  const dateStr = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : targetDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = targetDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return {
    label: `${dateStr} at ${timeStr}`,
    dateStr,
    timeStr,
  };
}

/**
 * Formats posted date and time for published posts
 */
export function formatPostedDate(postedAt?: number | string): string {
  if (!postedAt) return 'Recently';
  const date = typeof postedAt === 'number' ? new Date(postedAt) : new Date(postedAt);
  if (isNaN(date.getTime())) return 'Recently';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today at ${timeStr}`;
  if (isYesterday) return `Yesterday at ${timeStr}`;

  const dateStr = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });

  return `${dateStr} at ${timeStr}`;
}
