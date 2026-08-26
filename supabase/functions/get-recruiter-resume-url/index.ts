import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SIGNED_URL_TTL_SECONDS = 300;

function denied() {
  return new Response(JSON.stringify({ ok: false, status: "not_authorized" }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return denied();

    const { application_id } = await req.json();
    if (!application_id || typeof application_id !== "string") {
      return new Response(JSON.stringify({ ok: false, status: "invalid_request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Caller-context client: preserves the caller's own JWT, so auth.uid()
    // resolves correctly inside the SQL functions it calls. Used ONLY to
    // make the authorization decision, by reusing B8's already-live-tested
    // get_application_resume() -- not by re-implementing
    // is_job_recruiter()/is_blocked_by()/resume_sharing_revoked here.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return denied();

    const { data: resumeRows, error: resumeError } = await userClient.rpc("get_application_resume", {
      p_application_id: application_id,
    });
    if (resumeError) return denied();

    const resumeResult = Array.isArray(resumeRows) ? resumeRows[0] : resumeRows;
    if (!resumeResult || resumeResult.status !== "ok") return denied();

    const content = resumeResult.resume_content as { type?: string } | null;
    if (!content || content.type !== "pdf") {
      return new Response(JSON.stringify({ ok: false, status: "not_a_pdf" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Privileged client: only used now, after authorization already passed
    // above using the caller's own identity. Never trusts any client-
    // supplied storage path -- resolves it itself from the application row.
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: appRow, error: appError } = await serviceClient
      .from("hiring_applications")
      .select("resume_file_path")
      .eq("id", application_id)
      .maybeSingle();

    if (appError || !appRow?.resume_file_path) return denied();

    const { data: signedData, error: signedError } = await serviceClient.storage
      .from("resumes")
      .createSignedUrl(appRow.resume_file_path, SIGNED_URL_TTL_SECONDS);

    if (signedError || !signedData?.signedUrl) return denied();

    return new Response(
      JSON.stringify({ ok: true, expiresIn: SIGNED_URL_TTL_SECONDS, url: signedData.signedUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("get-recruiter-resume-url error:", e);
    return denied();
  }
});
