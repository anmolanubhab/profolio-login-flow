import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ChevronLeft,
  MapPin,
  Globe,
  Sparkles,
  ShieldOff,
  Briefcase,
  GraduationCap,
  Award,
  Lightbulb,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ExperienceEntry {
  company: string | null;
  role: string | null;
  employment_type: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
  description: string | null;
}

interface EducationEntry {
  institution: string | null;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface Disclosure {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  skills: string[] | null;
  experience: ExperienceEntry[] | null;
  education: EducationEntry[] | null;
  certifications: string[] | null;
  projects: unknown;
  open_to_work: boolean;
}

type PageState = 'loading' | 'unavailable' | 'ready';

function formatDateRange(start: string | null, end: string | null, isCurrent?: boolean | null) {
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : null);
  const startLabel = fmt(start);
  const endLabel = isCurrent ? 'Present' : fmt(end);
  if (!startLabel && !endLabel) return null;
  return [startLabel, endLabel].filter(Boolean).join(' – ');
}

export default function RecruiterCandidateProfile() {
  const { companyId, candidateId } = useParams<{ companyId: string; candidateId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [disclosure, setDisclosure] = useState<Disclosure | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!companyId || !candidateId) {
        navigate('/companies');
        return;
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        navigate('/');
        return;
      }
      if (cancelled) return;
      setUser(currentUser);

      // Authorization, consent, and blocking are all enforced server-side
      // inside this RPC -- absence of a row here is the only signal the
      // client receives, deliberately not distinguishing "not authorized"
      // from "consent off" from "blocked" from "not found".
      const { data, error } = await supabase.rpc('get_recruiter_candidate_disclosure', {
        _company_id: companyId,
        _candidate_profile_id: candidateId,
      });

      if (cancelled) return;

      if (error || !data || data.length === 0) {
        setPageState('unavailable');
        return;
      }

      setDisclosure(data[0] as unknown as Disclosure);
      setPageState('ready');
    };

    init();
    setDisclosure(null);

    return () => {
      cancelled = true;
    };
  }, [companyId, candidateId, navigate]);

  const handleBack = () => navigate(`/company/${companyId}/candidates`);

  if (pageState === 'loading') {
    return (
      <Layout user={user} fullWidth>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  if (pageState === 'unavailable') {
    return (
      <Layout user={user} fullWidth>
        <div className="w-full max-w-2xl mx-auto py-16 px-4 text-center">
          <ShieldOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Profile details unavailable</h1>
          <p className="text-muted-foreground mb-6">
            Candidate profile details are not available for recruiter viewing.
          </p>
          <Button variant="outline" onClick={handleBack}>Back to candidates</Button>
        </div>
      </Layout>
    );
  }

  const d = disclosure!;
  const skills = d.skills || [];
  const experience = d.experience || [];
  const education = d.education || [];
  const certifications = d.certifications || [];

  return (
    <Layout user={user} fullWidth>
      <div className="w-full max-w-3xl mx-auto px-2 sm:px-0">
        <div className="flex items-center gap-2 py-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack} aria-label="Back to candidates">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold text-foreground">Candidate profile</h1>
        </div>

        <Card className="bg-card shadow-card border-0 mb-4 overflow-hidden">
          <div
            className="h-24 w-full"
            style={
              d.cover_url
                ? { backgroundImage: `url(${d.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { background: 'var(--gradient-hero)' }
            }
          />
          <CardContent className="pt-0">
            <div className="-mt-10 flex items-end gap-4">
              <Avatar className="h-20 w-20 border-4 border-background shadow-elegant">
                <AvatarImage src={d.avatar_url || undefined} />
                <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
                  {d.display_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-foreground">{d.display_name || 'Profolio user'}</h2>
                {d.open_to_work && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success text-xs font-semibold px-2.5 py-1 border border-success/20">
                    <Sparkles className="h-3 w-3" />
                    Open to work
                  </span>
                )}
              </div>
              {d.headline && <p className="text-sm text-primary font-medium">{d.headline}</p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {d.location && (
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {d.location}</span>
                )}
                {d.website && (
                  <a href={d.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    <Globe className="h-3.5 w-3.5" /> {d.website}
                  </a>
                )}
              </div>
              {d.bio && <p className="text-sm text-foreground/90 leading-relaxed pt-1">{d.bio}</p>}
            </div>
          </CardContent>
        </Card>

        {skills.length > 0 && (
          <Card className="bg-card shadow-card border-0 mb-4">
            <CardHeader className="px-5 pt-4 pb-2">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" /> Skills
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs font-normal">{s}</Badge>
              ))}
            </CardContent>
          </Card>
        )}

        {experience.length > 0 && (
          <Card className="bg-card shadow-card border-0 mb-4">
            <CardHeader className="px-5 pt-4 pb-2">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" /> Experience
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              {experience.map((e, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold text-foreground">{e.role || 'Role'}{e.company ? ` · ${e.company}` : ''}</p>
                  <p className="text-xs text-muted-foreground">
                    {[formatDateRange(e.start_date, e.end_date, e.is_current), e.location].filter(Boolean).join(' · ')}
                  </p>
                  {e.description && <p className="text-sm text-foreground/80 mt-1">{e.description}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {education.length > 0 && (
          <Card className="bg-card shadow-card border-0 mb-4">
            <CardHeader className="px-5 pt-4 pb-2">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" /> Education
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {education.map((ed, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold text-foreground">{ed.institution || 'Institution'}</p>
                  <p className="text-xs text-muted-foreground">
                    {[ed.degree, ed.field_of_study].filter(Boolean).join(', ')}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateRange(ed.start_date, ed.end_date)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {certifications.length > 0 && (
          <Card className="bg-card shadow-card border-0 mb-4">
            <CardHeader className="px-5 pt-4 pb-2">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" /> Certifications
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 flex flex-wrap gap-1.5">
              {certifications.map((c) => (
                <Badge key={c} variant="outline" className="text-xs font-normal">{c}</Badge>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
