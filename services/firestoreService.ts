import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  getDocs,
  writeBatch,
  Unsubscribe 
} from "firebase/firestore";
import { firestore } from "./firebase";
import { QuizPost } from "../types";

/**
 * Returns a reference to the user's private posts subcollection:
 * Path: users/{userId}/posts/{postId}
 */
function getUserPostsRef(userId: string) {
  return collection(firestore, "users", userId, "posts");
}

/**
 * Real-time listener for the user's posts.
 * Automatically synchronizes changes across all devices.
 */
export function subscribeToUserPosts(
  userId: string, 
  onUpdate: (posts: QuizPost[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const postsQuery = query(
    getUserPostsRef(userId), 
    orderBy("timestamp", "desc")
  );

  return onSnapshot(
    postsQuery,
    (snapshot) => {
      const posts: QuizPost[] = [];
      snapshot.forEach((docSnap) => {
        posts.push(docSnap.data() as QuizPost);
      });
      onUpdate(posts);
    },
    (error) => {
      console.error("Firestore snapshot error:", error);
      onError?.(error);
    }
  );
}

/**
 * Removes undefined fields from an object so Firestore setDoc/updateDoc never throws:
 * "Unsupported field value: undefined"
 */
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Saves one or more posts into the user's Firestore subcollection
 */
export async function saveUserPosts(userId: string, posts: QuizPost[]): Promise<void> {
  if (!userId || posts.length === 0) return;

  const batch = writeBatch(firestore);
  const postsCol = getUserPostsRef(userId);

  for (const post of posts) {
    const postWithUser = sanitizeForFirestore({
      ...post,
      userId,
    });
    const postDoc = doc(postsCol, post.id);
    batch.set(postDoc, postWithUser);
  }

  await batch.commit();
}

/**
 * Updates a single post (e.g. archiving or updating custom text)
 */
export async function updateUserPost(userId: string, post: QuizPost): Promise<void> {
  if (!userId || !post.id) return;
  const postDoc = doc(getUserPostsRef(userId), post.id);
  const cleanData = sanitizeForFirestore({ ...post, userId });
  await setDoc(postDoc, cleanData, { merge: true });
}

/**
 * Deletes a post from the user's Firestore subcollection
 */
export async function deleteUserPost(userId: string, postId: string): Promise<void> {
  if (!userId || !postId) return;
  const postDoc = doc(getUserPostsRef(userId), postId);
  await deleteDoc(postDoc);
}

/**
 * Deletes all posts from the user's Firestore subcollection (Wipe & Reset)
 */
export async function clearAllUserPosts(userId: string): Promise<void> {
  if (!userId) return;
  const postsCol = getUserPostsRef(userId);
  const snapshot = await getDocs(postsCol);
  if (snapshot.empty) return;

  const batch = writeBatch(firestore);
  snapshot.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });
  await batch.commit();
}
