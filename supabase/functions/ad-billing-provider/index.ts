// =====================================================================
// Phase K3-B / K3-C-remediation — authenticated payment endpoint.
//
// verify_jwt = true. The caller's JWT authorises them as a billing
// manager of the target ad account. Every money-moving write goes
// through a K3-A/K3-C SECURITY DEFINER RPC using the service-role
// client. Provider = SIMULATED (test mode) only — no real money, no
// external account, no production credentials.
//
// R4 changes:
//  * server-derived idempotency key  checkout:<account>:<client_request_id>
//    (client can only supply an opaque request id — D4).
//  * ad_billing_claim_charge_for_intent() gate before firing the intent
//    so a retry can never double-fire (E10).
//  * provider API call and webhook delivery are separated: we call
//    createPaymentIntent() then, only for the simulator, deliver its
//    lifecycle webhook. A real adapter delivers its own webhooks.
//  * structured logs, safe error codes — never echo raw exception text
//    or secrets/PII to the caller (E7).
// =====================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getProvider,
  currencySupported,
  type NormalizedWebhookEvent,
  type SimulatedProvider,
} from "../_shared/provider.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
const denied = () => json({ ok: false, status: "not_authorized" }, 200);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) {
  // structured, single-line; never include card data, secrets, tokens, emails
  const line = JSON.stringify({ fn: "ad-billing-provider", level, event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, status: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return denied();

  let body: {
    action?: string;
    ad_account_id?: string;
    amount_cents?: number;
    client_request_id?: string; // open_checkout only: opaque per-attempt uuid
    idempotency_key?: string;   // open_checkout: legacy alias for client_request_id
    transaction_id?: string;    // confirm_payment / refund: address an existing row
    outcome?: string;
    holder_name?: string;
    payment_method_id?: string;
    approve?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, status: "invalid_request" }, 400);
  }
  const action = body.action;
  const adAccountId = body.ad_account_id;
  if (!action || !adAccountId || !UUID_RE.test(adAccountId)) {
    return json({ ok: false, status: "invalid_request" }, 400);
  }

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  // ---- authorise caller ------------------------------------------
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return denied();
  const { data: isMgr } = await userClient.rpc("is_ad_account_billing_manager", { _ad_account_id: adAccountId });
  const { data: roleRow } = await userClient
    .from("user_roles").select("role").eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
  const isAdmin = !!roleRow;
  if (!isMgr && !isAdmin) {
    log("warn", "authz_denied", { action, user: userRes.user.id });
    return denied();
  }

  // ---- provider (simulated / test mode only) --------------------
  const { data: cfg } = await admin
    .from("ad_provider_config").select("active_provider, test_mode").eq("id", 1).single();
  if (!cfg || cfg.active_provider !== "simulated" || cfg.test_mode !== true) {
    log("error", "provider_not_available", { active_provider: cfg?.active_provider, test_mode: cfg?.test_mode });
    return json({ ok: false, status: "provider_not_available" }, 200);
  }
  const provider = getProvider(cfg.active_provider);
  const { data: secretVal } = await admin.rpc("_ad_get_webhook_secret");
  const webhookSecret = (secretVal ?? undefined) as string | undefined;
  if (!webhookSecret) {
    log("error", "no_webhook_secret");
    return json({ ok: false, status: "provider_not_available" }, 200);
  }
  const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/ad-billing-webhook`;

  // deliver a simulator lifecycle webhook (the real adapter never does this)
  const deliverSimWebhook = async (event: NormalizedWebhookEvent) => {
    const { body: rawBody, signature } = await provider.buildSignedWebhook(event, webhookSecret);
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ad-billing-signature": signature,
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
      },
      body: rawBody,
    });
    if (!res.ok && res.status >= 500) {
      log("error", "webhook_delivery_failed", { http_status: res.status, event_type: event.type });
      throw new Error("webhook_delivery_failed");
    }
    log("info", "webhook_delivered", { event_type: event.type, http_status: res.status });
  };

  const clientRequestId = (body.client_request_id ?? body.idempotency_key ?? "").trim();

  try {
    // -------- add_payment_method --------------------------------
    if (action === "add_payment_method") {
      const { data: prof } = await admin
        .from("ad_billing_profiles")
        .select("provider_customer_ref, billing_email, legal_name")
        .eq("ad_account_id", adAccountId).maybeSingle();

      const cust = await provider.ensureCustomer({
        accountId: adAccountId,
        email: prof?.billing_email,
        name: prof?.legal_name,
        existingRef: prof?.provider_customer_ref,
      });
      await admin.rpc("ad_billing_set_provider_customer", {
        _ad_account_id: adAccountId, _provider: "simulated", _customer_ref: cust.customerRef,
      });

      const setup = await provider.createSetupIntent({ customerRef: cust.customerRef });
      const pm = await provider.finalizePaymentMethod({
        customerRef: cust.customerRef, setupRef: setup.setupRef,
        outcome: body.outcome, holderName: body.holder_name,
      });

      const { data: pmRow, error } = await admin.rpc("ad_billing_record_payment_method", {
        _ad_account_id: adAccountId, _provider: "simulated", _customer_ref: cust.customerRef,
        _pm_ref: pm.pmRef, _setup_ref: setup.setupRef, _brand: pm.brand, _last4: pm.last4,
        _exp_month: pm.expMonth, _exp_year: pm.expYear, _billing_name: body.holder_name ?? null, _make_default: true,
      });
      if (error) {
        log("error", "record_pm_failed", { code: error.code });
        return json({ ok: false, status: "record_failed" }, 200);
      }
      log("info", "pm_added", { account: adAccountId });
      return json({ ok: true, payment_method: pmRow });
    }

    // -------- open_checkout -------------------------------------
    if (action === "open_checkout") {
      const amount = Number(body.amount_cents);
      if (!Number.isInteger(amount) || amount <= 0) return json({ ok: false, status: "invalid_amount" }, 400);
      if (!clientRequestId || !UUID_RE.test(clientRequestId)) {
        return json({ ok: false, status: "invalid_request", detail: "client_request_id must be a uuid" }, 400);
      }
      // D4 — key is server-derived and namespaced by account; the client
      // cannot cause a cross-account idempotency collision.
      const idem = `checkout:${adAccountId}:${clientRequestId}`;

      const { data: txnRow, error: txnErr } = await admin.rpc("ad_billing_open_charge", {
        _ad_account_id: adAccountId, _amount_cents: amount, _idempotency_key: idem,
        _payment_method_id: body.payment_method_id ?? null,
      });
      if (txnErr) {
        log("warn", "open_charge_rejected", { account: adAccountId, code: txnErr.code });
        return json({ ok: false, status: "open_failed", detail: safeOpenError(txnErr.message) }, 200);
      }
      const txn = Array.isArray(txnRow) ? txnRow[0] : txnRow;

      if (!currencySupported(txn.currency)) {
        log("error", "unsupported_currency", { currency: txn.currency });
        return json({ ok: false, status: "unsupported_currency" }, 200);
      }

      // E10 — atomically claim this pending txn before touching the provider.
      // Only the winner of the claim fires the intent; retries see `false`.
      const { data: claimed } = await admin.rpc("ad_billing_claim_charge_for_intent", { _txn_id: txn.id });
      if (claimed === true) {
        const { data: pm } = await admin
          .from("ad_payment_methods").select("provider_ref").eq("id", txn.payment_method_id).maybeSingle();

        const intent = await provider.createPaymentIntent({
          customerRef: txn.provider_customer_ref ?? null,
          pmRef: pm?.provider_ref ?? null,
          amountMinor: amount,
          currency: txn.currency,
          idempotencyKey: idem,
          accountId: adAccountId,
          outcomeHint: body.outcome,
        });
        await admin.from("ad_billing_transactions")
          .update({ provider_ref: intent.intentRef, updated_at: new Date().toISOString() })
          .eq("id", txn.id).is("provider_ref", null);
        log("info", "intent_created", { account: adAccountId, txn: txn.id, status: intent.status });

        // simulator: deliver the lifecycle webhook it would have sent.
        if (provider.emitsOwnWebhooks) {
          const sim = provider as unknown as SimulatedProvider;
          const evt = sim.webhookForIntent({
            intentRef: intent.intentRef, idempotencyKey: idem, accountId: adAccountId,
            amountMinor: amount, currency: txn.currency, pmRef: pm?.provider_ref ?? null, outcomeHint: body.outcome,
          });
          await deliverSimWebhook(evt);
        }
      } else {
        log("info", "intent_already_claimed", { account: adAccountId, txn: txn.id });
      }

      const { data: updated } = await admin.from("ad_billing_transactions").select("*").eq("id", txn.id).single();
      const { data: summary } = await admin.rpc("ad_account_billing_summary", { _ad_account_id: adAccountId });
      return json({ ok: true, transaction: updated, summary });
    }

    // -------- confirm_payment (3DS-style follow-up) -------------
    if (action === "confirm_payment") {
      const txn = await resolveTxn(admin, adAccountId, body.transaction_id, body.idempotency_key, clientRequestId);
      if (!txn) return json({ ok: false, status: "not_found" }, 200);

      if (txn.status === "requires_action" && provider.emitsOwnWebhooks) {
        const sim = provider as unknown as SimulatedProvider;
        const evt = sim.webhookForConfirm({
          intentRef: txn.provider_ref ?? "", idempotencyKey: txn.idempotency_key, accountId: adAccountId,
          amountMinor: txn.amount_cents, approve: body.approve !== false,
        });
        await deliverSimWebhook(evt);
      }
      const { data: updated } = await admin.from("ad_billing_transactions").select("*").eq("id", txn.id).single();
      const { data: summary } = await admin.rpc("ad_account_billing_summary", { _ad_account_id: adAccountId });
      return json({ ok: true, transaction: updated, summary });
    }

    // -------- refund (admin only) ------------------------------
    if (action === "refund") {
      if (!isAdmin) return denied();
      const txn = await resolveTxn(admin, adAccountId, body.transaction_id, body.idempotency_key, clientRequestId);
      if (!txn || (txn.status !== "succeeded" && txn.status !== "partially_refunded")) {
        return json({ ok: false, status: "not_refundable" }, 200);
      }
      const maxRefund = Number(txn.amount_cents) - Number(txn.refunded_amount_cents ?? 0);
      const amount = Number.isInteger(Number(body.amount_cents)) && Number(body.amount_cents) > 0
        ? Number(body.amount_cents) : maxRefund;
      if (amount <= 0 || amount > maxRefund) return json({ ok: false, status: "invalid_amount" }, 200);

      const refund = await provider.createRefund({
        idempotencyKey: `refund:${txn.idempotency_key}:${amount}`, intentRef: txn.provider_ref ?? "", amountMinor: amount, accountId: adAccountId,
      });
      if (provider.emitsOwnWebhooks) {
        const sim = provider as unknown as SimulatedProvider;
        const evt = sim.webhookForRefund({
          intentRef: txn.provider_ref ?? "", accountId: adAccountId, refundMinor: amount, refundRef: refund.refundRef,
        });
        await deliverSimWebhook(evt);
      }
      log("info", "refund_issued", { account: adAccountId, txn: txn.id, amount_minor: amount });
      const { data: summary } = await admin.rpc("ad_account_billing_summary", { _ad_account_id: adAccountId });
      return json({ ok: true, summary });
    }

    return json({ ok: false, status: "unknown_action" }, 400);
  } catch (e) {
    log("error", "unhandled", { action, message: e instanceof Error ? e.message : "unknown" });
    return json({ ok: false, status: "error" }, 200);
  }
});

// Resolve an existing transaction for confirm/refund. Accepts a row id
// (uuid), the stored idempotency key, or a bare per-attempt request id
// (from which the server key is rebuilt). Always scoped to the account.
async function resolveTxn(
  admin: ReturnType<typeof createClient>,
  adAccountId: string,
  transactionId: string | undefined,
  idempotencyKey: string | undefined,
  clientRequestId: string,
) {
  let q = admin.from("ad_billing_transactions").select("*").eq("ad_account_id", adAccountId);
  if (transactionId && UUID_RE.test(transactionId)) {
    q = q.eq("id", transactionId);
  } else if (idempotencyKey && idempotencyKey.startsWith(`checkout:${adAccountId}:`)) {
    q = q.eq("idempotency_key", idempotencyKey);
  } else if (clientRequestId && UUID_RE.test(clientRequestId)) {
    q = q.eq("idempotency_key", `checkout:${adAccountId}:${clientRequestId}`);
  } else {
    return null;
  }
  const { data } = await q.maybeSingle();
  return data;
}

// Map a DB exception message to a stable, non-leaky short code.
function safeOpenError(msg: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("idempotency")) return "idempotency_key_invalid";
  if (m.includes("amount")) return "amount_out_of_range";
  if (m.includes("not active") || m.includes("status")) return "account_not_active";
  if (m.includes("payment method") || m.includes("payment_method")) return "payment_method_invalid";
  if (m.includes("billing manager") || m.includes("permission")) return "not_authorized";
  return "rejected";
}
