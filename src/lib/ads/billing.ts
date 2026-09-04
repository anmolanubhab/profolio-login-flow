import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

/**
 * Phase K1 — Billing Foundation (client layer).
 *
 * This establishes the billing account model. It does NOT charge money,
 * connect a payment provider, or store card/bank credentials. Payment
 * methods here hold only a tokenised provider reference plus display
 * metadata (brand / last 4 / expiry). Currency is inherited from the ad
 * account and is never set here.
 *
 * All access is gated server-side by `is_ad_account_billing_manager`
 * (company owner or super-admin). Ordinary company members and platform
 * admins do not get payment-method access.
 */

export type BillingProfile = Database['public']['Tables']['ad_billing_profiles']['Row'];
export type PaymentMethod = Database['public']['Tables']['ad_payment_methods']['Row'];
export type BillingEvent = Database['public']['Tables']['ad_billing_events']['Row'];
export type Invoice = Database['public']['Tables']['ad_invoices']['Row'];
export type BillingProfileStatus = Database['public']['Enums']['ad_billing_profile_status'];
export type PaymentMethodType = Database['public']['Enums']['ad_payment_method_type'];

export const BILLING_STATUS_META: Record<
  BillingProfileStatus,
  { label: string; tone: 'muted' | 'warning' | 'success' | 'destructive'; hint: string }
> = {
  setup_required: {
    label: 'Setup required',
    tone: 'warning',
    hint: 'Add the legal name, billing email and country to continue.',
  },
  payment_method_required: {
    label: 'Payment method required',
    tone: 'warning',
    hint: 'Billing details are complete. Add a payment method to finish setup.',
  },
  ready: {
    label: 'Ready',
    tone: 'success',
    hint: 'Billing is set up. Charging is enabled in a later phase.',
  },
  restricted: {
    label: 'Restricted',
    tone: 'destructive',
    hint: 'Billing is restricted by Profolio. Contact support.',
  },
};

/** A short ISO-3166 list covering the ad-account currencies Profolio supports. */
export const BILLING_COUNTRIES: { code: string; name: string }[] = [
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'AU', name: 'Australia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'DE', name: 'Germany' },
  { code: 'DK', name: 'Denmark' },
  { code: 'ES', name: 'Spain' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'HK', name: 'Hong Kong SAR' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IN', name: 'India' },
  { code: 'JP', name: 'Japan' },
  { code: 'MX', name: 'Mexico' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'PL', name: 'Poland' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SE', name: 'Sweden' },
  { code: 'SG', name: 'Singapore' },
  { code: 'US', name: 'United States' },
  { code: 'ZA', name: 'South Africa' },
];

/** Tax identifier label by billing country (nothing means "not applicable"). */
export const TAX_ID_BY_COUNTRY: Record<string, { type: string; label: string }> = {
  IN: { type: 'gst', label: 'GSTIN' },
  AU: { type: 'abn', label: 'ABN' },
  GB: { type: 'vat', label: 'VAT number' },
  DE: { type: 'vat', label: 'VAT number' },
  ES: { type: 'vat', label: 'VAT number' },
  FR: { type: 'vat', label: 'VAT number' },
  IE: { type: 'vat', label: 'VAT number' },
  NL: { type: 'vat', label: 'VAT number' },
  PL: { type: 'vat', label: 'VAT number' },
  SE: { type: 'vat', label: 'VAT number' },
  NO: { type: 'vat', label: 'VAT number' },
  DK: { type: 'vat', label: 'VAT number' },
  CH: { type: 'vat', label: 'VAT/MWST number' },
  SG: { type: 'gst', label: 'GST registration no.' },
  NZ: { type: 'gst', label: 'GST number' },
  ZA: { type: 'vat', label: 'VAT number' },
  AE: { type: 'trn', label: 'TRN' },
  SA: { type: 'vat', label: 'VAT number' },
  CA: { type: 'gst', label: 'GST/HST number' },
  US: { type: 'ein', label: 'EIN (optional)' },
};

export const CARD_BRANDS = ['visa', 'mastercard', 'amex', 'discover', 'other'] as const;

export interface BillingProfileInput {
  legal_name: string | null;
  billing_email: string | null;
  billing_contact_name: string | null;
  billing_country: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  tax_id_type: string | null;
  tax_id_value: string | null;
}

export interface PaymentMethodInput {
  method_type: PaymentMethodType;
  display_brand: string | null;
  display_last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  billing_name: string | null;
}

/** Does the signed-in user manage billing for this ad account? */
export async function isBillingManager(adAccountId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_ad_account_billing_manager', {
    _ad_account_id: adAccountId,
  });
  if (error) return false;
  return !!data;
}

export async function getBillingProfile(adAccountId: string): Promise<BillingProfile | null> {
  const { data, error } = await supabase
    .from('ad_billing_profiles')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertBillingProfile(
  adAccountId: string,
  input: BillingProfileInput,
): Promise<BillingProfile> {
  const { data: userRes } = await supabase.auth.getUser();
  const payload = {
    ad_account_id: adAccountId,
    created_by: userRes.user?.id ?? null,
    ...input,
  };
  const { data, error } = await supabase
    .from('ad_billing_profiles')
    .upsert(payload, { onConflict: 'ad_account_id' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listPaymentMethods(adAccountId: string): Promise<PaymentMethod[]> {
  const { data, error } = await supabase
    .from('ad_payment_methods')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addPaymentMethod(
  adAccountId: string,
  input: PaymentMethodInput,
): Promise<PaymentMethod> {
  const { data: userRes } = await supabase.auth.getUser();
  // K1: no provider connected yet — store display metadata only, never a real
  // card number or CVV. provider stays 'none' and provider_ref stays null.
  const { data, error } = await supabase
    .from('ad_payment_methods')
    .insert({
      ad_account_id: adAccountId,
      provider: 'none',
      provider_ref: null,
      created_by: userRes.user?.id ?? null,
      ...input,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setDefaultPaymentMethod(id: string): Promise<void> {
  const { error } = await supabase
    .from('ad_payment_methods')
    .update({ is_default: true })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function removePaymentMethod(id: string): Promise<void> {
  const { error } = await supabase.from('ad_payment_methods').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listBillingEvents(
  adAccountId: string,
  limit = 30,
): Promise<BillingEvent[]> {
  const { data, error } = await supabase
    .from('ad_billing_events')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listInvoices(adAccountId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('ad_invoices')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function isBillingProfileComplete(p: BillingProfile | null): boolean {
  return (
    !!p &&
    !!p.legal_name?.trim() &&
    !!p.billing_email?.trim() &&
    !!p.billing_country?.trim()
  );
}
