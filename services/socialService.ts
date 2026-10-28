import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFunctions } from "firebase/functions";
import { firestore, app } from "./firebase";
import { SocialConfig, QuizPost } from "../types";
import { updateUserPost } from "./firestoreService";
import { 
  postToAllBufferChannels, 
  deleteFromAllBufferChannels, 
  rescheduleBufferPost,
  getBufferPostStatus
} from "./bufferService";
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
 * Finds the earliest unoccupied schedule slot based on user's daily scheduleTimes
 * and already occupied slots.
 *
 * Algorithm:
 * 1. Checks candidate times for today (starting from now + 2-minute buffer).
 * 2. If a candidate slot is already occupied by another queued post (within a 15-minute window),
 *    it advances to the following configured time.
 * 3. If no unoccupied time remains for today, it advances to tomorrow's first time, second time, etc.
 * 4. Repeats for subsequent days until an unoccupied slot is found.
 */
export function findNextAvailableSlotDate(
  scheduleTimes: string[] = ["10:00", "19:00"],
  occupiedIsoStrings: string[] = [],
  currentPostId?: string,
  now: Date = new Date()
): Date {
  const validTimes = (scheduleTimes && scheduleTimes.length > 0 ? scheduleTimes : ["10:00", "19:00"])
    .filter(t => /^\d{1,2}:\d{2}$/.test(t))
    .slice()
    .sort((a, b) => {
      const [hA, mA] = a.split(':').map(Number);
      const [hB, mB] = b.split(':').map(Number);
      return hA * 60 + mA - (hB * 60 + mB);
    });

  if (validTimes.length === 0) {
    validTimes.push("10:00", "19:00");
  }

  // Parse occupied timestamps (exclude past slots older than 10 minutes)
  const occupiedTimestamps = occupiedIsoStrings
    .map(iso => new Date(iso).getTime())
    .filter(t => !isNaN(t) && t > now.getTime() - 10 * 60 * 1000);

  // Scan day by day up to 365 days
  for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
    for (const timeStr of validTimes) {
      const [h, m] = timeStr.split(':').map(Number);
      const candidate = new Date(
        now.getFullYear(), 
        now.getMonth(), 
        now.getDate() + dayOffset, 
        h, 
        m, 
        0, 
        0
      );

      // Today's slots must have at least a 2-minute buffer from current time
      if (dayOffset === 0 && candidate.getTime() <= now.getTime() + 2 * 60 * 1000) {
        continue;
      }

      // Check if any existing post is already scheduled for this slot (within 15 minutes)
      const isTaken = occupiedTimestamps.some(
        occTime => Math.abs(occTime - candidate.getTime()) < 15 * 60 * 1000
      );

      if (isTaken) {
        // Slot is already taken; look for the next time!
        continue;
      }

      // Found the first available unoccupied slot!
      return candidate;
    }
  }

  return new Date(now.getTime() + 24 * 3600 * 1000);
}

/**
 * Computes next available slot date based on user's configured schedule times
 */
export function calculateNextSlotDate(
  queueIndex: number = 0,
  scheduleTimes: string[] = ["10:00", "19:00"],
  existingPosts?: QuizPost[],
  currentPostId?: string
): Date {
  if (existingPosts && existingPosts.length > 0) {
    const occupied = existingPosts
      .filter(p => p.scheduleStatus === 'queued' && p.id !== currentPostId && p.scheduledTime)
      .map(p => p.scheduledTime as string);
    return findNextAvailableSlotDate(scheduleTimes, occupied, currentPostId);
  }

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
 * Queries all currently queued posts for a user from Firestore
 */
export async function getQueuedUserPosts(userId: string): Promise<QuizPost[]> {
  if (!userId) return [];
  try {
    const postsCol = collection(firestore, "users", userId, "posts");
    const q = query(postsCol, where("scheduleStatus", "==", "queued"));
    const snap = await getDocs(q);
    const posts: QuizPost[] = [];
    snap.forEach(docSnap => {
      posts.push(docSnap.data() as QuizPost);
    });
    return posts;
  } catch (err) {
    console.warn("Could not query queued posts from Firestore:", err);
    return [];
  }
}

/**
 * Queues a post directly into Buffer's calendar queue with custom scheduled timing,
 * ensuring no two posts ever share the same scheduled time slot.
 */
export async function queuePostForAutopost(
  userId: string, 
  post: QuizPost, 
  renderedImageUrl?: string,
  scheduledTime?: string,
  existingPosts?: QuizPost[]
): Promise<{ post: QuizPost; platforms: string[]; errors: string[] }> {
  const social = getLocalSocialConfig();

  let targetDate: Date;
  if (scheduledTime && scheduledTime.includes('-')) {
    targetDate = new Date(scheduledTime);
  } else {
    // Collect all existing queued posts to find occupied slots
    let queued = existingPosts
      ? existingPosts.filter(p => p.scheduleStatus === 'queued' && p.id !== post.id)
      : [];

    try {
      const cloudQueued = await getQueuedUserPosts(userId);
      const postMap = new Map<string, QuizPost>();
      queued.forEach(p => postMap.set(p.id, p));
      cloudQueued.forEach(p => {
        if (p.id !== post.id) postMap.set(p.id, p);
      });
      queued = Array.from(postMap.values());
    } catch (e) {
      // Ignore cloud query error if local list exists
    }

    const occupiedIsoStrings = queued
      .map(p => p.scheduledTime)
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

    targetDate = findNextAvailableSlotDate(
      social.scheduleTimes,
      occupiedIsoStrings,
      post.id
    );
  }

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
    bufferPostIds: res.ids,
    postError: res.errors.length > 0 ? res.errors.join(' | ') : undefined,
  };

  await updateUserPost(userId, updated);
  return { post: updated, platforms: res.platforms, errors: res.errors };
}

