// =====================================================================
// Phase K3-C-remediation — R3 / D1 pending-payment reconciliation.
//
// verify_jwt = true. Restricted to platform admins. Two modes:
//
//   { "action": "scan", "older_than_minutes": 30 }
//     -> list charge transactions stuck in pending/processing, ask the
//        provider adapter for each intent's authoritative status, and
//        resolve the ones the provider can speak to. The SIMULATED
//        provider holds no persistent state, so it returns "unknown"
//        and those transactions are left pending with a reconciliation
//        marker for an operator to action explicitly.
//
//   { "action": "resolve", "txn_id": "...", "resolved_status":
//     "succeeded"|"failed"|"canceled"|"requires_action",
//     "provider_ref": "...", "failure_reason": "..." }
//     -> operator-forced resolution of one transaction. Runs through
//        ad_billing_apply_webhook so ledger / invoice / hold effects are
//        identical to a real provider webhook.
//
// The provider adapter is selected from ad_provider_config. It is the
// SIMULATED provider while active_provider = 'simulated'. When Stripe is
// active, provider.getPaymentStatus() performs a real PaymentIntent
// retrieve; an indeterminate result is still returned as 'unknown' and
// never fabricated as a success.
// =====================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProvider } from "../_shared/provider.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ fn: "ad-billing-reconcile", level, event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, status: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ ok: false, status: "not_authorized" }, 200);

  let body: {
    action?: string;
    older_than_minutes?: number;
    txn_id?: string;
    resolved_status?: string;
    provider_ref?: string;
    failure_reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, status: "invalid_request" }, 400);
  }

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return json({ ok: false, status: "not_authorized" }, 200);
  const { data: roleRow } = await userClient
    .from("user_roles").select("role").eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) {
    log("warn", "authz_denied", { user: userRes.user.id });
    return json({ ok: false, status: "not_authorized" }, 200);
  }

  const { data: cfg } = await admin
    .from("ad_provider_config").select("active_provider, test_mode").eq("id", 1).single();
  if (!cfg) return json({ ok: false, status: "provider_not_available" }, 200);
  const provider = getProvider(cfg.active_provider);

  try {
    // -------- resolve one transaction (operator forced) --------
    if (body.action === "resolve") {
      if (!body.txn_id || !UUID_RE.test(body.txn_id)) return json({ ok: false, status: "invalid_request" }, 400);
      const allowed = ["succeeded", "failed", "canceled", "requires_action", "unknown"];
      const resolved = String(body.resolved_status ?? "");
      if (!allowed.includes(resolved)) return json({ ok: false, status: "invalid_request" }, 400);

      const { data, error } = await admin.rpc("ad_billing_resolve_pending_transaction", {
        _txn_id: body.txn_id,
        _resolved_status: resolved,
        _provider_ref: body.provider_ref ?? null,
        _failure_reason: body.failure_reason ?? null,
      });
      if (error) {
        log("error", "resolve_failed", { code: error.code, txn: body.txn_id });
        return json({ ok: false, status: "resolve_failed" }, 200);
      }
      log("info", "resolved", { txn: body.txn_id, resolved });
      return json({ ok: true, result: data });
    }

    // -------- scan for stuck transactions ---------------------
    if (!body.action || body.action === "scan") {
      const olderThan = Number.isInteger(body.older_than_minutes) && (body.older_than_minutes as number) > 0
        ? (body.older_than_minutes as number) : 30;

      const { data: stuck, error } = await admin.rpc("ad_billing_list_stuck_transactions", {
        _older_than_minutes: olderThan,
      });
      if (error) {
        log("error", "list_failed", { code: error.code });
        return json({ ok: false, status: "scan_failed" }, 200);
      }
      const rows = (stuck ?? []) as Array<{
        id: string; ad_account_id: string; provider_ref: string | null; idempotency_key: string;
        amount_cents: number; status: string; is_test: boolean;
      }>;

      const results: Array<Record<string, unknown>> = [];
      for (const t of rows) {
        const st = await provider.getPaymentStatus({ intentRef: t.provider_ref, idempotencyKey: t.idempotency_key });
        if (st.status === "unknown") {
          // provider cannot assert — leave pending, drop a marker.
          await admin.rpc("ad_billing_resolve_pending_transaction", {
            _txn_id: t.id, _resolved_status: "unknown", _provider_ref: null, _failure_reason: null,
          });
          results.push({ txn_id: t.id, provider_status: "unknown", action: "left_pending" });
          continue;
        }
        const map: Record<string, string> = {
          succeeded: "succeeded", failed: "failed", canceled: "canceled",
          requires_action: "requires_action", processing: "unknown",
        };
        const resolved = map[st.status] ?? "unknown";
        const { data: r } = await admin.rpc("ad_billing_resolve_pending_transaction", {
          _txn_id: t.id, _resolved_status: resolved,
          _provider_ref: st.providerRef ?? t.provider_ref, _failure_reason: st.failureReason ?? null,
        });
        results.push({ txn_id: t.id, provider_status: st.status, resolved, result: r });
      }

      log("info", "scan_complete", { stuck: rows.length, older_than_minutes: olderThan });
      return json({ ok: true, scanned: rows.length, results });
    }

    return json({ ok: false, status: "unknown_action" }, 400);
  } catch (e) {
    log("error", "unhandled", { message: e instanceof Error ? e.message : "unknown" });
    return json({ ok: false, status: "error" }, 200);
  }
});
