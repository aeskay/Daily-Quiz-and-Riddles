import * as admin from "firebase-admin";
import { postToTwitter, TwitterCredentials } from "./services/twitter";
import { postToFacebook, postToInstagram, MetaCredentials } from "./services/meta";
import { postToTikTok, TikTokCredentials } from "./services/tiktok";

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e) {
    console.error("Error parsing FIREBASE_SERVICE_ACCOUNT, falling back to default:", e);
    admin.initializeApp();
  }
} else {
  admin.initializeApp();
}

const db = admin.firestore();

interface SocialSettings {
  twitter?: TwitterCredentials & { enabled: boolean };
  meta?: MetaCredentials & { postToFacebook: boolean; postToInstagram: boolean };
  tiktok?: TikTokCredentials & { enabled: boolean };
  scheduleTimes?: string[];
  timezone?: string;
  autopostEnabled?: boolean;
}

function buildCaption(post: any): string {
  const parts = (post.visual_text || "").split(" | ");
  let body = "";
  if (parts.length > 1) {
    body = `${parts[0]}\n\n${parts.slice(1).join("\n\n")}`;
  } else {
    body = post.visual_text || "";
  }

  return `🧠 DAILY QUIZ & RIDDLES\n\n${body}\n\n👇 Drop your guess in the comments!\n\n#DailyQuizAndRiddles #Quiz #Riddles #BrainTeaser #Trivia #Challenge`;
}

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

  // 3. Post to Instagram
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

export async function main() {
  console.log("Checking 24/7 background autopost queue...");
  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, "0");
  const currentMinutes = now.getMinutes();

  const usersSnap = await db.collection("users").get();

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const settingsDoc = await db.collection("users").doc(userId).collection("settings").doc("social").get();
    if (!settingsDoc.exists) continue;

    const social = settingsDoc.data() as SocialSettings;
    if (!social.autopostEnabled) {
      console.log(`Autopost paused for user ${userId}`);
      continue;
    }

    const scheduleTimes = social.scheduleTimes || ["09:00", "13:00", "18:00"];

    // Check if current time is within +/- 15 mins of a scheduled slot
    const isSlotActive = scheduleTimes.some((slot) => {
      const [slotH, slotM] = slot.split(":").map(Number);
      const diffMinutes = Math.abs((now.getHours() * 60 + currentMinutes) - (slotH * 60 + slotM));
      return diffMinutes <= 15;
    });

    if (!isSlotActive) {
      console.log(`Current time (${currentHours}:${currentMinutes}) is not within a scheduled slot for user ${userId}.`);
      continue;
    }

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
    const result = await dispatchPostToSocials(nextPostDoc.ref, nextPost, social);
    console.log(`Result:`, result);
  }
}

main().then(() => {
  console.log("Autopost check complete.");
  process.exit(0);
}).catch((err) => {
  console.error("Autopost runner error:", err);
  process.exit(1);
});
