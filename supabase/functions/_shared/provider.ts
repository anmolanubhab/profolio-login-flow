// =====================================================================
// SHARED payment provider abstraction — the SINGLE contract imported by
// every billing edge function (ad-billing-provider, ad-billing-webhook,
// ad-billing-reconcile). Two implementations:
//
//   SimulatedProvider  — K3-B. Deterministic. Emits its own signed
//                        webhooks (test harness only).
//   StripeProvider     — K3-C sandbox. Real Stripe REST calls. TEST keys
//                        only (sk_test_… enforced). emitsOwnWebhooks =
//                        false — Stripe delivers its own events. INERT
//                        until ad_provider_config.active_provider =
//                        'stripe' (a task-10 migration, not done here)
//                        AND the STRIPE_* function secrets are present.
//
// Design rules:
//  * A provider API call (createPaymentIntent / createRefund) is SEPARATE
//    from webhook delivery.
//  * Webhook verification + provider->internal normalisation live in the
//    adapter, not in the database.
//  * No card number / CVV / bank credential is ever accepted or stored —
//    only opaque provider references (cus_…, pm_…, pi_…, re_…).
//  * Money is handled in a currency's MINOR units (Stripe's `amount` is
//    already minor units, incl. zero-decimal currencies like JPY).
//  * Secrets are read only from Deno.env, never returned or logged.
// =====================================================================

export type IntentStatus =
  | "processing" | "succeeded" | "failed" | "requires_action" | "canceled" | "unknown";

export type InternalEventType =
  | "payment_intent.processing" | "payment_intent.succeeded" | "payment_intent.payment_failed"
  | "payment_intent.requires_action" | "payment_intent.canceled" | "charge.refunded" | "charge.dispute.created";

export interface NormalizedWebhookEvent {
  providerEventId: string;
  type: InternalEventType | string;
  payload: {
    ad_account_id?: string; idempotency_key?: string; intent_ref?: string; amount_cents?: number;
    currency?: string; failure_reason?: string; refund_cents?: number; refund_ref?: string;
    dispute_ref?: string; dispute_reason?: string; [k: string]: unknown;
  };
}

export interface ProviderCustomer { customerRef: string; }
export interface ProviderSetupIntent { setupRef: string; clientSecretRef: string; }
export interface ProviderPaymentMethod { pmRef: string; brand: string; last4: string; expMonth: number; expYear: number; }
export interface ProviderPaymentIntent { intentRef: string; status: IntentStatus; clientSecretRef?: string; }
export interface ProviderRefund { refundRef: string; status: "succeeded" | "pending" | "failed"; }
export interface ProviderPaymentStatus { status: IntentStatus; providerRef?: string; failureReason?: string; }

export interface EmitWebhook { (event: NormalizedWebhookEvent): Promise<void>; }

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "XOF", "XAF", "BIF", "DJF", "GNF", "ISK", "KMF", "PYG", "RWF", "UGX", "VUV", "XPF"]);
const SUPPORTED = new Set(["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD", "AED", "JPY"]);
export function currencySupported(currency: string): boolean { return SUPPORTED.has((currency || "").toUpperCase()); }
export function minorUnitsPerMajor(currency: string): number { return ZERO_DECIMAL.has((currency || "").toUpperCase()) ? 1 : 100; }

export interface PaymentProvider {
  readonly name: "simulated" | "stripe";
  readonly emitsOwnWebhooks: boolean;
  ensureCustomer(input: { accountId: string; email?: string | null; name?: string | null; existingRef?: string | null }): Promise<ProviderCustomer>;
  createSetupIntent(input: { customerRef: string }): Promise<ProviderSetupIntent>;
  finalizePaymentMethod(input: { customerRef: string; setupRef: string; outcome?: string; holderName?: string | null }): Promise<ProviderPaymentMethod>;
  createPaymentIntent(input: { customerRef: string | null; pmRef: string | null; amountMinor: number; currency: string; idempotencyKey: string; accountId: string; outcomeHint?: string; }): Promise<ProviderPaymentIntent>;
  createRefund(input: { idempotencyKey: string; intentRef: string; amountMinor: number; accountId: string }): Promise<ProviderRefund>;
  getPaymentStatus(input: { intentRef: string | null; idempotencyKey: string }): Promise<ProviderPaymentStatus>;
  parseWebhook(rawBody: string, signatureHeader: string | null, secret: string): Promise<{ valid: boolean; event: NormalizedWebhookEvent | null }>;
  buildSignedWebhook(event: NormalizedWebhookEvent, secret: string): Promise<{ body: string; signature: string }>;
}

