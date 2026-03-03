export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          applied_at: string
          cover_letter: string | null
          id: string
          job_id: string
          resume_id: string | null
          status: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Insert: {
          applied_at?: string
          cover_letter?: string | null
          id?: string
          job_id: string
          resume_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Update: {
          applied_at?: string
          cover_letter?: string | null
          id?: string
          job_id?: string
          resume_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_user_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_search_index: {
        Row: {
          full_name: string | null
          headline: string | null
          location: string | null
          open_to_work: boolean
          profile_id: string
          searchable: unknown
          skills: string[]
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          full_name?: string | null
          headline?: string | null
          location?: string | null
          open_to_work?: boolean
          profile_id: string
          searchable?: unknown
          skills?: string[]
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          full_name?: string | null
          headline?: string | null
          location?: string | null
          open_to_work?: boolean
          profile_id?: string
          searchable?: unknown
          skills?: string[]
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_search_index_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          acted_as: string
          company_id: string | null
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acted_as?: string
          company_id?: string | null
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acted_as?: string
          company_id?: string | null
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          culture: string | null
          description: string | null
          employee_count: string | null
          founded_year: number | null
          id: string
          industry: string | null
          location: string | null
          logo_url: string | null
          name: string
          owner_id: string | null
          owner_profile_id: string | null
          values: string[] | null
          website: string | null
        }
        Insert: {
          created_at?: string
          culture?: string | null
          description?: string | null
          employee_count?: string | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          owner_profile_id?: string | null
          values?: string[] | null
          website?: string | null
        }
        Update: {
          created_at?: string
          culture?: string | null
          description?: string | null
          employee_count?: string | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          owner_profile_id?: string | null
          values?: string[] | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_followers: {
        Row: {
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_followers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invitations: {
        Row: {
          accepted_by: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["company_role"]
          status: string
          token_hash: string | null
          updated_at: string
          used_at: string | null
        }
        Insert: {
          accepted_by?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["company_role"]
          status?: string
          token_hash?: string | null
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          accepted_by?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["company_role"]
          status?: string
          token_hash?: string | null
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["company_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["company_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["company_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["connection_status"]
          user_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["connection_status"]
          user_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["connection_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          participant_1: string | null
          participant_2: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          participant_1?: string | null
          participant_2?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          participant_1?: string | null
          participant_2?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      education: {
        Row: {
          created_at: string
          degree: string | null
          description: string | null
          end_date: string | null
          field_of_study: string | null
          grade: string | null
          id: string
          institution: string
          start_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          degree?: string | null
          description?: string | null
          end_date?: string | null
          field_of_study?: string | null
          grade?: string | null
          id?: string
          institution: string
          start_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          degree?: string | null
          description?: string | null
          end_date?: string | null
          field_of_study?: string | null
          grade?: string | null
          id?: string
          institution?: string
          start_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      experience: {
        Row: {
          company: string
          created_at: string
          description: string | null
          employment_type: string | null
          end_date: string | null
          id: string
          is_current: boolean | null
          location: string | null
          role: string
          start_date: string
          user_id: string
        }
        Insert: {
          company: string
          created_at?: string
          description?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          location?: string | null
          role: string
          start_date: string
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          description?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          location?: string | null
          role?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      followers: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: Database["public"]["Enums"]["friend_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: Database["public"]["Enums"]["friend_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["friend_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          allow_member_invites: boolean | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          industry: string[] | null
          is_public: boolean | null
          location: string | null
          name: string
          owner_user_id: string | null
          require_post_approval: boolean | null
          rules: string | null
        }
        Insert: {
          allow_member_invites?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          industry?: string[] | null
          is_public?: boolean | null
          location?: string | null
          name: string
          owner_user_id?: string | null
          require_post_approval?: boolean | null
          rules?: string | null
        }
        Update: {
          allow_member_invites?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          industry?: string[] | null
          is_public?: boolean | null
          location?: string | null
          name?: string
          owner_user_id?: string | null
          require_post_approval?: boolean | null
          rules?: string | null
        }
        Relationships: []
      }
      hidden_posts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hidden_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hiring_application_events: {
        Row: {
          actor_profile_id: string | null
          actor_user_id: string | null
          application_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["application_event_type"]
          from_stage: Database["public"]["Enums"]["application_stage"] | null
          id: string
          metadata: Json
          to_stage: Database["public"]["Enums"]["application_stage"] | null
        }
        Insert: {
          actor_profile_id?: string | null
          actor_user_id?: string | null
          application_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["application_event_type"]
          from_stage?: Database["public"]["Enums"]["application_stage"] | null
          id?: string
          metadata?: Json
          to_stage?: Database["public"]["Enums"]["application_stage"] | null
        }
        Update: {
          actor_profile_id?: string | null
          actor_user_id?: string | null
          application_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["application_event_type"]
          from_stage?: Database["public"]["Enums"]["application_stage"] | null
          id?: string
          metadata?: Json
          to_stage?: Database["public"]["Enums"]["application_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "hiring_application_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "hiring_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications_legacy"
            referencedColumns: ["id"]
          },
        ]
      }
      hiring_applications: {
        Row: {
          candidate_profile_id: string
          candidate_user_id: string
          cover_note: string | null
          created_at: string
          current_stage: Database["public"]["Enums"]["application_stage"]
          id: string
          job_id: string
          rejection_reason: string | null
          resume_id: string | null
          source: string | null
          stage_updated_at: string
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          candidate_profile_id: string
          candidate_user_id: string
          cover_note?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["application_stage"]
          id?: string
          job_id: string
          rejection_reason?: string | null
          resume_id?: string | null
          source?: string | null
          stage_updated_at?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          candidate_profile_id?: string
          candidate_user_id?: string
          cover_note?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["application_stage"]
          id?: string
          job_id?: string
          rejection_reason?: string | null
          resume_id?: string | null
          source?: string | null
          stage_updated_at?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hiring_applications_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_applications_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      hiring_interview_rounds: {
        Row: {
          application_id: string
          created_at: string
          created_by_user_id: string | null
          duration_minutes: number | null
          feedback_score: number | null
          feedback_text: string | null
          id: string
          interviewer_profile_id: string | null
          interviewer_user_id: string | null
          meeting_link: string | null
          round_no: number
          round_type: Database["public"]["Enums"]["interview_round_type"]
          scheduled_at: string | null
          status: Database["public"]["Enums"]["interview_round_status"]
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by_user_id?: string | null
          duration_minutes?: number | null
          feedback_score?: number | null
          feedback_text?: string | null
          id?: string
          interviewer_profile_id?: string | null
          interviewer_user_id?: string | null
          meeting_link?: string | null
          round_no: number
          round_type: Database["public"]["Enums"]["interview_round_type"]
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_round_status"]
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by_user_id?: string | null
          duration_minutes?: number | null
          feedback_score?: number | null
          feedback_text?: string | null
          id?: string
          interviewer_profile_id?: string | null
          interviewer_user_id?: string | null
          meeting_link?: string | null
          round_no?: number
          round_type?: Database["public"]["Enums"]["interview_round_type"]
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_round_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hiring_interview_rounds_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_interview_rounds_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "hiring_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_interview_rounds_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_interview_rounds_interviewer_profile_id_fkey"
            columns: ["interviewer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hiring_match_scores: {
        Row: {
          candidate_profile_id: string
          candidate_user_id: string
          computed_at: string
          explanation: Json
          id: string
          job_id: string
          matched_skills: Json
          missing_skills: Json
          score: number
        }
        Insert: {
          candidate_profile_id: string
          candidate_user_id: string
          computed_at?: string
          explanation?: Json
          id?: string
          job_id: string
          matched_skills?: Json
          missing_skills?: Json
          score: number
        }
        Update: {
          candidate_profile_id?: string
          candidate_user_id?: string
          computed_at?: string
          explanation?: Json
          id?: string
          job_id?: string
          matched_skills?: Json
          missing_skills?: Json
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "hiring_match_scores_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_match_scores_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      hiring_offers: {
        Row: {
          accepted_at: string | null
          application_id: string
          base_salary: number | null
          bonus: number | null
          created_at: string
          currency: string
          decline_reason: string | null
          declined_at: string | null
          equity: string | null
          expires_at: string | null
          extended_by_user_id: string | null
          id: string
          offer_letter_url: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["offer_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          application_id: string
          base_salary?: number | null
          bonus?: number | null
          created_at?: string
          currency?: string
          decline_reason?: string | null
          declined_at?: string | null
          equity?: string | null
          expires_at?: string | null
          extended_by_user_id?: string | null
          id?: string
          offer_letter_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          application_id?: string
          base_salary?: number | null
          bonus?: number | null
          created_at?: string
          currency?: string
          decline_reason?: string | null
          declined_at?: string | null
          equity?: string | null
          expires_at?: string | null
          extended_by_user_id?: string | null
          id?: string
          offer_letter_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hiring_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "hiring_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "job_applications_legacy"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          interviewee_id: string | null
          interviewer_id: string | null
          meeting_link: string | null
          notes: string | null
          scheduled_at: string
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          interviewee_id?: string | null
          interviewer_id?: string | null
          meeting_link?: string | null
          notes?: string | null
          scheduled_at: string
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          interviewee_id?: string | null
          interviewer_id?: string | null
          meeting_link?: string | null
          notes?: string | null
          scheduled_at?: string
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      invitation_attempts: {
        Row: {
          attempt_count: number | null
          blocked_until: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          last_attempt_at: string | null
          user_id: string | null
        }
        Insert: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          last_attempt_at?: string | null
          user_id?: string | null
        }
        Update: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          last_attempt_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          cover_note: string | null
          created_at: string | null
          id: string
          job_id: string
          resume_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          cover_note?: string | null
          created_at?: string | null
          id?: string
          job_id: string
          resume_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          cover_note?: string | null
          created_at?: string | null
          id?: string
          job_id?: string
          resume_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      job_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          job_id: string
          read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          job_id: string
          read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          job_id?: string
          read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      job_skill_requirements: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          job_id: string
          min_level: number | null
          skill_name: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          job_id: string
          min_level?: number | null
          skill_name: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          job_id?: string
          min_level?: number | null
          skill_name?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_skill_requirements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          apply_link: string | null
          company_id: string | null
          company_name: string | null
          currency: string | null
          description: string | null
          employment_type: string | null
          expires_at: string | null
          id: string
          location: string | null
          posted_at: string
          posted_by: string | null
          posted_by_profile_id: string | null
          posted_by_user_id: string | null
          remote_option: string | null
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          status: string
          title: string
        }
        Insert: {
          apply_link?: string | null
          company_id?: string | null
          company_name?: string | null
          currency?: string | null
          description?: string | null
          employment_type?: string | null
          expires_at?: string | null
          id?: string
          location?: string | null
          posted_at?: string
          posted_by?: string | null
          posted_by_profile_id?: string | null
          posted_by_user_id?: string | null
          remote_option?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          title: string
        }
        Update: {
          apply_link?: string | null
          company_id?: string | null
          company_name?: string | null
          currency?: string | null
          description?: string | null
          employment_type?: string | null
          expires_at?: string | null
          id?: string
          location?: string | null
          posted_at?: string
          posted_by?: string | null
          posted_by_profile_id?: string | null
          posted_by_user_id?: string | null
          remote_option?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_posted_by_profile_id_fkey"
            columns: ["posted_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          is_read: boolean | null
          message_type: string | null
          sender_id: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          payload: Json | null
          read: boolean | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          payload?: Json | null
          read?: boolean | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          payload?: Json | null
          read?: boolean | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          acted_as: string
          company_id: string | null
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          acted_as?: string
          company_id?: string | null
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          acted_as?: string
          company_id?: string | null
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_notifications_enabled: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_notifications_enabled_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_notifications_enabled_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reason: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          company_id: string | null
          company_logo: string | null
          company_name: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          media_type: string | null
          posted_as: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          company_logo?: string | null
          company_name?: string | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          media_type?: string | null
          posted_as?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          company_logo?: string | null
          company_name?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          media_type?: string | null
          posted_as?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_profiles_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profile_views: {
        Row: {
          id: string
          viewed_at: string | null
          viewed_profile_id: string
          viewer_id: string
        }
        Insert: {
          id?: string
          viewed_at?: string | null
          viewed_profile_id: string
          viewer_id: string
        }
        Update: {
          id?: string
          viewed_at?: string | null
          viewed_profile_id?: string
          viewer_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          achievements: Json | null
          address: string | null
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          display_name: string | null
          education: Json | null
          email: string | null
          expected_salary: string | null
          experience: Json | null
          full_name: string | null
          github_url: string | null
          id: string
          job_type: string[] | null
          linkedin_url: string | null
          location: string | null
          notice_period: string | null
          open_to_roles: string[] | null
          open_to_work: boolean | null
          open_to_work_visibility: string | null
          phone: string | null
          photo_url: string | null
          preferences: Json | null
          preferred_locations: string[] | null
          profession: string | null
          profile_visibility: string | null
          projects: Json | null
          skills: string[] | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          achievements?: Json | null
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          education?: Json | null
          email?: string | null
          expected_salary?: string | null
          experience?: Json | null
          full_name?: string | null
          github_url?: string | null
          id?: string
          job_type?: string[] | null
          linkedin_url?: string | null
          location?: string | null
          notice_period?: string | null
          open_to_roles?: string[] | null
          open_to_work?: boolean | null
          open_to_work_visibility?: string | null
          phone?: string | null
          photo_url?: string | null
          preferences?: Json | null
          preferred_locations?: string[] | null
          profession?: string | null
          profile_visibility?: string | null
          projects?: Json | null
          skills?: string[] | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          achievements?: Json | null
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          education?: Json | null
          email?: string | null
          expected_salary?: string | null
          experience?: Json | null
          full_name?: string | null
          github_url?: string | null
          id?: string
          job_type?: string[] | null
          linkedin_url?: string | null
          location?: string | null
          notice_period?: string | null
          open_to_roles?: string[] | null
          open_to_work?: boolean | null
          open_to_work_visibility?: string | null
          phone?: string | null
          photo_url?: string | null
          preferences?: Json | null
          preferred_locations?: string[] | null
          profession?: string | null
          profile_visibility?: string | null
          projects?: Json | null
          skills?: string[] | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      resumes: {
        Row: {
          content: Json
          created_at: string
          id: string
          pdf_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          pdf_url?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          pdf_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_endorsements: {
        Row: {
          created_at: string
          endorsed_user_id: string
          endorser_id: string
          id: string
          skill_id: string
        }
        Insert: {
          created_at?: string
          endorsed_user_id: string
          endorser_id: string
          id?: string
          skill_id: string
        }
        Update: {
          created_at?: string
          endorsed_user_id?: string
          endorser_id?: string
          id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_endorsements_endorsed_user_id_fkey"
            columns: ["endorsed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_endorsements_endorser_id_fkey"
            columns: ["endorser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_endorsements_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          created_at: string
          id: string
          proficiency: Database["public"]["Enums"]["proficiency_level"] | null
          skill_name: string
          user_id: string
          years_of_experience: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          proficiency?: Database["public"]["Enums"]["proficiency_level"] | null
          skill_name: string
          user_id: string
          years_of_experience?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          proficiency?: Database["public"]["Enums"]["proficiency_level"] | null
          skill_name?: string
          user_id?: string
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snoozed_users: {
        Row: {
          created_at: string
          id: string
          snoozed_until: string
          snoozed_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          snoozed_until: string
          snoozed_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          snoozed_until?: string
          snoozed_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "snoozed_users_snoozed_user_id_fkey"
            columns: ["snoozed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snoozed_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          media_type: string | null
          media_url: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          media_type?: string | null
          media_url: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string
          user_id?: string | null
        }
        Relationships: []
      }
      story_views: {
        Row: {
          id: string
          story_id: string | null
          viewed_at: string | null
          viewer_id: string | null
        }
        Insert: {
          id?: string
          story_id?: string | null
          viewed_at?: string | null
          viewer_id?: string | null
        }
        Update: {
          id?: string
          story_id?: string | null
          viewed_at?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          ends_at: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          ends_at?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          ends_at?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feed_preferences: {
        Row: {
          created_at: string
          id: string
          interested_posts: string[] | null
          not_interested_posts: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interested_posts?: string[] | null
          not_interested_posts?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interested_posts?: string[] | null
          not_interested_posts?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feed_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      applications_legacy: {
        Row: {
          applied_at: string | null
          cover_letter: string | null
          id: string | null
          job_id: string | null
          resume_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          applied_at?: string | null
          cover_letter?: string | null
          id?: string | null
          job_id?: string | null
          resume_id?: string | null
          status?: never
          user_id?: string | null
        }
        Update: {
          applied_at?: string | null
          cover_letter?: string | null
          id?: string | null
          job_id?: string | null
          resume_id?: string | null
          status?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hiring_applications_candidate_profile_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_applications_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications_legacy: {
        Row: {
          cover_note: string | null
          created_at: string | null
          id: string | null
          job_id: string | null
          resume_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          cover_note?: string | null
          created_at?: string | null
          id?: string | null
          job_id?: string | null
          resume_id?: string | null
          status?: never
          user_id?: string | null
        }
        Update: {
          cover_note?: string | null
          created_at?: string | null
          id?: string | null
          job_id?: string | null
          resume_id?: string | null
          status?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hiring_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_applications_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_company_invitation: {
        Args: { invitation_id: string }
        Returns: boolean
      }
      accept_company_invitation_v2: {
        Args: { invitation_id: string; token_input: string }
        Returns: Json
      }
      accept_offer: {
        Args: {
          p_accept: boolean
          p_decline_reason?: string
          p_offer_id: string
        }
        Returns: undefined
      }
      apply_to_job: {
        Args: { p_cover_note?: string; p_job_id: string; p_resume_id?: string }
        Returns: string
      }
      compute_match_score: {
        Args: { p_candidate_profile_id: string; p_job_id: string }
        Returns: number
      }
      create_company_invitation: {
        Args: {
          company_id: string
          email: string
          role: Database["public"]["Enums"]["company_role"]
        }
        Returns: string
      }
      create_offer: {
        Args: {
          p_application_id: string
          p_base_salary: number
          p_bonus?: number
          p_currency?: string
          p_equity?: string
          p_expires_at?: string
          p_offer_letter_url?: string
          p_start_date?: string
        }
        Returns: string
      }
      current_profile_id: { Args: never; Returns: string }
      get_company_follower_count: {
        Args: { company_uuid: string }
        Returns: number
      }
      get_company_member_count: {
        Args: { company_uuid: string }
        Returns: number
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_token: { Args: { token_input: string }; Returns: string }
      is_company_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_member_safe: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_recruiter: { Args: { _company_id: string }; Returns: boolean }
      is_job_recruiter: { Args: { _job_id: string }; Returns: boolean }
      schedule_interview_round: {
        Args: {
          p_application_id: string
          p_duration_minutes: number
          p_meeting_link?: string
          p_round_type: Database["public"]["Enums"]["interview_round_type"]
          p_scheduled_at: string
        }
        Returns: string
      }
      search_candidates: {
        Args: {
          p_company_id: string
          p_limit?: number
          p_location?: string
          p_offset?: number
          p_query?: string
          p_required_skills?: string[]
        }
        Returns: {
          full_name: string
          headline: string
          location: string
          profile_id: string
          skills: string[]
          years_experience: number
        }[]
      }
      update_application_stage: {
        Args: {
          p_application_id: string
          p_new_stage: Database["public"]["Enums"]["application_stage"]
          p_reason?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "user"
        | "admin"
        | "recruiter"
        | "student"
        | "employer"
        | "company_admin"
        | "company_employee"
        | "mentor"
      application_event_type:
        | "created"
        | "stage_changed"
        | "note_added"
        | "interview_scheduled"
        | "interview_feedback_submitted"
        | "offer_created"
        | "offer_accepted"
        | "offer_declined"
        | "withdrawn"
      application_stage:
        | "applied"
        | "screening"
        | "shortlisted"
        | "interview_scheduled"
        | "interview_completed"
        | "offer_extended"
        | "offer_accepted"
        | "offer_declined"
        | "hired"
        | "rejected"
        | "withdrawn"
      application_status:
        | "applied"
        | "shortlisted"
        | "interview"
        | "offered"
        | "rejected"
        | "withdrawn"
      company_role: "super_admin" | "content_admin"
      connection_status: "pending" | "accepted" | "blocked"
      friend_request_status: "pending" | "accepted" | "rejected"
      interview_round_status:
        | "scheduled"
        | "completed"
        | "cancelled"
        | "no_show"
      interview_round_type:
        | "recruiter_screen"
        | "hiring_manager"
        | "technical"
        | "panel"
        | "culture"
        | "executive"
      offer_status:
        | "draft"
        | "extended"
        | "accepted"
        | "declined"
        | "expired"
        | "cancelled"
      proficiency_level: "beginner" | "intermediate" | "advanced" | "expert"
      subscription_plan: "free" | "pro" | "team"
      subscription_status: "active" | "past_due" | "canceled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "user",
        "admin",
        "recruiter",
        "student",
        "employer",
        "company_admin",
        "company_employee",
        "mentor",
      ],
      application_event_type: [
        "created",
        "stage_changed",
        "note_added",
        "interview_scheduled",
        "interview_feedback_submitted",
        "offer_created",
        "offer_accepted",
        "offer_declined",
        "withdrawn",
      ],
      application_stage: [
        "applied",
        "screening",
        "shortlisted",
        "interview_scheduled",
        "interview_completed",
        "offer_extended",
        "offer_accepted",
        "offer_declined",
        "hired",
        "rejected",
        "withdrawn",
      ],
      application_status: [
        "applied",
        "shortlisted",
        "interview",
        "offered",
        "rejected",
        "withdrawn",
      ],
      company_role: ["super_admin", "content_admin"],
      connection_status: ["pending", "accepted", "blocked"],
      friend_request_status: ["pending", "accepted", "rejected"],
      interview_round_status: [
        "scheduled",
        "completed",
        "cancelled",
        "no_show",
      ],
      interview_round_type: [
        "recruiter_screen",
        "hiring_manager",
        "technical",
        "panel",
        "culture",
        "executive",
      ],
      offer_status: [
        "draft",
        "extended",
        "accepted",
        "declined",
        "expired",
        "cancelled",
      ],
      proficiency_level: ["beginner", "intermediate", "advanced", "expert"],
      subscription_plan: ["free", "pro", "team"],
      subscription_status: ["active", "past_due", "canceled"],
    },
  },
} as const
