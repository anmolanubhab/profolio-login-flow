import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Newspaper, PenSquare, Users, Loader2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useLayoutUser } from '@/lib/insights/useLayoutUser';
import {
  fetchInsightBySlug,
  deleteInsight,
  deleteArticle,
  createArticleDraft,
} from '@/lib/insights/api';
import type { Insight, InsightArticle } from '@/lib/insights/types';
import InsightFollowButton from '@/components/insights/InsightFollowButton';
import InsightMoreMenu from '@/components/insights/InsightMoreMenu';
import CreateInsightDialog from '@/components/insights/CreateInsightDialog';

function fmt(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function InsightDetailPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, onSignOut } = useLayoutUser();

  const [insight, setInsight] = useState<Insight | null>(null);
  const [articles, setArticles] = useState<InsightArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetchInsightBySlug(slug);
      if (!res) {
        setNotFound(true);
        return;
      }
      setInsight(res.insight);
      setArticles(res.articles);
    } catch (err) {
      console.error('Insight detail load failed', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const startWriting = async () => {
    if (!insight || creatingDraft) return;
    setCreatingDraft(true);
    try {
      const draft = await createArticleDraft(insight.id);
      navigate(`/insights/${insight.slug}/${draft.slug}/edit`);
    } catch (err: any) {
      toast({ title: 'Could not start a draft', description: err?.message, variant: 'destructive' });
    } finally {
      setCreatingDraft(false);
    }
  };

  const removeInsight = async () => {
    if (!insight) return;
    await deleteInsight(insight.id);
    toast({ title: 'Insight deleted' });
    navigate('/insights');
  };

  const removeArticle = async (id: string) => {
    await deleteArticle(id);
    setArticles((a) => a.filter((x) => x.id !== id));
    toast({ title: 'Article deleted' });
  };

  if (loading) {
    return (
      <Layout user={user} onSignOut={onSignOut} fullWidth>
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          <Skeleton className="aspect-[16/6] w-full rounded-xl" />
          <Skeleton className="mt-4 h-7 w-2/3" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-6 h-24 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (notFound || !insight) {
    return (
      <Layout user={user} onSignOut={onSignOut} fullWidth>
        <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
          <Newspaper className="mx-auto h-12 w-12 opacity-30" />
          <p className="mt-3 font-medium">This Insight isn’t available</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It may be a private draft, or it may have been deleted.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/insights')}>
            Back to Insights
          </Button>
        </div>
      </Layout>
    );
  }

  const isOwner = !!insight.isOwner;
  const published = articles.filter((a) => a.status === 'published');
  const drafts = articles.filter((a) => a.status === 'draft');

  return (
    <Layout user={user} onSignOut={onSignOut} fullWidth>
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* cover */}
        <div className="overflow-hidden rounded-xl border border-border bg-muted">
          {insight.cover_url ? (
            <img src={insight.cover_url} alt="" className="aspect-[16/6] w-full object-cover" />
          ) : (
            <div className="grid aspect-[16/6] w-full place-items-center bg-gradient-to-br from-primary/10 to-secondary text-primary/40">
              <Newspaper className="h-12 w-12" />
            </div>
          )}
        </div>

        {/* identity + actions */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight tracking-tight">{insight.title}</h1>
            {insight.description && (
              <p className="mt-1.5 text-[15px] leading-normal text-muted-foreground">
                {insight.description}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2.5">
              <Avatar className="h-9 w-9">
                <AvatarImage src={insight.author?.avatar_url ?? undefined} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {(insight.author?.display_name ?? 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 text-sm">
                <div className="font-medium">{insight.author?.display_name ?? 'Unknown author'}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {(insight.subscriberCount ?? 0).toLocaleString()}{' '}
                    {insight.subscriberCount === 1 ? 'follower' : 'followers'}
                  </span>
                  {insight.status === 'draft' && isOwner && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">Draft</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {isOwner ? (
              <Button onClick={startWriting} disabled={creatingDraft} className="gap-1.5">
                {creatingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenSquare className="h-4 w-4" />}
                Write article
              </Button>
            ) : (
              <InsightFollowButton
                insightId={insight.id}
                initialFollowing={!!insight.isSubscribed}
                onChange={(f, d) =>
                  setInsight((s) =>
                    s ? { ...s, isSubscribed: f, subscriberCount: Math.max(0, (s.subscriberCount ?? 0) + d) } : s,
                  )
                }
              />
            )}
            <InsightMoreMenu
              shareUrl={`/insights/${insight.slug}`}
              shareTitle={insight.title}
              isOwner={isOwner}
              onEdit={() => setEditOpen(true)}
              onDelete={removeInsight}
              deleteLabel="Delete Insight"
              deleteConfirmTitle="Delete this Insight?"
              deleteConfirmBody="Every article in it will be permanently removed. This cannot be undone."
            />
          </div>
        </div>

        {/* owner drafts */}
        {isOwner && drafts.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Drafts
            </h2>
            <div className="divide-y divide-border rounded-xl border border-border">
              {drafts.map((a) => (
                <ArticleRow
                  key={a.id}
                  article={a}
                  insightSlug={insight.slug}
                  isOwner
                  onDelete={() => removeArticle(a.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* published articles */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">
            {published.length > 0 ? `${published.length} article${published.length === 1 ? '' : 's'}` : 'Articles'}
          </h2>
          {published.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              {isOwner ? 'No published articles yet. Write your first one.' : 'No articles published yet.'}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border">
              {published.map((a) => (
                <ArticleRow
                  key={a.id}
                  article={a}
                  insightSlug={insight.slug}
                  isOwner={isOwner}
                  onDelete={() => removeArticle(a.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <CreateInsightDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        insight={insight}
        onUpdated={(patch) => setInsight((s) => (s ? { ...s, ...patch } : s))}
      />
    </Layout>
  );
}

function ArticleRow({
  article,
  insightSlug,
  isOwner,
  onDelete,
}: {
  article: InsightArticle;
  insightSlug: string;
  isOwner: boolean;
  onDelete: () => Promise<void>;
}) {
  const readHref = `/insights/${insightSlug}/${article.slug}`;
  const editHref = `/insights/${insightSlug}/${article.slug}/edit`;
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-secondary/30">
      <Link to={article.status === 'published' ? readHref : editHref} className="min-w-0 flex-1">
        <div className="line-clamp-1 text-sm font-semibold">{article.title || 'Untitled'}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {article.status === 'published' ? (
            <span>{fmt(article.published_at)}</span>
          ) : (
            <span className="rounded bg-secondary px-1.5 py-0.5 font-medium">Draft</span>
          )}
          {article.reading_minutes ? <span>· {article.reading_minutes} min read</span> : null}
        </div>
      </Link>
      {isOwner && (
        <InsightMoreMenu
          shareUrl={readHref}
          shareTitle={article.title}
          isOwner
          onEdit={() => navigate(editHref)}
          onDelete={onDelete}
          deleteLabel="Delete article"
          deleteConfirmTitle="Delete this article?"
          deleteConfirmBody="It will be permanently removed. This cannot be undone."
        />
      )}
    </div>
  );
}
