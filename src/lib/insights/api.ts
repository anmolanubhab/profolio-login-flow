import { supabase } from '@/integrations/supabase/client';
import type { JSONContent } from '@tiptap/react';
import { makeSlug } from './slug';
import { renderInsightHtml, readingMinutes } from './editor';
import { secureUpload } from '@/lib/secure-upload';
import type { Insight, InsightArticle, InsightAuthor } from './types';

/** Upload a cover / inline image for Insights. Reuses Profolio's secure
 *  upload + the existing public `covers` (cover art) and `post-images`
 *  (inline article images) buckets — no new storage infrastructure. Path is
 *  the standard `{uid}/{file}` so the existing owner-scoped storage policies
 *  on both buckets apply unchanged. */
export async function uploadInsightImage(
  file: File,
  kind: 'cover' | 'inline',
): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Sign in required.');
  const res = await secureUpload({
    bucket: kind === 'cover' ? 'covers' : 'post-images',
    file,
    userId: auth.user.id,
  });
  if (!res.success || !res.url) throw new Error(res.error || 'Upload failed.');
  return res.url;
}

const AUTHOR_COLS = 'id, display_name, avatar_url, headline';

/** Current user's profiles.id (null if signed out / no profile row). */
export async function currentProfileId(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  return data?.id ?? null;
}

function mapAuthor(row: any): InsightAuthor | null {
  if (!row) return null;
  return {
    id: row.id,
    display_name: row.display_name ?? null,
    avatar_url: row.avatar_url ?? null,
    headline: row.headline ?? null,
  };
}

function mapInsight(row: any, meId: string | null): Insight {
  return {
    id: row.id,
    owner_id: row.owner_id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? null,
    cover_url: row.cover_url ?? null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at ?? null,
    author: mapAuthor(row.author),
    isOwner: !!meId && row.owner_id === meId,
  };
}

function mapArticle(row: any): InsightArticle {
  return {
    id: row.id,
    insight_id: row.insight_id,
    author_id: row.author_id,
    title: row.title,
    subtitle: row.subtitle ?? null,
    slug: row.slug,
    cover_url: row.cover_url ?? null,
    body: (row.body ?? { type: 'doc', content: [] }) as JSONContent,
    body_html: row.body_html ?? null,
    reading_minutes: row.reading_minutes ?? null,
    status: row.status,
    published_at: row.published_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: mapAuthor(row.author),
    insight: row.insight
      ? {
          id: row.insight.id,
          title: row.insight.title,
          slug: row.insight.slug,
          cover_url: row.insight.cover_url ?? null,
          owner_id: row.insight.owner_id,
        }
      : null,
  };
}

// ------------------------------------------------------------------ landing

export interface InsightsLandingData {
  meId: string | null;
  mine: Insight[];
  following: Insight[];
  latest: Insight[];
}

export async function fetchInsightsLanding(): Promise<InsightsLandingData> {
  const meId = await currentProfileId();

  const [mineRes, subsRes, latestRes] = await Promise.all([
    meId
      ? supabase
          .from('insights')
          .select(`*, author:profiles!insights_owner_id_fkey (${AUTHOR_COLS})`)
          .eq('owner_id', meId)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [], error: null } as any),
    meId
      ? supabase.from('insight_subscriptions').select('insight_id').eq('subscriber_id', meId)
      : Promise.resolve({ data: [], error: null } as any),
    supabase
      .from('insights')
      .select(`*, author:profiles!insights_owner_id_fkey (${AUTHOR_COLS})`)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(24),
  ]);

  if (mineRes.error) throw mineRes.error;
  if (latestRes.error) throw latestRes.error;

  const followedIds: string[] = (subsRes.data ?? []).map((r: any) => r.insight_id);
  let following: Insight[] = [];
  if (followedIds.length > 0) {
    const { data, error } = await supabase
      .from('insights')
      .select(`*, author:profiles!insights_owner_id_fkey (${AUTHOR_COLS})`)
      .in('id', followedIds)
      .eq('status', 'published')
      .order('published_at', { ascending: false });
    if (error) throw error;
    following = (data ?? []).map((r) => mapInsight(r, meId));
  }

  const mine = (mineRes.data ?? []).map((r: any) => mapInsight(r, meId));
  const followedSet = new Set(followedIds);
  const latest = (latestRes.data ?? [])
    .map((r: any) => mapInsight(r, meId))
    .filter((i) => i.owner_id !== meId)
    .map((i) => ({ ...i, isSubscribed: followedSet.has(i.id) }));

  // subscriber counts for everything on screen
  const all = [...mine, ...following, ...latest];
  await attachSubscriberCounts(all);

  return { meId, mine, following, latest };
}

