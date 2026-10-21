import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Uploads a base64/dataURL PNG of the rendered 1000x1000 square card
 * to Firebase Storage and returns its public HTTPS download URL.
 * Social platforms (especially Instagram & Facebook) require a public HTTPS image URL.
 */
export async function uploadRenderedCard(
  userId: string, 
  postId: string, 
  dataUrl: string
): Promise<string> {
  if (!userId || !postId || !dataUrl) {
    throw new Error("Missing parameters for storage upload");
  }

  try {
    const storageRef = ref(storage, `users/${userId}/posts/${postId}.png`);
    
    // uploadString with 'data_url' format handles "data:image/png;base64,..."
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
    console.error("Firebase Storage upload error:", err);
    throw new Error(
      "Could not upload image to Firebase Storage. Please ensure Firebase Storage CORS is enabled on your bucket: " + (err?.message || err)
    );
  }
}

