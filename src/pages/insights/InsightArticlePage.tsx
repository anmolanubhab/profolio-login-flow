import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Newspaper, Pencil } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLayoutUser } from '@/lib/insights/useLayoutUser';
import { fetchArticle } from '@/lib/insights/api';
import type { Insight, InsightArticle } from '@/lib/insights/types';
import InsightArticleRenderer from '@/components/insights/InsightArticleRenderer';
import InsightFollowButton from '@/components/insights/InsightFollowButton';
import InsightMoreMenu from '@/components/insights/InsightMoreMenu';
import InsightEngagement from '@/components/insights/InsightEngagement';

function fmt(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function InsightArticlePage() {
  const { slug = '', articleSlug = '' } = useParams();
  const navigate = useNavigate();
  const { user, onSignOut } = useLayoutUser();

  const [article, setArticle] = useState<InsightArticle | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetchArticle(slug, articleSlug);
      if (!res) {
        setNotFound(true);
        return;
      }
      setArticle(res.article);
      setInsight(res.insight);
      setPostId(res.postId);
    } catch (err) {
      console.error('Article load failed', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug, articleSlug]);

  useEffect(() => {
    load();
    window.scrollTo(0, 0);
  }, [load]);

  if (loading) {
    return (
      <Layout user={user} onSignOut={onSignOut} fullWidth>
        <div className="mx-auto w-full max-w-[680px] px-4 py-8">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-9 w-full" />
          <Skeleton className="mt-2 h-5 w-3/4" />
          <Skeleton className="mt-6 aspect-[16/9] w-full rounded-xl" />
          <div className="mt-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (notFound || !article || !insight) {
    return (
      <Layout user={user} onSignOut={onSignOut} fullWidth>
        <div className="mx-auto w-full max-w-[680px] px-4 py-16 text-center">
          <Newspaper className="mx-auto h-12 w-12 opacity-30" />
          <p className="mt-3 font-medium">This article isn’t available</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It may be an unpublished draft, or it may have been removed.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/insights')}>
            Back to Insights
          </Button>
        </div>
      </Layout>
    );
  }

  const isOwner = !!insight.isOwner;

  return (
    <Layout user={user} onSignOut={onSignOut} fullWidth>
      <article className="mx-auto w-full max-w-[680px] px-4 pb-20 pt-4 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {article.status === 'draft' && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 text-sm">
            <span className="font-medium text-muted-foreground">Draft preview — not published</span>
            {isOwner && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => navigate(`/insights/${insight.slug}/${article.slug}/edit`)}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>
        )}

        {/* insight identity */}
        <Link
          to={`/insights/${insight.slug}`}
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
        >
          <Newspaper className="h-3.5 w-3.5" />
          {insight.title}
        </Link>

        <h1 className="mt-2 text-[26px] font-bold leading-[1.2] tracking-tight sm:text-[32px]">
          {article.title}
        </h1>
        {article.subtitle && (
          <p className="mt-2 text-lg leading-snug text-muted-foreground">{article.subtitle}</p>
        )}

        {/* byline */}
        <div className="mt-5 flex items-center justify-between gap-3 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={article.author?.avatar_url ?? undefined} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {(article.author?.display_name ?? 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <div className="font-semibold">{article.author?.display_name ?? 'Unknown author'}</div>
              <div className="text-xs text-muted-foreground">
                {article.status === 'published' && article.published_at ? fmt(article.published_at) : 'Draft'}
                {article.reading_minutes ? ` · ${article.reading_minutes} min read` : ''}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {!isOwner && (
              <InsightFollowButton
                insightId={insight.id}
                initialFollowing={!!insight.isSubscribed}
                size="sm"
                variant="compact"
              />
            )}
            <InsightMoreMenu
              shareUrl={`/insights/${insight.slug}/${article.slug}`}
              shareTitle={article.title}
              isOwner={isOwner}
              onEdit={() => navigate(`/insights/${insight.slug}/${article.slug}/edit`)}
            />
          </div>
        </div>

        {/* cover */}
        {article.cover_url && (
          <img
            src={article.cover_url}
            alt=""
            className="my-6 aspect-[16/9] w-full rounded-xl border border-border object-cover"
          />
        )}

        {/* body */}
        <div className="mt-6">
          <InsightArticleRenderer html={article.body_html} doc={article.body} />
        </div>

        {/* reactions + comments — reuses the feed post that publishing created */}
        {postId && <InsightEngagement postId={postId} />}

        {/* footer follow CTA */}
        {!isOwner && (
          <div className="mt-12 rounded-xl border border-border bg-secondary/40 p-5 text-center">
            <p className="text-sm font-medium">Enjoyed this? Get the next one in your feed.</p>
            <div className="mt-3 flex justify-center">
              <InsightFollowButton insightId={insight.id} initialFollowing={!!insight.isSubscribed} />
            </div>
          </div>
        )}
      </article>
    </Layout>
  );
}
