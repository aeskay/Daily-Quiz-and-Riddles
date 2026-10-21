import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { postToTwitter, TwitterCredentials } from "./services/twitter";
import { postToFacebook, postToInstagram, MetaCredentials } from "./services/meta";
import { postToTikTok, TikTokCredentials } from "./services/tiktok";

admin.initializeApp();
const db = admin.firestore();

interface SocialSettings {
  twitter?: TwitterCredentials & { enabled: boolean };
  meta?: MetaCredentials & { postToFacebook: boolean; postToInstagram: boolean };
  tiktok?: TikTokCredentials & { enabled: boolean };
  scheduleTimes?: string[]; // e.g. ["09:00", "13:00", "18:00"]
  timezone?: string;
  autopostEnabled?: boolean;
}

/**
 * Builds an engaging caption for Twitter, Instagram, Facebook, and TikTok
 */
function buildCaption(post: any): string {
  const parts = (post.visual_text || "").split(" | ");
  let body = "";
  if (parts.length > 1) {
    body = `${parts[0]}\n\n${parts.slice(1).join("\n\n")}`;
  } else {
    body = post.visual_text || "";
  }

  return `🧠 DAILY QUIZ & RIDDLES\n\n${body}\n\n👇 Drop your guess in the comments!\n\n#DailyQuizAndRiddles #Quiz #Riddles #BrainTeaser #Trivia #Logic #Challenge`;
}

/**
 * Dispatches a post to all configured platforms
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
  const platforms: string[] = [];
  const errors: string[] = [];

  // 1. Post to Twitter / X
  if (social.twitter?.enabled && social.twitter.apiKey) {
    const res = await postToTwitter(social.twitter, caption, imageUrl);
    if (res.success) {
      platforms.push("twitter");
    } else if (res.error) {
      errors.push(`Twitter: ${res.error}`);
    }
  }

  // 2. Post to Facebook Page
  if (social.meta?.postToFacebook && social.meta.pageId) {
    const res = await postToFacebook(social.meta, caption, imageUrl);
    if (res.success) {
      platforms.push("facebook");
    } else if (res.error) {
      errors.push(`Facebook: ${res.error}`);
    }
  }

  // 3. Post to Instagram Professional/Creator
  if (social.meta?.postToInstagram && social.meta.instagramAccountId) {
    const res = await postToInstagram(social.meta, caption, imageUrl);
    if (res.success) {
      platforms.push("instagram");
    } else if (res.error) {
      errors.push(`Instagram: ${res.error}`);
    }
  }

  // 4. Post to TikTok
  if (social.tiktok?.enabled && social.tiktok.accessToken) {
    const res = await postToTikTok(social.tiktok, caption, imageUrl);
    if (res.success) {
      platforms.push("tiktok");
    } else if (res.error) {
      errors.push(`TikTok: ${res.error}`);
    }
  }

  const isSuccess = platforms.length > 0;
  await postDocRef.update({
    scheduleStatus: isSuccess ? "posted" : "failed",
    postedAt: isSuccess ? Date.now() : null,
    postedPlatforms: platforms,
    postError: errors.length > 0 ? errors.join(" | ") : null,
  });

  return { success: isSuccess, platforms, errors };
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
    const currentHours = String(now.getHours()).padStart(2, "0");
    const currentMinutes = now.getMinutes();

    // Query users collection for those who configured autopost
    const usersSnap = await db.collection("users").get();

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const settingsDoc = await db.collection("users").doc(userId).collection("settings").doc("social").get();
      if (!settingsDoc.exists) continue;

      const social = settingsDoc.data() as SocialSettings;
      if (!social.autopostEnabled) continue;

      const scheduleTimes = social.scheduleTimes || ["09:00", "13:00", "18:00"];

      // Check if current time is within +/- 15 mins of a scheduled slot
      const isSlotActive = scheduleTimes.some((slot) => {
        const [slotH, slotM] = slot.split(":").map(Number);
        const diffMinutes = Math.abs((now.getHours() * 60 + currentMinutes) - (slotH * 60 + slotM));
        return diffMinutes <= 15;
      });

      if (!isSlotActive) continue;

      // Find the next queued post
      const postsSnap = await db
        .collection("users")
        .doc(userId)
        .collection("posts")
        .where("scheduleStatus", "==", "queued")
        .orderBy("timestamp", "asc")
        .limit(1)
        .get();

      if (postsSnap.empty) {
        console.log(`User ${userId} has no queued posts ready to publish.`);
        continue;
      }

      const nextPostDoc = postsSnap.docs[0];
      const nextPost = nextPostDoc.data();

      console.log(`Publishing post ${nextPostDoc.id} for user ${userId}...`);
      await dispatchPostToSocials(nextPostDoc.ref, nextPost, social);
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
