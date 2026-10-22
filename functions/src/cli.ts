import * as admin from "firebase-admin";
import { postToTwitter, TwitterCredentials } from "./services/twitter";
import { postToFacebook, postToInstagram, MetaCredentials } from "./services/meta";
import { postToTikTok, TikTokCredentials } from "./services/tiktok";
import { postToBuffer, BufferCredentials } from "./services/buffer";

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
  buffer?: BufferCredentials & { enabled: boolean };
  meta?: MetaCredentials & { postToFacebook: boolean; postToInstagram: boolean };
  tiktok?: TikTokCredentials & { enabled: boolean };
  scheduleTimes?: string[];
  timezone?: string;
  autopostEnabled?: boolean;
  lastPostedAt?: number;
}

function buildCaption(post: any): string {
  const parts = (post.visual_text || "").split(" | ");
  let body = "";
  if (parts.length > 1) {
    body = `${parts[0]}\n\n${parts.slice(1).join("\n\n")}`;
  } else {
    body = post.visual_text || "";
  }

  return `🧠 DAILY QUIZ & RIDDLES\n\n${body}\n\n👇 Drop your guess in the comments!`;
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

  // 1. Post to Twitter / X (via Buffer if enabled, or direct)
  if (social.buffer?.enabled && social.buffer.accessToken) {
    const creds = {
      accessToken: social.buffer.accessToken,
      channelId: social.buffer.channelId || "6ada7779778b240e2f9221b8",
    };
    const res = await postToBuffer(creds, caption);
    if (res.success) {
      platforms.push("twitter (via Buffer)");
    } else if (res.error) {
      errors.push(`Twitter (Buffer): ${res.error}`);
    }
  } else if (social.twitter?.enabled && social.twitter.apiKey) {
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
  const isManualRun = process.env.MANUAL_RUN === "true" || process.env.GITHUB_EVENT_NAME === "workflow_dispatch";
  console.log(`Execution Mode: ${isManualRun ? "MANUAL (Immediate Dispatch)" : "CRON (Scheduled Window)"}`);

  // 1. Discover all user IDs from users collection (including virtual parents)
  let userIds: string[] = [];
  try {
    const userDocs = await db.collection("users").listDocuments();
    userIds = userDocs.map((doc) => doc.id);
  } catch (e) {
    const usersSnap = await db.collection("users").get();
    userIds = usersSnap.docs.map((d) => d.id);
  }

  console.log(`Discovered ${userIds.length} user(s): ${userIds.join(", ") || "none"}`);

  for (const userId of userIds) {
    console.log(`\n--- Checking User: ${userId} ---`);
    const settingsDoc = await db.collection("users").doc(userId).collection("settings").doc("social").get();
    if (!settingsDoc.exists) {
      console.log(`User ${userId} has not configured social media settings in the web app.`);
      continue;
    }

    const social = settingsDoc.data() as SocialSettings;
    if (!social.autopostEnabled && !isManualRun) {
      console.log(`Autopost is currently PAUSED for user ${userId}.`);
      continue;
    }

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

    // Identify the latest scheduled slot that has arrived today in user's timezone
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

    if (!isManualRun) {
      if (!activeSlot) {
        console.log(`User ${userId}: No scheduled slot has arrived yet today (current time: ${userH}:${String(userM).padStart(2, "0")} in ${userTz}). Next slot: ${scheduleTimes[0]}.`);
        continue;
      }

      // Check if a post was already made since this slot started today
      const lastPostedAt = social.lastPostedAt || 0;
      const minutesSinceSlot = userTotalMinutes - activeSlotMinutes;
      const slotEpoch = now.getTime() - (minutesSinceSlot * 60 * 1000);

      if (lastPostedAt >= slotEpoch - 60000) {
        console.log(`User ${userId}: Already posted for slot ${activeSlot} today (last posted at ${new Date(lastPostedAt).toLocaleTimeString()}).`);
        continue;
      }
    }

    // Find all queued posts
    const postsSnap = await db
      .collection("users")
      .doc(userId)
      .collection("posts")
      .where("scheduleStatus", "==", "queued")
      .get();

    if (postsSnap.empty) {
      console.log(`User ${userId} has no queued posts ready to publish.`);
      continue;
    }

    console.log(`User ${userId} has ${postsSnap.docs.length} post(s) queued for publishing.`);

    // Sort earliest post first
    const sortedDocs = postsSnap.docs.sort((a, b) => {
      const tA = a.data().timestamp || 0;
      const tB = b.data().timestamp || 0;
      return tA - tB;
    });

    const nextPostDoc = sortedDocs[0];
    const nextPost = nextPostDoc.data();

    console.log(`Publishing post ${nextPostDoc.id} for user ${userId} (slot: ${activeSlot || "manual"})...`);
    const result = await dispatchPostToSocials(nextPostDoc.ref, nextPost, social);
    console.log(`Result:`, result);

    if (result.success) {
      await settingsDoc.ref.set({ lastPostedAt: Date.now() }, { merge: true });
    }
  }
}

main().then(() => {
  console.log("Autopost check complete.");
  process.exit(0);
}).catch((err) => {
  console.error("Autopost runner error:", err);
  process.exit(1);
});
