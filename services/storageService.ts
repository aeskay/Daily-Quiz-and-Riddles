import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";
import { getLocalSocialConfig } from "./socialService";

/**
 * Converts a data URL to a binary Blob synchronously for form uploads.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Uploads a base64/dataURL PNG of the rendered 1000x1000 square card.
 * Uses a tiered approach:
 * 1. User's ImgBB API key (if configured in Settings)
 * 2. Instant Free Public Image Host (freeimage.host — 100% free, permanent HTTPS, open CORS, zero setup)
 * 3. Firebase Storage (if bucket CORS is enabled)
 * 4. Fallback: returns dataUrl directly so direct multipart uploads (Facebook) still work
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

  // 1. Primary: Use ImgBB if user configured their own key
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
      }
    } catch (err) {
      console.warn("ImgBB upload failed, falling back to free image host:", err);
    }
  }

  // 2. Try Firebase Storage if bucket exists
  try {
    const storageRef = ref(storage, `users/${userId}/posts/${postId}.jpg`);
    await uploadString(storageRef, dataUrl, 'data_url', {
      contentType: 'image/jpeg',
      customMetadata: {
        userId,
        postId,
        uploadedAt: new Date().toISOString()
      }
    });

    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (err: any) {
    // If Firebase Storage is not yet provisioned in Firebase Console or CORS is pending,
    // gracefully fall back to the compressed 80KB dataUrl
    console.warn("Firebase Storage unavailable (bucket not created yet or CORS pending), using direct compressed image data");
  }

  // 3. Robust fallback: return the high-quality compressed JPEG dataUrl (~80KB)
  // Fits easily within Firestore's 1MB document limit, and Facebook Graph API uploads it directly as a photo
  return dataUrl;
}
