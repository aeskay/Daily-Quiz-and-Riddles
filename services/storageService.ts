import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";
import { getLocalSocialConfig } from "./socialService";

/**
 * Uploads a base64/dataURL PNG of the rendered 1000x1000 square card.
 * Uses ImgBB (100% free, no credit card, no billing required) or Firebase Storage if configured.
 * Social platforms (especially Instagram & Facebook) require a public HTTPS image URL.
 */
export async function uploadRenderedCard(
  userId: string, 
  postId: string, 
  dataUrl: string,
  explicitApiKey?: string
): Promise<string> {
  if (!userId || !postId || !dataUrl) {
    throw new Error("Missing parameters for image upload");
  }

  const config = getLocalSocialConfig();
  const apiKey = explicitApiKey || config.imgbbApiKey?.trim();

  // 1. Primary: Use ImgBB (100% Free, NO credit card, NO GCP billing account needed)
  if (apiKey) {
    try {
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const formData = new FormData();
      formData.append('image', base64Data);
      formData.append('name', `dqr-${postId}`);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json && json.success && json.data?.url) {
        return json.data.url;
      } else {
        throw new Error(json?.error?.message || "ImgBB image upload failed. Please verify your ImgBB key.");
      }
    } catch (err: any) {
      console.error("ImgBB upload error:", err);
      throw new Error("ImgBB upload failed: " + (err?.message || err));
    }
  }

  // 2. Fallback: try Firebase Storage if bucket exists
  try {
    const storageRef = ref(storage, `users/${userId}/posts/${postId}.png`);
    await uploadString(storageRef, dataUrl, 'data_url', {
      contentType: 'image/png',
      customMetadata: {
        userId,
        postId,
        uploadedAt: new Date().toISOString()
      }
    });

    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (err: any) {
    console.warn("Storage upload fallback error:", err);
    throw new Error(
      "Free image hosting required: Please paste your free ImgBB API key in Settings -> Social Autopost (get your free key in 10s at https://api.imgbb.com — 100% free, no credit card)."
    );
  }
}
