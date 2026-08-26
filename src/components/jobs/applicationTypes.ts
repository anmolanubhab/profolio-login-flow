import { Database } from '@/integrations/supabase/types';
import { ApplicationStage } from '@/lib/applicationStages';

export interface ApplicationJob {
  id: string;
  title: string;
  location: string | null;
  employment_type: string | null;
  remote_option: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  posted_at: string;
  company_id: string | null;
  company_name: string | null;
  companies: { name: string; logo_url: string | null } | null;
}

export interface ApplicationRow {
  id: string;
  job_id: string;
  current_stage: ApplicationStage;
  stage_updated_at: string;
  created_at: string;
  resume_id: string | null;
  resume_sharing_revoked: boolean;
  source: string | null;
  rejection_reason: string | null;
  jobs: ApplicationJob;
}

export interface ApplicationResumeResult {
  status: 'ok' | 'revoked' | 'no_resume' | 'not_authorized';
  candidate_name: string | null;
  resume_title: string | null;
  resume_content: {
    type?: string;
    title?: string;
    fileName?: string;
    personalInfo?: { name?: string; location?: string };
    summary?: string;
    experience?: string;
    education?: string;
    skills?: string;
  } | null;
}

export type InterviewRound = Database['public']['Tables']['hiring_interview_rounds']['Row'];
export type Offer = Database['public']['Tables']['hiring_offers']['Row'];
export type MatchScore = Database['public']['Tables']['hiring_match_scores']['Row'];
export type ApplicationEvent = Database['public']['Tables']['hiring_application_events']['Row'];

export function companyName(job: ApplicationJob): string {
  return job.companies?.name || job.company_name || 'Unknown company';
}

export function companyLogo(job: ApplicationJob): string | null {
  return job.companies?.logo_url || null;
}

export function formatSalary(job: ApplicationJob): string | null {
  if (!job.salary_min || !job.salary_max) return null;
  const currency = job.currency || 'USD';
  return `${currency} ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}`;
}
