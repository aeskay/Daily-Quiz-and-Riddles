/**
 * Buffer GraphQL API service for automated posting to X (Twitter) without developer credits.
 */
export async function postToBuffer(
  accessToken: string,
  channelId: string,
  text: string,
  imageUrl?: string,
  mode: 'shareNow' | 'addToQueue' = 'shareNow'
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

    // On Netlify in the browser, route through Netlify Serverless Function or proxy
    const endpoint = typeof window !== 'undefined'
      ? (window.location.hostname.includes('netlify.app') ? '/.netlify/functions/buffer' : '/api/buffer/graphql')
      : 'https://api.buffer.com/graphql';

    const input: any = {
      channelId: channelId.trim(),
      text,
      schedulingType: 'automatic',
      mode,
    };

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
