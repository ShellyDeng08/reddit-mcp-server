# Reddit Connector MCP Server Design

**Date:** 2026-03-12
**Purpose:** Enable AI assistants to browse and summarize Reddit content via MCP

## Architecture Overview

**Project Structure:**
```
reddit-connector-mcp/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── tools/            # Tool implementations
│   │   ├── search.ts
│   │   ├── subreddit.ts
│   │   ├── comments.ts
│   │   └── user.ts
│   ├── reddit-client.ts  # Fetch + retry logic
│   └── types.ts          # Response types
├── package.json
└── tsconfig.json
```

**Core Components:**
- **RedditClient** — Handles all HTTP requests with retry logic, User-Agent header, and error normalization
- **Tools** — 6 MCP tools that call RedditClient and format responses
- **Types** — Minimal TypeScript interfaces for Reddit's JSON structure

**Data Flow:**
```
AI Agent → MCP Tool → RedditClient → reddit.com/.json → Response
                    ← Retry on 429/5xx ←
```

## Tools

| Tool | Parameters | Description |
|------|------------|-------------|
| `search_posts` | `query`, `subreddit?`, `limit?` | Search across Reddit or within a subreddit |
| `get_subreddit_posts` | `subreddit`, `sort?`, `limit?` | Get posts from a subreddit (hot/new/top) |
| `get_hot_posts` | `subreddit`, `limit?` | Shortcut for hot posts |
| `get_post_comments` | `post_url`, `limit?` | Get comments for a specific post |
| `get_user_profile` | `username` | Get user karma, account age, etc. |
| `get_user_posts` | `username`, `limit?` | Get recent posts/comments by a user |

**Return Fields (essential only):**
- Post: title, author, score, url, permalink, selftext (truncated 500 chars), num_comments, created_utc, subreddit
- Comment: author, body (truncated 500 chars), score, created_utc
- User: name, link_karma, comment_karma, account_created_utc

**Defaults:**
- `limit` defaults to 25, max 100
- `sort` defaults to "hot" for subreddit posts
- `selftext/body` truncated to 500 chars to avoid token bloat

## RedditClient & Error Handling

**Request Configuration:**
- Base URL: `https://www.reddit.com`
- Required header: `User-Agent: reddit-mcp-connector/1.0`
- Accept gzip encoding

**Retry Logic:**
- Max retries: 3
- Backoff: exponential (1s, 2s, 4s)
- Retry on: 429 (rate limit), 502, 503, 504
- No retry on: 404, 403, 400

**Error Response Format:**
```typescript
{
  isError: true,
  content: [{ type: "text", text: "Reddit API error: 404 - Subreddit not found" }]
}
```

**Edge Cases:**
- Private/quarantined subreddits → 403 error
- Deleted posts/users → 404
- Empty results → Return empty array
- NSFW content → Returned as-is

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

No HTTP client library needed — Node.js 18+ has native `fetch`.

## Configuration

**MCP Configuration:**
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

No environment variables needed — public endpoints require no API keys.

## Out of Scope

- OAuth support for authenticated requests
- Pagination via `after` cursor
- Local caching
- Content filtering (NSFW, etc.)
