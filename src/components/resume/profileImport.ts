import { supabase } from '@/integrations/supabase/client';
import {
  type ResumeDoc,
  emptyExperience,
  emptyEducation,
  emptySkill,
} from '@/lib/resume/schema';
import { bulletsToHtml } from '@/lib/resume/phrases';

/**
 * Pull the signed-in user's Profolio profile data into a resume doc. Only
 * fills blanks — never overwrites something the user already typed.
 */
export async function importFromProfile(doc: ResumeDoc): Promise<ResumeDoc> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return doc;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, full_name, email, phone, location, headline, profession, bio, website, linkedin_url')
    .eq('user_id', user.id)
    .maybeSingle();

  const next: ResumeDoc = structuredClone(doc);

  next.basics.fullName ||=
    (profile?.full_name as string) || (profile?.display_name as string) || '';
  next.basics.headline ||=
    (profile?.headline as string) || (profile?.profession as string) || '';
  next.basics.email ||= (profile?.email as string) || user.email || '';
  next.basics.phone ||= (profile?.phone as string) || '';
  next.basics.location ||= (profile?.location as string) || '';
  next.basics.website ||= (profile?.website as string) || '';
  next.basics.linkedin ||= (profile?.linkedin_url as string) || '';
  if (!hasText(next.summary) && typeof profile?.bio === 'string' && profile.bio.trim()) {
    next.summary = `<p>${escapeHtml(profile.bio.trim())}</p>`;
  }

  const pid = profile?.id as string | undefined;
  if (!pid) return next;

  const [{ data: exp }, { data: edu }, { data: sk }] = await Promise.all([
    supabase
      .from('experience')
      .select('role, company, location, start_date, end_date, is_current, description')
      .eq('user_id', pid)
      .order('start_date', { ascending: false }),
    supabase
      .from('education')
      .select('institution, degree, field_of_study, start_date, end_date, description')
      .eq('user_id', pid)
      .order('start_date', { ascending: false }),
    supabase.from('skills').select('skill_name').eq('user_id', pid),
  ]);

  if (next.experience.length === 0 && exp && exp.length) {
    next.experience = exp.map((e) => ({
      ...emptyExperience(),
      role: (e.role as string) || '',
      company: (e.company as string) || '',
      location: (e.location as string) || '',
      startDate: fmtDate(e.start_date as string | null),
      endDate: e.is_current ? '' : fmtDate(e.end_date as string | null),
      current: e.is_current === true,
      description: e.description
        ? bulletsToHtml(String(e.description).split(/\r?\n+/).map((s) => s.trim()).filter(Boolean))
        : '',
    }));
  }

  if (next.education.length === 0 && edu && edu.length) {
    next.education = edu.map((e) => ({
      ...emptyEducation(),
      school: (e.institution as string) || '',
      degree: (e.degree as string) || '',
      field: (e.field_of_study as string) || '',
      startDate: fmtDate(e.start_date as string | null),
      endDate: fmtDate(e.end_date as string | null),
      location: '',
      description: e.description ? `<p>${escapeHtml(String(e.description))}</p>` : '',
    }));
  }

  if (next.skills.length === 0 && sk && sk.length) {
    next.skills = sk
      .map((s) => (s.skill_name as string) || '')
      .filter(Boolean)
      .map((name) => ({ ...emptySkill(), name }));
  }

  return next;
}

function hasText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim().length > 0;
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fmtDate(v: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
