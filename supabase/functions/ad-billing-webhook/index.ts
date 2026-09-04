// =====================================================================
// Phase K3-B / K3-C — payment provider webhook receiver.
//
// verify_jwt = false: providers don't send a Supabase JWT. Authenticity
// is established by the adapter's parseWebhook(), which verifies the
// HMAC signature against the provider webhook secret (private schema,
// read via _ad_get_webhook_secret) and normalises the event into the
// provider-neutral vocabulary. The DB function ad_billing_apply_webhook
// is the AUTHORITATIVE processor: idempotent on (provider,
// provider_event_id), records every event (valid or not), and never
// trusts an unsigned / forged event or a payload-supplied amount.
//
// Hardening (sandbox prep):
//  * Requests with NO signature header are rejected 401 before any DB
//    work — a forger who does not even present a signature can no longer
//    create an ad_billing_webhook_events row.
//  * Best-effort in-memory sliding-window rate limit per client IP.
//    Edge instances are ephemeral so this is per-instance only; the
//    durable controls remain the platform rate limits + the DB unique
//    constraint. A DB-backed limiter + a retention/prune job on
//    ad_billing_webhook_events are still required before production.
// =====================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProvider } from "../_shared/provider.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ad-billing-signature, stripe-signature",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ fn: "ad-billing-webhook", level, event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

// ---- best-effort per-instance rate limit -------------------------
const RL_MAX = 120;            // requests
const RL_WINDOW_MS = 60_000;   // per minute, per client IP
const rlHits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RL_WINDOW_MS;
  const hits = (rlHits.get(ip) ?? []).filter((t) => t > cutoff);
  hits.push(now);
  rlHits.set(ip, hits);
  if (rlHits.size > 5000) {
    // opportunistic prune so the map cannot grow unbounded
    for (const [k, v] of rlHits) {
      const kept = v.filter((t) => t > cutoff);
      if (kept.length === 0) rlHits.delete(k);
      else rlHits.set(k, kept);
    }
  }
  return hits.length > RL_MAX;
}
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    log("warn", "rate_limited", { ip });
    return json({ ok: false, reason: "rate_limited" }, 429);
  }

  // A signature header is mandatory. Reject before any DB work so an
  // unsigned flood cannot create audit rows.
  const sigHeader = req.headers.get("x-ad-billing-signature") ?? req.headers.get("stripe-signature");
  if (!sigHeader) {
    log("warn", "missing_signature", { ip });
    return json({ ok: false, reason: "missing_signature" }, 401);
  }

  const raw = await req.text();
  if (raw.length > 1_000_000) {
    log("warn", "payload_too_large", { ip, bytes: raw.length });
    return json({ ok: false, reason: "payload_too_large" }, 413);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: cfg, error: cfgErr } = await admin
    .from("ad_provider_config").select("active_provider, test_mode").eq("id", 1).single();
  if (cfgErr || !cfg) {
    log("error", "no_provider_config");
    return json({ ok: false, reason: "unavailable" }, 503);
  }

  const { data: secretVal, error: secErr } = await admin.rpc("_ad_get_webhook_secret");
  if (secErr || !secretVal) {
    log("error", "no_webhook_secret");
    return json({ ok: false, reason: "unavailable" }, 503);
  }

  const provider = getProvider(cfg.active_provider);

  let parsed: { valid: boolean; event: { providerEventId: string; type: string; payload: Record<string, unknown> } | null };
  try {
    parsed = await provider.parseWebhook(raw, sigHeader, secretVal as string);
  } catch (e) {
    log("error", "parse_failed", { message: e instanceof Error ? e.message : "unknown" });
    return json({ ok: false, reason: "bad_request" }, 400);
  }

  if (!parsed.event) {
    log("warn", "unparseable_event", { ip });
    return json({ ok: false, reason: "bad_request" }, 400);
  }

  const { data, error } = await admin.rpc("ad_billing_apply_webhook", {
    _provider: cfg.active_provider,
    _provider_event_id: parsed.event.providerEventId,
    _event_type: parsed.event.type,
    _signature_valid: parsed.valid,
    _payload: parsed.event.payload ?? {},
  });
  if (error) {
    log("error", "apply_webhook_failed", { code: error.code, event_type: parsed.event.type });
    return json({ ok: false, reason: "processing_error" }, 500);
  }

  log("info", "processed", {
    ip,
    event_type: parsed.event.type,
    signature_valid: parsed.valid,
    result: (data && typeof data === "object" && "reason" in data) ? (data as Record<string, unknown>).reason : "ok",
  });

  // 400 on invalid signature (tells a real provider "rejected"); 200 otherwise.
  return json(data ?? { ok: true }, parsed.valid ? 200 : 400);
});
