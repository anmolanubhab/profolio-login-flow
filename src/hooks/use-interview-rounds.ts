import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type InterviewRoundType = Database['public']['Enums']['interview_round_type'];
export type InterviewRoundStatus = Database['public']['Enums']['interview_round_status'];
export type InterviewMode = Database['public']['Enums']['interview_mode'];
export type MeetingProvider = Database['public']['Enums']['meeting_provider'];
export type InterviewRecommendation = Database['public']['Enums']['interview_recommendation'];

export interface InterviewPanelist {
  id: string;
  round_id: string;
  user_id: string;
  profile_id: string | null;
  panel_role: string | null;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface InterviewRound {
  id: string;
  application_id: string;
  round_no: number;
  round_type: InterviewRoundType;
  status: InterviewRoundStatus;
  title: string | null;
  description: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  timezone: string;
  mode: InterviewMode;
  provider: MeetingProvider | null;
  meeting_link: string | null;
  interviewer_user_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  panelists?: InterviewPanelist[];
}

export interface InterviewFeedback {
  id: string;
  round_id: string;
  panelist_user_id: string;
  panelist_profile_id: string | null;
  technical_skill: number | null;
  communication: number | null;
  problem_solving: number | null;
  overall: number | null;
  recommendation: InterviewRecommendation | null;
  private_notes: string | null;
  created_at: string;
  updated_at: string;
  panelist_name?: string | null;
}

/** Fetches interview rounds (+ panelists) for a single hiring_applications row. */
export function useInterviewRounds(applicationId?: string) {
  const [rounds, setRounds] = useState<InterviewRound[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRounds = useCallback(async () => {
    if (!applicationId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data: roundRows, error } = await supabase
        .from('hiring_interview_rounds')
        .select('*')
        .eq('application_id', applicationId)
        .order('round_no', { ascending: true });

      if (error) throw error;

      const roundIds = (roundRows || []).map((r) => r.id);
      let panelistsByRound: Record<string, InterviewPanelist[]> = {};

      if (roundIds.length > 0) {
        const { data: panelRows } = await supabase
          .from('hiring_interview_panelists')
          .select('*')
          .in('round_id', roundIds);

        const profileIds = Array.from(
          new Set((panelRows || []).map((p) => p.profile_id).filter(Boolean))
        ) as string[];

        let profilesById: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
        if (profileIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', profileIds);
          profilesById = Object.fromEntries(
            (profiles || []).map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
          );
        }

        panelistsByRound = (panelRows || []).reduce((acc, p) => {
          const entry: InterviewPanelist = {
            ...p,
            profile: p.profile_id ? profilesById[p.profile_id] : undefined,
          };
          acc[p.round_id] = [...(acc[p.round_id] || []), entry];
          return acc;
        }, {} as Record<string, InterviewPanelist[]>);
      }

      setRounds(
        (roundRows || []).map((r) => ({ ...r, panelists: panelistsByRound[r.id] || [] }))
      );
    } catch (error) {
      console.error('Error fetching interview rounds:', error);
    } finally {
      setIsLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  return { rounds, isLoading, refetch: fetchRounds };
}

export function useInterviewActions() {
  const inviteInterviewRound = async (params: {
    applicationId: string;
    roundType: InterviewRoundType;
    title: string;
    description: string | null;
    scheduledAt: string;
    durationMinutes: number;
    timezone: string;
    mode: InterviewMode;
    provider: MeetingProvider | null;
    meetingLink: string | null;
    panelistUserIds: string[];
  }) => {
    const { data, error } = await supabase.rpc('invite_interview_round', {
      p_application_id: params.applicationId,
      p_round_type: params.roundType,
      p_title: params.title,
      p_description: params.description,
      p_scheduled_at: params.scheduledAt,
      p_duration_minutes: params.durationMinutes,
      p_timezone: params.timezone,
      p_mode: params.mode,
      p_provider: params.provider,
      p_meeting_link: params.meetingLink,
      p_panelist_user_ids: params.panelistUserIds,
    });
    if (error) throw error;
    return data as string;
  };

  const respondToInvite = async (roundId: string, accept: boolean, declineReason?: string) => {
    const { error } = await supabase.rpc('respond_interview_invite', {
      p_round_id: roundId,
      p_accept: accept,
      p_decline_reason: declineReason || null,
    });
    if (error) throw error;
  };

  const rescheduleRound = async (roundId: string, newScheduledAt: string, newMeetingLink?: string) => {
    const { error } = await supabase.rpc('reschedule_interview_round', {
      p_round_id: roundId,
      p_new_scheduled_at: newScheduledAt,
      p_new_meeting_link: newMeetingLink || null,
    });
    if (error) throw error;
  };

  const cancelRound = async (roundId: string, reason?: string) => {
    const { error } = await supabase.rpc('cancel_interview_round', {
      p_round_id: roundId,
      p_reason: reason || null,
    });
    if (error) throw error;
  };

  const markOutcome = async (roundId: string, outcome: 'completed' | 'no_show') => {
    const { error } = await supabase.rpc('mark_interview_outcome', {
      p_round_id: roundId,
      p_outcome: outcome,
    });
    if (error) throw error;
  };

  const submitFeedback = async (params: {
    roundId: string;
    technical: number;
    communication: number;
    problemSolving: number;
    overall: number;
    recommendation: InterviewRecommendation;
    notes?: string;
  }) => {
    const { error } = await supabase.rpc('submit_interview_feedback', {
      p_round_id: params.roundId,
      p_technical: params.technical,
      p_communication: params.communication,
      p_problem_solving: params.problemSolving,
      p_overall: params.overall,
      p_recommendation: params.recommendation,
      p_notes: params.notes || null,
    });
    if (error) throw error;
  };

  const fetchFeedback = async (roundId: string): Promise<InterviewFeedback[]> => {
    const { data, error } = await supabase
      .from('hiring_interview_feedback')
      .select('*')
      .eq('round_id', roundId);
    if (error) throw error;

    const profileIds = Array.from(new Set((data || []).map((f) => f.panelist_profile_id).filter(Boolean))) as string[];
    let namesById: Record<string, string | null> = {};
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', profileIds);
      namesById = Object.fromEntries((profiles || []).map((p) => [p.id, p.display_name]));
    }

    return (data || []).map((f) => ({
      ...f,
      panelist_name: f.panelist_profile_id ? namesById[f.panelist_profile_id] : null,
    }));
  };

  return {
    inviteInterviewRound,
    respondToInvite,
    rescheduleRound,
    cancelRound,
    markOutcome,
    submitFeedback,
    fetchFeedback,
  };
}

/** Recruiters/company-members authorized to sit on a panel for a given company, per the B6 model. */
export function useCompanyRecruiters(companyId?: string) {
  const [recruiters, setRecruiters] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!companyId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const { data: company } = await supabase
          .from('companies')
          .select('owner_id')
          .eq('id', companyId)
          .single();

        const { data: members } = await supabase
          .from('company_members')
          .select('user_id, is_recruiter')
          .eq('company_id', companyId)
          .eq('is_recruiter', true);

        const profileIds = Array.from(
          new Set([company?.owner_id, ...((members || []).map((m) => m.user_id))].filter(Boolean))
        ) as string[];

        if (profileIds.length === 0) {
          if (!cancelled) setRecruiters([]);
          return;
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, user_id, display_name')
          .in('id', profileIds);

        if (!cancelled) {
          setRecruiters(
            (profiles || []).map((p) => ({ user_id: p.user_id, display_name: p.display_name }))
          );
        }
      } catch (error) {
        console.error('Error fetching company recruiters:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { recruiters, isLoading };
}
