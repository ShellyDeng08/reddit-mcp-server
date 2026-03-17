# reddit-mcp-server

[![npm version](https://img.shields.io/npm/v/reddit-mcp-server.svg)](https://www.npmjs.com/package/reddit-mcp-server)
[![license](https://img.shields.io/npm/l/reddit-mcp-server.svg)](https://github.com/ShellyDeng08/reddit-mcp-server/blob/master/LICENSE)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that lets AI assistants browse Reddit. Search posts, read comments, and view user profiles — no API key required.

<a href="https://glama.ai/mcp/servers/@ShellyDeng08/reddit-mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@ShellyDeng08/reddit-mcp-server/badge" alt="reddit-mcp-server MCP server" />
</a>

## Features

- **Search Reddit** — search across all of Reddit or within a specific subreddit
- **Browse Subreddits** — get posts sorted by hot, new, top, or rising
- **Read Comments** — fetch full comment threads with nested replies
- **User Profiles** — view karma, account age, and recent activity
- **No API Key Required** — uses Reddit's public JSON API
- **Dual Output** — supports both JSON and Markdown response formats
- **Resilient** — automatic retry with exponential backoff on rate limits

## Quick Start

### Claude Code (CLI)

```bash
claude mcp add reddit -- npx -y reddit-mcp-server
```

### Claude Desktop

Add to your config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "reddit": {
      "command": "npx",
      "args": ["-y", "reddit-mcp-server"]
    }
  }
}
```

### Cursor / Windsurf / Other MCP Clients

```json
{
  "mcpServers": {
    "reddit": {
      "command": "npx",
      "args": ["-y", "reddit-mcp-server"]
    }
  }
}
```

### Install Globally (Optional)

```bash
npm install -g reddit-mcp-server
```

## Tools

| Tool | Description |
|------|-------------|
| `reddit_search_posts` | Search for posts across Reddit or within a specific subreddit |
| `reddit_get_subreddit_posts` | Get posts from a subreddit sorted by hot, new, top, or rising |
| `reddit_get_post_comments` | Get comments for a specific Reddit post by URL |
| `reddit_get_user_profile` | Get profile information for a Reddit user |
| `reddit_get_user_posts` | Get recent posts and comments by a Reddit user |

All tools support a `response_format` parameter (`json` or `markdown`).

### Examples

**Search posts:**
```json
{ "query": "machine learning", "subreddit": "programming", "limit": 10 }
```

**Get subreddit posts:**
```json
{ "subreddit": "science", "sort": "top", "limit": 5 }
```

**Get post comments:**
```json
{ "post_url": "https://www.reddit.com/r/programming/comments/abc123/my_post/" }
```

**Get user profile:**
```json
{ "username": "spez" }
```

**Get user posts:**
```json
{ "username": "spez", "limit": 10 }
```

## How It Works

This server uses Reddit's public `.json` endpoints (e.g., `reddit.com/r/programming.json`), which don't require authentication. This means:

- **Zero configuration** — no OAuth, no API keys, no Reddit account needed
- **Rate limited** — ~60 requests/minute (Reddit's unauthenticated limit)
- **Read-only** — browse and search, no posting or voting
- **Automatic retry** — exponential backoff on 429/5xx errors (up to 3 retries)
- **Token-efficient** — text truncated to minimize token usage (25KB max response)

## Development

```bash
git clone https://github.com/ShellyDeng08/reddit-mcp-server.git
cd reddit-mcp-server
npm install
npm run build
npm start
```

## License

MIT
