import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Briefcase, TrendingUp, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { REACTION_WEIGHTS } from '@/lib/postAggregation';

interface TrendingPost {
  id: string;
  content: string;
  reaction_count: number;
}

interface SuggestedProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  profession: string | null;
}

interface RecommendedJob {
  id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  employment_type: string | null;
}

const WIDGET_CLASS = 'rounded-xl border border-border bg-card shadow-card overflow-hidden';

// The desktop feed's right column: real, queried content only -- no
// decorative placeholder widgets. Every section here reads from a table
// that's already load-bearing elsewhere in the app (post_reactions,
// profiles, jobs), just surfaced in a new place.
export function FeedRightRail() {
  const [trending, setTrending] = useState<TrendingPost[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedProfile[]>([]);
  const [jobs, setJobs] = useState<RecommendedJob[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: me } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();

      // Trending: most-reacted published posts from the last 7 days,
      // scored with the same REACTION_WEIGHTS used in the real feed ranking
      // (src/lib/postAggregation.ts) rather than a raw count, so "trending"
      // means the same thing here as it does in the feed itself.
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentPosts } = await supabase
        .from('posts')
        .select('id, content, post_reactions(reaction_type)')
        .eq('status', 'published')
        .gte('created_at', since)
        .limit(50);

      if (recentPosts) {
        const scored = recentPosts
          .map((p: any) => ({
            id: p.id,
            content: p.content as string,
            reaction_count: (p.post_reactions || []).reduce(
              (sum: number, r: any) => sum + (REACTION_WEIGHTS[r.reaction_type as keyof typeof REACTION_WEIGHTS] || 1),
              0
            ),
          }))
          .filter((p) => p.reaction_count > 0)
          .sort((a, b) => b.reaction_count - a.reaction_count)
          .slice(0, 4);
        setTrending(scored);
      }

      if (me) {
        // People to follow: other real profiles, excluding anyone already
        // connected/following, capped small -- a lightweight "who's on the
        // platform" surface, not a recommendation engine.
        const [{ data: connections }, { data: follows }, { data: blocked }] = await Promise.all([
          supabase.from('connections').select('user_id, connection_id').or(`user_id.eq.${me.id},connection_id.eq.${me.id}`),
          supabase.from('followers').select('following_id').eq('follower_id', me.id),
          supabase.from('blocked_users').select('blocked_user_id').eq('user_id', me.id),
        ]);
        const excluded = new Set<string>([me.id]);
        (connections || []).forEach((c: any) => { excluded.add(c.user_id); excluded.add(c.connection_id); });
        (follows || []).forEach((f: any) => excluded.add(f.following_id));
        // Keep people I've blocked out of my own suggestions too -- purely
        // my own discovery experience, unrelated to the RLS-level rule that
        // stops a blocked person from seeing me (see is_blocked_by()).
        (blocked || []).forEach((b: { blocked_user_id: string }) => excluded.add(b.blocked_user_id));

        // profile_discovery=false opts a profile out of this suggestions
        // list specifically -- it doesn't affect direct /profile/:id access.
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, profession')
          .eq('profile_discovery', true)
          .limit(20);
        const filtered = (profiles || []).filter((p) => !excluded.has(p.id)).slice(0, 3);
        setSuggestions(filtered);
      }

      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, title, company_name, location, employment_type')
        .eq('status', 'open')
        .order('posted_at', { ascending: false })
        .limit(3);
      setJobs(jobsData || []);
    };
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className={WIDGET_CLASS}>
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-[15px] font-semibold text-foreground">Profolio Insights</h3>
        </div>
        {trending.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-muted-foreground">No trending posts this week yet.</p>
        ) : (
          <ul>
            {trending.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full text-left px-4 py-2.5 hover:bg-secondary transition-colors border-b last:border-b-0"
                >
                  <p className="text-[13px] text-foreground line-clamp-2">{p.content || 'Shared an update'}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{p.reaction_count} weighted reactions</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className={WIDGET_CLASS}>
          <div className="px-4 py-3 border-b">
            <h3 className="text-[15px] font-semibold text-foreground">People to follow</h3>
          </div>
          <ul>
            {suggestions.map((p) => (
              <li key={p.id} className="px-4 py-3 flex items-center gap-3 border-b last:border-b-0">
                <button onClick={() => navigate(`/profile/${p.id}`)} className="shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={p.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {p.display_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
                <div className="min-w-0 flex-1">
                  <button onClick={() => navigate(`/profile/${p.id}`)} className="text-[13px] font-medium text-foreground hover:underline block truncate text-left w-full">
                    {p.display_name || 'Profolio user'}
                  </button>
                  {p.profession && <p className="text-[11px] text-muted-foreground truncate">{p.profession}</p>}
                </div>
                <Button size="sm" variant="outline" className="h-7 rounded-full text-[12px] px-3 shrink-0" onClick={() => navigate(`/profile/${p.id}`)}>
                  View
                </Button>
              </li>
            ))}
          </ul>
          <button onClick={() => navigate('/network')} className="w-full text-center py-2.5 text-[13px] font-medium text-muted-foreground hover:bg-secondary transition-colors">
            Show more
          </button>
        </div>
      )}

      {jobs.length > 0 && (
        <div className={WIDGET_CLASS}>
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <h3 className="text-[15px] font-semibold text-foreground">Jobs for you</h3>
          </div>
          <ul>
            {jobs.map((j) => (
              <li key={j.id}>
                <button onClick={() => navigate('/jobs')} className="w-full text-left px-4 py-2.5 hover:bg-secondary transition-colors border-b last:border-b-0">
                  <p className="text-[13px] font-medium text-foreground line-clamp-1">{j.title}</p>
                  <p className="text-[12px] text-muted-foreground">{j.company_name}</p>
                  {j.location && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {j.location}{j.employment_type ? ` · ${j.employment_type}` : ''}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => navigate('/jobs')} className="w-full text-center py-2.5 text-[13px] font-medium text-muted-foreground hover:bg-secondary transition-colors">
            View all jobs
          </button>
        </div>
      )}
    </div>
  );
}

export default FeedRightRail;
