import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { microsToMajor } from '@/lib/ads/spend';

/**
 * Phase K3-B — payment / billing (client layer).
 *
 * SIMULATED provider, TEST MODE. No real money moves, no external payment
 * account, no production credentials. Payment lifecycle runs through the
 * `ad-billing-provider` edge function (authorises the caller as a billing
 * manager) which drives the K3-A server-authoritative RPCs; the provider
 * emits HMAC-signed webhooks to `ad-billing-webhook`, the authoritative
 * confirmation. The frontend never marks a payment successful.
 */

export type BillingTransaction = Database['public']['Tables']['ad_billing_transactions']['Row'];
export type BillingInvoice = Database['public']['Tables']['ad_invoices']['Row'];
export type BillingLedgerEntry = Database['public']['Tables']['ad_billing_ledger']['Row'];

export interface BillingSummary {
  currency: string;
  /** LIVE (real-money) balance. Always 0 while the provider is in test mode. */
  outstandingMicros: number;
  lifetimePaidMicros: number;
  creditMicros: number;
  /** TEST-mode balance — simulated provider activity, no real money. */
  testOutstandingMicros: number;
  testLifetimePaidMicros: number;
  testCreditMicros: number;
  paymentThresholdCents: number;
  hold: boolean;
  holdReason: string | null;
  lastChargeAt: string | null;
  lastChargeStatus: string | null;
  billingStatus: string;
  hasPaymentMethod: boolean;
  provider: string;
  testMode: boolean;
}

export type SimOutcome = 'ok' | 'decline' | 'action';

export const TXN_STATUS_META: Record<
  string,
  { label: string; tone: 'muted' | 'warning' | 'success' | 'destructive' }
> = {
  pending: { label: 'Pending', tone: 'muted' },
  processing: { label: 'Processing', tone: 'warning' },
  requires_action: { label: 'Needs confirmation', tone: 'warning' },
  succeeded: { label: 'Succeeded', tone: 'success' },
  failed: { label: 'Failed', tone: 'destructive' },
  canceled: { label: 'Cancelled', tone: 'muted' },
  refunded: { label: 'Refunded', tone: 'muted' },
  partially_refunded: { label: 'Partially refunded', tone: 'muted' },
};

export const LEDGER_LABEL: Record<string, string> = {
  spend_accrued: 'Ad spend',
  invoice_issued: 'Invoice issued',
  payment_succeeded: 'Payment',
  payment_failed: 'Payment failed',
  refund: 'Refund',
  adjustment: 'Adjustment',
  credit: 'Credit',
};

export function centsToMajor(cents: number | null | undefined): number {
  return (cents ?? 0) / 100;
}

export async function getBillingSummary(adAccountId: string): Promise<BillingSummary> {
  const { data, error } = await supabase.rpc('ad_account_billing_summary', {
    _ad_account_id: adAccountId,
  });
  if (error) throw new Error(error.message);
  const j = (data ?? {}) as Record<string, unknown>;
  return {
    currency: (j.currency as string) ?? 'USD',
    outstandingMicros: Number(j.outstanding_micros ?? 0),
    lifetimePaidMicros: Number(j.lifetime_paid_micros ?? 0),
    creditMicros: Number(j.credit_micros ?? 0),
    testOutstandingMicros: Number(j.test_outstanding_micros ?? 0),
    testLifetimePaidMicros: Number(j.test_lifetime_paid_micros ?? 0),
    testCreditMicros: Number(j.test_credit_micros ?? 0),
    paymentThresholdCents: Number(j.payment_threshold_cents ?? 10000),
    hold: !!j.hold,
    holdReason: (j.hold_reason as string) ?? null,
    lastChargeAt: (j.last_charge_at as string) ?? null,
    lastChargeStatus: (j.last_charge_status as string) ?? null,
    billingStatus: (j.billing_status as string) ?? 'setup_required',
    hasPaymentMethod: !!j.has_payment_method,
    provider: (j.provider as string) ?? 'simulated',
    testMode: j.test_mode !== false,
  };
}

export async function listTransactions(adAccountId: string, limit = 40): Promise<BillingTransaction[]> {
  const { data, error } = await supabase
    .from('ad_billing_transactions')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listInvoices(adAccountId: string, limit = 40): Promise<BillingInvoice[]> {
  const { data, error } = await supabase
    .from('ad_invoices')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listBillingLedger(adAccountId: string, limit = 60): Promise<BillingLedgerEntry[]> {
  const { data, error } = await supabase
    .from('ad_billing_ledger')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

interface ProviderResult<T = unknown> {
  ok: boolean;
  status?: string;
  error?: string;
  transaction?: BillingTransaction;
  payment_method?: unknown;
  summary?: unknown;
  data?: T;
}

async function callProvider(body: Record<string, unknown>): Promise<ProviderResult> {
  const { data, error } = await supabase.functions.invoke('ad-billing-provider', { body });
  if (error) throw new Error(error.message);
  const res = data as ProviderResult;
  if (!res?.ok) {
    throw new Error(res?.error || res?.status || 'The payment service rejected the request.');
  }
  return res;
}

/** Add a payment method through the (simulated) provider. `outcome` is a test control. */
export async function addPaymentMethod(
  adAccountId: string,
  input: { outcome: SimOutcome; holderName?: string },
): Promise<void> {
  await callProvider({
    action: 'add_payment_method',
    ad_account_id: adAccountId,
    outcome: input.outcome,
    holder_name: input.holderName ?? null,
  });
}

/** Open a checkout / charge attempt for an amount (major units). Returns the resulting transaction. */
export async function openCheckout(
  adAccountId: string,
  input: { amountCents: number; outcome?: SimOutcome; clientRequestId?: string; paymentMethodId?: string },
): Promise<BillingTransaction | undefined> {
  const res = await callProvider({
    action: 'open_checkout',
    ad_account_id: adAccountId,
    amount_cents: input.amountCents,
    outcome: input.outcome,
    // opaque per-attempt id; the server derives the real, account-scoped
    // idempotency key from it (client can't cause a cross-account collision).
    client_request_id: input.clientRequestId ?? crypto.randomUUID(),
    payment_method_id: input.paymentMethodId ?? null,
  });
  return res.transaction;
}

export async function confirmPayment(
  adAccountId: string,
  transactionId: string,
  approve: boolean,
): Promise<BillingTransaction | undefined> {
  const res = await callProvider({
    action: 'confirm_payment',
    ad_account_id: adAccountId,
    transaction_id: transactionId,
    approve,
  });
  return res.transaction;
}

/** Admin only. */
export async function refundTransaction(
  adAccountId: string,
  transactionId: string,
  amountCents?: number,
): Promise<void> {
  await callProvider({
    action: 'refund',
    ad_account_id: adAccountId,
    transaction_id: transactionId,
    amount_cents: amountCents,
  });
}

export { microsToMajor };
