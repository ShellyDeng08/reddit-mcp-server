# Reddit Connector MCP Server

An MCP server that enables AI assistants to browse and summarize Reddit content using Reddit's public JSON API.

## Installation

```bash
npm install
npm run build
```

## Configuration

Add to your MCP client configuration (e.g., Claude Code's settings):

```json
{
  "mcpServers": {
    "reddit": {
      "command": "node",
      "args": ["/path/to/reddit-connector-mcp/dist/index.js"]
    }
  }
}
```

## Available Tools

### search_posts
Search for posts across Reddit or within a specific subreddit.

```
Parameters:
  - query (required): Search query
  - subreddit (optional): Restrict search to this subreddit
  - limit (optional): Number of results (default: 25, max: 100)
```

### get_subreddit_posts
Get posts from a subreddit with optional sorting.

```
Parameters:
  - subreddit (required): Subreddit name (without r/ prefix)
  - sort (optional): hot | new | top | rising (default: hot)
  - limit (optional): Number of posts (default: 25, max: 100)
```

### get_hot_posts
Shortcut for getting hot posts from a subreddit.

```
Parameters:
  - subreddit (required): Subreddit name (without r/ prefix)
  - limit (optional): Number of posts (default: 25, max: 100)
```

### get_post_comments
Get comments for a specific Reddit post.

```
Parameters:
  - post_url (required): Full Reddit post URL or permalink
  - limit (optional): Number of comments (default: 25)
```

### get_user_profile
Get profile information for a Reddit user.

```
Parameters:
  - username (required): Reddit username (without u/ prefix)
```

### get_user_posts
Get recent posts and comments by a Reddit user.

```
Parameters:
  - username (required): Reddit username (without u/ prefix)
  - limit (optional): Number of items (default: 25, max: 100)
```

## Example Usage

```typescript
// Search for AI discussions
search_posts({ query: "AI startups", limit: 10 })

// Get hot posts from r/technology
get_hot_posts({ subreddit: "technology", limit: 20 })

// Get comments on a post
get_post_comments({
  post_url: "https://reddit.com/r/startups/comments/abc123/my_post/"
})

// Get user info
get_user_profile({ username: "spez" })
```

## Notes

- Uses Reddit's public JSON endpoints — no API key required
- Rate limited by Reddit (~60 requests/minute for unauthenticated access)
- Automatic retry with exponential backoff on 429/5xx errors
- Text content truncated to 500 characters to minimize token usage
