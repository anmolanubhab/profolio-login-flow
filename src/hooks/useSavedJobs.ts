import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Tracks which jobs the current user has saved, mirroring the existing saved_posts pattern. */
export function useSavedJobs() {
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('saved_jobs').select('job_id').eq('user_id', user.id);
    if (!error) setSavedJobIds(new Set((data || []).map((r) => r.job_id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const toggleSave = async (jobId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isSaved = savedJobIds.has(jobId);
    if (isSaved) {
      setSavedJobIds((prev) => { const next = new Set(prev); next.delete(jobId); return next; });
      const { error } = await supabase.from('saved_jobs').delete().eq('user_id', user.id).eq('job_id', jobId);
      if (error) setSavedJobIds((prev) => new Set(prev).add(jobId)); // revert on failure
    } else {
      setSavedJobIds((prev) => new Set(prev).add(jobId));
      const { error } = await supabase.from('saved_jobs').insert({ user_id: user.id, job_id: jobId });
      if (error) setSavedJobIds((prev) => { const next = new Set(prev); next.delete(jobId); return next; });
    }
  };

  return { savedJobIds, loading, toggleSave, refetch };
}
