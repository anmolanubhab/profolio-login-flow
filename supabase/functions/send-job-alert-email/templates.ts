// Phase 5: reusable email template registry. Keeping templates here (not
// hardcoded inline in the matching/outbox SQL logic, and not inline in
// index.ts's request-handling code) so future email types (application
// updates, messages, connections, etc.) can register a new template_key
// here without touching the send/retry/dedup plumbing at all.

export interface JobAlertPayload {
  job_id: string;
  job_title: string;
  company_name: string | null;
  score: number;
  explanation_text: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// Configurable via the APP_BASE_URL Edge Function secret -- deliberately
// NOT hardcoded to a guessed production domain (this repo's actual deployed
// URL wasn't confirmed at implementation time; see Phase 5 report). Falls
// back to a placeholder that's obviously wrong rather than silently linking
// to a domain that might not exist.
const JOBS_URL_BASE = Deno.env.get("APP_BASE_URL") || "https://SET_APP_BASE_URL_SECRET.invalid";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderJobAlertV1(payload: JobAlertPayload): RenderedEmail {
  const company = payload.company_name ? ` at ${escapeHtml(payload.company_name)}` : "";
  const jobUrl = `${JOBS_URL_BASE}/jobs?job=${encodeURIComponent(payload.job_id)}`;
  const subject = `${payload.score}% match: ${payload.job_title}${payload.company_name ? " at " + payload.company_name : ""}`;

  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1D2226;">
    <p style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">New job matching your profile</p>
    <h1 style="font-size: 20px; margin: 0 0 4px;">${escapeHtml(payload.job_title)}</h1>
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px;">${company.trim() ? escapeHtml(payload.company_name || "") : ""}</p>
    <div style="display: inline-block; background: #eef2ff; color: #1d4ed8; font-weight: 600; font-size: 14px; padding: 6px 12px; border-radius: 999px; margin-bottom: 16px;">
      ${payload.score}% Match
    </div>
    <p style="font-size: 14px; line-height: 1.5; margin: 0 0 20px;">${escapeHtml(payload.explanation_text)}</p>
    <a href="${jobUrl}" style="display: inline-block; background: #0066CC; color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 6px;">View Job</a>
    <p style="font-size: 12px; color: #9ca3af; margin-top: 32px;">
      You're receiving this because you opted in to job-match emails on Profolio.
      You can turn these off any time in Settings &gt; Notifications.
    </p>
  </div>`;

  const text = `New job matching your profile: ${payload.job_title}${company}\n${payload.score}% Match\n${payload.explanation_text}\n\nView job: ${jobUrl}\n\nYou're receiving this because you opted in to job-match emails on Profolio. Turn these off any time in Settings > Notifications.`;

  return { subject, html, text };
}

export function renderTemplate(templateKey: string, payload: unknown): RenderedEmail | null {
  switch (templateKey) {
    case "job_alert_v1":
      return renderJobAlertV1(payload as JobAlertPayload);
    default:
      return null;
  }
}
