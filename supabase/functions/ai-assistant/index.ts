import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { action, data } = await req.json();

    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "resume_summary": {
        const { name, education, skills, experience, goal } = data;
        systemPrompt = "You are a professional resume writer. Generate a compelling, concise professional summary (3-4 sentences) for a resume. Be specific, highlight strengths, and use action-oriented language. Return ONLY the summary text, no quotes or labels.";
        userPrompt = `Generate a professional resume summary for:
Name: ${name || "Not provided"}
Education: ${education || "Not provided"}
Skills: ${skills || "Not provided"}
Experience: ${experience || "Not provided"}
Career Goal: ${goal || "Not provided"}`;
        break;
      }

      case "skill_suggestions": {
        const { education: edu, experience: exp, currentSkills, profession } = data;
        systemPrompt = "You are a career advisor. Suggest 8-12 relevant skills based on the user's background. Return a JSON array of strings only, like [\"Skill1\", \"Skill2\"]. No explanation.";
        userPrompt = `Suggest relevant skills for:
Profession: ${profession || "Not provided"}
Education: ${edu || "Not provided"}
Experience: ${exp || "Not provided"}
Current Skills: ${currentSkills?.join(", ") || "None"}
Suggest skills they should add that they don't already have.`;
        break;
      }

      case "cover_letter": {
        const { jobTitle, companyName, jobDescription, candidateName, candidateSkills, candidateExperience } = data;
        systemPrompt = "You are an expert cover letter writer. Write a professional, personalized cover letter (3-4 paragraphs). Be specific to the job and candidate. Return ONLY the letter text.";
        userPrompt = `Write a cover letter for:
Job Title: ${jobTitle}
Company: ${companyName || "the company"}
Job Description: ${jobDescription || "Not provided"}
Candidate Name: ${candidateName || "the candidate"}
Candidate Skills: ${candidateSkills || "Not provided"}
Candidate Experience: ${candidateExperience || "Not provided"}`;
        break;
      }

      case "improve_text": {
        const { text, field } = data;
        systemPrompt = `You are a professional resume editor. Improve the given ${field || "text"} to be more impactful, professional, and ATS-friendly. Return ONLY the improved text.`;
        userPrompt = `Improve this ${field || "text"}:\n\n${text}`;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service unavailable");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ result: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
