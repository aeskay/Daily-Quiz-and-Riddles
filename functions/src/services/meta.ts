import axios from "axios";

export interface MetaCredentials {
  pageId: string;
  instagramAccountId: string;
  accessToken: string; // Long-Lived Page Access Token
}

/**
 * Publishes a photo post to a Facebook Page via Meta Graph API v21.0
 */
export async function postToFacebook(
  creds: MetaCredentials,
  caption: string,
  imageUrl: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    if (!creds.pageId || !creds.accessToken) {
      throw new Error("Missing Facebook Page ID or Page Access Token.");
    }

    const endpoint = `https://graph.facebook.com/v21.0/${creds.pageId}/photos`;
    const response = await axios.post(endpoint, null, {
      params: {
        url: imageUrl,
        caption: caption,
        access_token: creds.accessToken,
      },
    });

    return {
      success: true,
      postId: response.data.id,
    };
  } catch (err: any) {
    const errorMsg = err?.response?.data?.error?.message || err?.message || "Failed to publish to Facebook";
    console.error("Facebook publish error:", err?.response?.data || err);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Publishes a 1:1 square image to an Instagram Professional/Creator account
 * via the official Instagram Content Publishing API.
 */
export async function postToInstagram(
  creds: MetaCredentials,
  caption: string,
  imageUrl: string
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    if (!creds.instagramAccountId || !creds.accessToken) {
      throw new Error("Missing Instagram Account ID or Access Token.");
    }

    // Step 1: Create media container
    const containerEndpoint = `https://graph.facebook.com/v21.0/${creds.instagramAccountId}/media`;
    const containerRes = await axios.post(containerEndpoint, null, {
      params: {
        image_url: imageUrl,
        caption: caption,
        access_token: creds.accessToken,
      },
    });

    const creationId = containerRes.data.id;
    if (!creationId) {
      throw new Error("Failed to create Instagram media container.");
    }

    // Wait 3 seconds for Meta CDN to process the image container
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 2: Publish the media container
    const publishEndpoint = `https://graph.facebook.com/v21.0/${creds.instagramAccountId}/media_publish`;
    const publishRes = await axios.post(publishEndpoint, null, {
      params: {
        creation_id: creationId,
        access_token: creds.accessToken,
      },
    });

    return {
      success: true,
      mediaId: publishRes.data.id,
    };
  } catch (err: any) {
    const errorMsg = err?.response?.data?.error?.message || err?.message || "Failed to publish to Instagram";
    console.error("Instagram publish error:", err?.response?.data || err);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
