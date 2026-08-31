import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrentProfileId } from '@/hooks/network/useCurrentProfileId';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, SlidersHorizontal, Clock, EyeOff, UserX, ThumbsDown } from 'lucide-react';

// "Hide all from" writes a far-future snoozed_until; a normal 30-day snooze is
// well under a year. Same split PostOptionsMenu uses to label the two.
const HIDE_ALL_THRESHOLD_MS = 365 * 24 * 60 * 60 * 1000;

interface PersonRow {
  key: string; // the row id in its source table
  profileId: string;
  name: string;
  avatar: string | null;
  meta: string;
}
interface PostRow {
  key: string;
  postId: string;
  content: string;
  author: string;
}

const FeedPreferences = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profileId } = useCurrentProfileId();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) { navigate('/'); return; }
      setUser(authUser);
    });
  }, [navigate]);

  const enabled = !!profileId;
  const key = (name: string) => ['feed-prefs', name, profileId ?? 'anon'];

  // --- snoozed / hide-all people ---
  const snoozedPeople = useQuery({
    queryKey: key('snoozed-users'),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('snoozed_users')
        .select('id, snoozed_user_id, snoozed_until')
        .eq('user_id', profileId!)
        .gt('snoozed_until', new Date().toISOString());
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((r) => r.snoozed_user_id);
      const profiles = ids.length
        ? (await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids)).data ?? []
        : [];
      const pmap = new Map(profiles.map((p) => [p.id, p]));
      const snoozed: PersonRow[] = [];
      const hiddenAll: PersonRow[] = [];
      for (const r of rows) {
        const p = pmap.get(r.snoozed_user_id);
        const far = new Date(r.snoozed_until).getTime() - Date.now() >= HIDE_ALL_THRESHOLD_MS;
        const row: PersonRow = {
          key: r.id,
          profileId: r.snoozed_user_id,
          name: p?.display_name || 'Unknown user',
          avatar: p?.avatar_url ?? null,
          meta: far ? 'Hidden from your feed' : `Snoozed until ${new Date(r.snoozed_until).toLocaleDateString()}`,
        };
        (far ? hiddenAll : snoozed).push(row);
      }
      return { snoozed, hiddenAll };
    },
  });

  // --- blocked people ---
  const blockedPeople = useQuery({
    queryKey: key('blocked-users'),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('id, blocked_user_id')
        .eq('user_id', profileId!);
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((r) => r.blocked_user_id);
      const profiles = ids.length
        ? (await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids)).data ?? []
        : [];
      const pmap = new Map(profiles.map((p) => [p.id, p]));
      return rows.map<PersonRow>((r) => ({
        key: r.id,
        profileId: r.blocked_user_id,
        name: pmap.get(r.blocked_user_id)?.display_name || 'Unknown user',
        avatar: pmap.get(r.blocked_user_id)?.avatar_url ?? null,
        meta: 'Blocked',
      }));
    },
  });

  // --- snoozed companies ---
  const snoozedCompanies = useQuery({
    queryKey: key('snoozed-companies'),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('snoozed_companies')
        .select('id, snoozed_company_id, snoozed_until')
        .eq('user_id', profileId!)
        .gt('snoozed_until', new Date().toISOString());
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((r) => r.snoozed_company_id);
      const companies = ids.length
        ? (await supabase.from('companies').select('id, name, logo_url').in('id', ids)).data ?? []
        : [];
      const cmap = new Map(companies.map((c) => [c.id, c]));
      const snoozed: PersonRow[] = [];
      const hiddenAll: PersonRow[] = [];
      for (const r of rows) {
        const c = cmap.get(r.snoozed_company_id);
        const far = new Date(r.snoozed_until).getTime() - Date.now() >= HIDE_ALL_THRESHOLD_MS;
        const row: PersonRow = {
          key: r.id,
          profileId: r.snoozed_company_id,
          name: c?.name || 'Unknown company',
          avatar: c?.logo_url ?? null,
          meta: far ? 'Hidden from your feed' : `Snoozed until ${new Date(r.snoozed_until).toLocaleDateString()}`,
        };
        (far ? hiddenAll : snoozed).push(row);
      }
      return { snoozed, hiddenAll };
    },
  });

  // --- blocked companies ---
  const blockedCompanies = useQuery({
    queryKey: key('blocked-companies'),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocked_companies')
        .select('id, blocked_company_id')
        .eq('user_id', profileId!);
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((r) => r.blocked_company_id);
      const companies = ids.length
        ? (await supabase.from('companies').select('id, name, logo_url').in('id', ids)).data ?? []
        : [];
      const cmap = new Map(companies.map((c) => [c.id, c]));
      return rows.map<PersonRow>((r) => ({
        key: r.id,
        profileId: r.blocked_company_id,
        name: cmap.get(r.blocked_company_id)?.name || 'Unknown company',
        avatar: cmap.get(r.blocked_company_id)?.logo_url ?? null,
        meta: 'Blocked',
      }));
    },
  });

  // --- hidden individual posts + not-interested posts ---
  const posts = useQuery({
    queryKey: key('posts'),
    enabled,
    queryFn: async () => {
      const [hiddenRes, prefsRes] = await Promise.all([
        supabase.from('hidden_posts').select('id, post_id').eq('user_id', profileId!),
        supabase.from('user_feed_preferences').select('not_interested_posts').eq('user_id', profileId!).maybeSingle(),
      ]);
      const hiddenRows = hiddenRes.data ?? [];
      const notInterestedIds: string[] = prefsRes.data?.not_interested_posts ?? [];
      const allIds = [...new Set([...hiddenRows.map((r) => r.post_id), ...notInterestedIds])];
      if (allIds.length === 0) return { hidden: [] as PostRow[], notInterested: [] as PostRow[] };

      const { data: postRows } = await supabase
        .from('posts')
        .select('id, content, user_id')
        .in('id', allIds);
      const authorIds = [...new Set((postRows ?? []).map((p) => p.user_id))];
      const { data: authors } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', authorIds.length ? authorIds : ['00000000-0000-0000-0000-000000000000']);
      const amap = new Map((authors ?? []).map((a) => [a.user_id, a.display_name]));
      const pmap = new Map((postRows ?? []).map((p) => [p.id, p]));

      const toRow = (id: string, rowKey: string): PostRow => {
        const p = pmap.get(id);
        return {
          key: rowKey,
          postId: id,
          content: (p?.content || '(no text)').slice(0, 120),
          author: p ? amap.get(p.user_id) || 'Unknown' : 'Unavailable',
        };
      };
      return {
        hidden: hiddenRows.map((r) => toRow(r.post_id, r.id)),
        notInterested: notInterestedIds.map((id) => toRow(id, `ni-${id}`)),
      };
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['feed-prefs'] });
  };

  const undoSnooze = async (rowId: string, name: string) => {
    const { error } = await supabase.from('snoozed_users').delete().eq('id', rowId).eq('user_id', profileId!);
    if (error) { toast({ title: 'Could not update', variant: 'destructive' }); return; }
    toast({ title: `${name} restored to your feed` });
    invalidateAll();
  };
  const undoBlock = async (rowId: string, name: string) => {
    const { error } = await supabase.from('blocked_users').delete().eq('id', rowId).eq('user_id', profileId!);
    if (error) { toast({ title: 'Could not unblock', variant: 'destructive' }); return; }
    toast({ title: `Unblocked ${name}` });
    invalidateAll();
  };
  const undoSnoozeCompany = async (rowId: string, name: string) => {
    const { error } = await supabase.from('snoozed_companies').delete().eq('id', rowId).eq('user_id', profileId!);
    if (error) { toast({ title: 'Could not update', variant: 'destructive' }); return; }
    toast({ title: `${name} restored to your feed` });
    invalidateAll();
  };
  const undoBlockCompany = async (rowId: string, name: string) => {
    const { error } = await supabase.from('blocked_companies').delete().eq('id', rowId).eq('user_id', profileId!);
    if (error) { toast({ title: 'Could not unblock', variant: 'destructive' }); return; }
    toast({ title: `Unblocked ${name}` });
    invalidateAll();
  };
  const undoHiddenPost = async (rowId: string) => {
    const { error } = await supabase.from('hidden_posts').delete().eq('id', rowId).eq('user_id', profileId!);
    if (error) { toast({ title: 'Could not update', variant: 'destructive' }); return; }
    toast({ title: 'Post restored to your feed' });
    invalidateAll();
  };
  const undoNotInterested = async (postId: string) => {
    const { data } = await supabase
      .from('user_feed_preferences')
      .select('not_interested_posts')
      .eq('user_id', profileId!)
      .maybeSingle();
    const next = (data?.not_interested_posts ?? []).filter((id: string) => id !== postId);
    const { error } = await supabase
      .from('user_feed_preferences')
      .update({ not_interested_posts: next })
      .eq('user_id', profileId!);
    if (error) { toast({ title: 'Could not update', variant: 'destructive' }); return; }
    toast({ title: 'Preference removed' });
    invalidateAll();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const anyLoading =
    snoozedPeople.isLoading ||
    blockedPeople.isLoading ||
    snoozedCompanies.isLoading ||
    blockedCompanies.isLoading ||
    posts.isLoading;

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Feed preferences</h1>
        </div>
        <p className="px-4 pb-4 text-sm text-muted-foreground">
          Everything you've snoozed, hidden, or blocked from your three-dot post menu. Undo any of it here.
        </p>

        <div className="space-y-6 px-4 pb-16">
          <Section
            icon={Clock}
            title="Snoozed people"
            empty="No one is snoozed."
            loading={snoozedPeople.isLoading}
            rows={snoozedPeople.data?.snoozed ?? []}
            renderRow={(r) => (
              <PersonRowView key={r.key} row={r} actionLabel="Unsnooze" onAction={() => undoSnooze(r.key, r.name)} />
            )}
          />
          <Section
            icon={EyeOff}
            title="People hidden from your feed"
            empty="No one is hidden."
            loading={snoozedPeople.isLoading}
            rows={snoozedPeople.data?.hiddenAll ?? []}
            renderRow={(r) => (
              <PersonRowView key={r.key} row={r} actionLabel="Show again" onAction={() => undoSnooze(r.key, r.name)} />
            )}
          />
          <Section
            icon={UserX}
            title="Blocked accounts"
            empty="You haven't blocked anyone."
            loading={blockedPeople.isLoading}
            rows={blockedPeople.data ?? []}
            renderRow={(r) => (
              <PersonRowView key={r.key} row={r} actionLabel="Unblock" onAction={() => undoBlock(r.key, r.name)} destructive />
            )}
          />
          <Section
            icon={Clock}
            title="Snoozed companies"
            empty="No companies are snoozed."
            loading={snoozedCompanies.isLoading}
            rows={snoozedCompanies.data?.snoozed ?? []}
            renderRow={(r) => (
              <PersonRowView key={r.key} row={r} actionLabel="Unsnooze" onAction={() => undoSnoozeCompany(r.key, r.name)} />
            )}
          />
          <Section
            icon={EyeOff}
            title="Companies hidden from your feed"
            empty="No companies are hidden."
            loading={snoozedCompanies.isLoading}
            rows={snoozedCompanies.data?.hiddenAll ?? []}
            renderRow={(r) => (
              <PersonRowView key={r.key} row={r} actionLabel="Show again" onAction={() => undoSnoozeCompany(r.key, r.name)} />
            )}
          />
          <Section
            icon={UserX}
            title="Blocked companies"
            empty="You haven't blocked any companies."
            loading={blockedCompanies.isLoading}
            rows={blockedCompanies.data ?? []}
            renderRow={(r) => (
              <PersonRowView key={r.key} row={r} actionLabel="Unblock" onAction={() => undoBlockCompany(r.key, r.name)} destructive />
            )}
          />
          <Section
            icon={EyeOff}
            title="Hidden posts"
            empty="No hidden posts."
            loading={posts.isLoading}
            rows={posts.data?.hidden ?? []}
            renderRow={(r) => (
              <PostRowView key={r.key} row={r} actionLabel="Unhide" onAction={() => undoHiddenPost(r.key)} />
            )}
          />
          <Section
            icon={ThumbsDown}
            title="Marked “Not interested”"
            empty="Nothing marked not interested."
            loading={posts.isLoading}
            rows={posts.data?.notInterested ?? []}
            renderRow={(r) => (
              <PostRowView key={r.key} row={r} actionLabel="Remove" onAction={() => undoNotInterested(r.postId)} />
            )}
          />

          {!anyLoading &&
            (snoozedPeople.data?.snoozed.length ?? 0) === 0 &&
            (snoozedPeople.data?.hiddenAll.length ?? 0) === 0 &&
            (blockedPeople.data?.length ?? 0) === 0 &&
            (snoozedCompanies.data?.snoozed.length ?? 0) === 0 &&
            (snoozedCompanies.data?.hiddenAll.length ?? 0) === 0 &&
            (blockedCompanies.data?.length ?? 0) === 0 &&
            (posts.data?.hidden.length ?? 0) === 0 &&
            (posts.data?.notInterested.length ?? 0) === 0 && (
              <div className="centered py-10 subtle text-center">
                <SlidersHorizontal className="mx-auto mb-3 h-10 w-10 opacity-30" />
                <p className="font-medium">Your feed is wide open</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You haven't snoozed, hidden, or blocked anything yet.
                </p>
              </div>
            )}
        </div>
      </div>
    </Layout>
  );
};

