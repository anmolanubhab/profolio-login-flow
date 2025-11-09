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
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
          description: string | null
          employee_count: string | null
          founded_year: number | null
          id: string
          industry: string | null
          location: string | null
          logo_url: string | null
          name: string
          owner_id: string | null
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          employee_count?: string | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          employee_count?: string | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
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
          id: string
          is_read: boolean
          payload: Json | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          payload?: Json | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          payload?: Json | null
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
          content: string
          created_at: string
          id: string
          image_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          created_at: string
          display_name: string | null
          education: Json | null
          email: string | null
          experience: Json | null
          full_name: string | null
          github_url: string | null
          id: string
          linkedin_url: string | null
          location: string | null
          phone: string | null
          photo_url: string | null
          preferences: Json | null
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
          created_at?: string
          display_name?: string | null
          education?: Json | null
          email?: string | null
          experience?: Json | null
          full_name?: string | null
          github_url?: string | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          photo_url?: string | null
          preferences?: Json | null
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
          created_at?: string
          display_name?: string | null
          education?: Json | null
          email?: string | null
          experience?: Json | null
          full_name?: string | null
          github_url?: string | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          photo_url?: string | null
          preferences?: Json | null
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
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
      app_role: "user" | "admin" | "recruiter"
      application_status:
        | "applied"
        | "shortlisted"
        | "interview"
        | "offered"
        | "rejected"
        | "withdrawn"
      connection_status: "pending" | "accepted" | "blocked"
      friend_request_status: "pending" | "accepted" | "rejected"
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
      app_role: ["user", "admin", "recruiter"],
      application_status: [
        "applied",
        "shortlisted",
        "interview",
        "offered",
        "rejected",
        "withdrawn",
      ],
      connection_status: ["pending", "accepted", "blocked"],
      friend_request_status: ["pending", "accepted", "rejected"],
      proficiency_level: ["beginner", "intermediate", "advanced", "expert"],
      subscription_plan: ["free", "pro", "team"],
      subscription_status: ["active", "past_due", "canceled"],
    },
  },
} as const
