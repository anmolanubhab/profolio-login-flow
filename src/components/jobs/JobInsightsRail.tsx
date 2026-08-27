import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, TrendingUp } from 'lucide-react';

const WIDGET_CLASS = 'rounded-xl border border-border bg-card shadow-card overflow-hidden';

/** Jobs page right rail: real application stats (never fabricated) plus a link into the tracker. */
export function JobInsightsRail() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ total: number; interviews: number; offers: number } | null>(null);
  const [profileComplete, setProfileComplete] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: apps } = await supabase
        .from('hiring_applications')
        .select('current_stage')
        .eq('candidate_user_id', user.id);

      if (apps) {
        const interviews = apps.filter((a) =>
          ['interview_offered', 'interview_scheduled', 'interview_completed'].includes(a.current_stage)
        ).length;
        const offers = apps.filter((a) => a.current_stage === 'offer_extended').length;
        setStats({ total: apps.length, interviews, offers });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url, profession, location, skills, open_to_roles')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile) {
        const fields = [profile.avatar_url, profile.profession, profile.location, profile.skills?.length, profile.open_to_roles?.length];
        setProfileComplete(Math.round((fields.filter(Boolean).length / fields.length) * 100));
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className={WIDGET_CLASS}>
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <h3 className="text-[15px] font-semibold text-foreground">Your job search</h3>
        </div>
        <div className="p-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-foreground">{stats?.total ?? '—'}</p>
            <p className="text-[11px] text-muted-foreground">Applied</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{stats?.interviews ?? '—'}</p>
            <p className="text-[11px] text-muted-foreground">Interviews</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{stats?.offers ?? '—'}</p>
            <p className="text-[11px] text-muted-foreground">Offers</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/dashboard?tab=applications')}
          className="w-full text-center py-2.5 text-[13px] font-medium text-muted-foreground hover:bg-secondary transition-colors border-t"
        >
          Open Job Tracker
        </button>
      </div>

      {profileComplete !== null && profileComplete < 100 && (
        <div className={WIDGET_CLASS}>
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-[15px] font-semibold text-foreground">Better recommendations</h3>
          </div>
          <div className="p-4">
            <p className="text-[13px] text-muted-foreground mb-2">
              Complete your profile to get better job recommendations. {profileComplete}% complete.
            </p>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
              <div className="h-full bg-primary rounded-full" style={{ width: `${profileComplete}%` }} />
            </div>
            <button onClick={() => navigate('/settings/visibility')} className="text-[13px] font-medium text-primary hover:underline">
              Set job preferences →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
