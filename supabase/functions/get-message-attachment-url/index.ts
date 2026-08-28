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

    const { message_id } = await req.json();
    if (!message_id || typeof message_id !== "string") {
      return new Response(JSON.stringify({ ok: false, status: "invalid_request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Caller-context client: preserves the caller's own JWT so auth.uid()
    // resolves correctly inside get_message_attachment(), which performs
    // the actual conversation-membership authorization check.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return denied();

    const { data: rows, error: rpcError } = await userClient.rpc("get_message_attachment", {
      p_message_id: message_id,
    });
    if (rpcError) return denied();

    const result = Array.isArray(rows) ? rows[0] : rows;
    if (!result || result.status !== "ok" || !result.storage_path) return denied();

    // Privileged client: only used now, after authorization already passed
    // above via the caller's own identity. The storage path is resolved
    // entirely server-side from the message record -- the client never
    // supplies or influences it.
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: signedData, error: signedError } = await serviceClient.storage
      .from("message-attachments")
      .createSignedUrl(result.storage_path, SIGNED_URL_TTL_SECONDS);

    if (signedError || !signedData?.signedUrl) return denied();

    return new Response(
      JSON.stringify({ ok: true, expiresIn: SIGNED_URL_TTL_SECONDS, url: signedData.signedUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("get-message-attachment-url error:", e);
    return denied();
  }
});
