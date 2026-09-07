import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderTemplate } from "./templates.ts";

// Phase 5: drains a bounded batch of email_outbox rows (already claimed as
// 'processing' by process_pending_email_outbox()) and sends each via
// Resend. Never trusts client-controlled recipient/content -- every field
// sent to Resend comes from the outbox row, which is itself only ever
// written server-side (see _enqueue_job_alert_email()). This function is
// NOT reachable by end users: verify_jwt is false for this function (it's
// invoked by pg_net from inside Postgres, not by a logged-in user's
// browser), and the very first check below rejects any request that
// doesn't carry the internal shared secret.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-internal-secret",
};

const RESEND_API_URL = "https://api.resend.com/emails";
const MAX_ATTEMPTS = 5;

interface OutboxRow {
  id: string;
  recipient_email: string;
  template_key: string;
  payload: unknown;
  attempt_count: number;
}

function backoffMinutes(attempt: number): number {
  return Math.pow(2, Math.min(attempt, 6)); // 2, 4, 8, 16, 32, 64 min cap
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // Reject anything without the correct internal secret -- this is the
  // ONLY authorization check for this function (verify_jwt is off since
  // the caller is Postgres/pg_net, not an end-user session).
  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = Deno.env.get("INTERNAL_EMAIL_WORKER_SECRET");
  if (!expectedSecret || !internalSecret || internalSecret !== expectedSecret) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let outboxIds: string[];
  try {
    const body = await req.json();
    outboxIds = Array.isArray(body?.outbox_ids) ? body.outbox_ids.filter((id: unknown) => typeof id === "string") : [];
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }
  if (outboxIds.length === 0) return json({ ok: true, processed: 0 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const RESEND_FROM_ADDRESS = Deno.env.get("RESEND_FROM_ADDRESS");

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Only ever act on rows that are actually claimed ('processing') AND in
  // our requested id set -- never touch anything else, regardless of what
  // the caller asked for.
  const { data: rows, error: fetchError } = await db
    .from("email_outbox")
    .select("id, recipient_email, template_key, payload, attempt_count")
    .in("id", outboxIds)
    .eq("status", "processing");

  if (fetchError) {
    console.error("send-job-alert-email: fetch error", fetchError);
    return json({ ok: false, error: "fetch_failed" }, 500);
  }

  // Per Step 18: never actually call Resend if it isn't configured yet.
  // Reset the claimed rows back to 'pending' (no attempt-count penalty --
  // this is a system config gap, not a per-message failure) so the next
  // tick retries automatically once RESEND_API_KEY is set, with nothing
  // stranded in 'processing' in the meantime.
  if (!RESEND_API_KEY || !RESEND_FROM_ADDRESS) {
    const ids = (rows || []).map((r: OutboxRow) => r.id);
    if (ids.length > 0) {
      await db.from("email_outbox").update({ status: "pending" }).in("id", ids);
    }
    console.warn("send-job-alert-email: RESEND_API_KEY/RESEND_FROM_ADDRESS not configured -- no email sent, rows reset to pending", { count: ids.length });
    return json({ ok: true, processed: 0, note: "email provider not configured" });
  }

  let sent = 0, failed = 0, skipped = 0;

  for (const row of (rows || []) as OutboxRow[]) {
    const rendered = renderTemplate(row.template_key, row.payload);
    if (!rendered) {
      // Unknown template -- not retryable, mark failed rather than looping forever.
      await db.from("email_outbox").update({
        status: "failed", failed_at: new Date().toISOString(), last_error: `Unknown template_key: ${row.template_key}`,
      }).eq("id", row.id);
      skipped++;
      continue;
    }

    try {
      const resendRes = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
          // Security audit finding (Phase 5 review): our own bookkeeping
          // can't fully guarantee we never re-attempt a row after Resend
          // already accepted it (e.g. this function is killed between the
          // fetch() succeeding and the status='sent' write landing, so the
          // row gets reclaimed as stale and retried). Passing the outbox
          // row's id as Resend's Idempotency-Key means even a genuine
          // duplicate call for the same row is deduplicated by Resend
          // itself, not just by us -- so a retry can never cause a second
          // email to actually reach the recipient.
          "Idempotency-Key": `email_outbox:${row.id}`,
        },
        body: JSON.stringify({
          from: RESEND_FROM_ADDRESS,
          to: [row.recipient_email],
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        }),
      });

      if (resendRes.ok) {
        await db.from("email_outbox").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id);
        sent++;
      } else {
        const errText = await resendRes.text();
        const nextAttempt = row.attempt_count + 1;
        const isFinal = nextAttempt >= MAX_ATTEMPTS;
        await db.from("email_outbox").update({
          status: isFinal ? "failed" : "pending",
          attempt_count: nextAttempt,
          next_attempt_at: new Date(Date.now() + backoffMinutes(nextAttempt) * 60_000).toISOString(),
          failed_at: isFinal ? new Date().toISOString() : null,
          last_error: `Resend ${resendRes.status}: ${errText.slice(0, 500)}`,
        }).eq("id", row.id);
        failed++;
      }
    } catch (e) {
      const nextAttempt = row.attempt_count + 1;
      const isFinal = nextAttempt >= MAX_ATTEMPTS;
      await db.from("email_outbox").update({
        status: isFinal ? "failed" : "pending",
        attempt_count: nextAttempt,
        next_attempt_at: new Date(Date.now() + backoffMinutes(nextAttempt) * 60_000).toISOString(),
        failed_at: isFinal ? new Date().toISOString() : null,
        last_error: `Network/exception: ${String(e).slice(0, 500)}`,
      }).eq("id", row.id);
      failed++;
    }
  }

  return json({ ok: true, processed: rows?.length || 0, sent, failed, skipped });
});
