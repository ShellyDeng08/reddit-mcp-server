// Reddit API Response Types (minimal, essential fields only)

export interface RedditPost {
  title: string;
  author: string;
  score: number;
  url: string;
  permalink: string;
  selftext: string;
  num_comments: number;
  created_utc: number;
  subreddit: string;
  id: string;
}

export interface RedditComment {
  author: string;
  body: string;
  score: number;
  created_utc: number;
  id: string;
  replies?: RedditComment[];
}

export interface RedditUser {
  name: string;
  link_karma: number;
  comment_karma: number;
  created_utc: number;
}

// Formatted response types returned by the MCP tools

export interface FormattedPost {
  title: string;
  author: string;
  score: number;
  url: string;
  permalink: string;
  selftext: string;
  selftext_truncated?: boolean;
  num_comments: number;
  created_utc: number;
  subreddit: string;
}

export interface FormattedComment {
  author: string;
  body: string;
  body_truncated?: boolean;
  score: number;
  created_utc: number;
  replies: FormattedComment[];
}

export interface FormattedUser {
  name: string;
  link_karma: number;
  comment_karma: number;
  account_created_utc: number;
}
