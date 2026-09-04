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
      ad_account_billing_state: {
        Row: {
          ad_account_id: string
          currency: string
          hold: boolean
          hold_reason: string | null
          last_charge_at: string | null
          last_charge_status: string | null
          lifetime_paid_micros: number
          outstanding_micros: number
          payment_threshold_cents: number
          test_lifetime_paid_micros: number
          test_outstanding_micros: number
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          currency: string
          hold?: boolean
          hold_reason?: string | null
          last_charge_at?: string | null
          last_charge_status?: string | null
          lifetime_paid_micros?: number
          outstanding_micros?: number
          payment_threshold_cents?: number
          test_lifetime_paid_micros?: number
          test_outstanding_micros?: number
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          currency?: string
          hold?: boolean
          hold_reason?: string | null
          last_charge_at?: string | null
          last_charge_status?: string | null
          lifetime_paid_micros?: number
          outstanding_micros?: number
          payment_threshold_cents?: number
          test_lifetime_paid_micros?: number
          test_outstanding_micros?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_account_billing_state_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: true
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_accounts: {
        Row: {
          agreement_accepted_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          name: string
          status: Database["public"]["Enums"]["ad_account_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          agreement_accepted_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["ad_account_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          agreement_accepted_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["ad_account_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_audiences: {
        Row: {
          ad_account_id: string
          created_at: string
          created_by: string | null
          estimated_reach: number | null
          estimated_reach_at: string | null
          id: string
          name: string
          spec: Json
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          created_by?: string | null
          estimated_reach?: number | null
          estimated_reach_at?: string | null
          id?: string
          name: string
          spec?: Json
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          created_by?: string | null
          estimated_reach?: number | null
          estimated_reach_at?: string | null
          id?: string
          name?: string
          spec?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_audiences_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_billing_events: {
        Row: {
          actor_user_id: string | null
          ad_account_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["ad_billing_event_type"]
          id: string
          metadata: Json
          summary: string
        }
        Insert: {
          actor_user_id?: string | null
          ad_account_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["ad_billing_event_type"]
          id?: string
          metadata?: Json
          summary: string
        }
        Update: {
          actor_user_id?: string | null
          ad_account_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["ad_billing_event_type"]
          id?: string
          metadata?: Json
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_billing_events_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_billing_ledger: {
        Row: {
          ad_account_id: string
          amount_micros: number
          balance_after_micros: number
          created_at: string
          currency: string
          entry_type: string
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          is_test: boolean
          note: string | null
          spend_event_id: string | null
          transaction_id: string | null
        }
        Insert: {
          ad_account_id: string
          amount_micros: number
          balance_after_micros: number
          created_at?: string
          currency: string
          entry_type: string
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          is_test?: boolean
          note?: string | null
          spend_event_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          ad_account_id?: string
          amount_micros?: number
          balance_after_micros?: number
          created_at?: string
          currency?: string
          entry_type?: string
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          is_test?: boolean
          note?: string | null
          spend_event_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_billing_ledger_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_billing_ledger_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ad_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_billing_ledger_spend_event_id_fkey"
            columns: ["spend_event_id"]
            isOneToOne: false
            referencedRelation: "ad_spend_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_billing_ledger_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "ad_billing_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_billing_profiles: {
        Row: {
          ad_account_id: string
          address_line1: string | null
          address_line2: string | null
          billing_contact_name: string | null
          billing_country: string | null
          billing_email: string | null
          city: string | null
          created_at: string
          created_by: string | null
          hold_reason: string | null
          id: string
          legal_name: string | null
          postal_code: string | null
          provider: Database["public"]["Enums"]["ad_payment_provider"]
          provider_customer_ref: string | null
          state_region: string | null
          status: Database["public"]["Enums"]["ad_billing_profile_status"]
          tax_id_type: string | null
          tax_id_value: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          address_line1?: string | null
          address_line2?: string | null
          billing_contact_name?: string | null
          billing_country?: string | null
          billing_email?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          hold_reason?: string | null
          id?: string
          legal_name?: string | null
          postal_code?: string | null
          provider?: Database["public"]["Enums"]["ad_payment_provider"]
          provider_customer_ref?: string | null
          state_region?: string | null
          status?: Database["public"]["Enums"]["ad_billing_profile_status"]
          tax_id_type?: string | null
          tax_id_value?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          address_line1?: string | null
          address_line2?: string | null
          billing_contact_name?: string | null
          billing_country?: string | null
          billing_email?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          hold_reason?: string | null
          id?: string
          legal_name?: string | null
          postal_code?: string | null
          provider?: Database["public"]["Enums"]["ad_payment_provider"]
          provider_customer_ref?: string | null
          state_region?: string | null
          status?: Database["public"]["Enums"]["ad_billing_profile_status"]
          tax_id_type?: string | null
          tax_id_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_billing_profiles_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: true
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_billing_transactions: {
        Row: {
          ad_account_id: string
          amount_cents: number
          client_secret_ref: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          is_test: boolean
          occurred_at: string
          parent_transaction_id: string | null
          payment_method_id: string | null
          provider: Database["public"]["Enums"]["ad_payment_provider"]
          provider_customer_ref: string | null
          provider_event_id: string | null
          provider_ref: string | null
          refunded_amount_cents: number
          settled_at: string | null
          status: Database["public"]["Enums"]["ad_billing_txn_status"]
          txn_type: Database["public"]["Enums"]["ad_billing_txn_type"]
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          amount_cents: number
          client_secret_ref?: string | null
          created_at?: string
          currency: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          is_test?: boolean
          occurred_at?: string
          parent_transaction_id?: string | null
          payment_method_id?: string | null
          provider?: Database["public"]["Enums"]["ad_payment_provider"]
          provider_customer_ref?: string | null
          provider_event_id?: string | null
          provider_ref?: string | null
          refunded_amount_cents?: number
          settled_at?: string | null
          status?: Database["public"]["Enums"]["ad_billing_txn_status"]
          txn_type: Database["public"]["Enums"]["ad_billing_txn_type"]
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          amount_cents?: number
          client_secret_ref?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          is_test?: boolean
          occurred_at?: string
          parent_transaction_id?: string | null
          payment_method_id?: string | null
          provider?: Database["public"]["Enums"]["ad_payment_provider"]
          provider_customer_ref?: string | null
          provider_event_id?: string | null
          provider_ref?: string | null
          refunded_amount_cents?: number
          settled_at?: string | null
          status?: Database["public"]["Enums"]["ad_billing_txn_status"]
          txn_type?: Database["public"]["Enums"]["ad_billing_txn_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_billing_transactions_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_billing_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ad_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_billing_transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "ad_billing_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_billing_transactions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "ad_payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_billing_webhook_events: {
        Row: {
          error: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          provider: Database["public"]["Enums"]["ad_payment_provider"]
          provider_event_id: string
          received_at: string
          signature_valid: boolean
        }
        Insert: {
          error?: string | null
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          provider: Database["public"]["Enums"]["ad_payment_provider"]
          provider_event_id: string
          received_at?: string
          signature_valid: boolean
        }
        Update: {
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["ad_payment_provider"]
          provider_event_id?: string
          received_at?: string
          signature_valid?: boolean
        }
        Relationships: []
      }
      ad_campaign_spend_daily: {
        Row: {
          ad_account_id: string
          campaign_id: string
          clicks: number
          currency: string
          day: string
          id: string
          impressions: number
          spend_micros: number
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          campaign_id: string
          clicks?: number
          currency: string
          day: string
          id?: string
          impressions?: number
          spend_micros?: number
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          campaign_id?: string
          clicks?: number
          currency?: string
          day?: string
          id?: string
          impressions?: number
          spend_micros?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaign_spend_daily_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaign_spend_daily_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_creatives: {
        Row: {
          ad_id: string
          body: string | null
          created_at: string
          cta_label: string | null
          destination_url: string | null
          format: Database["public"]["Enums"]["ad_format"]
          headline: string
          id: string
          media_type: string | null
          media_url: string | null
          updated_at: string
        }
        Insert: {
          ad_id: string
          body?: string | null
          created_at?: string
          cta_label?: string | null
          destination_url?: string | null
          format?: Database["public"]["Enums"]["ad_format"]
          headline: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          updated_at?: string
        }
        Update: {
          ad_id?: string
          body?: string | null
          created_at?: string
          cta_label?: string | null
          destination_url?: string | null
          format?: Database["public"]["Enums"]["ad_format"]
          headline?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_creatives_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_daily_metrics: {
        Row: {
          ad_account_id: string
          ad_id: string
          clicks: number
          day: string
          id: string
          impressions: number
          reach: number
          spend_cents: number
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          ad_id: string
          clicks?: number
          day: string
          id?: string
          impressions?: number
          reach?: number
          spend_cents?: number
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          ad_id?: string
          clicks?: number
          day?: string
          id?: string
          impressions?: number
          reach?: number
          spend_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_daily_metrics_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_daily_metrics_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_delivery_events: {
        Row: {
          ad_account_id: string
          ad_id: string
          ad_set_id: string
          campaign_id: string
          dedup_key: string
          event_type: Database["public"]["Enums"]["ad_event_type"]
          id: string
          occurred_at: string
          placement: Database["public"]["Enums"]["ad_placement"]
          session_key: string
          viewer_profile_id: string | null
        }
        Insert: {
          ad_account_id: string
          ad_id: string
          ad_set_id: string
          campaign_id: string
          dedup_key: string
          event_type: Database["public"]["Enums"]["ad_event_type"]
          id?: string
          occurred_at?: string
          placement: Database["public"]["Enums"]["ad_placement"]
          session_key: string
          viewer_profile_id?: string | null
        }
        Update: {
          ad_account_id?: string
          ad_id?: string
          ad_set_id?: string
          campaign_id?: string
          dedup_key?: string
          event_type?: Database["public"]["Enums"]["ad_event_type"]
          id?: string
          occurred_at?: string
          placement?: Database["public"]["Enums"]["ad_placement"]
          session_key?: string
          viewer_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_delivery_events_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_delivery_events_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_delivery_events_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_delivery_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_delivery_events_viewer_profile_id_fkey"
            columns: ["viewer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_delivery_test_users: {
        Row: {
          added_at: string
          added_by: string | null
          profile_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          profile_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_delivery_test_users_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_invoices: {
        Row: {
          ad_account_id: string
          attempt_count: number
          billing_profile_snapshot: Json | null
          created_at: string
          currency: string
          due_at: string | null
          id: string
          invoice_number: string | null
          is_test: boolean
          issued_at: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          provider: Database["public"]["Enums"]["ad_payment_provider"]
          provider_customer_ref: string | null
          provider_ref: string | null
          status: Database["public"]["Enums"]["ad_invoice_status"]
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          attempt_count?: number
          billing_profile_snapshot?: Json | null
          created_at?: string
          currency: string
          due_at?: string | null
          id?: string
          invoice_number?: string | null
          is_test?: boolean
          issued_at?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          provider?: Database["public"]["Enums"]["ad_payment_provider"]
          provider_customer_ref?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["ad_invoice_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          attempt_count?: number
          billing_profile_snapshot?: Json | null
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number?: string | null
          is_test?: boolean
          issued_at?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          provider?: Database["public"]["Enums"]["ad_payment_provider"]
          provider_customer_ref?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["ad_invoice_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_invoices_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "ad_billing_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_payment_methods: {
        Row: {
          ad_account_id: string
          billing_name: string | null
          created_at: string
          created_by: string | null
          display_brand: string | null
          display_last4: string | null
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          method_type: Database["public"]["Enums"]["ad_payment_method_type"]
          provider: Database["public"]["Enums"]["ad_payment_provider"]
          provider_customer_ref: string | null
          provider_ref: string | null
          provider_setup_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          billing_name?: string | null
          created_at?: string
          created_by?: string | null
          display_brand?: string | null
          display_last4?: string | null
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          method_type?: Database["public"]["Enums"]["ad_payment_method_type"]
          provider?: Database["public"]["Enums"]["ad_payment_provider"]
          provider_customer_ref?: string | null
          provider_ref?: string | null
          provider_setup_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          billing_name?: string | null
          created_at?: string
          created_by?: string | null
          display_brand?: string | null
          display_last4?: string | null
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          method_type?: Database["public"]["Enums"]["ad_payment_method_type"]
          provider?: Database["public"]["Enums"]["ad_payment_provider"]
          provider_customer_ref?: string | null
          provider_ref?: string | null
          provider_setup_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_payment_methods_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_provider_config: {
        Row: {
          active_provider: Database["public"]["Enums"]["ad_payment_provider"]
          id: number
          notes: string | null
          test_mode: boolean
          updated_at: string
        }
        Insert: {
          active_provider?: Database["public"]["Enums"]["ad_payment_provider"]
          id?: number
          notes?: string | null
          test_mode?: boolean
          updated_at?: string
        }
        Update: {
          active_provider?: Database["public"]["Enums"]["ad_payment_provider"]
          id?: number
          notes?: string | null
          test_mode?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ad_reviews: {
        Row: {
          ad_id: string
          created_at: string
          decision: Database["public"]["Enums"]["ad_review_status"]
          id: string
          reason: string | null
          reviewer_user_id: string
        }
        Insert: {
          ad_id: string
          created_at?: string
          decision: Database["public"]["Enums"]["ad_review_status"]
          id?: string
          reason?: string | null
          reviewer_user_id?: string
        }
        Update: {
          ad_id?: string
          created_at?: string
          decision?: Database["public"]["Enums"]["ad_review_status"]
          id?: string
          reason?: string | null
          reviewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_reviews_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_sets: {
        Row: {
          audience_id: string | null
          bid_amount_cents: number | null
          bid_strategy: Database["public"]["Enums"]["ad_bid_strategy"]
          campaign_id: string
          created_at: string
          daily_budget_cents: number | null
          id: string
          name: string
          placements: Database["public"]["Enums"]["ad_placement"][]
          updated_at: string
        }
        Insert: {
          audience_id?: string | null
          bid_amount_cents?: number | null
          bid_strategy?: Database["public"]["Enums"]["ad_bid_strategy"]
          campaign_id: string
          created_at?: string
          daily_budget_cents?: number | null
          id?: string
          name: string
          placements?: Database["public"]["Enums"]["ad_placement"][]
          updated_at?: string
        }
        Update: {
          audience_id?: string | null
          bid_amount_cents?: number | null
          bid_strategy?: Database["public"]["Enums"]["ad_bid_strategy"]
          campaign_id?: string
          created_at?: string
          daily_budget_cents?: number | null
          id?: string
          name?: string
          placements?: Database["public"]["Enums"]["ad_placement"][]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_sets_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "ad_audiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_sets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_spend_events: {
        Row: {
          ad_account_id: string
          ad_id: string
          ad_set_id: string
          campaign_id: string
          chargeable: boolean
          cost_micros: number
          created_at: string
          currency: string
          delivery_event_id: string
          event_type: Database["public"]["Enums"]["ad_event_type"]
          id: string
          occurred_at: string
          rate_model: string
          unit_cost_micros: number
        }
        Insert: {
          ad_account_id: string
          ad_id: string
          ad_set_id: string
          campaign_id: string
          chargeable: boolean
          cost_micros: number
          created_at?: string
          currency: string
          delivery_event_id: string
          event_type: Database["public"]["Enums"]["ad_event_type"]
          id?: string
          occurred_at: string
          rate_model: string
          unit_cost_micros: number
        }
        Update: {
          ad_account_id?: string
          ad_id?: string
          ad_set_id?: string
          campaign_id?: string
          chargeable?: boolean
          cost_micros?: number
          created_at?: string
          currency?: string
          delivery_event_id?: string
          event_type?: Database["public"]["Enums"]["ad_event_type"]
          id?: string
          occurred_at?: string
          rate_model?: string
          unit_cost_micros?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_spend_events_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_spend_events_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_spend_events_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_spend_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_spend_events_delivery_event_id_fkey"
            columns: ["delivery_event_id"]
            isOneToOne: true
            referencedRelation: "ad_delivery_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_spend_rate_card: {
        Row: {
          default_cpm_cents: number
          id: number
          min_bid_cpc_cents: number
          min_bid_cpm_cents: number
          notes: string | null
          updated_at: string
        }
        Insert: {
          default_cpm_cents?: number
          id?: number
          min_bid_cpc_cents?: number
          min_bid_cpm_cents?: number
          notes?: string | null
          updated_at?: string
        }
        Update: {
          default_cpm_cents?: number
          id?: number
          min_bid_cpc_cents?: number
          min_bid_cpm_cents?: number
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ads: {
        Row: {
          ad_set_id: string
          created_at: string
          id: string
          name: string
          review_status: Database["public"]["Enums"]["ad_review_status"]
          status: string
          updated_at: string
        }
        Insert: {
          ad_set_id: string
          created_at?: string
          id?: string
          name: string
          review_status?: Database["public"]["Enums"]["ad_review_status"]
          status?: string
          updated_at?: string
        }
        Update: {
          ad_set_id?: string
          created_at?: string
          id?: string
          name?: string
          review_status?: Database["public"]["Enums"]["ad_review_status"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
        ]
      }
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
      blocked_companies: {
        Row: {
          blocked_company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          blocked_company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          blocked_company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_companies_blocked_company_id_fkey"
            columns: ["blocked_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_companies_user_id_fkey"
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
      campaigns: {
        Row: {
          activated_at: string | null
          ad_account_id: string
          created_at: string
          created_by: string | null
          daily_budget_cents: number | null
          end_at: string | null
          id: string
          name: string
          objective: Database["public"]["Enums"]["campaign_objective"]
          reviewed_at: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          submitted_at: string | null
          total_budget_cents: number
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          ad_account_id: string
          created_at?: string
          created_by?: string | null
          daily_budget_cents?: number | null
          end_at?: string | null
          id?: string
          name: string
          objective: Database["public"]["Enums"]["campaign_objective"]
          reviewed_at?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          submitted_at?: string | null
          total_budget_cents?: number
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          ad_account_id?: string
          created_at?: string
          created_by?: string | null
          daily_budget_cents?: number | null
          end_at?: string | null
          id?: string
          name?: string
          objective?: Database["public"]["Enums"]["campaign_objective"]
          reviewed_at?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          submitted_at?: string | null
          total_budget_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
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
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reaction_type: Database["public"]["Enums"]["reaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reaction_type?: Database["public"]["Enums"]["reaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reaction_type?: Database["public"]["Enums"]["reaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          acted_as: string
          company_id: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_edited: boolean
          parent_comment_id: string | null
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
          image_url?: string | null
          is_edited?: boolean
          parent_comment_id?: string | null
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
          image_url?: string | null
          is_edited?: boolean
          parent_comment_id?: string | null
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
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
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
          cover_image_url: string | null
          created_at: string
          culture: string | null
          description: string | null
          employee_count: string | null
          founded_year: number | null
          headquarters: string | null
          id: string
          industry: string | null
          location: string | null
          logo_url: string | null
          name: string
          owner_id: string | null
          owner_profile_id: string | null
          specialties: string[] | null
          tagline: string | null
          values: string[] | null
          website: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          culture?: string | null
          description?: string | null
          employee_count?: string | null
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          owner_profile_id?: string | null
          specialties?: string[] | null
          tagline?: string | null
          values?: string[] | null
          website?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          culture?: string | null
          description?: string | null
          employee_count?: string | null
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          owner_profile_id?: string | null
          specialties?: string[] | null
          tagline?: string | null
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
          is_recruiter: boolean
          role: Database["public"]["Enums"]["company_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_recruiter?: boolean
          role?: Database["public"]["Enums"]["company_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_recruiter?: boolean
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
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
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
      dismissed_suggested_posts: {
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
            foreignKeyName: "dismissed_suggested_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dismissed_suggested_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dismissed_suggestions: {
        Row: {
          created_at: string
          dismissed_profile_id: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          dismissed_profile_id: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          dismissed_profile_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dismissed_suggestions_dismissed_profile_id_fkey"
            columns: ["dismissed_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dismissed_suggestions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      event_attendees: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          external_url: string | null
          id: string
          is_online: boolean
          location: string | null
          organizer_user_id: string
          starts_at: string
          title: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          external_url?: string | null
          id?: string
          is_online?: boolean
          location?: string | null
          organizer_user_id?: string
          starts_at: string
          title: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          external_url?: string | null
          id?: string
          is_online?: boolean
          location?: string | null
          organizer_user_id?: string
          starts_at?: string
          title?: string
        }
        Relationships: []
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
          message: string | null
          receiver_id: string
          sender_id: string
          status: Database["public"]["Enums"]["friend_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id: string
          sender_id: string
          status?: Database["public"]["Enums"]["friend_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
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
          resume_file_path: string | null
          resume_id: string | null
          resume_sharing_revoked: boolean
          resume_snapshot: Json | null
          resume_snapshot_created_at: string | null
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
          resume_file_path?: string | null
          resume_id?: string | null
          resume_sharing_revoked?: boolean
          resume_snapshot?: Json | null
          resume_snapshot_created_at?: string | null
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
          resume_file_path?: string | null
          resume_id?: string | null
          resume_sharing_revoked?: boolean
          resume_snapshot?: Json | null
          resume_snapshot_created_at?: string | null
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
      hiring_interview_feedback: {
        Row: {
          communication: number | null
          created_at: string
          id: string
          overall: number | null
          panelist_profile_id: string | null
          panelist_user_id: string
          private_notes: string | null
          problem_solving: number | null
          recommendation:
            | Database["public"]["Enums"]["interview_recommendation"]
            | null
          round_id: string
          technical_skill: number | null
          updated_at: string
        }
        Insert: {
          communication?: number | null
          created_at?: string
          id?: string
          overall?: number | null
          panelist_profile_id?: string | null
          panelist_user_id: string
          private_notes?: string | null
          problem_solving?: number | null
          recommendation?:
            | Database["public"]["Enums"]["interview_recommendation"]
            | null
          round_id: string
          technical_skill?: number | null
          updated_at?: string
        }
        Update: {
          communication?: number | null
          created_at?: string
          id?: string
          overall?: number | null
          panelist_profile_id?: string | null
          panelist_user_id?: string
          private_notes?: string | null
          problem_solving?: number | null
          recommendation?:
            | Database["public"]["Enums"]["interview_recommendation"]
            | null
          round_id?: string
          technical_skill?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hiring_interview_feedback_panelist_profile_id_fkey"
            columns: ["panelist_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_interview_feedback_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "hiring_interview_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      hiring_interview_panelists: {
        Row: {
          created_at: string
          id: string
          panel_role: string | null
          profile_id: string | null
          round_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          panel_role?: string | null
          profile_id?: string | null
          round_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          panel_role?: string | null
          profile_id?: string | null
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hiring_interview_panelists_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_interview_panelists_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "hiring_interview_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      hiring_interview_rounds: {
        Row: {
          application_id: string
          created_at: string
          created_by_user_id: string | null
          description: string | null
          duration_minutes: number | null
          feedback_score: number | null
          feedback_text: string | null
          id: string
          interviewer_profile_id: string | null
          interviewer_user_id: string | null
          meeting_link: string | null
          mode: Database["public"]["Enums"]["interview_mode"]
          provider: Database["public"]["Enums"]["meeting_provider"] | null
          round_no: number
          round_type: Database["public"]["Enums"]["interview_round_type"]
          scheduled_at: string | null
          status: Database["public"]["Enums"]["interview_round_status"]
          timezone: string
          title: string | null
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          feedback_score?: number | null
          feedback_text?: string | null
          id?: string
          interviewer_profile_id?: string | null
          interviewer_user_id?: string | null
          meeting_link?: string | null
          mode?: Database["public"]["Enums"]["interview_mode"]
          provider?: Database["public"]["Enums"]["meeting_provider"] | null
          round_no: number
          round_type: Database["public"]["Enums"]["interview_round_type"]
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_round_status"]
          timezone?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          feedback_score?: number | null
          feedback_text?: string | null
          id?: string
          interviewer_profile_id?: string | null
          interviewer_user_id?: string | null
          meeting_link?: string | null
          mode?: Database["public"]["Enums"]["interview_mode"]
          provider?: Database["public"]["Enums"]["meeting_provider"] | null
          round_no?: number
          round_type?: Database["public"]["Enums"]["interview_round_type"]
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_round_status"]
          timezone?: string
          title?: string | null
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
      insight_articles: {
        Row: {
          author_id: string
          body: Json
          body_html: string | null
          cover_url: string | null
          created_at: string
          id: string
          insight_id: string
          published_at: string | null
          reading_minutes: number | null
          slug: string
          status: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: Json
          body_html?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          insight_id: string
          published_at?: string | null
          reading_minutes?: number | null
          slug: string
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: Json
          body_html?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          insight_id?: string
          published_at?: string | null
          reading_minutes?: number | null
          slug?: string
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insight_articles_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "insights"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_subscriptions: {
        Row: {
          created_at: string
          id: string
          insight_id: string
          subscriber_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          insight_id: string
          subscriber_id: string
        }
        Update: {
          created_at?: string
          id?: string
          insight_id?: string
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_subscriptions_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insight_subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          owner_id: string
          published_at: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id: string
          published_at?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_owner_id_fkey"
            columns: ["owner_id"]
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
      languages: {
        Row: {
          created_at: string
          id: string
          name: string
          proficiency: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          proficiency: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          proficiency?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "languages_user_id_fkey"
            columns: ["user_id"]
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
          file_size: number | null
          file_url: string | null
          id: string
          is_read: boolean | null
          message_type: string | null
          metadata: Json | null
          mime_type: string | null
          sender_id: string | null
          story_id: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          metadata?: Json | null
          mime_type?: string | null
          sender_id?: string | null
          story_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          metadata?: Json | null
          mime_type?: string | null
          sender_id?: string | null
          story_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          used_session_id: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          used_session_id?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          used_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfa_recovery_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      muted_story_authors: {
        Row: {
          created_at: string
          id: string
          muted_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          muted_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          muted_user_id?: string
          user_id?: string
        }
        Relationships: []
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
      poll_options: {
        Row: {
          id: string
          option_text: string
          poll_id: string
          position: number
        }
        Insert: {
          id?: string
          option_text: string
          poll_id: string
          position?: number
        }
        Update: {
          id?: string
          option_text?: string
          poll_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          id: string
          post_id: string
          question: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          question: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
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
      post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: Database["public"]["Enums"]["reaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type: Database["public"]["Enums"]["reaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: Database["public"]["Enums"]["reaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
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
          description: string | null
          id: string
          post_id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          post_id: string
          reason: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
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
      post_reposts: {
        Row: {
          commentary: string | null
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          commentary?: string | null
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          commentary?: string | null
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reposts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          carousel_urls: string[] | null
          company_id: string | null
          company_logo: string | null
          company_name: string | null
          content: string
          created_at: string
          cta_enabled: boolean
          cta_label: string | null
          cta_open_new_tab: boolean
          cta_url: string | null
          document_name: string | null
          document_url: string | null
          id: string
          image_url: string | null
          insight_article_id: string | null
          media_type: string | null
          post_type: string
          posted_as: string
          status: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          carousel_urls?: string[] | null
          company_id?: string | null
          company_logo?: string | null
          company_name?: string | null
          content: string
          created_at?: string
          cta_enabled?: boolean
          cta_label?: string | null
          cta_open_new_tab?: boolean
          cta_url?: string | null
          document_name?: string | null
          document_url?: string | null
          id?: string
          image_url?: string | null
          insight_article_id?: string | null
          media_type?: string | null
          post_type?: string
          posted_as?: string
          status?: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          carousel_urls?: string[] | null
          company_id?: string | null
          company_logo?: string | null
          company_name?: string | null
          content?: string
          created_at?: string
          cta_enabled?: boolean
          cta_label?: string | null
          cta_open_new_tab?: boolean
          cta_url?: string | null
          document_name?: string | null
          document_url?: string | null
          id?: string
          image_url?: string | null
          insight_article_id?: string | null
          media_type?: string | null
          post_type?: string
          posted_as?: string
          status?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
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
            foreignKeyName: "posts_insight_article_id_fkey"
            columns: ["insight_article_id"]
            isOneToOne: false
            referencedRelation: "insight_articles"
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
      professional_resources: {
        Row: {
          created_at: string
          id: string
          label: string | null
          profile_id: string
          resource_type: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          profile_id: string
          resource_type: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          profile_id?: string
          resource_type?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_resources_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reported_profile_id: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reported_profile_id: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reported_profile_id?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_reports_reported_profile_id_fkey"
            columns: ["reported_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
          allow_recruiter_profile_view: boolean
          allow_recruiter_search: boolean
          autoplay_videos: boolean
          avatar_url: string | null
          bio: string | null
          connections_visibility: string
          cover_position: number
          cover_url: string | null
          created_at: string
          display_name: string | null
          education: Json | null
          email: string | null
          email_visibility: string
          expected_salary: string | null
          experience: Json | null
          full_name: string | null
          github_url: string | null
          headline: string | null
          id: string
          job_type: string[] | null
          last_active_at: string | null
          last_name_visibility: string
          linkedin_url: string | null
          location: string | null
          notice_period: string | null
          open_to_roles: string[] | null
          open_to_work: boolean | null
          open_to_work_visibility: string | null
          phone: string | null
          phone_visibility: string
          photo_url: string | null
          photo_visibility: string
          preferences: Json | null
          preferred_locations: string[] | null
          profession: string | null
          profile_discovery: boolean
          profile_visibility: string | null
          projects: Json | null
          pronouns: string | null
          share_online_resume_with_recruiters: boolean
          share_pdf_resume_with_recruiters: boolean
          share_professional_links_with_recruiters: boolean
          skills: string[] | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          achievements?: Json | null
          address?: string | null
          allow_recruiter_profile_view?: boolean
          allow_recruiter_search?: boolean
          autoplay_videos?: boolean
          avatar_url?: string | null
          bio?: string | null
          connections_visibility?: string
          cover_position?: number
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          education?: Json | null
          email?: string | null
          email_visibility?: string
          expected_salary?: string | null
          experience?: Json | null
          full_name?: string | null
          github_url?: string | null
          headline?: string | null
          id?: string
          job_type?: string[] | null
          last_active_at?: string | null
          last_name_visibility?: string
          linkedin_url?: string | null
          location?: string | null
          notice_period?: string | null
          open_to_roles?: string[] | null
          open_to_work?: boolean | null
          open_to_work_visibility?: string | null
          phone?: string | null
          phone_visibility?: string
          photo_url?: string | null
          photo_visibility?: string
          preferences?: Json | null
          preferred_locations?: string[] | null
          profession?: string | null
          profile_discovery?: boolean
          profile_visibility?: string | null
          projects?: Json | null
          pronouns?: string | null
          share_online_resume_with_recruiters?: boolean
          share_pdf_resume_with_recruiters?: boolean
          share_professional_links_with_recruiters?: boolean
          skills?: string[] | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          achievements?: Json | null
          address?: string | null
          allow_recruiter_profile_view?: boolean
          allow_recruiter_search?: boolean
          autoplay_videos?: boolean
          avatar_url?: string | null
          bio?: string | null
          connections_visibility?: string
          cover_position?: number
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          education?: Json | null
          email?: string | null
          email_visibility?: string
          expected_salary?: string | null
          experience?: Json | null
          full_name?: string | null
          github_url?: string | null
          headline?: string | null
          id?: string
          job_type?: string[] | null
          last_active_at?: string | null
          last_name_visibility?: string
          linkedin_url?: string | null
          location?: string | null
          notice_period?: string | null
          open_to_roles?: string[] | null
          open_to_work?: boolean | null
          open_to_work_visibility?: string | null
          phone?: string | null
          phone_visibility?: string
          photo_url?: string | null
          photo_visibility?: string
          preferences?: Json | null
          preferred_locations?: string[] | null
          profession?: string | null
          profile_discovery?: boolean
          profile_visibility?: string | null
          projects?: Json | null
          pronouns?: string | null
          share_online_resume_with_recruiters?: boolean
          share_pdf_resume_with_recruiters?: boolean
          share_professional_links_with_recruiters?: boolean
          skills?: string[] | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          action: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          user_id?: string
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
      saved_jobs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
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
      snoozed_companies: {
        Row: {
          created_at: string
          id: string
          snoozed_company_id: string
          snoozed_until: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          snoozed_company_id: string
          snoozed_until: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          snoozed_company_id?: string
          snoozed_until?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "snoozed_companies_snoozed_company_id_fkey"
            columns: ["snoozed_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snoozed_companies_user_id_fkey"
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
          ai_label: boolean
          alt_text: string | null
          alt_text_source: string
          background: Json | null
          caption: string | null
          created_at: string | null
          duration_ms: number | null
          expires_at: string | null
          font_style: string | null
          id: string
          is_archived: boolean
          kind: string
          media_height: number | null
          media_type: string | null
          media_url: string | null
          media_width: number | null
          music: Json | null
          overlays: Json
          privacy: string
          thumbnail_url: string | null
          trim: Json | null
          user_id: string | null
        }
        Insert: {
          ai_label?: boolean
          alt_text?: string | null
          alt_text_source?: string
          background?: Json | null
          caption?: string | null
          created_at?: string | null
          duration_ms?: number | null
          expires_at?: string | null
          font_style?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          media_height?: number | null
          media_type?: string | null
          media_url?: string | null
          media_width?: number | null
          music?: Json | null
          overlays?: Json
          privacy?: string
          thumbnail_url?: string | null
          trim?: Json | null
          user_id?: string | null
        }
        Update: {
          ai_label?: boolean
          alt_text?: string | null
          alt_text_source?: string
          background?: Json | null
          caption?: string | null
          created_at?: string | null
          duration_ms?: number | null
          expires_at?: string | null
          font_style?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          media_height?: number | null
          media_type?: string | null
          media_url?: string | null
          media_width?: number | null
          music?: Json | null
          overlays?: Json
          privacy?: string
          thumbnail_url?: string | null
          trim?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      story_audience: {
        Row: {
          created_at: string
          story_id: string
          viewer_user_id: string
        }
        Insert: {
          created_at?: string
          story_id: string
          viewer_user_id: string
        }
        Update: {
          created_at?: string
          story_id?: string
          viewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_audience_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_music_tracks: {
        Row: {
          artist: string
          audio_url: string
          cover_color: string
          created_at: string
          duration_ms: number
          genre: string | null
          id: string
          is_active: boolean
          sort_order: number
          title: string
        }
        Insert: {
          artist: string
          audio_url: string
          cover_color?: string
          created_at?: string
          duration_ms: number
          genre?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
        }
        Update: {
          artist?: string
          audio_url?: string
          cover_color?: string
          created_at?: string
          duration_ms?: number
          genre?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      story_reactions: {
        Row: {
          created_at: string
          id: string
          reaction_type: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction_type?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          reporter_id: string
          story_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reporter_id: string
          story_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reports_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_saved_music: {
        Row: {
          created_at: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_saved_music_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "story_music_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      story_settings: {
        Row: {
          archive_enabled: boolean
          default_privacy: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archive_enabled?: boolean
          default_privacy?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archive_enabled?: boolean
          default_privacy?: string
          updated_at?: string
          user_id?: string
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
      _ad_analytics_can_view: {
        Args: { _scope: string; _scope_id: string }
        Returns: boolean
      }
      _ad_analytics_events: {
        Args: { _from: string; _scope: string; _scope_id: string; _to: string }
        Returns: {
          ad_id: string
          ad_set_id: string
          campaign_id: string
          day: string
          event_type: Database["public"]["Enums"]["ad_event_type"]
          viewer_key: string
        }[]
      }
      _ad_audience_bucket: { Args: { _raw: number }; Returns: number }
      _ad_audience_count: { Args: { _spec: Json }; Returns: number }
      _ad_billing_apply_status: {
        Args: { _p: Database["public"]["Tables"]["ad_billing_profiles"]["Row"] }
        Returns: Database["public"]["Enums"]["ad_billing_profile_status"]
      }
      _ad_billing_post_ledger: {
        Args: {
          _ad_account_id: string
          _amount_micros: number
          _currency: string
          _entry_type: string
          _idempotency_key?: string
          _invoice_id?: string
          _note?: string
          _spend_event_id?: string
          _transaction_id?: string
        }
        Returns: undefined
      }
      _ad_billing_set_hold: {
        Args: { _ad_account_id: string; _hold: boolean; _reason: string }
        Returns: undefined
      }
      _ad_campaign_deliverable: {
        Args: { _campaign_id: string }
        Returns: boolean
      }
      _ad_currency_minor_units: { Args: { _currency: string }; Returns: number }
      _ad_delivery_eligible_for: {
        Args: { _ad_id: string; _me: string }
        Returns: boolean
      }
      _ad_event_cost: {
        Args: {
          _bid_amount_cents: number
          _bid_strategy: Database["public"]["Enums"]["ad_bid_strategy"]
          _kind: Database["public"]["Enums"]["ad_event_type"]
        }
        Returns: {
          rate_model: string
          unit_cost_micros: number
        }[]
      }
      _ad_get_webhook_secret: { Args: never; Returns: string }
      _ad_like_terms: { Args: { _arr: Json }; Returns: string[] }
      _ad_profile_matches_audience: {
        Args: { _profile_id: string; _spec: Json }
        Returns: boolean
      }
      _ad_profile_years_experience: {
        Args: { _profile_id: string }
        Returns: number
      }
      _ad_record_event: {
        Args: {
          _ad_id: string
          _kind: Database["public"]["Enums"]["ad_event_type"]
          _session_key: string
        }
        Returns: undefined
      }
      _ad_spend_record: {
        Args: { _delivery_event_id: string }
        Returns: undefined
      }
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
      activate_campaign: {
        Args: { _campaign_id: string }
        Returns: {
          activated_at: string | null
          ad_account_id: string
          created_at: string
          created_by: string | null
          daily_budget_cents: number | null
          end_at: string | null
          id: string
          name: string
          objective: Database["public"]["Enums"]["campaign_objective"]
          reviewed_at: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          submitted_at: string | null
          total_budget_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ad_account_billing_summary: {
        Args: { _ad_account_id: string }
        Returns: Json
      }
      ad_analytics_breakdown: {
        Args: {
          _from?: string
          _level?: string
          _scope: string
          _scope_id: string
          _to?: string
        }
        Returns: {
          clicks: number
          ctr: number
          entity_id: string
          entity_name: string
          impressions: number
          spend_micros: number
        }[]
      }
      ad_analytics_daily: {
        Args: {
          _from?: string
          _scope: string
          _scope_id: string
          _to?: string
        }
        Returns: {
          clicks: number
          day: string
          impressions: number
          spend_micros: number
        }[]
      }
      ad_analytics_summary: {
        Args: {
          _from?: string
          _scope: string
          _scope_id: string
          _to?: string
        }
        Returns: {
          clicks: number
          ctr: number
          currency: string
          first_event: string
          impressions: number
          last_event: string
          spend_micros: number
          unique_viewers: number
          unique_viewers_withheld: boolean
        }[]
      }
      ad_audience_preview_reach: {
        Args: { _ad_account_id: string; _spec: Json }
        Returns: number
      }
      ad_audience_recompute_reach: {
        Args: { _audience_id: string }
        Returns: {
          ad_account_id: string
          created_at: string
          created_by: string | null
          estimated_reach: number | null
          estimated_reach_at: string | null
          id: string
          name: string
          spec: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ad_audiences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ad_billing_apply_adjustment: {
        Args: {
          _ad_account_id: string
          _amount_cents: number
          _direction: string
          _idempotency_key: string
          _reason: string
        }
        Returns: undefined
      }
      ad_billing_apply_webhook: {
        Args: {
          _event_type: string
          _payload: Json
          _provider: Database["public"]["Enums"]["ad_payment_provider"]
          _provider_event_id: string
          _signature_valid: boolean
        }
        Returns: Json
      }
      ad_billing_claim_charge_for_intent: {
        Args: { _txn_id: string }
        Returns: boolean
      }
      ad_billing_list_stuck_transactions: {
        Args: { _older_than_minutes?: number }
        Returns: {
          ad_account_id: string
          amount_cents: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          is_test: boolean
          provider: Database["public"]["Enums"]["ad_payment_provider"]
          provider_ref: string
          status: Database["public"]["Enums"]["ad_billing_txn_status"]
        }[]
      }
      ad_billing_open_charge: {
        Args: {
          _ad_account_id: string
          _amount_cents: number
          _idempotency_key: string
          _payment_method_id?: string
        }
        Returns: {
          ad_account_id: string
          amount_cents: number
          client_secret_ref: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          is_test: boolean
          occurred_at: string
          parent_transaction_id: string | null
          payment_method_id: string | null
          provider: Database["public"]["Enums"]["ad_payment_provider"]
          provider_customer_ref: string | null
          provider_event_id: string | null
          provider_ref: string | null
          refunded_amount_cents: number
          settled_at: string | null
          status: Database["public"]["Enums"]["ad_billing_txn_status"]
          txn_type: Database["public"]["Enums"]["ad_billing_txn_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ad_billing_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ad_billing_reconciliation_check: {
        Args: { _ad_account_id?: string }
        Returns: Json
      }
      ad_billing_record_payment_method: {
        Args: {
          _ad_account_id: string
          _billing_name: string
          _brand: string
          _customer_ref: string
          _exp_month: number
          _exp_year: number
          _last4: string
          _make_default?: boolean
          _pm_ref: string
          _provider: Database["public"]["Enums"]["ad_payment_provider"]
          _setup_ref: string
        }
        Returns: {
          ad_account_id: string
          billing_name: string | null
          created_at: string
          created_by: string | null
          display_brand: string | null
          display_last4: string | null
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          method_type: Database["public"]["Enums"]["ad_payment_method_type"]
          provider: Database["public"]["Enums"]["ad_payment_provider"]
          provider_customer_ref: string | null
          provider_ref: string | null
          provider_setup_ref: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ad_payment_methods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ad_billing_resolve_pending_transaction: {
        Args: {
          _failure_reason?: string
          _provider_ref?: string
          _resolved_status: string
          _txn_id: string
        }
        Returns: Json
      }
      ad_billing_set_default_payment_method: {
        Args: { _payment_method_id: string }
        Returns: undefined
      }
      ad_billing_set_provider_customer: {
        Args: {
          _ad_account_id: string
          _customer_ref: string
          _provider: Database["public"]["Enums"]["ad_payment_provider"]
        }
        Returns: undefined
      }
      ad_campaign_budget_status: {
        Args: { _campaign_id: string }
        Returns: Json
      }
      ad_daily_metrics_is_owner: {
        Args: { _ad_account_id: string }
        Returns: boolean
      }
      ad_rebuild_daily_metrics: {
        Args: { _ad_account_id: string; _from?: string; _to?: string }
        Returns: number
      }
      ad_record_click: {
        Args: { _ad_id: string; _session_key: string }
        Returns: undefined
      }
      ad_record_impression: {
        Args: { _ad_id: string; _session_key: string }
        Returns: undefined
      }
      apply_to_job: {
        Args: { p_cover_note?: string; p_job_id: string; p_resume_id?: string }
        Returns: string
      }
      attach_audience_to_ad_set: {
        Args: { _audience_id: string; _campaign_id: string }
        Returns: {
          audience_id: string | null
          bid_amount_cents: number | null
          bid_strategy: Database["public"]["Enums"]["ad_bid_strategy"]
          campaign_id: string
          created_at: string
          daily_budget_cents: number | null
          id: string
          name: string
          placements: Database["public"]["Enums"]["ad_placement"][]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ad_sets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      broadcast_profile_update: { Args: never; Returns: undefined }
      can_view_story: {
        Args: { _author: string; _privacy: string; _story_id: string }
        Returns: boolean
      }
      cancel_interview_round: {
        Args: { p_reason?: string; p_round_id: string }
        Returns: undefined
      }
      check_and_record_rate_limit: {
        Args: {
          p_action: string
          p_max_count: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      compute_match_score: {
        Args: { p_candidate_profile_id: string; p_job_id: string }
        Returns: number
      }
      consume_mfa_recovery_code: { Args: { code: string }; Returns: boolean }
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
      create_poll_post:
        | { Args: { p_content: string; p_options: string[] }; Returns: string }
        | {
            Args: {
              p_company_id?: string
              p_company_logo?: string
              p_company_name?: string
              p_content: string
              p_options: string[]
            }
            Returns: string
          }
      current_profile_id: { Args: never; Returns: string }
      detach_audience_from_ad_set: {
        Args: { _campaign_id: string }
        Returns: {
          audience_id: string | null
          bid_amount_cents: number | null
          bid_strategy: Database["public"]["Enums"]["ad_bid_strategy"]
          campaign_id: string
          created_at: string
          daily_budget_cents: number | null
          id: string
          name: string
          placements: Database["public"]["Enums"]["ad_placement"][]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ad_sets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      feed_pick_sponsored_ad: {
        Args: { _session_key: string }
        Returns: {
          ad_id: string
          body: string
          cta_label: string
          destination_url: string
          format: Database["public"]["Enums"]["ad_format"]
          headline: string
          media_url: string
          sponsor_name: string
        }[]
      }
      follow_counts: {
        Args: never
        Returns: {
          followers_count: number
          following_count: number
        }[]
      }
      generate_mfa_recovery_codes: { Args: never; Returns: string[] }
      get_application_candidate_resources: {
        Args: { p_application_id: string }
        Returns: {
          online_resume: Json
          professional_links: Json
          status: string
        }[]
      }
      get_application_cover_note: {
        Args: { p_application_id: string }
        Returns: {
          cover_note: string
          status: string
        }[]
      }
      get_application_resume: {
        Args: { p_application_id: string }
        Returns: {
          candidate_name: string
          resume_content: Json
          resume_title: string
          status: string
        }[]
      }
      get_company_follower_count: {
        Args: { company_uuid: string }
        Returns: number
      }
      get_company_member_count: {
        Args: { company_uuid: string }
        Returns: number
      }
      get_message_attachment: {
        Args: { p_message_id: string }
        Returns: {
          status: string
          storage_path: string
        }[]
      }
      get_mfa_recovery_codes_status: {
        Args: never
        Returns: {
          generated_at: string
          remaining: number
          total_generated: number
        }[]
      }
      get_my_consent_history: {
        Args: { limit_n?: number }
        Returns: {
          id: string
          user_id: string
          signal_key: string
          old_value: Json
          new_value: Json
          source: string
          schema_version: number
          occurred_at: string
        }[]
      }
      get_my_settings: {
        Args: never
        Returns: {
          preferences: Json
          expected_salary: string
          notice_period: string
          open_to_roles: string[]
          preferred_locations: string[]
          job_type: string[]
          autoplay_videos: boolean
          allow_recruiter_search: boolean
          allow_recruiter_profile_view: boolean
          share_pdf_resume_with_recruiters: boolean
          share_online_resume_with_recruiters: boolean
          share_professional_links_with_recruiters: boolean
          email_visibility: string
          phone_visibility: string
          connections_visibility: string
          open_to_work_visibility: string
        }[]
      }
      get_or_create_campaign_ad_set: {
        Args: { _campaign_id: string }
        Returns: {
          audience_id: string | null
          bid_amount_cents: number | null
          bid_strategy: Database["public"]["Enums"]["ad_bid_strategy"]
          campaign_id: string
          created_at: string
          daily_budget_cents: number | null
          id: string
          name: string
          placements: Database["public"]["Enums"]["ad_placement"][]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ad_sets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_or_create_conversation: {
        Args: { _user_a: string; _user_b: string }
        Returns: string
      }
      get_profile_contact_info: {
        Args: { _profile_id: string }
        Returns: {
          email: string
          phone: string
        }[]
      }
      get_public_profile: {
        Args: { target_profile_id: string }
        Returns: {
          id: string
          user_id: string
          display_name: string
          full_name: string
          headline: string
          profession: string
          avatar_url: string
          photo_url: string
          cover_url: string
          cover_position: number
          bio: string
          location: string
          pronouns: string
          open_to_work: boolean
          skills: string[]
          projects: Json
          experience: Json
          education: Json
          achievements: Json
          website: string
          linkedin_url: string
          github_url: string
          twitter_url: string
          address: string
          created_at: string
          last_active_at: string
          profile_visibility: string
          photo_visibility: string
          last_name_visibility: string
          profile_discovery: boolean
          show_active_status: boolean
          has_verified_email: boolean
        }[]
      }
      get_ranked_post_comments: {
        Args: { p_limit?: number; p_offset?: number; p_post_id: string }
        Returns: {
          content: string
          created_at: string
          id: string
          image_url: string
          is_edited: boolean
          parent_comment_id: string
          post_id: string
          reaction_count: number
          relevance: number
          reply_count: number
          user_id: string
        }[]
      }
      get_recruiter_candidate_disclosure: {
        Args: { _candidate_profile_id: string; _company_id: string }
        Returns: {
          avatar_url: string
          bio: string
          certifications: string[]
          cover_url: string
          display_name: string
          education: Json
          experience: Json
          headline: string
          location: string
          open_to_work: boolean
          profile_id: string
          projects: Json
          skills: string[]
          website: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_visible_connections_count: {
        Args: { target_profile_id: string }
        Returns: number
      }
      has_active_mfa_recovery_grant: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_token: { Args: { token_input: string }; Returns: string }
      insight_subscriber_count: {
        Args: { _insight_id: string }
        Returns: number
      }
      invite_interview_round: {
        Args: {
          p_application_id: string
          p_description: string
          p_duration_minutes: number
          p_meeting_link: string
          p_mode: Database["public"]["Enums"]["interview_mode"]
          p_panelist_user_ids?: string[]
          p_provider: Database["public"]["Enums"]["meeting_provider"]
          p_round_type: Database["public"]["Enums"]["interview_round_type"]
          p_scheduled_at: string
          p_timezone: string
          p_title: string
        }
        Returns: string
      }
      is_ad_account_admin: {
        Args: { _ad_account_id: string }
        Returns: boolean
      }
      is_ad_account_billing_manager: {
        Args: { _ad_account_id: string }
        Returns: boolean
      }
      is_ad_admin: { Args: { _ad_id: string }; Returns: boolean }
      is_ad_set_admin: { Args: { _ad_set_id: string }; Returns: boolean }
      is_any_authorized_recruiter: { Args: never; Returns: boolean }
      is_authorized_search_recruiter: {
        Args: { _company_id: string }
        Returns: boolean
      }
      is_blocked_by: { Args: { target_profile_id: string }; Returns: boolean }
      is_campaign_admin: { Args: { _campaign_id: string }; Returns: boolean }
      is_company_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_member_safe: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_owner_or_super_admin: {
        Args: { _company_id: string }
        Returns: boolean
      }
      is_company_recruiter: { Args: { _company_id: string }; Returns: boolean }
      is_company_recruiter_user: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_job_recruiter: { Args: { _job_id: string }; Returns: boolean }
      list_followers: {
        Args: { lim?: number; off?: number; search?: string }
        Returns: {
          avatar_url: string
          display_name: string
          followed_at: string
          full_name: string
          headline: string
          i_follow_them: boolean
          is_connected: boolean
          last_name_visibility: string
          location: string
          mutual_count: number
          profession: string
          profile_id: string
        }[]
      }
      list_following: {
        Args: { lim?: number; off?: number; search?: string }
        Returns: {
          avatar_url: string
          display_name: string
          followed_at: string
          full_name: string
          headline: string
          is_connected: boolean
          last_name_visibility: string
          location: string
          mutual_count: number
          profession: string
          profile_id: string
          they_follow_me: boolean
        }[]
      }
      mark_interview_outcome: {
        Args: { p_outcome: string; p_round_id: string }
        Returns: undefined
      }
      mutual_connections_count: {
        Args: { other_profile_id: string }
        Returns: number
      }
      network_counts: {
        Args: never
        Returns: {
          connections_count: number
          pending_received: number
          pending_sent: number
        }[]
      }
      pause_campaign: {
        Args: { _campaign_id: string }
        Returns: {
          activated_at: string | null
          ad_account_id: string
          created_at: string
          created_by: string | null
          daily_budget_cents: number | null
          end_at: string | null
          id: string
          name: string
          objective: Database["public"]["Enums"]["campaign_objective"]
          reviewed_at: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          submitted_at: string | null
          total_budget_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      purge_expired_stories: { Args: never; Returns: number }
      remove_connection: {
        Args: { other_profile_id: string }
        Returns: boolean
      }
      reschedule_interview_round: {
        Args: {
          p_new_meeting_link?: string
          p_new_scheduled_at: string
          p_round_id: string
        }
        Returns: undefined
      }
      respond_interview_invite: {
        Args: {
          p_accept: boolean
          p_decline_reason?: string
          p_round_id: string
        }
        Returns: undefined
      }
      respond_to_connection_request: {
        Args: { accept: boolean; request_id: string }
        Returns: string
      }
      review_ad_approve: {
        Args: { _ad_id: string }
        Returns: {
          ad_set_id: string
          created_at: string
          id: string
          name: string
          review_status: Database["public"]["Enums"]["ad_review_status"]
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_ad_reject: {
        Args: { _ad_id: string; _reason: string }
        Returns: {
          ad_set_id: string
          created_at: string
          id: string
          name: string
          review_status: Database["public"]["Enums"]["ad_review_status"]
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
          open_to_work: boolean
          profile_id: string
          skills: string[]
          years_experience: number
        }[]
      }
      search_mentionable_people: {
        Args: { q: string }
        Returns: {
          id: string
          display_name: string
          avatar_url: string
          profession: string
        }[]
      }
      search_connections: {
        Args: { lim?: number; off?: number; search?: string }
        Returns: {
          avatar_url: string
          connected_at: string
          display_name: string
          full_name: string
          headline: string
          last_name_visibility: string
          location: string
          mutual_count: number
          profession: string
          profile_id: string
        }[]
      }
      search_people: {
        Args: { lim?: number; off?: number; search?: string }
        Returns: {
          avatar_url: string
          display_name: string
          full_name: string
          headline: string
          last_name_visibility: string
          location: string
          mutual_count: number
          profession: string
          profile_id: string
          relationship: string
          request_id: string
        }[]
      }
      send_connection_request: {
        Args: { note?: string; target_profile_id: string }
        Returns: string
      }
      set_ad_delivery_test_user: {
        Args: { _enabled: boolean; _profile_id: string }
        Returns: undefined
      }
      set_application_resume_sharing: {
        Args: { p_application_id: string; p_revoked: boolean }
        Returns: boolean
      }
      set_company_recruiter: {
        Args: {
          _company_id: string
          _is_recruiter: boolean
          _member_user_id: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_ad_for_review: {
        Args: { _ad_id: string }
        Returns: {
          ad_set_id: string
          created_at: string
          id: string
          name: string
          review_status: Database["public"]["Enums"]["ad_review_status"]
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_campaign_for_review: {
        Args: { _campaign_id: string }
        Returns: {
          activated_at: string | null
          ad_account_id: string
          created_at: string
          created_by: string | null
          daily_budget_cents: number | null
          end_at: string | null
          id: string
          name: string
          objective: Database["public"]["Enums"]["campaign_objective"]
          reviewed_at: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          submitted_at: string | null
          total_budget_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_interview_feedback: {
        Args: {
          p_communication: number
          p_notes?: string
          p_overall: number
          p_problem_solving: number
          p_recommendation: Database["public"]["Enums"]["interview_recommendation"]
          p_round_id: string
          p_technical: number
        }
        Returns: undefined
      }
      update_application_stage: {
        Args: {
          p_application_id: string
          p_new_stage: Database["public"]["Enums"]["application_stage"]
          p_reason?: string
        }
        Returns: undefined
      }
      update_my_preferences_patch: {
        Args: { patch: Json }
        Returns: Json
      }
      validate_campaign_budget: {
        Args: { _campaign_id: string }
        Returns: Json
      }
      withdraw_ad_submission: {
        Args: { _ad_id: string }
        Returns: {
          ad_set_id: string
          created_at: string
          id: string
          name: string
          review_status: Database["public"]["Enums"]["ad_review_status"]
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_campaign_submission: {
        Args: { _campaign_id: string }
        Returns: {
          activated_at: string | null
          ad_account_id: string
          created_at: string
          created_by: string | null
          daily_budget_cents: number | null
          end_at: string | null
          id: string
          name: string
          objective: Database["public"]["Enums"]["campaign_objective"]
          reviewed_at: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          submitted_at: string | null
          total_budget_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_connection_request: {
        Args: { request_id: string }
        Returns: boolean
      }
    }
    Enums: {
      ad_account_status: "active" | "suspended" | "closed"
      ad_bid_strategy: "auto" | "max_cpc" | "max_cpm"
      ad_billing_event_type:
        | "profile_created"
        | "profile_updated"
        | "status_changed"
        | "payment_method_added"
        | "payment_method_removed"
        | "payment_method_default_changed"
        | "provider_connected"
        | "payment_started"
        | "payment_succeeded"
        | "payment_failed"
        | "payment_requires_action"
        | "payment_canceled"
        | "payment_refunded"
        | "billing_adjustment"
        | "invoice_issued"
        | "invoice_paid"
        | "account_hold"
        | "account_hold_cleared"
      ad_billing_profile_status:
        | "setup_required"
        | "payment_method_required"
        | "ready"
        | "restricted"
      ad_billing_txn_status:
        | "pending"
        | "succeeded"
        | "failed"
        | "canceled"
        | "processing"
        | "requires_action"
        | "refunded"
        | "partially_refunded"
      ad_billing_txn_type: "charge" | "refund" | "adjustment" | "credit"
      ad_event_type: "impression" | "click"
      ad_format: "single_image" | "text" | "spotlight"
      ad_invoice_status: "draft" | "open" | "paid" | "void" | "uncollectible"
      ad_payment_method_type: "card" | "paypal" | "bank_account" | "other"
      ad_payment_provider: "none" | "stripe" | "manual" | "simulated"
      ad_placement: "right_rail" | "feed_sponsored" | "company_page"
      ad_review_status: "draft" | "pending" | "approved" | "rejected"
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
        | "interview_invited"
        | "interview_accepted"
        | "interview_declined"
        | "interview_rescheduled"
        | "interview_cancelled"
        | "interview_no_show"
        | "interview_completed"
      application_stage:
        | "applied"
        | "screening"
        | "shortlisted"
        | "interview_offered"
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
      campaign_objective:
        | "brand_awareness"
        | "profile_visits"
        | "company_page_visits"
        | "post_engagement"
        | "website_visits"
        | "job_promotion"
        | "lead_generation"
      campaign_status:
        | "draft"
        | "pending_review"
        | "approved"
        | "active"
        | "paused"
        | "completed"
        | "rejected"
      company_role: "super_admin" | "content_admin"
      connection_status: "pending" | "accepted" | "blocked"
      friend_request_status: "pending" | "accepted" | "rejected"
      interview_mode: "online" | "offline"
      interview_recommendation: "strong_hire" | "hire" | "maybe" | "reject"
      interview_round_status:
        | "scheduled"
        | "completed"
        | "cancelled"
        | "no_show"
        | "invited"
        | "declined"
      interview_round_type:
        | "recruiter_screen"
        | "hiring_manager"
        | "technical"
        | "panel"
        | "culture"
        | "executive"
      meeting_provider: "zoom" | "microsoft_teams" | "google_meet" | "other"
      offer_status:
        | "draft"
        | "extended"
        | "accepted"
        | "declined"
        | "expired"
        | "cancelled"
      proficiency_level: "beginner" | "intermediate" | "advanced" | "expert"
      reaction_type:
        | "like"
        | "celebrate"
        | "support"
        | "love"
        | "insightful"
        | "funny"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      ad_account_status: ["active", "suspended", "closed"],
      ad_bid_strategy: ["auto", "max_cpc", "max_cpm"],
      ad_billing_event_type: [
        "profile_created",
        "profile_updated",
        "status_changed",
        "payment_method_added",
        "payment_method_removed",
        "payment_method_default_changed",
        "provider_connected",
        "payment_started",
        "payment_succeeded",
        "payment_failed",
        "payment_requires_action",
        "payment_canceled",
        "payment_refunded",
        "billing_adjustment",
        "invoice_issued",
        "invoice_paid",
        "account_hold",
        "account_hold_cleared",
      ],
      ad_billing_profile_status: [
        "setup_required",
        "payment_method_required",
        "ready",
        "restricted",
      ],
      ad_billing_txn_status: [
        "pending",
        "succeeded",
        "failed",
        "canceled",
        "processing",
        "requires_action",
        "refunded",
        "partially_refunded",
      ],
      ad_billing_txn_type: ["charge", "refund", "adjustment", "credit"],
      ad_event_type: ["impression", "click"],
      ad_format: ["single_image", "text", "spotlight"],
      ad_invoice_status: ["draft", "open", "paid", "void", "uncollectible"],
      ad_payment_method_type: ["card", "paypal", "bank_account", "other"],
      ad_payment_provider: ["none", "stripe", "manual", "simulated"],
      ad_placement: ["right_rail", "feed_sponsored", "company_page"],
      ad_review_status: ["draft", "pending", "approved", "rejected"],
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
        "interview_invited",
        "interview_accepted",
        "interview_declined",
        "interview_rescheduled",
        "interview_cancelled",
        "interview_no_show",
        "interview_completed",
      ],
      application_stage: [
        "applied",
        "screening",
        "shortlisted",
        "interview_offered",
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
      campaign_objective: [
        "brand_awareness",
        "profile_visits",
        "company_page_visits",
        "post_engagement",
        "website_visits",
        "job_promotion",
        "lead_generation",
      ],
      campaign_status: [
        "draft",
        "pending_review",
        "approved",
        "active",
        "paused",
        "completed",
        "rejected",
      ],
      company_role: ["super_admin", "content_admin"],
      connection_status: ["pending", "accepted", "blocked"],
      friend_request_status: ["pending", "accepted", "rejected"],
      interview_mode: ["online", "offline"],
      interview_recommendation: ["strong_hire", "hire", "maybe", "reject"],
      interview_round_status: [
        "scheduled",
        "completed",
        "cancelled",
        "no_show",
        "invited",
        "declined",
      ],
      interview_round_type: [
        "recruiter_screen",
        "hiring_manager",
        "technical",
        "panel",
        "culture",
        "executive",
      ],
      meeting_provider: ["zoom", "microsoft_teams", "google_meet", "other"],
      offer_status: [
        "draft",
        "extended",
        "accepted",
        "declined",
        "expired",
        "cancelled",
      ],
      proficiency_level: ["beginner", "intermediate", "advanced", "expert"],
      reaction_type: [
        "like",
        "celebrate",
        "support",
        "love",
        "insightful",
        "funny",
      ],
      subscription_plan: ["free", "pro", "team"],
      subscription_status: ["active", "past_due", "canceled"],
    },
  },
} as const
