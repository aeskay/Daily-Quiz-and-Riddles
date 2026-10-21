import axios from "axios";

export interface TikTokCredentials {
  accessToken: string;
  openId?: string;
}

/**
 * Publishes a photo post to TikTok via the TikTok Content Posting API v2
 */
export async function postToTikTok(
  creds: TikTokCredentials,
  caption: string,
  imageUrl: string
): Promise<{ success: boolean; publishId?: string; error?: string }> {
  try {
    if (!creds.accessToken) {
      throw new Error("Missing TikTok User Access Token.");
    }

    const endpoint = "https://open.tiktokapis.com/v2/post/publish/content/init/";
    const response = await axios.post(
      endpoint,
      {
        post_info: {
          title: caption.slice(0, 150),
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          auto_add_music: true,
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 1,
          photo_images: [imageUrl],
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      },
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      }
    );

    const publishId = response.data?.data?.publish_id;
    return {
      success: true,
      publishId,
    };
  } catch (err: any) {
    const errorMsg =
      err?.response?.data?.error?.message ||
      err?.response?.data?.message ||
      err?.message ||
      "Failed to publish to TikTok";
    console.error("TikTok publish error:", err?.response?.data || err);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
