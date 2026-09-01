import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { ChevronLeft, Download, Plug, UserX, FileText, MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type BulkKind = 'posts' | 'comments';

export default function ManageDataPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ posts: number | null; comments: number | null }>({
    posts: null,
    comments: null,
  });
  const [confirm, setConfirm] = useState<BulkKind | null>(null);
  const [busy, setBusy] = useState<BulkKind | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      setProfileId(profile?.id ?? null);
      const [{ count: posts }, { count: comments }] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        profile
          ? supabase
              .from('comments')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', profile.id)
          : Promise.resolve({ count: 0 }),
      ]);
      setCounts({ posts: posts ?? 0, comments: comments ?? 0 });
    })();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const runBulkDelete = async (kind: BulkKind) => {
    setConfirm(null);
    setBusy(kind);
    try {
      // Own rows only — the same delete RLS every single-item delete already
      // relies on (posts.user_id = auth uid, comments.user_id = profiles.id).
      const { error } =
        kind === 'posts'
          ? await supabase.from('posts').delete().eq('user_id', user!.id)
          : await supabase.from('comments').delete().eq('user_id', profileId!);
      if (error) throw error;
      setCounts((c) => ({ ...c, [kind]: 0 }));
      toast({ title: kind === 'posts' ? 'All your posts were deleted' : 'All your comments were deleted' });
    } catch (err) {
      toast({
        title: 'Couldn’t delete',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="w-full max-w-[720px] mx-auto px-2 sm:px-4">
        <div className="flex items-center gap-2 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate('/settings/privacy')}
            aria-label="Back to Data privacy"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Manage your data</h1>
        </div>

        <div className="space-y-4">
          <Card className="bg-card shadow-card border-0 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-[15px] font-bold">Your data</CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              <SettingsRow
                icon={Download}
                title="Download your data"
                status="active"
                onClick={() => navigate('/settings/privacy/download-data')}
              />
              <SettingsRow
                icon={Plug}
                title="Connected services"
                status="active"
                onClick={() => navigate('/settings/privacy/connected-services')}
              />
              <SettingsRow
                icon={UserX}
                title="Blocked accounts"
                status="active"
                onClick={() => navigate('/settings/visibility')}
              />
            </CardContent>
          </Card>

          <Card className="bg-card shadow-card border-0 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-[15px] font-bold text-destructive">
                Delete content
              </CardTitle>
              <CardDescription className="text-xs">
                Permanent. This removes the content everywhere it appears and can’t be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              <BulkRow
                icon={FileText}
                title="Delete all my posts"
                count={counts.posts}
                busy={busy === 'posts'}
                onClick={() => setConfirm('posts')}
              />
              <BulkRow
                icon={MessageSquare}
                title="Delete all my comments"
                count={counts.comments}
                busy={busy === 'comments'}
                onClick={() => setConfirm('comments')}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete all your {confirm === 'posts' ? 'posts' : 'comments'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{' '}
              {confirm === 'posts' ? counts.posts ?? 0 : counts.comments ?? 0}{' '}
              {confirm === 'posts' ? 'post(s)' : 'comment(s)'}. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (confirm) void runBulkDelete(confirm);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

function BulkRow({
  icon: Icon,
  title,
  count,
  busy,
  onClick,
}: {
  icon: typeof FileText;
  title: string;
  count: number | null;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">
            {count === null ? 'Counting…' : `${count} item${count === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        disabled={busy || count === null || count === 0}
        onClick={onClick}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}
