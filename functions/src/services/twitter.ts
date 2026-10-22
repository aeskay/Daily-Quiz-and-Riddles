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

    let mediaId: string | undefined;
    try {
      // 1. Download the rendered card image as a binary buffer
      const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
      const imageBuffer = Buffer.from(imageResponse.data);

      // 2. Upload media to Twitter v1.1 endpoint (requires Basic tier or media permissions)
      mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType: "image/png" });
    } catch (mediaErr: any) {
      console.warn("Twitter media upload note (X Free tier blocks v1.1 media upload with code 402, falling back to text tweet):", mediaErr?.message || mediaErr);
    }

    // 3. Post tweet with media if available, or text tweet fallback
    const tweetPayload: any = {
      text: mediaId 
        ? text.slice(0, 275) 
        : text.slice(0, 275),
    };

    if (mediaId) {
      tweetPayload.media = { media_ids: [mediaId] };
    }

    const tweet = await client.v2.tweet(tweetPayload);
    console.log(`[Twitter] Tweet posted successfully! Tweet ID: ${tweet.data.id}`);
    console.log(`[Twitter] Direct Tweet Link: https://twitter.com/i/web/status/${tweet.data.id}`);

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