// ---------- shared crypto helpers --------------------------------
async function hmacHex(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
// Verify a Stripe-style signature header ("t=<unix>,v1=<hex>[,v1=<hex>]").
// Used by BOTH providers — the simulator's format was modelled on Stripe's.
async function verifyTsV1(rawBody: string, header: string | null, secret: string, toleranceSecs = 300): Promise<boolean> {
  if (!header) return false;
  let t: string | null = null;
  const v1s: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (k === "t") t = v;
    else if (k === "v1") v1s.push(v);
  }
  if (!t || v1s.length === 0) return false;
  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  if (!Number.isFinite(skew) || skew > toleranceSecs) return false;
  const expected = await hmacHex(secret, `${t}.${rawBody}`);
  return v1s.some((v1) => timingSafeEqual(expected, v1));
}
const rand = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

// =====================================================================
// SimulatedProvider (K3-B) — unchanged
// =====================================================================
const OUTCOME_CARDS: Record<string, { brand: string; last4: string }> = {
  ok: { brand: "visa", last4: "4242" }, decline: { brand: "visa", last4: "0002" }, action: { brand: "visa", last4: "3155" },
};

export class SimulatedProvider implements PaymentProvider {
  readonly name = "simulated" as const;
  readonly emitsOwnWebhooks = true;
  ensureCustomer(input: { existingRef?: string | null }): Promise<ProviderCustomer> {
    return Promise.resolve({ customerRef: input.existingRef || rand("sim_cus") });
  }
  createSetupIntent(): Promise<ProviderSetupIntent> {
    return Promise.resolve({ setupRef: rand("sim_seti"), clientSecretRef: rand("sim_seti_secret") });
  }
  finalizePaymentMethod(input: { outcome?: string }): Promise<ProviderPaymentMethod> {
    const o = (input.outcome || "ok").toLowerCase();
    const card = OUTCOME_CARDS[o] ?? OUTCOME_CARDS.ok;
    return Promise.resolve({
      pmRef: `sim_pm_${o}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      brand: card.brand, last4: card.last4, expMonth: 12, expYear: new Date().getUTCFullYear() + 3,
    });
  }
  private outcomeFromPm(pmRef: string | null, hint?: string): "ok" | "decline" | "action" {
    const src = (hint || pmRef || "ok").toLowerCase();
    if (src.includes("decline")) return "decline";
    if (src.includes("action")) return "action";
    return "ok";
  }
  createPaymentIntent(input: { pmRef: string | null; outcomeHint?: string }): Promise<ProviderPaymentIntent> {
    const outcome = this.outcomeFromPm(input.pmRef, input.outcomeHint);
    const status: IntentStatus = outcome === "action" ? "requires_action" : outcome === "decline" ? "failed" : "processing";
    return Promise.resolve({ intentRef: rand("sim_pi"), status, clientSecretRef: rand("sim_pi_secret") });
  }
  createRefund(_input: { intentRef: string }): Promise<ProviderRefund> {
    return Promise.resolve({ refundRef: rand("sim_re"), status: "succeeded" });
  }
  getPaymentStatus(): Promise<ProviderPaymentStatus> {
    return Promise.resolve({ status: "unknown" });
  }
  webhookForIntent(input: { intentRef: string; idempotencyKey: string; accountId: string; amountMinor: number; currency: string; pmRef: string | null; outcomeHint?: string; }): NormalizedWebhookEvent {
    const outcome = this.outcomeFromPm(input.pmRef, input.outcomeHint);
    const type: InternalEventType =
      outcome === "action" ? "payment_intent.requires_action" : outcome === "decline" ? "payment_intent.payment_failed" : "payment_intent.succeeded";
    return {
      providerEventId: rand("sim_evt"), type,
      payload: {
        ad_account_id: input.accountId, idempotency_key: input.idempotencyKey, intent_ref: input.intentRef,
        amount_cents: input.amountMinor, currency: input.currency,
        ...(outcome === "decline" ? { failure_reason: "card_declined" } : {}),
      },
    };
  }
  webhookForConfirm(input: { intentRef: string; idempotencyKey: string; accountId: string; amountMinor: number; approve: boolean }): NormalizedWebhookEvent {
    return {
      providerEventId: rand("sim_evt"),
      type: input.approve ? "payment_intent.succeeded" : "payment_intent.canceled",
      payload: {
        ad_account_id: input.accountId, idempotency_key: input.idempotencyKey, intent_ref: input.intentRef, amount_cents: input.amountMinor,
        ...(input.approve ? {} : { failure_reason: "authentication_abandoned" }),
      },
    };
  }
  webhookForRefund(input: { intentRef: string; accountId: string; refundMinor: number; refundRef: string }): NormalizedWebhookEvent {
    return {
      providerEventId: rand("sim_evt"), type: "charge.refunded",
      payload: { ad_account_id: input.accountId, intent_ref: input.intentRef, refund_cents: input.refundMinor, refund_ref: input.refundRef },
    };
  }
  async buildSignedWebhook(event: NormalizedWebhookEvent, secret: string): Promise<{ body: string; signature: string }> {
    const body = JSON.stringify({ provider_event_id: event.providerEventId, type: event.type, payload: event.payload });
    const t = Math.floor(Date.now() / 1000);
    const v1 = await hmacHex(secret, `${t}.${body}`);
    return { body, signature: `t=${t},v1=${v1}` };
  }
  async parseWebhook(rawBody: string, signatureHeader: string | null, secret: string): Promise<{ valid: boolean; event: NormalizedWebhookEvent | null }> {
    const valid = await verifyTsV1(rawBody, signatureHeader, secret);
    let event: NormalizedWebhookEvent | null = null;
    try {
      const b = JSON.parse(rawBody);
      const id = b.provider_event_id ?? b.id;
      if (id && b.type) event = { providerEventId: String(id), type: String(b.type), payload: b.payload ?? {} };
    } catch { /* keep null */ }
    return { valid, event };
  }
}

// =====================================================================
// StripeProvider (K3-C sandbox) — real REST, TEST keys only, inert
// until selected. Never touched by a client code path.
// =====================================================================
export class StripeAdapterError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "StripeAdapterError";
    this.code = code;
  }
}

const STRIPE_API = "https://api.stripe.com/v1";

function stripeSecret(): string {
  const k = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim();
  if (!k) throw new StripeAdapterError("stripe_not_configured", "STRIPE_SECRET_KEY is not set");
  if (!k.startsWith("sk_test_") && !k.startsWith("rk_test_")) {
    // Hard refusal: this adapter is sandbox-only. A live key is never accepted.
    throw new StripeAdapterError("stripe_test_key_required", "only Stripe TEST keys (sk_test_ / rk_test_) are accepted");
  }
  return k;
}
export function stripeConfigured(): boolean {
  const k = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim();
  return k.startsWith("sk_test_") || k.startsWith("rk_test_");
}
function stripeWebhookSecret(): string {
  const s = (Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "").trim();
  if (!s) throw new StripeAdapterError("stripe_webhook_not_configured", "STRIPE_WEBHOOK_SECRET is not set");
  return s;
}

function formEncode(obj: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    p.append(k, String(v));
  }
  return p.toString();
}

function mapPiStatus(pi: { status?: string; last_payment_error?: unknown }): IntentStatus {
  switch (pi.status) {
    case "succeeded": return "succeeded";
    case "processing": return "processing";
    case "requires_action":
    case "requires_confirmation": return "requires_action";
    case "requires_payment_method": return pi.last_payment_error ? "failed" : "requires_action";
    case "canceled": return "canceled";
    default: return "unknown";
  }
}

function mapEventType(stripeType: string): InternalEventType | null {
  switch (stripeType) {
    case "payment_intent.succeeded": return "payment_intent.succeeded";
    case "payment_intent.processing": return "payment_intent.processing";
    case "payment_intent.payment_failed": return "payment_intent.payment_failed";
    case "payment_intent.requires_action":
    case "payment_intent.amount_capturable_updated": return "payment_intent.requires_action";
    case "payment_intent.canceled": return "payment_intent.canceled";
    case "charge.refunded":
    case "charge.refund.updated": return "charge.refunded";
    case "charge.dispute.created": return "charge.dispute.created";
    default: return null;
  }
}

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  readonly emitsOwnWebhooks = false; // Stripe delivers its own events

  private async api<T = Record<string, unknown>>(
    method: "GET" | "POST",
    path: string,
    params?: Record<string, string | number | undefined | null>,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const key = stripeSecret();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
      ...(extraHeaders ?? {}),
    };
    let url = `${STRIPE_API}${path}`;
    let body: string | undefined;
    if (method === "GET" && params) url += `?${formEncode(params)}`;
    else if (params) body = formEncode(params);
    const res = await fetch(url, { method, headers, body });
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { /* leave empty */ }
    if (!res.ok) {
      const err = (parsed?.error ?? {}) as { code?: string; type?: string; message?: string };
      // surface a stable code + Stripe's own code/type — NEVER the key or full body
      throw new StripeAdapterError(
        `stripe_api_error:${err.code ?? err.type ?? res.status}`,
        `Stripe ${method} ${path} -> ${res.status} ${err.type ?? ""} ${err.code ?? ""}`.trim(),
      );
    }
    return parsed as T;
  }

  async ensureCustomer(input: { accountId: string; email?: string | null; name?: string | null; existingRef?: string | null }): Promise<ProviderCustomer> {
    if (input.existingRef && input.existingRef.startsWith("cus_")) return { customerRef: input.existingRef };
    const c = await this.api<{ id: string }>("POST", "/customers", {
      email: input.email ?? undefined,
      name: input.name ?? undefined,
      "metadata[ad_account_id]": input.accountId,
    });
    return { customerRef: c.id };
  }

  async createSetupIntent(input: { customerRef: string }): Promise<ProviderSetupIntent> {
    const si = await this.api<{ id: string; client_secret: string }>("POST", "/setup_intents", {
      customer: input.customerRef,
      "payment_method_types[]": "card",
      usage: "off_session",
    });
    return { setupRef: si.id, clientSecretRef: si.client_secret };
  }

  // The raw card is ALWAYS collected client-side by Stripe.js/Elements; the
  // server only ever receives a PaymentMethod token (pm_…). `outcome` carries
  // that token when the provider is Stripe. No PAN/CVV ever reaches here.
  async finalizePaymentMethod(input: { customerRef: string; outcome?: string }): Promise<ProviderPaymentMethod> {
    const pmId = (input.outcome ?? "").trim();
    if (!/^pm_[A-Za-z0-9_]+$/.test(pmId)) {
      throw new StripeAdapterError("payment_method_token_required", "a Stripe pm_… token collected client-side is required");
    }
    await this.api("POST", `/payment_methods/${pmId}/attach`, { customer: input.customerRef });
    const pm = await this.api<{ id: string; card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number } }>(
      "GET", `/payment_methods/${pmId}`,
    );
    return {
      pmRef: pm.id,
      brand: pm.card?.brand ?? "card",
      last4: pm.card?.last4 ?? "0000",
      expMonth: pm.card?.exp_month ?? 12,
      expYear: pm.card?.exp_year ?? new Date().getUTCFullYear() + 3,
    };
  }

  // Provider API call ONLY. Stripe emits its own webhook — nothing is
  // delivered from here.
  async createPaymentIntent(input: {
    customerRef: string | null; pmRef: string | null; amountMinor: number; currency: string; idempotencyKey: string; accountId: string;
  }): Promise<ProviderPaymentIntent> {
    const pi = await this.api<{ id: string; status?: string; client_secret?: string; last_payment_error?: unknown }>(
      "POST", "/payment_intents",
      {
        amount: Math.trunc(input.amountMinor),
        currency: input.currency.toLowerCase(),
        customer: input.customerRef ?? undefined,
        payment_method: input.pmRef ?? undefined,
        confirm: "true",
        off_session: "true",
        "automatic_payment_methods[enabled]": "true",
        "automatic_payment_methods[allow_redirects]": "never",
        "metadata[ad_account_id]": input.accountId,
        "metadata[idempotency_key]": input.idempotencyKey,
      },
      { "Idempotency-Key": input.idempotencyKey },
    );
    return { intentRef: pi.id, status: mapPiStatus(pi), clientSecretRef: pi.client_secret };
  }

  async createRefund(input: { idempotencyKey: string; intentRef: string; amountMinor: number; accountId: string }): Promise<ProviderRefund> {
    const r = await this.api<{ id: string; status?: string }>(
      "POST", "/refunds",
      {
        payment_intent: input.intentRef,
        amount: Math.trunc(input.amountMinor),
        "metadata[ad_account_id]": input.accountId,
      },
      { "Idempotency-Key": input.idempotencyKey },
    );
    return { refundRef: r.id, status: r.status === "succeeded" ? "succeeded" : r.status === "pending" ? "pending" : "failed" };
  }

  // Authoritative status lookup for reconciliation. Returns "unknown" only
  // when it genuinely cannot be determined — never fabricates a success.
  async getPaymentStatus(input: { intentRef: string | null }): Promise<ProviderPaymentStatus> {
    if (!input.intentRef || !input.intentRef.startsWith("pi_")) return { status: "unknown" };
    try {
      const pi = await this.api<{ id: string; status?: string; last_payment_error?: { message?: string; code?: string } }>(
        "GET", `/payment_intents/${input.intentRef}`,
      );
      return {
        status: mapPiStatus(pi),
        providerRef: pi.id,
        failureReason: pi.last_payment_error?.code ?? pi.last_payment_error?.message ?? undefined,
      };
    } catch {
      return { status: "unknown" };
    }
  }

  // Verify the Stripe-Signature header and normalise the event to the
  // provider-neutral vocabulary consumed by ad_billing_apply_webhook.
  async parseWebhook(rawBody: string, signatureHeader: string | null, _secretArg: string): Promise<{ valid: boolean; event: NormalizedWebhookEvent | null }> {
    let whSecret: string;
    try { whSecret = stripeWebhookSecret(); } catch { return { valid: false, event: null }; }
    const valid = await verifyTsV1(rawBody, signatureHeader, whSecret);

    let event: NormalizedWebhookEvent | null = null;
    try {
      const b = JSON.parse(rawBody) as {
        id?: string; type?: string; data?: { object?: Record<string, unknown> };
      };
      const obj = (b.data?.object ?? {}) as Record<string, unknown>;
      const internal = b.type ? mapEventType(b.type) : null;
      if (b.id && b.type) {
        const md = (obj.metadata ?? {}) as Record<string, string>;
        const isPi = String(b.type).startsWith("payment_intent.");
        const isDispute = b.type === "charge.dispute.created";
        const intentRef = isPi
          ? String(obj.id ?? "")
          : String(obj.payment_intent ?? "");
        const payload: NormalizedWebhookEvent["payload"] = {
          ad_account_id: md.ad_account_id || undefined,
          idempotency_key: md.idempotency_key || undefined,
          intent_ref: intentRef || undefined,
          currency: typeof obj.currency === "string" ? obj.currency.toUpperCase() : undefined,
        };
        if (isPi && typeof obj.amount === "number") payload.amount_cents = obj.amount as number;
        if (b.type === "payment_intent.payment_failed") {
          const lpe = (obj.last_payment_error ?? {}) as { code?: string; message?: string };
          payload.failure_reason = lpe.code ?? lpe.message ?? "declined";
        }
        if (b.type === "charge.refunded" || b.type === "charge.refund.updated") {
          const refunds = ((obj.refunds ?? {}) as { data?: Array<{ id?: string; amount?: number; status?: string }> }).data ?? [];
          const latest = refunds[refunds.length - 1];
          if (latest) {
            payload.refund_cents = typeof latest.amount === "number" ? latest.amount : undefined;
            payload.refund_ref = latest.id;
          } else if (typeof obj.amount_refunded === "number") {
            payload.refund_cents = obj.amount_refunded as number;
            payload.refund_ref = String(obj.id ?? b.id);
          }
        }
        if (isDispute) {
          payload.dispute_ref = String(obj.id ?? "");
          payload.dispute_reason = typeof obj.reason === "string" ? obj.reason : undefined;
        }
        event = { providerEventId: String(b.id), type: internal ?? String(b.type), payload };
      }
    } catch { /* keep null */ }
    return { valid, event };
  }

  buildSignedWebhook(): Promise<{ body: string; signature: string }> {
    // Stripe delivers its own webhooks; this test-only helper is not used
    // for the Stripe adapter.
    return Promise.reject(new StripeAdapterError("not_supported", "StripeProvider does not synthesize webhooks"));
  }
}

export function getProvider(name: string): PaymentProvider {
  if (name === "simulated") return new SimulatedProvider();
  if (name === "stripe") return new StripeProvider();
  throw new Error(`unknown payment provider: ${name}`);
}