async function attachSubscriberCounts(insights: Insight[]): Promise<void> {
  await Promise.all(
    insights.map(async (i) => {
      const { data } = await supabase.rpc('insight_subscriber_count', { _insight_id: i.id });
      i.subscriberCount = typeof data === 'number' ? data : 0;
    }),
  );
}

// ------------------------------------------------------------------ detail

export async function fetchInsightBySlug(slug: string): Promise<{
  insight: Insight;
  articles: InsightArticle[];
} | null> {
  const meId = await currentProfileId();
  const { data, error } = await supabase
    .from('insights')
    .select(`*, author:profiles!insights_owner_id_fkey (${AUTHOR_COLS})`)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const insight = mapInsight(data, meId);

  const { data: countData } = await supabase.rpc('insight_subscriber_count', {
    _insight_id: insight.id,
  });
  insight.subscriberCount = typeof countData === 'number' ? countData : 0;

  if (meId) {
    const { data: sub } = await supabase
      .from('insight_subscriptions')
      .select('id')
      .eq('insight_id', insight.id)
      .eq('subscriber_id', meId)
      .maybeSingle();
    insight.isSubscribed = !!sub;
  }

  const { data: articleRows, error: aErr } = await supabase
    .from('insight_articles')
    .select(`*, author:profiles!insight_articles_author_id_fkey (${AUTHOR_COLS})`)
    .eq('insight_id', insight.id)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false });
  if (aErr) throw aErr;

  let articles = (articleRows ?? []).map(mapArticle);
  // Non-owners only ever see published articles (RLS already enforces this,
  // this is a belt-and-suspenders for the owner-preview case).
  if (!insight.isOwner) articles = articles.filter((a) => a.status === 'published');
  insight.articleCount = articles.filter((a) => a.status === 'published').length;

  return { insight, articles };
}

// ------------------------------------------------------------------ article

export async function fetchArticle(
  insightSlug: string,
  articleSlug: string,
): Promise<{
  article: InsightArticle;
  insight: Insight;
  meId: string | null;
  /** feed post that hosts reactions/comments for a PUBLISHED article (null for drafts) */
  postId: string | null;
} | null> {
  const meId = await currentProfileId();
  const { data: insightRow, error: iErr } = await supabase
    .from('insights')
    .select(`*, author:profiles!insights_owner_id_fkey (${AUTHOR_COLS})`)
    .eq('slug', insightSlug)
    .maybeSingle();
  if (iErr) throw iErr;
  if (!insightRow) return null;
  const insight = mapInsight(insightRow, meId);

  const { data: artRow, error: aErr } = await supabase
    .from('insight_articles')
    .select(`*, author:profiles!insight_articles_author_id_fkey (${AUTHOR_COLS})`)
    .eq('insight_id', insight.id)
    .eq('slug', articleSlug)
    .maybeSingle();
  if (aErr) throw aErr;
  if (!artRow) return null;

  if (meId) {
    const { data: sub } = await supabase
      .from('insight_subscriptions')
      .select('id')
      .eq('insight_id', insight.id)
      .eq('subscriber_id', meId)
      .maybeSingle();
    insight.isSubscribed = !!sub;
  }
  const { data: countData } = await supabase.rpc('insight_subscriber_count', {
    _insight_id: insight.id,
  });
  insight.subscriberCount = typeof countData === 'number' ? countData : 0;

  let postId: string | null = null;
  if (artRow.status === 'published') {
    const { data: linkedPost } = await supabase
      .from('posts')
      .select('id')
      .eq('insight_article_id', artRow.id)
      .maybeSingle();
    postId = linkedPost?.id ?? null;
  }

  return { article: mapArticle(artRow), insight, meId, postId };
}

