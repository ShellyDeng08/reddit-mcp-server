import type { RedditPost, RedditComment, RedditUser } from './types.js';

const USER_AGENT = 'reddit-mcp-connector/1.0';
const BASE_URL = 'https://www.reddit.com';
const MAX_RETRIES = 3;

interface FetchOptions {
  retries?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function truncate(text: string | undefined | null, max = 500): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

export async function redditFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { retries = 0 } = options;
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });

  // Retry on rate limit or server errors
  if (response.status === 429 || response.status >= 500) {
    if (retries < MAX_RETRIES) {
      const backoff = Math.pow(2, retries) * 1000; // 1s, 2s, 4s
      await sleep(backoff);
      return redditFetch<T>(endpoint, { retries: retries + 1 });
    }
  }

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status} - ${response.statusText}`);
  }

  return response.json();
}

// Format post for MCP response
export function formatPost(post: RedditPost) {
  return {
    title: post.title,
    author: post.author || '[deleted]',
    score: post.score,
    url: post.url,
    permalink: `https://reddit.com${post.permalink}`,
    selftext: truncate(post.selftext),
    num_comments: post.num_comments,
    created_utc: post.created_utc,
    subreddit: post.subreddit,
  };
}

// Format comment for MCP response
export function formatComment(comment: RedditComment): any {
  // Handle replies - Reddit returns replies as { kind: "Listing", data: { children: [...] } }
  let formattedReplies: any[] = [];
  if (comment.replies && typeof comment.replies === 'object' && !Array.isArray(comment.replies)) {
    // It's a Reddit listing object
    const listingData = (comment.replies as any).data?.children || [];
    formattedReplies = listingData
      .filter((child: any) => child.kind === 't1')
      .map((child: any) => formatComment(child.data));
  } else if (Array.isArray(comment.replies)) {
    formattedReplies = comment.replies.map(formatComment);
  }

  return {
    author: comment.author || '[deleted]',
    body: truncate(comment.body),
    score: comment.score,
    created_utc: comment.created_utc,
    replies: formattedReplies,
  };
}

// Format user for MCP response
export function formatUser(user: RedditUser) {
  return {
    name: user.name,
    link_karma: user.link_karma,
    comment_karma: user.comment_karma,
    account_created_utc: user.created_utc,
  };
}

// Extract comments recursively from Reddit's nested structure
export function extractComments(commentsData: any, limit = 25): any[] {
  const comments: any[] = [];

  function traverse(children: any[]) {
    for (const child of children) {
      if (comments.length >= limit) break;
      if (child.kind === 't1' && child.data) {
        const comment: RedditComment = {
          author: child.data.author,
          body: child.data.body,
          score: child.data.score,
          created_utc: child.data.created_utc,
          id: child.data.id,
        };
        comments.push(formatComment(comment));
      }
    }
  }

  if (commentsData?.data?.children) {
    traverse(commentsData.data.children);
  }

  return comments;
}

// Search posts
export async function searchPosts(
  query: string,
  subreddit?: string,
  limit = 25
): Promise<any[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(limit, 100)),
    restrict_sr: subreddit ? '1' : '0',
  });

  const endpoint = subreddit
    ? `/r/${subreddit}/search.json?${params}`
    : `/search.json?${params}`;

  const data = await redditFetch<any>(endpoint);
  return data.data.children.map((child: any) => formatPost(child.data));
}

// Get subreddit posts
export async function getSubredditPosts(
  subreddit: string,
  sort = 'hot',
  limit = 25
): Promise<any[]> {
  const endpoint = `/r/${subreddit}/${sort}.json?limit=${Math.min(limit, 100)}`;
  const data = await redditFetch<any>(endpoint);
  return data.data.children.map((child: any) => formatPost(child.data));
}

// Get post comments
export async function getPostComments(
  postUrl: string,
  limit = 25
): Promise<{ post: any; comments: any[] }> {
  // Normalize URL to .json format
  let url = postUrl;
  if (!url.endsWith('.json')) {
    url = url.replace(/\/$/, '') + '.json';
  }

  const data = await redditFetch<any[]>(url);

  // Reddit returns [post_data, comments_data]
  const postData = data[0]?.data?.children?.[0]?.data;
  const commentsData = data[1];

  return {
    post: postData ? formatPost(postData) : null,
    comments: extractComments(commentsData, limit),
  };
}

// Get user profile
export async function getUserProfile(username: string): Promise<any> {
  const endpoint = `/user/${username}/about.json`;
  const data = await redditFetch<any>(endpoint);
  return formatUser(data.data);
}

// Get user posts/comments
export async function getUserPosts(
  username: string,
  limit = 25
): Promise<{ posts: any[]; comments: any[] }> {
  const postsEndpoint = `/user/${username}/submitted.json?limit=${Math.min(limit, 100)}`;
  const commentsEndpoint = `/user/${username}/comments.json?limit=${Math.min(limit, 100)}`;

  const [postsData, commentsData] = await Promise.all([
    redditFetch<any>(postsEndpoint),
    redditFetch<any>(commentsEndpoint),
  ]);

  const posts = postsData.data.children
    .filter((child: any) => child.kind === 't3')
    .map((child: any) => formatPost(child.data));

  const comments = commentsData.data.children
    .filter((child: any) => child.kind === 't1')
    .map((child: any) => formatComment(child.data));

  return { posts, comments };
}
