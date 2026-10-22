import { doc, getDoc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFunctions } from "firebase/functions";
import { firestore, app } from "./firebase";
import { SocialConfig, QuizPost } from "../types";
import { updateUserPost } from "./firestoreService";

const functions = getFunctions(app);

export const DEFAULT_SOCIAL_CONFIG: SocialConfig = {
  twitter: {
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    accessSecret: '',
    enabled: false,
  },
  meta: {
    pageId: '',
    instagramAccountId: '',
    accessToken: '',
    postToFacebook: false,
    postToInstagram: false,
  },
  tiktok: {
    accessToken: '',
    openId: '',
    enabled: false,
  },
  buffer: {
    accessToken: 'i-mLlsruAUr7fE3HtY4tkZY5L1tAwLweU1ihZK3etwT',
    channelId: '6ada7779778b240e2f9221b8',
    enabled: true,
  },
  scheduleTimes: ["09:00", "13:00", "18:00"],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago",
  autopostEnabled: false,
};

const LOCAL_STORAGE_KEY = 'dqr_social_config';

export function getLocalSocialConfig(): SocialConfig {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SOCIAL_CONFIG, ...JSON.parse(saved) };
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
  // Always persist locally first so keys never vanish
  saveLocalSocialConfig(config);

  if (userId) {
    try {
      // Ensure the root user doc exists for collection scanners
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
 * Queues a post for automated scheduling
 */
export async function queuePostForAutopost(
  userId: string, 
  post: QuizPost, 
  renderedImageUrl?: string,
  scheduledTime?: string
): Promise<QuizPost> {
  const updated: QuizPost = {
    ...post,
    scheduleStatus: 'queued',
    scheduledTime: scheduledTime || post.scheduledTime || "09:00",
    renderedImageUrl: renderedImageUrl || post.renderedImageUrl,
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
