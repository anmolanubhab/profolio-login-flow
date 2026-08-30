import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { JSONContent } from '@tiptap/react';
import {
  ArrowLeft,
  Check,
  Eye,
  ImagePlus,
  Loader2,
  Send,
  X,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';
import { useLayoutUser } from '@/lib/insights/useLayoutUser';
import {
  fetchArticle,
  fetchInsightBySlug,
  createArticleDraft,
  saveArticleDraft,
  publishArticle,
  uploadInsightImage,
} from '@/lib/insights/api';
import { isDocEmpty } from '@/lib/insights/editor';
import type { Insight, InsightArticle } from '@/lib/insights/types';
import InsightEditor from '@/components/insights/InsightEditor';
import InsightArticleRenderer from '@/components/insights/InsightArticleRenderer';

const TITLE_MAX = 160;
const SUBTITLE_MAX = 200;

export default function InsightEditorPage() {
  const { slug = '', articleSlug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, onSignOut } = useLayoutUser();

  const [insight, setInsight] = useState<Insight | null>(null);
  const [article, setArticle] = useState<InsightArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [doc, setDoc] = useState<JSONContent>({ type: 'doc', content: [{ type: 'paragraph' }] });

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title, subtitle, coverUrl, doc });
  latest.current = { title, subtitle, coverUrl, doc };

  // ---- load / bootstrap a draft --------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setDenied(false);
      try {
        const meRes = await fetchInsightBySlug(slug);
        if (!meRes) {
          if (!cancelled) setDenied(true);
          return;
        }
        if (!meRes.insight.isOwner) {
          if (!cancelled) setDenied(true);
          return;
        }
        if (cancelled) return;
        setInsight(meRes.insight);

        if (!articleSlug) {
          // "/insights/:slug/write" — spin up a fresh draft, then swap the URL
          const draft = await createArticleDraft(meRes.insight.id);
          if (cancelled) return;
          navigate(`/insights/${slug}/${draft.slug}/edit`, { replace: true });
          return;
        }

        const res = await fetchArticle(slug, articleSlug);
        if (!res || res.insight.id !== meRes.insight.id) {
          if (!cancelled) setDenied(true);
          return;
        }
        if (cancelled) return;
        setArticle(res.article);
        setTitle(res.article.title === 'Untitled' ? '' : res.article.title);
        setSubtitle(res.article.subtitle ?? '');
        setCoverUrl(res.article.cover_url);
        setDoc(res.article.body ?? { type: 'doc', content: [{ type: 'paragraph' }] });
        setDirty(false);
      } catch (err) {
        console.error('Editor load failed', err);
        if (!cancelled) setDenied(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, articleSlug, navigate]);

  // ---- warn on browser unload while dirty ---------------------------------
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty && !saving) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, saving]);

  const doSave = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!article) return false;
      setSaving(true);
      try {
        await saveArticleDraft(article.id, {
          title: latest.current.title,
          subtitle: latest.current.subtitle,
          cover_url: latest.current.coverUrl,
          body: latest.current.doc,
        });
        setDirty(false);
        setSavedAt(Date.now());
        return true;
      } catch (err: any) {
        if (!opts?.silent) {
          toast({
            title: 'Save failed',
            description: err?.message ?? 'Your changes are still here — try again.',
            variant: 'destructive',
          });
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [article, toast],
  );

  // ---- debounced autosave ----------------------------------------------------
  const markDirty = useCallback(() => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void doSave({ silent: true }), 1600);
  }, [doSave]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const onCoverPick = () => coverInputRef.current?.click();
  const onCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadInsightImage(file, 'cover');
      setCoverUrl(url);
      markDirty();
    } catch (err: any) {
      toast({ title: 'Cover upload failed', description: err?.message, variant: 'destructive' });
    } finally {
      setUploadingCover(false);
    }
  };

  const trimmedTitle = title.trim();
  const canPublish =
    !!article &&
    trimmedTitle.length > 0 &&
    trimmedTitle.length <= TITLE_MAX &&
    subtitle.length <= SUBTITLE_MAX &&
    !isDocEmpty(doc) &&
    !publishing &&
    !saving;

  const runPublish = async () => {
    if (!article || !insight) return;
    setPublishing(true);
    try {
      // persist latest edits first so publish never loses a keystroke
      const ok = await doSave({ silent: true });
      if (!ok) {
        setPublishing(false);
        return;
      }
      const published = await publishArticle(article.id, {
        title: latest.current.title,
        subtitle: latest.current.subtitle,
        cover_url: latest.current.coverUrl,
        body: latest.current.doc,
      });
      setDirty(false);
      setPublishConfirm(false);
      toast({ title: 'Insight published' });
      navigate(`/insights/${insight.slug}/${published.slug}`);
    } catch (err: any) {
      toast({
        title: 'Publish failed',
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
      setPublishing(false);
    }
  };

  const guardedBack = () => {
    if (dirty && !saving) setLeaveTo(insight ? `/insights/${insight.slug}` : '/insights');
    else navigate(insight ? `/insights/${insight.slug}` : '/insights');
  };

  const savedLabel = useMemo(() => {
    if (saving) return 'Saving…';
    if (dirty) return 'Unsaved changes';
    if (savedAt) return 'Saved';
    return article?.status === 'published' ? 'Published' : 'Draft';
  }, [saving, dirty, savedAt, article?.status]);

  if (loading) {
    return (
      <Layout user={user} onSignOut={onSignOut} fullWidth>
        <div className="mx-auto w-full max-w-[720px] px-4 py-6">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="mt-6 h-10 w-3/4" />
          <Skeleton className="mt-3 h-6 w-1/2" />
          <Skeleton className="mt-6 h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (denied) {
    return (
      <Layout user={user} onSignOut={onSignOut} fullWidth>
        <div className="mx-auto w-full max-w-[720px] px-4 py-16 text-center">
          <p className="font-medium">You can’t edit this</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Only the owner of an Insight can write or edit its articles.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/insights')}>
            Back to Insights
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onSignOut={onSignOut} fullWidth>
      {/* editor top bar */}
      <div className="sticky top-[var(--nav-height)] z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[720px] items-center gap-2 px-4 py-2">
          <button
            onClick={guardedBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{insight?.title}</span>
          </button>
          <span className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : !dirty && (savedAt || article?.status === 'published') ? (
              <Check className="h-3 w-3 text-primary" />
            ) : null}
            {savedLabel}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void doSave()}
              disabled={saving || !dirty}
            >
              Save
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setPublishConfirm(true)}
              disabled={!canPublish}
            >
              <Send className="h-4 w-4" />
              Publish
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[720px] px-4 pb-24 pt-5 sm:px-6">
        {/* cover */}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={onCoverChange}
        />
        {coverUrl ? (
          <div className="relative mb-5 overflow-hidden rounded-xl border border-border">
            <img src={coverUrl} alt="" className="aspect-[16/9] w-full object-cover" />
            <div className="absolute right-2 top-2 flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={onCoverPick} disabled={uploadingCover}>
                {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Replace'}
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8"
                aria-label="Remove cover"
                onClick={() => {
                  setCoverUrl(null);
                  markDirty();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onCoverPick}
            disabled={uploadingCover}
            className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/40 py-4 text-sm text-muted-foreground hover:bg-secondary"
          >
            {uploadingCover ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            Add a cover image
          </button>
        )}

        {/* title / subtitle */}
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value.slice(0, TITLE_MAX + 20));
            markDirty();
          }}
          placeholder="Article title"
          className="w-full border-0 bg-transparent p-0 text-[26px] font-bold leading-tight tracking-tight outline-none placeholder:text-muted-foreground/50 sm:text-[32px]"
        />
        <input
          value={subtitle}
          onChange={(e) => {
            setSubtitle(e.target.value.slice(0, SUBTITLE_MAX + 20));
            markDirty();
          }}
          placeholder="Add a subtitle (optional)"
          className="mt-2 w-full border-0 bg-transparent p-0 text-lg leading-snug text-muted-foreground outline-none placeholder:text-muted-foreground/50"
        />
        <div className="mt-1 text-[11px] text-muted-foreground">
          {trimmedTitle.length > TITLE_MAX && (
            <span className="text-destructive">Title too long by {trimmedTitle.length - TITLE_MAX}. </span>
          )}
          {subtitle.length > SUBTITLE_MAX && (
            <span className="text-destructive">Subtitle too long by {subtitle.length - SUBTITLE_MAX}.</span>
          )}
        </div>

        <div className="my-4 h-px bg-border" />

        {/* body */}
        <InsightEditor
          initialContent={doc}
          onChange={(next) => {
            setDoc(next);
            markDirty();
          }}
        />
      </div>

      {/* preview — same renderer as the published page */}
      <ResponsiveModal open={previewOpen} onOpenChange={setPreviewOpen}>
        <ResponsiveModalContent className="sm:max-w-[720px]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Preview</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="pb-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">
              {insight?.title}
            </div>
            <h1 className="mt-1.5 text-[24px] font-bold leading-tight tracking-tight sm:text-[28px]">
              {trimmedTitle || 'Untitled'}
            </h1>
            {subtitle.trim() && (
              <p className="mt-1.5 text-base text-muted-foreground">{subtitle.trim()}</p>
            )}
            {coverUrl && (
              <img
                src={coverUrl}
                alt=""
                className="my-4 aspect-[16/9] w-full rounded-lg border border-border object-cover"
              />
            )}
            <div className="mt-4">
              <InsightArticleRenderer doc={doc} />
            </div>
          </div>
          <ResponsiveModalFooter className="gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
              Back to editing
            </Button>
            <Button
              onClick={() => {
                setPreviewOpen(false);
                setPublishConfirm(true);
              }}
              disabled={!canPublish}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" /> Publish
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* publish confirm */}
      <AlertDialog open={publishConfirm} onOpenChange={(o) => !publishing && setPublishConfirm(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this article?</AlertDialogTitle>
            <AlertDialogDescription>
              It becomes public at its link and everyone following “{insight?.title}” is notified.
              You can edit or unpublish it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishing}>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void runPublish();
              }}
              disabled={publishing || !canPublish}
            >
              {publishing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* unsaved-changes guard */}
      <AlertDialog open={!!leaveTo} onOpenChange={(o) => !o && setLeaveTo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Save them first, or discard and leave.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={async () => {
                const target = leaveTo!;
                setLeaveTo(null);
                await doSave({ silent: true });
                navigate(target);
              }}
            >
              Save &amp; leave
            </Button>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                const target = leaveTo!;
                setDirty(false);
                setLeaveTo(null);
                navigate(target);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
