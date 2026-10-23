import * as admin from "firebase-admin";
import { postToAllBufferChannels, BufferCredentials } from "./services/buffer";

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
  buffer?: BufferCredentials & { enabled: boolean };
  scheduleTimes?: string[];
  timezone?: string;
  autopostEnabled?: boolean;
  lastPostedAt?: number;
}

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

  // Single unified Buffer pipeline for all channels:
  // - Instagram (quiz_riddles_ -> automatically cross-posts to Facebook Page)
  // - TikTok (quiz_riddles1)
  // - Twitter / X (quiz_riddles)
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

export async function main() {
  console.log("Checking 24/7 background autopost queue...");
  const now = new Date();
  const isManualRun = process.env.MANUAL_RUN === "true" || process.env.GITHUB_EVENT_NAME === "workflow_dispatch";
  console.log(`Execution Mode: ${isManualRun ? "MANUAL (Immediate Dispatch)" : "CRON (Scheduled Window)"}`);

  // 1. Discover all user IDs from users collection
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
