/**
 * Buffer GraphQL API service for automated posting to all channels:
 * - Instagram (quiz_riddles_ -> automatically cross-posts to Facebook Page)
 * - TikTok (quiz_riddles1)
 * - Twitter / X (quiz_riddles)
 */

export interface BufferChannel {
  id: string;
  name: string;
  service: string;
}

const getBufferEndpoint = () => {
  return typeof window !== 'undefined'
    ? (window.location.hostname.includes('netlify.app') ? '/.netlify/functions/buffer' : '/api/buffer/graphql')
    : 'https://api.buffer.com/graphql';
};

/**
 * Discovers all active social channels connected to this Buffer account
 */
export async function getBufferChannels(accessToken: string): Promise<BufferChannel[]> {
  try {
    const endpoint = getBufferEndpoint();
    const orgRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: '{ account { organizations { id } } }' }),
    });

    const orgData = await orgRes.json();
    const orgId = orgData?.data?.account?.organizations?.[0]?.id;
    if (!orgId) {
      return getFallbackChannels();
    }

    const channelsRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `query GetChannels($input: ChannelsInput!) { channels(input: $input) { id name service } }`,
        variables: { input: { organizationId: orgId } },
      }),
    });

    const channelsData = await channelsRes.json();
    const list = channelsData?.data?.channels;
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
    return getFallbackChannels();
  } catch (err) {
    console.warn("[Buffer] Failed to auto-fetch channels, using verified fallback list:", err);
    return getFallbackChannels();
  }
}

/**
 * Returns verified default channels if network query is blocked
 */
export function getFallbackChannels(): BufferChannel[] {
  return [
    { id: '6adb582a778b240e2f9ce322', name: 'quiz_riddles_', service: 'instagram' },
    { id: '6adb53eb778b240e2f9cc185', name: 'quiz_riddles1', service: 'tiktok' },
    { id: '6ada7779778b240e2f9221b8', name: 'quiz_riddles', service: 'twitter' },
  ];
}

/**
 * Publishes or schedules a post to a single Buffer channel
 */
export async function postToBuffer(
  accessToken: string,
  channelId: string,
  text: string,
  imageUrl?: string,
  mode: 'shareNow' | 'customScheduled' | 'addToQueue' = 'shareNow',
  dueAt?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
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

    const endpoint = getBufferEndpoint();
    const input: any = {
      channelId: channelId.trim(),
      text,
      schedulingType: 'automatic',
      mode,
      needsApproval: false,
    };

    if (mode === 'customScheduled' && dueAt) {
      input.dueAt = dueAt;
    }

    if (imageUrl && imageUrl.startsWith('http')) {
      input.assets = [
        {
          image: {
            url: imageUrl,
          },
        },
      ];
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: { input },
      }),
    });

    const data = await res.json();
    if (data.errors && data.errors.length > 0) {
      return { success: false, error: data.errors[0]?.message || 'Buffer GraphQL error' };
    }

    const payload = data?.data?.createPost;
    if (payload?.post?.id) {
      return { success: true, id: payload.post.id };
    } else if (payload?.message) {
      return { success: false, error: payload.message };
    } else {
      return { success: false, error: 'Unknown response from Buffer' };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Dispatches to all connected Buffer channels (Instagram, TikTok, Twitter/X)
 */
export async function postToAllBufferChannels(
  accessToken: string,
  text: string,
  imageUrl?: string,
  mode: 'shareNow' | 'customScheduled' | 'addToQueue' = 'shareNow',
  dueAt?: string
): Promise<{ success: boolean; platforms: string[]; errors: string[] }> {
  const channels = await getBufferChannels(accessToken);
  const platforms: string[] = [];
  const errors: string[] = [];

  for (const ch of channels) {
    const res = await postToBuffer(accessToken, ch.id, text, imageUrl, mode, dueAt);
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
