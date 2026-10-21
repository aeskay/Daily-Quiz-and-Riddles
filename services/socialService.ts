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
  scheduleTimes: ["09:00", "13:00", "18:00"],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago",
  autopostEnabled: false,
};

/**
 * Loads the user's social media configuration from Firestore
 */
export async function getSocialConfig(userId: string): Promise<SocialConfig> {
  if (!userId) return DEFAULT_SOCIAL_CONFIG;
  try {
    const configDocRef = doc(firestore, "users", userId, "settings", "social");
    const snap = await getDoc(configDocRef);
    if (snap.exists()) {
      return { ...DEFAULT_SOCIAL_CONFIG, ...snap.data() } as SocialConfig;
    }
  } catch (err) {
    console.warn("Could not load social config:", err);
  }
  return DEFAULT_SOCIAL_CONFIG;
}

/**
 * Saves the user's social media configuration to Firestore
 */
export async function saveSocialConfig(userId: string, config: SocialConfig): Promise<void> {
  if (!userId) throw new Error("User must be signed in to save social config.");
  const configDocRef = doc(firestore, "users", userId, "settings", "social");
  await setDoc(configDocRef, config, { merge: true });
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
