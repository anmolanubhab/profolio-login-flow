import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// media-cleanup  (Phase 6C finalization)
//
// The `post-images` bucket's client DELETE is unreliable for the owner (see the
// Phase 6C report), and — more importantly — a client can't be trusted to
// decide an object is safe to delete (races, shared references). This function
// is the safe trust boundary:
//
//   mode: "prune"  { paths: string[] }
//     For each path: keep ONLY if it lives under `post-images/<caller uid>/`
//     AND is no longer referenced by ANY post (posts.media / image_url /
//     carousel_urls). Delete the survivors with the service role. Idempotent.
//     Used after an Edit-Post image removal and after a post is deleted.
//
//   mode: "sweep"  { limit?: number }   (1..100, default 50)
//     Bounded scan of the caller's OWN `post-images/<uid>/` folder for
//     unreferenced objects older than 24h; deletes them. Safe to run
//     repeatedly. Never touches another user's folder.
//
// Never deletes a path the caller doesn't own. Never deletes a referenced
// object. A failed individual delete is reported in `skipped`, not thrown.
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "post-images";
const SWEEP_MIN_AGE_MS = 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Accept a bare `<uid>/<file>` path or a full public URL; return the bare path. */
function toObjectPath(input: string): string {
  const m = input.match(/\/object\/public\/post-images\/(.+)$/);
  let out = m ? decodeURIComponent(m[1]) : input;
  out = out.replace(/^\/+/, "").replace(/^post-images\//, "");
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "unauthorized" }, 401);
    const uid = userData.user.id;
    const ownPrefix = `${uid}/`;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const mode = typeof body?.mode === "string" ? body.mode : "";

    // ---- resolve candidate object paths (all guaranteed caller-owned) -------
    let candidates: string[] = [];

    if (mode === "prune") {
      if (!Array.isArray(body.paths)) return json({ error: "paths[] required" }, 400);
      const seen = new Set<string>();
      for (const raw of body.paths) {
        if (typeof raw !== "string" || !raw) continue;
        const p = toObjectPath(raw);
        // caller-owned + exactly `<uid>/<file>` (matches the upload policy shape)
        if (p.startsWith(ownPrefix) && p.split("/").length === 2 && !seen.has(p)) {
          seen.add(p);
          candidates.push(p);
        }
      }
    } else if (mode === "sweep") {
      const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);
      const { data: list, error } = await admin.storage
        .from(BUCKET)
        .list(uid, { limit, sortBy: { column: "created_at", order: "asc" } });
      if (error) return json({ error: error.message }, 500);
      const cutoff = Date.now() - SWEEP_MIN_AGE_MS;
      candidates = (list ?? [])
        .filter((o) => o.name && (!o.created_at || Date.parse(o.created_at) < cutoff))
        .map((o) => `${uid}/${o.name}`);
    } else {
      return json({ error: "unknown mode (expected 'prune' or 'sweep')" }, 400);
    }

    if (candidates.length === 0) return json({ mode, deleted: [], skipped: [], referenced: [] });

    // ---- delete only the unreferenced ones --------------------------------
    const deleted: string[] = [];
    const referenced: string[] = [];
    const skipped: string[] = [];

    for (const path of candidates) {
      const { data: isRef, error: refErr } = await admin.rpc("storage_path_referenced", {
        p_path: path,
      });
      if (refErr) {
        skipped.push(path);
        continue;
      }
      if (isRef === true) {
        referenced.push(path);
        continue;
      }
      const { error: delErr } = await admin.storage.from(BUCKET).remove([path]);
      if (delErr) skipped.push(path);
      else deleted.push(path);
    }

    return json({ mode, deleted, referenced, skipped });
  } catch (e) {
    console.error("media-cleanup error:", e);
    return json({ error: e instanceof Error ? e.message : "cleanup failed" }, 500);
  }
});
