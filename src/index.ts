#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  searchPosts,
  getSubredditPosts,
  getPostComments,
  getUserProfile,
  getUserPosts,
  checkResponseSize,
} from './reddit-client.js';

const server = new McpServer({
  name: 'reddit-connector-mcp',
  version: '1.0.0',
});

// --- reddit_search_posts ---
server.registerTool(
  'reddit_search_posts',
  {
    title: 'Search Reddit Posts',
    description: `Search for posts across Reddit or within a specific subreddit.

Examples:
- Search all of Reddit: { "query": "machine learning" }
- Search within a subreddit: { "query": "best practices", "subreddit": "programming" }

Returns: { posts: [{ title, author, score, url, permalink, selftext, num_comments, created_utc, subreddit }], count, has_more }

Errors:
- 403: Subreddit is private or quarantined
- 404: Subreddit does not exist
- 429: Rate limited by Reddit API`,
    inputSchema: {
      query: z.string().min(1).describe('Search query'),
      subreddit: z.string().min(1).optional().describe('Restrict search to this subreddit (without r/ prefix)'),
      limit: z.number().min(1).max(100).default(25).describe('Number of results (default: 25, max: 100)'),
      response_format: z.enum(['json', 'markdown']).default('json').describe('Response format'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: true,
    },
  },
  async ({ query, subreddit, limit, response_format }) => {
    const posts = await searchPosts(query, subreddit, limit);
    const result = { posts, count: posts.length, has_more: posts.length === limit };

    if (response_format === 'markdown') {
      return formatMarkdownResponse(
        `## Search Results for "${query}"${subreddit ? ` in r/${subreddit}` : ''}\n\n` +
        posts.map((p) =>
          `### ${p.title}\n- **Author:** ${p.author} | **Score:** ${p.score} | **Comments:** ${p.num_comments}\n- **Subreddit:** r/${p.subreddit}\n- **URL:** ${p.permalink}\n${p.selftext ? `\n${p.selftext}\n` : ''}`
        ).join('\n') +
        `\n\n*Showing ${posts.length} results${result.has_more ? ' (more available)' : ''}*`
      );
    }

    return formatJsonResponse(result);
  }
);

// --- reddit_get_subreddit_posts ---
server.registerTool(
  'reddit_get_subreddit_posts',
  {
    title: 'Get Subreddit Posts',
    description: `Get posts from a subreddit sorted by hot, new, top, or rising.

Examples:
- Hot posts: { "subreddit": "programming" }
- Top posts: { "subreddit": "science", "sort": "top", "limit": 10 }

Returns: { posts: [{ title, author, score, url, permalink, selftext, num_comments, created_utc, subreddit }], count, subreddit, sort, has_more }

Errors:
- 403: Subreddit is private or quarantined
- 404: Subreddit does not exist`,
    inputSchema: {
      subreddit: z.string().min(1).describe('Subreddit name (without r/ prefix)'),
      sort: z.enum(['hot', 'new', 'top', 'rising']).default('hot').describe('Sort method'),
      limit: z.number().min(1).max(100).default(25).describe('Number of posts (default: 25, max: 100)'),
      response_format: z.enum(['json', 'markdown']).default('json').describe('Response format'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: true,
    },
  },
  async ({ subreddit, sort, limit, response_format }) => {
    const posts = await getSubredditPosts(subreddit, sort, limit);
    const result = { posts, count: posts.length, subreddit, sort, has_more: posts.length === limit };

    if (response_format === 'markdown') {
      return formatMarkdownResponse(
        `## r/${subreddit} — ${sort} posts\n\n` +
        posts.map((p) =>
          `### ${p.title}\n- **Author:** ${p.author} | **Score:** ${p.score} | **Comments:** ${p.num_comments}\n- **URL:** ${p.permalink}\n${p.selftext ? `\n${p.selftext}\n` : ''}`
        ).join('\n') +
        `\n\n*Showing ${posts.length} posts${result.has_more ? ' (more available)' : ''}*`
      );
    }

    return formatJsonResponse(result);
  }
);

// --- reddit_get_post_comments ---
server.registerTool(
  'reddit_get_post_comments',
  {
    title: 'Get Post Comments',
    description: `Get comments for a specific Reddit post by URL.

Examples:
- { "post_url": "https://www.reddit.com/r/programming/comments/abc123/my_post/" }

Returns: { post: { title, author, score, ... }, comments: [{ author, body, score, created_utc, replies }], comment_count }

Errors:
- 404: Post does not exist or has been removed`,
    inputSchema: {
      post_url: z.string().min(1).describe('Full Reddit post URL or permalink'),
      limit: z.number().min(1).max(100).default(25).describe('Number of top-level comments (default: 25)'),
      response_format: z.enum(['json', 'markdown']).default('json').describe('Response format'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: true,
    },
  },
  async ({ post_url, limit, response_format }) => {
    const data = await getPostComments(post_url, limit);
    const result = {
      post: data.post,
      comments: data.comments,
      comment_count: data.comments.length,
    };

    if (response_format === 'markdown') {
      const postSection = data.post
        ? `## ${data.post.title}\n- **Author:** ${data.post.author} | **Score:** ${data.post.score}\n${data.post.selftext ? `\n${data.post.selftext}\n` : ''}\n---\n`
        : '';
      return formatMarkdownResponse(
        postSection +
        `### Comments (${data.comments.length})\n\n` +
        data.comments.map((c) => formatCommentMarkdown(c, 0)).join('\n')
      );
    }

    return formatJsonResponse(result);
  }
);

// --- reddit_get_user_profile ---
server.registerTool(
  'reddit_get_user_profile',
  {
    title: 'Get User Profile',
    description: `Get profile information for a Reddit user.

Examples:
- { "username": "spez" }

Returns: { user: { name, link_karma, comment_karma, account_created_utc } }

Errors:
- 404: User does not exist or account is suspended`,
    inputSchema: {
      username: z.string().min(1).describe('Reddit username (without u/ prefix)'),
      response_format: z.enum(['json', 'markdown']).default('json').describe('Response format'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: true,
    },
  },
  async ({ username, response_format }) => {
    const user = await getUserProfile(username);
    const result = { user };

    if (response_format === 'markdown') {
      return formatMarkdownResponse(
        `## u/${user.name}\n\n` +
        `- **Link Karma:** ${user.link_karma}\n` +
        `- **Comment Karma:** ${user.comment_karma}\n` +
        `- **Account Created:** ${new Date(user.account_created_utc * 1000).toISOString()}\n`
      );
    }

    return formatJsonResponse(result);
  }
);

// --- reddit_get_user_posts ---
server.registerTool(
  'reddit_get_user_posts',
  {
    title: 'Get User Posts',
    description: `Get recent posts and comments by a Reddit user.

Examples:
- { "username": "spez", "limit": 10 }

Returns: { username, posts: [...], comments: [...], post_count, comment_count }

Errors:
- 404: User does not exist or account is suspended`,
    inputSchema: {
      username: z.string().min(1).describe('Reddit username (without u/ prefix)'),
      limit: z.number().min(1).max(100).default(25).describe('Number of items (default: 25, max: 100)'),
      response_format: z.enum(['json', 'markdown']).default('json').describe('Response format'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: true,
    },
  },
  async ({ username, limit, response_format }) => {
    const data = await getUserPosts(username, limit);
    const result = {
      username,
      posts: data.posts,
      comments: data.comments,
      post_count: data.posts.length,
      comment_count: data.comments.length,
    };

    if (response_format === 'markdown') {
      return formatMarkdownResponse(
        `## u/${username} Activity\n\n` +
        `### Posts (${data.posts.length})\n\n` +
        data.posts.map((p) =>
          `- **${p.title}** (score: ${p.score}) in r/${p.subreddit}\n  ${p.permalink}`
        ).join('\n') +
        `\n\n### Comments (${data.comments.length})\n\n` +
        data.comments.map((c) =>
          `- ${c.body} (score: ${c.score})`
        ).join('\n')
      );
    }

    return formatJsonResponse(result);
  }
);

// --- Helpers ---

function formatJsonResponse(result: unknown): { content: { type: 'text'; text: string }[] } {
  const json = JSON.stringify(result, null, 2);
  const { content, truncated } = checkResponseSize(json);
  if (truncated) {
    return { content: [{ type: 'text' as const, text: content }] };
  }
  return { content: [{ type: 'text' as const, text: json }] };
}

function formatMarkdownResponse(markdown: string): { content: { type: 'text'; text: string }[] } {
  const { content, truncated } = checkResponseSize(markdown);
  if (truncated) {
    return { content: [{ type: 'text' as const, text: content }] };
  }
  return { content: [{ type: 'text' as const, text: markdown }] };
}

function formatCommentMarkdown(comment: { author: string; body: string; score: number; replies: Array<{ author: string; body: string; score: number; replies: unknown[] }> }, depth: number): string {
  const indent = '  '.repeat(depth);
  let text = `${indent}- **${comment.author}** (${comment.score} pts): ${comment.body}\n`;
  for (const reply of comment.replies) {
    text += formatCommentMarkdown(reply as typeof comment, depth + 1);
  }
  return text;
}

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Reddit MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
