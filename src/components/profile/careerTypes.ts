import type { Database } from "@/integrations/supabase/types";

export type ExperienceRow = Database["public"]["Tables"]["experience"]["Row"];
export type EducationRow = Database["public"]["Tables"]["education"]["Row"];
export type LanguageRow = Database["public"]["Tables"]["languages"]["Row"];
export type CertificateRow = Database["public"]["Tables"]["certificates"]["Row"];

// ---------------------------------------------------------------------------
// Language proficiency — matches the CHECK constraint on public.languages
// ---------------------------------------------------------------------------
export const LANGUAGE_PROFICIENCIES = [
  "elementary",
  "limited_working",
  "professional_working",
  "full_professional",
  "native",
] as const;

export type LanguageProficiency = (typeof LANGUAGE_PROFICIENCIES)[number];

export const PROFICIENCY_LABEL: Record<LanguageProficiency, string> = {
  elementary: "Elementary proficiency",
  limited_working: "Limited working proficiency",
  professional_working: "Professional working proficiency",
  full_professional: "Full professional proficiency",
  native: "Native or bilingual proficiency",
};

// ---------------------------------------------------------------------------
// Employment types (free text stored; this is just the picker list)
// ---------------------------------------------------------------------------
export const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Self-employed",
  "Freelance",
  "Contract",
  "Internship",
  "Apprenticeship",
  "Seasonal",
] as const;

// ---------------------------------------------------------------------------
// Projects live in profiles.projects (jsonb array). This is the entry shape
// the profile UI reads/writes — the store itself is untyped jsonb.
// ---------------------------------------------------------------------------
export interface ProjectEntry {
  id: string;
  title: string;
  description?: string;
  url?: string;
  start_date?: string; // YYYY-MM-DD
  end_date?: string;
  is_ongoing?: boolean;
  skills?: string[];
}

export function parseProjects(raw: unknown): ProjectEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p, i) => ({
      id: typeof p.id === "string" && p.id ? p.id : `project_${i}`,
      title: typeof p.title === "string" ? p.title : "",
      description: typeof p.description === "string" ? p.description : undefined,
      url: typeof p.url === "string" ? p.url : undefined,
      start_date: typeof p.start_date === "string" ? p.start_date : undefined,
      end_date: typeof p.end_date === "string" ? p.end_date : undefined,
      is_ongoing: Boolean(p.is_ongoing),
      skills: Array.isArray(p.skills)
        ? (p.skills.filter((s) => typeof s === "string") as string[])
        : undefined,
    }))
    .filter((p) => p.title.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Date helpers — DB columns are `date` (YYYY-MM-DD). Display as "Mon YYYY".
// ---------------------------------------------------------------------------
export function formatMonthYear(d?: string | null): string {
  if (!d) return "";
  const parsed = new Date(`${d}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function formatRange(
  start?: string | null,
  end?: string | null,
  current?: boolean | null
): string {
  const s = formatMonthYear(start);
  if (!s && !end && !current) return "";
  const e = current ? "Present" : formatMonthYear(end);
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

/** Sort key: most recent first (current entries first, then by start date). */
export function byRecency<T extends { start_date?: string | null; end_date?: string | null; is_current?: boolean | null; created_at?: string }>(
  a: T,
  b: T
): number {
  const aCur = a.is_current ? 1 : 0;
  const bCur = b.is_current ? 1 : 0;
  if (aCur !== bCur) return bCur - aCur;
  const ak = a.end_date || a.start_date || a.created_at || "";
  const bk = b.end_date || b.start_date || b.created_at || "";
  return bk.localeCompare(ak);
}
