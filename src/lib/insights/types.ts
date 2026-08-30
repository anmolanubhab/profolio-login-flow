import type { JSONContent } from '@tiptap/react';

export type InsightStatus = 'draft' | 'published';

export interface InsightAuthor {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
}

export interface Insight {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  status: InsightStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  author: InsightAuthor | null;
  // derived / joined
  subscriberCount?: number;
  isSubscribed?: boolean;
  isOwner?: boolean;
  articleCount?: number;
  latestArticleAt?: string | null;
}

export interface InsightArticle {
  id: string;
  insight_id: string;
  author_id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  cover_url: string | null;
  body: JSONContent;
  body_html: string | null;
  reading_minutes: number | null;
  status: InsightStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author?: InsightAuthor | null;
  insight?: Pick<Insight, 'id' | 'title' | 'slug' | 'cover_url' | 'owner_id'> | null;
}
