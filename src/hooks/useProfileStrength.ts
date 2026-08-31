import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PROFILE_CHANGED_EVENT } from '@/lib/profileNav';
import {
  calculateProfileStrength,
  type ProfileStrengthResult,
} from '@/lib/profileStrength';

/**
 * Owner-only Profile Strength. One batched query (profile row + 6 section
 * head-counts), then the pure engine. Shared React Query cache keyed on the
 * profile id, so the header widget, the dashboard sidecard, and the detail
 * sheet all read the same value. Call `invalidateProfileStrength(profileId)`
 * after any profile/section edit to recompute.
 */

export const profileStrengthKey = (profileId: string | null | undefined) =>
  ['profile-strength', profileId ?? 'anon'] as const;

interface UseProfileStrengthArgs {
  /** profiles.id of the current user's own profile */
  profileId: string | null | undefined;
  /** auth user id — certificates / resumes are keyed on this */
  authUserId: string | null | undefined;
}

export function useProfileStrength({ profileId, authUserId }: UseProfileStrengthArgs) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!profileId) return;
    const onChanged = () => qc.invalidateQueries({ queryKey: profileStrengthKey(profileId) });
    window.addEventListener(PROFILE_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, onChanged);
  }, [qc, profileId]);

  return useQuery<ProfileStrengthResult>({
    queryKey: profileStrengthKey(profileId),
    enabled: !!profileId && !!authUserId,
    staleTime: 30_000,
    queryFn: async () => {
      const pid = profileId!;
      const uid = authUserId!;

      const headByProfile = (table: 'experience' | 'education' | 'skills' | 'languages') =>
        supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', pid);
      const headByAuth = (table: 'certificates' | 'resumes') =>
        supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', uid);

      const [profileRes, exp, edu, sk, lang, certs, resumes] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'avatar_url, photo_url, cover_url, display_name, full_name, headline, profession, bio, location, address, phone, website, linkedin_url, github_url, twitter_url, projects, skills',
          )
          .eq('id', pid)
          .maybeSingle(),
        headByProfile('experience'),
        headByProfile('education'),
        headByProfile('skills'),
        headByProfile('languages'),
        headByAuth('certificates'),
        headByAuth('resumes'),
      ]);

      if (profileRes.error) throw profileRes.error;
      const p = profileRes.data ?? {};

      return calculateProfileStrength({
        avatarUrl: (p as Record<string, unknown>).avatar_url as string | null,
        photoUrl: (p as Record<string, unknown>).photo_url as string | null,
        coverUrl: (p as Record<string, unknown>).cover_url as string | null,
        displayName: (p as Record<string, unknown>).display_name as string | null,
        fullName: (p as Record<string, unknown>).full_name as string | null,
        headline: (p as Record<string, unknown>).headline as string | null,
        profession: (p as Record<string, unknown>).profession as string | null,
        bio: (p as Record<string, unknown>).bio as string | null,
        location: (p as Record<string, unknown>).location as string | null,
        address: (p as Record<string, unknown>).address as string | null,
        phone: (p as Record<string, unknown>).phone as string | null,
        website: (p as Record<string, unknown>).website as string | null,
        linkedinUrl: (p as Record<string, unknown>).linkedin_url as string | null,
        githubUrl: (p as Record<string, unknown>).github_url as string | null,
        twitterUrl: (p as Record<string, unknown>).twitter_url as string | null,
        projects: (p as Record<string, unknown>).projects,
        legacySkills: (p as Record<string, unknown>).skills,
        experienceCount: exp.count ?? 0,
        educationCount: edu.count ?? 0,
        skillsCount: sk.count ?? 0,
        certificatesCount: certs.count ?? 0,
        languagesCount: lang.count ?? 0,
        resumesCount: resumes.count ?? 0,
      });
    },
  });
}

/** Recompute after a profile / section edit. */
export function useInvalidateProfileStrength() {
  const qc = useQueryClient();
  return (profileId: string | null | undefined) =>
    qc.invalidateQueries({ queryKey: profileStrengthKey(profileId) });
}
