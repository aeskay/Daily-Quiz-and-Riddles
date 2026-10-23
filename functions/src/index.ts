import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { postToAllBufferChannels, BufferCredentials } from "./services/buffer";

admin.initializeApp();
const db = admin.firestore();

interface SocialSettings {
  buffer?: BufferCredentials & { enabled: boolean };
  scheduleTimes?: string[];
  timezone?: string;
  autopostEnabled?: boolean;
  lastPostedAt?: number;
}

/**
 * Builds an engaging caption for social channels
 */
function buildCaption(post: any): string {
  const category = post.category || '';
  let header = '🧠 QUIZ';
  if (category === 'Riddles') header = '🧩 RIDDLE';
  else if (category === 'Logic & Math') header = '🔢 LOGIC & MATH PUZZLE';
  else if (category === 'General Knowledge') header = '💡 GENERAL KNOWLEDGE QUIZ';
  else if (category === 'Science & Tech') header = '🔬 SCIENCE & TECH QUIZ';
  else if (category === 'Language & Literature') header = '📚 LANGUAGE & LITERATURE QUIZ';
  else if (category === 'Nature & Animals') header = '🌿 NATURE & ANIMALS TRIVIA';
  else if (category === 'Psychology') header = '🧠 PSYCHOLOGY TRIVIA';
  else if (category === 'Would you rather') header = '💭 WOULD YOU RATHER?';
  else if (category) header = `🧠 ${category.toUpperCase()}`;

  if (category === 'Would you rather') {
    return `${header}\n\nWhich one are you choosing?`;
  }

  if (post.caption_hook && post.caption_hook.trim()) {
    return `${header}\n\n${post.caption_hook.trim()}`;
  }

  const hookPattern = /^(only\s+\d+%\s+[^.?!:]+[.?!:]*|99%\s+[^.?!:]+[.?!:]*|can\s+you\s+(solve|figure|answer)[^.?!:]+[.?!:]*|brain[- ]?teaser\s*:?|riddle\s+me\s+this\s*:?|most\s+people\s+get\s+this\s+wrong[.?!:]*|test\s+your\s+iq\s*:?|solve\s+this\s+if\s+you\s+can\s*:?)/i;
  const match = (post.visual_text || '').match(hookPattern);
  if (match) {
    return `${header}\n\n${match[0].trim()}`;
  }

  let defaultHook = 'Can you solve this?';
  if (category === 'Riddles') defaultHook = 'Only 5% can solve this riddle on the first try — can you?';
  else if (category === 'Logic & Math') defaultHook = "Only 1% can solve this fast — what's your answer?";
  else if (category === 'General Knowledge') defaultHook = 'Most people get this wrong — do you know the answer?';
  else if (category === 'Science & Tech') defaultHook = 'Mind-blowing trivia of the day — can you guess it?';
  else if (category === 'Language & Literature') defaultHook = 'Wordplay test — can you figure this out?';
  else if (category === 'Nature & Animals') defaultHook = 'Crazy nature trivia — do you know this one?';
  else if (category === 'Psychology') defaultHook = 'Your brain might trick you on this one — what do you think?';

  return `${header}\n\n${defaultHook}`;
}

/**
 * Dispatches a post to all configured platforms via Buffer
 */
async function dispatchPostToSocials(
  postDocRef: admin.firestore.DocumentReference,
  postData: any,
  social: SocialSettings
): Promise<{ success: boolean; platforms: string[]; errors: string[] }> {
  const imageUrl = postData.renderedImageUrl || postData.imageUrl;
  if (!imageUrl) {
    throw new Error("No image URL available to post. The card must have a rendered image URL.");
  }

  const caption = buildCaption(postData);
  const bufferToken =
    social.buffer?.accessToken ||
    process.env.BUFFER_ACCESS_TOKEN ||
    "i-mLlsruAUr7fE3HtY4tkZY5L1tAwLweU1ihZK3etwT";

  const res = await postToAllBufferChannels(bufferToken, caption, imageUrl, "shareNow");

  const isSuccess = res.platforms.length > 0;
  await postDocRef.update({
    scheduleStatus: isSuccess ? "posted" : "failed",
    postedAt: isSuccess ? Date.now() : null,
    postedPlatforms: res.platforms,
    postError: res.errors.length > 0 ? res.errors.join(" | ") : null,
  });

  return { success: isSuccess, platforms: res.platforms, errors: res.errors };
}