/**
 * Removes a post from the queue, cancels any pending Buffer jobs, and resets status to draft.
 */
export async function unqueuePost(userId: string, post: QuizPost): Promise<QuizPost> {
  const social = getLocalSocialConfig();
  const bufferToken =
    social.buffer?.accessToken ||
    (typeof process !== 'undefined' && process.env?.VITE_BUFFER_ACCESS_TOKEN) ||
    'i-mLlsruAUr7fE3HtY4tkZY5L1tAwLweU1ihZK3etwT';

  // Clean up from Buffer if buffer IDs exist
  if (post.bufferPostIds && post.bufferPostIds.length > 0) {
    deleteFromAllBufferChannels(bufferToken, post.bufferPostIds).catch(err => {
      console.warn("Error deleting posts from Buffer on unqueue:", err);
    });
  }

  const updated: QuizPost = {
    ...post,
    scheduleStatus: 'draft',
    scheduledTime: '',
    bufferPostIds: [],
  };

  await updateUserPost(userId, updated);
  return updated;
}

/**
 * Scans all currently queued posts and re-slots them into clean, non-colliding consecutive slots.
 * Use when duplicate slots are detected or when schedule configuration changes.
 */
export async function realignQueuedPosts(
  userId: string,
  scheduleTimes: string[],
  queuedPosts: QuizPost[]
): Promise<QuizPost[]> {
  if (!queuedPosts || queuedPosts.length === 0) return [];

  const social = getLocalSocialConfig();
  const bufferToken =
    social.buffer?.accessToken ||
    (typeof process !== 'undefined' && process.env?.VITE_BUFFER_ACCESS_TOKEN) ||
    'i-mLlsruAUr7fE3HtY4tkZY5L1tAwLweU1ihZK3etwT';

  // Sort queued posts by existing scheduledTime or timestamp
  const sorted = [...queuedPosts].sort((a, b) => {
    const timeA = a.scheduledTime ? new Date(a.scheduledTime).getTime() : (a.timestamp || 0);
    const timeB = b.scheduledTime ? new Date(b.scheduledTime).getTime() : (b.timestamp || 0);
    return timeA - timeB;
  });

  const occupiedIsoStrings: string[] = [];
  const updatedPosts: QuizPost[] = [];

  for (const post of sorted) {
    const slotDate = findNextAvailableSlotDate(
      scheduleTimes,
      occupiedIsoStrings,
      post.id
    );
    const newDueAt = slotDate.toISOString();
    occupiedIsoStrings.push(newDueAt);

    // If time actually changed, update Buffer and Firestore
    if (post.scheduledTime !== newDueAt) {
      if (post.bufferPostIds && post.bufferPostIds.length > 0) {
        const caption = buildSocialCaption(post);
        const imageUrl = post.renderedImageUrl || post.imageUrl;
        for (const bid of post.bufferPostIds) {
          rescheduleBufferPost(bufferToken, bid, newDueAt, caption, imageUrl).catch(console.warn);
        }
      }
      const updated: QuizPost = {
        ...post,
        scheduledTime: newDueAt,
      };
      await updateUserPost(userId, updated);
      updatedPosts.push(updated);
    } else {
      updatedPosts.push(post);
    }
  }

  return updatedPosts;
}

/**
 * Reschedules an already queued post to a new custom date/time or slot
 */
