/**
 * Buffer GraphQL API service for automated posting to X (Twitter) without developer credits.
 */
export async function postToBuffer(
  accessToken: string,
  channelId: string,
  text: string,
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

    const res = await fetch('https://api.buffer.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            channelId: channelId.trim(),
            text,
            schedulingType: 'automatic',
            mode,
            needsApproval: false,
          },
        },
      }),
    });

    const data = await res.json();
    const result = data?.data?.createPost;

    if (result?.post?.id) {
      return { success: true, id: result.post.id };
    }

    const errorMsg = result?.message || data?.errors?.[0]?.message || 'Buffer post creation failed';
    return { success: false, error: errorMsg };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