function Section<T>({
  icon: Icon,
  title,
  empty,
  loading,
  rows,
  renderRow,
}: {
  icon: React.ElementType;
  title: string;
  empty: string;
  loading: boolean;
  rows: T[];
  renderRow: (row: T) => React.ReactNode;
}) {
  if (!loading && rows.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon className="h-4 w-4" />
        {title}
        {!loading && <span className="text-xs font-normal">({rows.length})</span>}
      </h2>
      <div className="divide-y divide-border rounded-xl border border-border">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">{empty}</div>
        ) : (
          rows.map(renderRow)
        )}
      </div>
    </section>
  );
}

const PersonRowView = ({
  row,
  actionLabel,
  onAction,
  destructive = false,
}: {
  row: PersonRow;
  actionLabel: string;
  onAction: () => void;
  destructive?: boolean;
}) => {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3 p-3">
      <Avatar className="h-9 w-9">
        <AvatarImage src={row.avatar ?? undefined} className="object-cover" />
        <AvatarFallback>{row.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.name}</p>
        <p className="truncate text-xs text-muted-foreground">{row.meta}</p>
      </div>
      <Button
        size="sm"
        variant={destructive ? 'outline' : 'secondary'}
        disabled={busy}
        onClick={async () => { setBusy(true); await onAction(); setBusy(false); }}
      >
        {actionLabel}
      </Button>
    </div>
  );
};

const PostRowView = ({
  row,
  actionLabel,
  onAction,
}: {
  row: PostRow;
  actionLabel: string;
  onAction: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{row.content}</p>
        <p className="truncate text-xs text-muted-foreground">by {row.author}</p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={async () => { setBusy(true); await onAction(); setBusy(false); }}
      >
        {actionLabel}
      </Button>
    </div>
  );
};

export default FeedPreferences;
