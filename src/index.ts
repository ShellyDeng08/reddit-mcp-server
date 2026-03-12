#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import {
  searchPosts,
  getSubredditPosts,
  getPostComments,
  getUserProfile,
  getUserPosts,
} from './reddit-client.js';

// Create MCP server
const server = new Server(
  {
    name: 'reddit-connector',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_posts',
        description: 'Search for posts across Reddit or within a specific subreddit',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            subreddit: {
              type: 'string',
              description: 'Optional: restrict search to this subreddit',
            },
            limit: {
              type: 'number',
              description: 'Number of results (default: 25, max: 100)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_subreddit_posts',
        description: 'Get posts from a subreddit with optional sorting',
        inputSchema: {
          type: 'object',
          properties: {
            subreddit: {
              type: 'string',
              description: 'Subreddit name (without r/ prefix)',
            },
            sort: {
              type: 'string',
              enum: ['hot', 'new', 'top', 'rising'],
              description: 'Sort method (default: hot)',
            },
            limit: {
              type: 'number',
              description: 'Number of posts (default: 25, max: 100)',
            },
          },
          required: ['subreddit'],
        },
      },
      {
        name: 'get_hot_posts',
        description: 'Get hot posts from a subreddit (shortcut for get_subreddit_posts with sort=hot)',
        inputSchema: {
          type: 'object',
          properties: {
            subreddit: {
              type: 'string',
              description: 'Subreddit name (without r/ prefix)',
            },
            limit: {
              type: 'number',
              description: 'Number of posts (default: 25, max: 100)',
            },
          },
          required: ['subreddit'],
        },
      },
      {
        name: 'get_post_comments',
        description: 'Get comments for a specific Reddit post',
        inputSchema: {
          type: 'object',
          properties: {
            post_url: {
              type: 'string',
              description: 'Full Reddit post URL or permalink',
            },
            limit: {
              type: 'number',
              description: 'Number of comments (default: 25)',
            },
          },
          required: ['post_url'],
        },
      },
      {
        name: 'get_user_profile',
        description: 'Get profile information for a Reddit user',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'Reddit username (without u/ prefix)',
            },
          },
          required: ['username'],
        },
      },
      {
        name: 'get_user_posts',
        description: 'Get recent posts and comments by a Reddit user',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'Reddit username (without u/ prefix)',
            },
            limit: {
              type: 'number',
              description: 'Number of items (default: 25, max: 100)',
            },
          },
          required: ['username'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case 'search_posts': {
        const { query, subreddit, limit = 25 } = args as any;
        const posts = await searchPosts(query, subreddit, limit);
        result = { posts, count: posts.length };
        break;
      }

      case 'get_subreddit_posts': {
        const { subreddit, sort = 'hot', limit = 25 } = args as any;
        const posts = await getSubredditPosts(subreddit, sort, limit);
        result = { posts, count: posts.length, subreddit, sort };
        break;
      }

      case 'get_hot_posts': {
        const { subreddit, limit = 25 } = args as any;
        const posts = await getSubredditPosts(subreddit, 'hot', limit);
        result = { posts, count: posts.length, subreddit };
        break;
      }

      case 'get_post_comments': {
        const { post_url, limit = 25 } = args as any;
        const data = await getPostComments(post_url, limit);
        result = {
          post: data.post,
          comments: data.comments,
          comment_count: data.comments.length,
        };
        break;
      }

      case 'get_user_profile': {
        const { username } = args as any;
        const user = await getUserProfile(username);
        result = { user };
        break;
      }

      case 'get_user_posts': {
        const { username, limit = 25 } = args as any;
        const data = await getUserPosts(username, limit);
        result = {
          username,
          posts: data.posts,
          comments: data.comments,
          post_count: data.posts.length,
          comment_count: data.comments.length,
        };
        break;
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error occurred';
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Reddit Connector MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