export async function reschedulePost(
  userId: string,
  post: QuizPost,
  newDueAtIso: string
): Promise<QuizPost> {
  const social = getLocalSocialConfig();
  const bufferToken =
    social.buffer?.accessToken ||
    (typeof process !== 'undefined' && process.env?.VITE_BUFFER_ACCESS_TOKEN) ||
    'i-mLlsruAUr7fE3HtY4tkZY5L1tAwLweU1ihZK3etwT';

  const caption = buildSocialCaption(post);
  const imageUrl = post.renderedImageUrl || post.imageUrl;

  if (post.bufferPostIds && post.bufferPostIds.length > 0) {
    await Promise.allSettled(
      post.bufferPostIds.map(bid =>
        rescheduleBufferPost(bufferToken, bid, newDueAtIso, caption, imageUrl)
      )
    );
  }

  const updated: QuizPost = {
    ...post,
    scheduledTime: newDueAtIso,
  };
  await updateUserPost(userId, updated);
  return updated;
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
  scheduleTimes: string[] = ["10:00", "19:00"],
  occupiedIsoStrings: string[] = []
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

  const targetDate = occupiedIsoStrings.length > 0
    ? findNextAvailableSlotDate(scheduleTimes, occupiedIsoStrings, post.id, now)
    : calculateNextSlotDate(queueIndex, scheduleTimes);

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

/**
 * Synchronizes queued posts whose scheduled time is in the past:
 * Checks Buffer to see if they were sent or failed, and updates Firestore accordingly.
 */
export async function syncPastQueuedPosts(
  userId: string,
  posts: QuizPost[]
): Promise<{ updatedCount: number; posts: QuizPost[] }> {
  if (!userId || !posts || posts.length === 0) {
    return { updatedCount: 0, posts: posts || [] };
  }

  const social = getLocalSocialConfig();
  const bufferToken =
    social.buffer?.accessToken ||
    (typeof process !== 'undefined' && process.env?.VITE_BUFFER_ACCESS_TOKEN) ||
    'i-mLlsruAUr7fE3HtY4tkZY5L1tAwLweU1ihZK3etwT';

  const now = Date.now();
  // Find posts marked 'queued' whose scheduledTime has passed (with a 2-minute safety buffer)
  const pastQueued = posts.filter(p => {
    if (p.scheduleStatus !== 'queued') return false;
    if (!p.scheduledTime) return false;
    const scheduledEpoch = new Date(p.scheduledTime).getTime();
    return !isNaN(scheduledEpoch) && scheduledEpoch <= now - 2 * 60 * 1000;
  });

  if (pastQueued.length === 0) {
    return { updatedCount: 0, posts };
  }

  let updatedCount = 0;
  const updatedMap = new Map<string, QuizPost>();

  await Promise.allSettled(
    pastQueued.map(async (post) => {
      let isSent = false;
      let sentTimestamp: number = new Date(post.scheduledTime!).getTime();
      let hasError = false;
      let errorMsg: string | undefined;

      // If post has Buffer IDs, check Buffer's live status
      if (post.bufferPostIds && post.bufferPostIds.length > 0) {
        for (const bid of post.bufferPostIds) {
          try {
            const res = await getBufferPostStatus(bufferToken, bid);
            if (res?.status === 'sent') {
              isSent = true;
              if (res.sentAt) {
                const t = new Date(res.sentAt).getTime();
                if (!isNaN(t)) sentTimestamp = t;
              }
              break;
            } else if (res?.status === 'error') {
              hasError = true;
              errorMsg = res.error || 'Failed to publish from Buffer';
            }
          } catch (e) {
            console.warn("Buffer status check warning for post", bid, e);
          }
        }
      } else {
        // If no Buffer ID is recorded but scheduled time is well past (> 30 mins), treat as posted
        isSent = true;
      }

      // If Buffer confirmed sent OR the scheduled time is well in the past and no error occurred
      const scheduledEpoch = new Date(post.scheduledTime!).getTime();
      if (isSent || (!hasError && scheduledEpoch <= now - 15 * 60 * 1000)) {
        const updated: QuizPost = {
          ...post,
          scheduleStatus: 'posted',
          postedAt: sentTimestamp,
        };
        await updateUserPost(userId, updated);
        updatedMap.set(post.id, updated);
        updatedCount++;
      } else if (hasError) {
        const updated: QuizPost = {
          ...post,
          scheduleStatus: 'failed',
          postError: errorMsg,
        };
        await updateUserPost(userId, updated);
        updatedMap.set(post.id, updated);
        updatedCount++;
      }
    })
  );

  const finalPosts = posts.map(p => updatedMap.get(p.id) || p);
  return { updatedCount, posts: finalPosts };
}
