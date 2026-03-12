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

// Internal response types
export interface PostResponse {
  title: string;
  author: string;
  score: number;
  url: string;
  permalink: string;
  selftext: string;
  num_comments: number;
  created_utc: number;
  subreddit: string;
}

export interface CommentResponse {
  author: string;
  body: string;
  score: number;
  created_utc: number;
}

export interface UserResponse {
  name: string;
  link_karma: number;
  comment_karma: number;
  account_created_utc: number;
}
