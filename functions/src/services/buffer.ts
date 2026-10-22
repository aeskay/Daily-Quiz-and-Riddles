import axios from "axios";

export interface BufferCredentials {
  accessToken: string;
  channelId: string;
  enabled?: boolean;
}

/**
 * Publishes a tweet via Buffer GraphQL API (100% Free, zero X developer credits needed)
 */
export async function postToBuffer(
  creds: BufferCredentials,
  caption: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    if (!creds.accessToken || !creds.channelId) {
      throw new Error("Missing Buffer access token or channel ID.");
    }

    const mutation = `
      mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess {
            post {
              id
              text
            }
          }
          ... on LimitReachedError {
            message
          }
          ... on InvalidInputError {
            message
          }
          ... on UnexpectedError {
            message
          }
        }
      }
    `;

    const res = await axios.post(
      "https://api.buffer.com/graphql",
      {
        query: mutation,
        variables: {
          input: {
            channelId: creds.channelId.trim(),
            text: caption,
            schedulingType: "automatic",
            mode: "shareNow",
            needsApproval: false,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken.trim()}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = res.data?.data?.createPost;
    if (result?.post?.id) {
      console.log(`[Buffer] Successfully published to X (Twitter)! Post ID: ${result.post.id}`);
      return { success: true, postId: result.post.id };
    }

    const errorMsg = result?.message || res.data?.errors?.[0]?.message || "Buffer post creation failed";
    console.error("[Buffer] Publish error:", errorMsg);
    return { success: false, error: errorMsg };
  } catch (err: any) {
    const errorMsg = err?.response?.data?.message || err?.message || String(err);
    console.error("[Buffer] Request error:", errorMsg);
    return { success: false, error: errorMsg };
  }
}
