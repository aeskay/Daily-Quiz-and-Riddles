import { TwitterApi } from "twitter-api-v2";
import axios from "axios";

export interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

/**
 * Publishes a tweet with an attached image card to X (Twitter).
 * @param creds Twitter API v1.1/v2 credentials
 * @param text The tweet caption/text
 * @param imageUrl Public URL of the rendered card image
 */
export async function postToTwitter(
  creds: TwitterCredentials,
  text: string,
  imageUrl: string
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    if (!creds.apiKey || !creds.apiSecret || !creds.accessToken || !creds.accessSecret) {
      throw new Error("Missing Twitter API credentials.");
    }

    const client = new TwitterApi({
      appKey: creds.apiKey,
      appSecret: creds.apiSecret,
      accessToken: creds.accessToken,
      accessSecret: creds.accessSecret,
    });

    // 1. Download the rendered card image as a binary buffer
    const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const imageBuffer = Buffer.from(imageResponse.data);

    // 2. Upload media to Twitter v1.1 endpoint
    const mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType: "image/png" });

    // 3. Post tweet with media attachment via Twitter v2 endpoint
    const tweet = await client.v2.tweet({
      text: text.slice(0, 275), // Twitter 280-char limit safety
      media: { media_ids: [mediaId] },
    });

    return {
      success: true,
      tweetId: tweet.data.id,
    };
  } catch (err: any) {
    console.error("Twitter publishing error:", err?.response?.data || err?.message || err);
    return {
      success: false,
      error: err?.response?.data?.detail || err?.message || "Failed to publish to Twitter.",
    };
  }
}
