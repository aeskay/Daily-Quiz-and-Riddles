import axios from "axios";

export interface BufferCredentials {
  accessToken: string;
  channelId?: string;
  channelIds?: string[];
  enabled?: boolean;
}

export interface BufferChannel {
  id: string;
  name: string;
  service: string;
}

/**
 * Discovers all active social channels connected to this Buffer account
 */
export async function getBufferChannels(accessToken: string): Promise<BufferChannel[]> {
  try {
    const orgRes = await axios.post(
      "https://api.buffer.com/graphql",
      { query: "{ account { organizations { id } } }" },
      { headers: { Authorization: `Bearer ${accessToken.trim()}`, "Content-Type": "application/json" } }
    );

    const orgId = orgRes.data?.data?.account?.organizations?.[0]?.id;
    if (!orgId) return [];

    const channelsRes = await axios.post(
      "https://api.buffer.com/graphql",
      {
        query: `query GetChannels($input: ChannelsInput!) { channels(input: $input) { id name service } }`,
        variables: { input: { organizationId: orgId } },
      },
      { headers: { Authorization: `Bearer ${accessToken.trim()}`, "Content-Type": "application/json" } }
    );

    return channelsRes.data?.data?.channels || [];
  } catch (err: any) {
    console.error("[Buffer] Failed to fetch channels:", err?.response?.data || err?.message);
    return [];
  }
}

/**
 * Publishes or schedules a post to a single Buffer channel
 */
export async function postToBuffer(
  creds: { accessToken: string; channelId: string },
  caption: string,
  imageUrl?: string,
  mode: "shareNow" | "customScheduled" | "addToQueue" = "shareNow",
  dueAt?: string
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

    const input: any = {
      channelId: creds.channelId.trim(),
      text: caption,
      schedulingType: "automatic",
      mode: mode,
      needsApproval: false,
    };

    if (mode === "customScheduled" && dueAt) {
      input.dueAt = dueAt;
    }

    if (imageUrl && imageUrl.startsWith("http")) {
      input.assets = [
        {
          image: {
            url: imageUrl,
          },
        },
      ];
    }

    const res = await axios.post(
      "https://api.buffer.com/graphql",
      {
        query: mutation,
        variables: { input },
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
      console.log(`[Buffer] Successfully dispatched to channel ${creds.channelId}! Post ID: ${result.post.id}`);
      return { success: true, postId: result.post.id };
    }

    const errorMsg = result?.message || res.data?.errors?.[0]?.message || "Buffer post creation failed";
    console.error(`[Buffer] Publish error on channel ${creds.channelId}:`, errorMsg);
    return { success: false, error: errorMsg };
  } catch (err: any) {
    const errorMsg = err?.response?.data?.message || err?.message || String(err);
    console.error(`[Buffer] Request error on channel ${creds.channelId}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Publishes a post to ALL connected Buffer channels (Instagram, TikTok, Twitter/X)
 */
export async function postToAllBufferChannels(
  accessToken: string,
  caption: string,
  imageUrl?: string,
  mode: "shareNow" | "customScheduled" | "addToQueue" = "shareNow",
  dueAt?: string
): Promise<{ success: boolean; platforms: string[]; errors: string[] }> {
  let channels = await getBufferChannels(accessToken);
  const platforms: string[] = [];
  const errors: string[] = [];

  if (channels.length === 0) {
    // Known channel fallback if API discovery has a transient issue
    channels = [
      { id: "6adb582a778b240e2f9ce322", name: "quiz_riddles_", service: "instagram" },
      { id: "6adb53eb778b240e2f9cc185", name: "quiz_riddles1", service: "tiktok" },
      { id: "6ada7779778b240e2f9221b8", name: "quiz_riddles", service: "twitter" },
    ];
  }

  for (const ch of channels) {
    console.log(`[Buffer] Dispatching to ${ch.name} (${ch.service})...`);
    const res = await postToBuffer({ accessToken, channelId: ch.id }, caption, imageUrl, mode, dueAt);
    if (res.success) {
      const label = ch.service === 'instagram' ? 'Instagram (+ FB Page cross-post)' : `${ch.name} (${ch.service})`;
      platforms.push(label);
    } else {
      errors.push(`${ch.name} (${ch.service}): ${res.error}`);
    }
  }

  return {
    success: platforms.length > 0,
    platforms,
    errors,
  };
}
