import type {
  RedditPost,
  RedditComment,
  RedditUser,
  FormattedPost,
  FormattedComment,
  FormattedUser,
} from './types.js';

const USER_AGENT = 'reddit-connector-mcp/1.0';
const BASE_URL = 'https://www.reddit.com';
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 30_000;

export const CHARACTER_LIMIT = 25_000;

interface FetchOptions {
  retries?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function truncate(text: string | undefined | null, max = 500): { text: string; truncated: boolean } {
  if (!text) return { text: '', truncated: false };
  if (text.length > max) return { text: text.slice(0, max) + '...', truncated: true };
  return { text, truncated: false };
}

export function checkResponseSize(json: string): { content: string; truncated: boolean } {
  if (json.length <= CHARACTER_LIMIT) {
    return { content: json, truncated: false };
  }
  const truncatedContent = json.slice(0, CHARACTER_LIMIT);
  return { content: truncatedContent + '\n\n[Response truncated due to size limit]', truncated: true };
}

export async function redditFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { retries = 0 } = options;
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    // Retry on rate limit or server errors
    if (response.status === 429 || response.status >= 500) {
      if (retries < MAX_RETRIES) {
        const backoff = Math.pow(2, retries) * 1000;
        await sleep(backoff);
        return redditFetch<T>(endpoint, { retries: retries + 1 });
      }
      throw new Error(`Reddit API error: ${response.status} after ${MAX_RETRIES} retries`);
    }

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Reddit API error: 403 Forbidden — subreddit may be private or quarantined');
      }
      if (response.status === 404) {
        throw new Error('Reddit API error: 404 Not Found — subreddit, user, or post does not exist');
      }
      throw new Error(`Reddit API error: ${response.status} - ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

export function formatPost(post: RedditPost): FormattedPost {
  const { text: selftext, truncated: selftext_truncated } = truncate(post.selftext);
  const result: FormattedPost = {
    title: post.title,
    author: post.author || '[deleted]',
    score: post.score,
    url: post.url,
    permalink: `https://reddit.com${post.permalink}`,
    selftext,
    num_comments: post.num_comments,
    created_utc: post.created_utc,
    subreddit: post.subreddit,
  };
  if (selftext_truncated) result.selftext_truncated = true;
  return result;
}

export function formatComment(comment: RedditComment): FormattedComment {
  const { text: body, truncated: body_truncated } = truncate(comment.body);

  // Handle replies - Reddit returns replies as { kind: "Listing", data: { children: [...] } }
  let formattedReplies: FormattedComment[] = [];
  if (comment.replies && typeof comment.replies === 'object' && !Array.isArray(comment.replies)) {
    const listingData = (comment.replies as Record<string, unknown> as { data?: { children?: Array<{ kind: string; data: RedditComment }> } }).data?.children || [];
    formattedReplies = listingData
      .filter((child) => child.kind === 't1')
      .map((child) => formatComment(child.data));
  } else if (Array.isArray(comment.replies)) {
    formattedReplies = comment.replies.map(formatComment);
  }

  const result: FormattedComment = {
    author: comment.author || '[deleted]',
    body,
    score: comment.score,
    created_utc: comment.created_utc,
    replies: formattedReplies,
  };
  if (body_truncated) result.body_truncated = true;
  return result;
}

export function formatUser(user: RedditUser): FormattedUser {
  return {
    name: user.name,
    link_karma: user.link_karma,
    comment_karma: user.comment_karma,
    account_created_utc: user.created_utc,
  };
}

// Reddit API listing response shape
interface RedditListing<T> {
  data: {
    children: Array<{ kind: string; data: T }>;
  };
}

export function extractComments(commentsData: RedditListing<RedditComment> | undefined, limit = 25): FormattedComment[] {
  const comments: FormattedComment[] = [];

  function traverse(children: Array<{ kind: string; data: RedditComment }>) {
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

export async function searchPosts(
  query: string,
  subreddit?: string,
  limit = 25
): Promise<FormattedPost[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(limit, 100)),
    restrict_sr: subreddit ? '1' : '0',
  });

  const endpoint = subreddit
    ? `/r/${subreddit}/search.json?${params}`
    : `/search.json?${params}`;

  const data = await redditFetch<RedditListing<RedditPost>>(endpoint);
  return data.data.children.map((child) => formatPost(child.data));
}

export async function getSubredditPosts(
  subreddit: string,
  sort = 'hot',
  limit = 25
): Promise<FormattedPost[]> {
  const endpoint = `/r/${subreddit}/${sort}.json?limit=${Math.min(limit, 100)}`;
  const data = await redditFetch<RedditListing<RedditPost>>(endpoint);
  return data.data.children.map((child) => formatPost(child.data));
}

export async function getPostComments(
  postUrl: string,
  limit = 25
): Promise<{ post: FormattedPost | null; comments: FormattedComment[] }> {
  let url = postUrl;
  if (!url.endsWith('.json')) {
    url = url.replace(/\/$/, '') + '.json';
  }

  const data = await redditFetch<[RedditListing<RedditPost>, RedditListing<RedditComment>]>(url);

  const postData = data[0]?.data?.children?.[0]?.data;
  const commentsData = data[1];

  return {
    post: postData ? formatPost(postData) : null,
    comments: extractComments(commentsData, limit),
  };
}

export async function getUserProfile(username: string): Promise<FormattedUser> {
  const endpoint = `/user/${username}/about.json`;
  const data = await redditFetch<{ data: RedditUser }>(endpoint);
  return formatUser(data.data);
}

export async function getUserPosts(
  username: string,
  limit = 25
): Promise<{ posts: FormattedPost[]; comments: FormattedComment[] }> {
  const postsEndpoint = `/user/${username}/submitted.json?limit=${Math.min(limit, 100)}`;
  const commentsEndpoint = `/user/${username}/comments.json?limit=${Math.min(limit, 100)}`;

  const [postsData, commentsData] = await Promise.all([
    redditFetch<RedditListing<RedditPost>>(postsEndpoint),
    redditFetch<RedditListing<RedditComment>>(commentsEndpoint),
  ]);

  const posts = postsData.data.children
    .filter((child) => child.kind === 't3')
    .map((child) => formatPost(child.data));

  const comments = commentsData.data.children
    .filter((child) => child.kind === 't1')
    .map((child) => formatComment(child.data));

  return { posts, comments };
}