/**
 * 1. Cloud Scheduler Cron: Runs every 15 minutes.
 * Checks for users who have autopostEnabled === true and whose schedule matches now.
 */
export const autoPostScheduler = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "America/Chicago",
  },
  async () => {
    console.log("Checking autopost schedule...");
    const now = new Date();

    // Query users collection for those who configured autopost
    const usersSnap = await db.collection("users").get();

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const settingsDoc = await db.collection("users").doc(userId).collection("settings").doc("social").get();
      if (!settingsDoc.exists) continue;

      const social = settingsDoc.data() as SocialSettings;
      if (!social.autopostEnabled) continue;

      const userTz = social.timezone || "America/Chicago";
      const timeParts = new Intl.DateTimeFormat("en-US", {
        timeZone: userTz,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).formatToParts(now);

      const userH = Number(timeParts.find((p) => p.type === "hour")?.value || 0);
      const userM = Number(timeParts.find((p) => p.type === "minute")?.value || 0);
      const userTotalMinutes = userH * 60 + userM;

      const scheduleTimes = (social.scheduleTimes && social.scheduleTimes.length > 0)
        ? [...social.scheduleTimes].sort()
        : ["09:00", "13:00", "18:00"];

      // Find the latest slot that has arrived today in user's timezone
      let activeSlot: string | null = null;
      let activeSlotMinutes = 0;
      for (const slot of scheduleTimes) {
        const [sH, sM] = slot.split(":").map(Number);
        const slotMin = sH * 60 + sM;
        if (userTotalMinutes >= slotMin) {
          activeSlot = slot;
          activeSlotMinutes = slotMin;
        }
      }

      if (!activeSlot) continue;

      const lastPostedAt = social.lastPostedAt || 0;
      const minutesSinceSlot = userTotalMinutes - activeSlotMinutes;
      const slotEpoch = now.getTime() - (minutesSinceSlot * 60 * 1000);

      if (lastPostedAt >= slotEpoch - 60000) continue;

      // Find all queued posts
      const postsSnap = await db
        .collection("users")
        .doc(userId)
        .collection("posts")
        .where("scheduleStatus", "==", "queued")
        .get();

      if (postsSnap.empty) continue;

      const sortedDocs = postsSnap.docs.sort((a, b) => {
        const tA = a.data().timestamp || 0;
        const tB = b.data().timestamp || 0;
        return tA - tB;
      });

      const nextPostDoc = sortedDocs[0];
      const nextPost = nextPostDoc.data();

      console.log(`Publishing post ${nextPostDoc.id} for user ${userId}...`);
      const res = await dispatchPostToSocials(nextPostDoc.ref, nextPost, social);
      if (res.success) {
        await settingsDoc.ref.set({ lastPostedAt: Date.now() }, { merge: true });
      }
    }
  }
);

/**
 * 2. OnCall Callable: Allows user to click "Post to Socials Now" directly
 * from the app to test credentials immediately without waiting for cron.
 */
export const postNowCallable = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError("unauthenticated", "You must be signed in to post.");
  }

  const { postId } = request.data;
  if (!postId) {
    throw new HttpsError("invalid-argument", "Missing postId.");
  }

  const postDocRef = db.collection("users").doc(userId).collection("posts").doc(postId);
  const postDoc = await postDocRef.get();
  if (!postDoc.exists) {
    throw new HttpsError("not-found", "Post not found.");
  }

  const settingsDoc = await db.collection("users").doc(userId).collection("settings").doc("social").get();
  if (!settingsDoc.exists) {
    throw new HttpsError("failed-precondition", "Social media credentials not configured in Settings.");
  }

  const social = settingsDoc.data() as SocialSettings;
  const result = await dispatchPostToSocials(postDocRef, postDoc.data(), social);

  return result;
});