// ------------------------------------------------------------------ mutations

export async function createInsight(input: {
  title: string;
  description: string | null;
  cover_url: string | null;
}): Promise<Insight> {
  const meId = await currentProfileId();
  if (!meId) throw new Error('You need a profile to create an Insight.');

  // Retry once on the (very unlikely) slug collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = makeSlug(input.title);
    const { data, error } = await supabase
      .from('insights')
      .insert({
        owner_id: meId,
        title: input.title.trim(),
        slug,
        description: input.description?.trim() || null,
        cover_url: input.cover_url,
        status: 'draft',
      })
      .select(`*, author:profiles!insights_owner_id_fkey (${AUTHOR_COLS})`)
      .single();
    if (!error) return mapInsight(data, meId);
    if (error.code !== '23505') throw error;
  }
  throw new Error('Could not generate a unique link. Please try again.');
}

export async function updateInsightMeta(
  id: string,
  patch: { title?: string; description?: string | null; cover_url?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('insights')
    .update({
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
      ...(patch.cover_url !== undefined ? { cover_url: patch.cover_url } : {}),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteInsight(id: string): Promise<void> {
  const { error } = await supabase.from('insights').delete().eq('id', id);
  if (error) throw error;
}

/** Create a new draft article inside an insight and return it. */
export async function createArticleDraft(insightId: string): Promise<InsightArticle> {
  const meId = await currentProfileId();
  if (!meId) throw new Error('Sign in required.');
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = makeSlug('untitled');
    const { data, error } = await supabase
      .from('insight_articles')
      .insert({
        insight_id: insightId,
        author_id: meId,
        title: 'Untitled',
        slug,
        body: { type: 'doc', content: [{ type: 'paragraph' }] },
        status: 'draft',
      })
      .select(`*, author:profiles!insight_articles_author_id_fkey (${AUTHOR_COLS})`)
      .single();
    if (!error) return mapArticle(data);
    if (error.code !== '23505') throw error;
  }
  throw new Error('Could not create the draft. Please try again.');
}

export async function saveArticleDraft(
  id: string,
  patch: { title: string; subtitle: string | null; cover_url: string | null; body: JSONContent },
): Promise<void> {
  const { error } = await supabase
    .from('insight_articles')
    .update({
      title: patch.title.trim() || 'Untitled',
      subtitle: patch.subtitle?.trim() || null,
      cover_url: patch.cover_url,
      body: patch.body as any,
      body_html: renderInsightHtml(patch.body),
      reading_minutes: readingMinutes(patch.body),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function publishArticle(
  id: string,
  patch: { title: string; subtitle: string | null; cover_url: string | null; body: JSONContent },
): Promise<InsightArticle> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('insight_articles')
    .update({
      title: patch.title.trim(),
      subtitle: patch.subtitle?.trim() || null,
      cover_url: patch.cover_url,
      body: patch.body as any,
      body_html: renderInsightHtml(patch.body),
      reading_minutes: readingMinutes(patch.body),
      status: 'published',
      published_at: nowIso,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;

  // The DB trigger `sync_insight_article_publish` atomically (a) flips the
  // parent Insight to published, (b) creates/refreshes the feed post, and
  // (c) notifies subscribers — so there is nothing else to do client-side.
  return mapArticle(data);
}

export async function unpublishArticle(id: string): Promise<void> {
  const { error } = await supabase
    .from('insight_articles')
    .update({ status: 'draft' })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await supabase.from('insight_articles').delete().eq('id', id);
  if (error) throw error;
}

// ------------------------------------------------------------------ follow

export async function subscribeToInsight(insightId: string): Promise<void> {
  const meId = await currentProfileId();
  if (!meId) throw new Error('Sign in to follow this Insight.');
  const { error } = await supabase
    .from('insight_subscriptions')
    .insert({ insight_id: insightId, subscriber_id: meId });
  if (error && error.code !== '23505') throw error;
}

export async function unsubscribeFromInsight(insightId: string): Promise<void> {
  const meId = await currentProfileId();
  if (!meId) return;
  const { error } = await supabase
    .from('insight_subscriptions')
    .delete()
    .eq('insight_id', insightId)
    .eq('subscriber_id', meId);
  if (error) throw error;
}
