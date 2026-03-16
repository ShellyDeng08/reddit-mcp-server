# reddit-mcp-server

An MCP (Model Context Protocol) server for browsing Reddit. Search posts, read comments, and view user profiles — all read-only, no authentication required.

## Installation

```bash
npm install -g reddit-mcp-server
```

Or use directly with `npx`:

```bash
npx reddit-mcp-server
```

## Configuration

### Claude Code (CLI)

```bash
claude mcp add reddit -- npx -y --registry https://registry.npmjs.org/ reddit-mcp-server
```

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "reddit": {
      "command": "npx",
      "args": ["-y", "--registry", "https://registry.npmjs.org/", "reddit-mcp-server"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `reddit_search_posts` | Search for posts across Reddit or within a specific subreddit |
| `reddit_get_subreddit_posts` | Get posts from a subreddit sorted by hot, new, top, or rising |
| `reddit_get_post_comments` | Get comments for a specific Reddit post |
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

## Notes

- Uses Reddit's public JSON endpoints — no API key required
- Rate limited by Reddit (~60 requests/minute for unauthenticated access)
- Automatic retry with exponential backoff on 429/5xx errors
- 30-second request timeout
- Text content truncated to minimize token usage
- Large responses truncated at 25,000 characters

## Development

```bash
npm install
npm run build
npm start
```

## License

MIT
