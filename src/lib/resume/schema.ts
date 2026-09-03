/**
 * Structured resume document model.
 *
 * The `resumes.content` column is jsonb, so this schema evolves without a
 * migration. `normalizeResume()` upgrades every historical shape we have ever
 * written (flat strings, partial arrays, `projects`, and the recruiter-upload
 * marker) into the current `ResumeDoc` so old saved resumes open cleanly and
 * are never silently dropped.
 */

export type TemplateId = 'aurora' | 'ledger' | 'sidebar' | 'minimal';
export type FontId = 'sans' | 'serif' | 'mono' | 'grotesk';
export type FontScale = 'compact' | 'normal' | 'roomy';
export type SectionId =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'custom';

export interface ResumeBasics {
  fullName: string;
  headline: string; // e.g. "Senior Product Designer"
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedin: string;
}

export interface ExperienceEntry {
  id: string;
  role: string;
  company: string;
  location: string;
  startDate: string; // free text, e.g. "Mar 2024"
  endDate: string; // free text, empty when current
  current: boolean;
  /** Sanitised HTML (tiptap output). Bullet list expected but not required. */
  description: string;
}

export interface EducationEntry {
  id: string;
  school: string;
  degree: string;
  field: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ProjectEntry {
  id: string;
  name: string;
  url: string;
  description: string;
}

export interface SkillEntry {
  id: string;
  name: string;
  /** 0 = no rating shown, 1-5 = dots on templates that support it. */
  level: number;
}

export interface CustomSection {
  id: string;
  title: string;
  /** Sanitised HTML. */
  body: string;
}

export interface ResumeDesign {
  template: TemplateId;
  accent: string; // hsl tribple string, e.g. "211 100% 40%"
  font: FontId;
  scale: FontScale;
  /** 0.85 - 1.3 multiplier applied to vertical rhythm. */
  spacing: number;
  /** Ordered, may omit sections the user has hidden. */
  order: SectionId[];
}

export interface ResumeDoc {
  /** Bumped when the shape changes in a non-back-compatible way. */
  v: 2;
  basics: ResumeBasics;
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  projects: ProjectEntry[];
  skills: SkillEntry[];
  custom: CustomSection[];
  design: ResumeDesign;
}

export const DEFAULT_ORDER: SectionId[] = [
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'custom',
];

export const DEFAULT_DESIGN: ResumeDesign = {
  template: 'aurora',
  accent: '211 100% 40%',
  font: 'sans',
  scale: 'normal',
  spacing: 1,
  order: [...DEFAULT_ORDER],
};

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyExperience(): ExperienceEntry {
  return {
    id: uid(),
    role: '',
    company: '',
    location: '',
    startDate: '',
    endDate: '',
    current: false,
    description: '',
  };
}

export function emptyEducation(): EducationEntry {
  return {
    id: uid(),
    school: '',
    degree: '',
    field: '',
    location: '',
    startDate: '',
    endDate: '',
    description: '',
  };
}

export function emptyProject(): ProjectEntry {
  return { id: uid(), name: '', url: '', description: '' };
}

export function emptySkill(): SkillEntry {
  return { id: uid(), name: '', level: 0 };
}

export function emptyCustom(): CustomSection {
  return { id: uid(), title: 'Custom section', body: '' };
}

export function emptyResume(): ResumeDoc {
  return {
    v: 2,
    basics: {
      fullName: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      website: '',
      linkedin: '',
    },
    summary: '',
    experience: [],
    education: [],
    projects: [],
    skills: [],
    custom: [],
    design: { ...DEFAULT_DESIGN, order: [...DEFAULT_ORDER] },
  };
}

/** True when the stored content is a recruiter-upload marker, not an editable doc. */
export function isUploadRecord(content: unknown): boolean {
  return (
    !!content &&
    typeof content === 'object' &&
    (content as Record<string, unknown>).type === 'upload'
  );
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function linesToHtml(text: string): string {
  const parts = text
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return `<p>${escapeHtml(parts[0])}</p>`;
  return `<ul>${parts.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Accept any historical `content` payload and return a valid ResumeDoc.
 * Never throws; unknown fields are ignored, missing fields get sane defaults.
 */
export function normalizeResume(content: unknown, fallbackTitle = ''): ResumeDoc {
  const doc = emptyResume();
  if (!content || typeof content !== 'object') {
    doc.basics.headline = fallbackTitle;
    return doc;
  }
  const c = content as Record<string, unknown>;

  // Already-current shape.
  if (c.v === 2 && c.basics) {
    return mergeDoc(doc, c);
  }

  const pi = (c.personalInfo && typeof c.personalInfo === 'object'
    ? (c.personalInfo as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  doc.basics = {
    fullName: asString(pi.name) || asString(c.name),
    headline: asString(c.headline) || fallbackTitle || asString(c.title),
    email: asString(pi.email),
    phone: asString(pi.phone),
    location: asString(pi.location),
    website: asString(pi.website),
    linkedin: asString(pi.linkedin),
  };

  doc.summary = asString(c.summary);

  // experience: string (legacy) | array of entries
  if (Array.isArray(c.experience)) {
    doc.experience = (c.experience as Record<string, unknown>[]).map((e) => ({
      ...emptyExperience(),
      id: asString(e.id) || uid(),
      role: asString(e.role) || asString(e.title),
      company: asString(e.company),
      location: asString(e.location),
      startDate: asString(e.startDate) || asString(e.start_date),
      endDate: asString(e.endDate) || asString(e.end_date),
      current: e.current === true || e.is_current === true,
      description: normalizeRichText(e.description),
    }));
  } else if (asString(c.experience).trim()) {
    doc.experience = [
      { ...emptyExperience(), role: 'Experience', description: linesToHtml(asString(c.experience)) },
    ];
  }

  // education: string (legacy) | array
  if (Array.isArray(c.education)) {
    doc.education = (c.education as Record<string, unknown>[]).map((e) => ({
      ...emptyEducation(),
      id: asString(e.id) || uid(),
      school: asString(e.institution) || asString(e.school),
      degree: asString(e.degree),
      field: asString(e.field) || asString(e.field_of_study),
      location: asString(e.location),
      startDate: asString(e.startDate) || asString(e.start_date),
      endDate: asString(e.endDate) || asString(e.end_date),
      description: normalizeRichText(e.description),
    }));
  } else if (asString(c.education).trim()) {
    doc.education = [
      { ...emptyEducation(), school: asString(c.education) },
    ];
  }

  // projects: array
  if (Array.isArray(c.projects)) {
    doc.projects = (c.projects as Record<string, unknown>[]).map((p) => ({
      ...emptyProject(),
      id: asString(p.id) || uid(),
      name: asString(p.name),
      url: asString(p.url),
      description:
        normalizeRichText(p.description) ||
        (asString(p.technologies).trim()
          ? `<p>${escapeHtml(asString(p.technologies))}</p>`
          : ''),
    }));
  }

  // skills: string (comma list) | array of strings | array of entries
  if (Array.isArray(c.skills)) {
    doc.skills = (c.skills as unknown[])
      .map((s) => {
        if (typeof s === 'string') return { ...emptySkill(), name: s };
        const so = s as Record<string, unknown>;
        return {
          ...emptySkill(),
          id: asString(so.id) || uid(),
          name: asString(so.name) || asString(so.skill_name),
          level: typeof so.level === 'number' ? so.level : 0,
        };
      })
      .filter((s) => s.name.trim());
  } else if (asString(c.skills).trim()) {
    doc.skills = asString(c.skills)
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ ...emptySkill(), name }));
  }

  if (c.design && typeof c.design === 'object') {
    doc.design = mergeDesign(doc.design, c.design as Record<string, unknown>);
  }

  return doc;
}

function normalizeRichText(v: unknown): string {
  const s = asString(v);
  if (!s.trim()) return '';
  // Looks like HTML already.
  if (/<\/?[a-z][\s\S]*>/i.test(s)) return s;
  return linesToHtml(s);
}

function mergeDesign(
  base: ResumeDesign,
  d: Record<string, unknown>,
): ResumeDesign {
  const templates: TemplateId[] = ['aurora', 'ledger', 'sidebar', 'minimal'];
  const fonts: FontId[] = ['sans', 'serif', 'mono', 'grotesk'];
  const scales: FontScale[] = ['compact', 'normal', 'roomy'];
  const order = Array.isArray(d.order)
    ? (d.order as unknown[]).filter((x): x is SectionId =>
        DEFAULT_ORDER.includes(x as SectionId),
      )
    : base.order;
  return {
    template: templates.includes(d.template as TemplateId)
      ? (d.template as TemplateId)
      : base.template,
    accent: typeof d.accent === 'string' ? d.accent : base.accent,
    font: fonts.includes(d.font as FontId) ? (d.font as FontId) : base.font,
    scale: scales.includes(d.scale as FontScale)
      ? (d.scale as FontScale)
      : base.scale,
    spacing:
      typeof d.spacing === 'number' && d.spacing >= 0.7 && d.spacing <= 1.5
        ? d.spacing
        : base.spacing,
    order: order.length ? dedupeOrder(order) : base.order,
  };
}

function dedupeOrder(order: SectionId[]): SectionId[] {
  const seen = new Set<SectionId>();
  const out: SectionId[] = [];
  for (const s of order) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  for (const s of DEFAULT_ORDER) if (!seen.has(s)) out.push(s);
  return out;
}

function mergeDoc(base: ResumeDoc, c: Record<string, unknown>): ResumeDoc {
  const b = (c.basics ?? {}) as Record<string, unknown>;
  return {
    v: 2,
    basics: {
      fullName: asString(b.fullName),
      headline: asString(b.headline),
      email: asString(b.email),
      phone: asString(b.phone),
      location: asString(b.location),
      website: asString(b.website),
      linkedin: asString(b.linkedin),
    },
    summary: asString(c.summary),
    experience: Array.isArray(c.experience)
      ? (c.experience as Record<string, unknown>[]).map((e) => ({
          ...emptyExperience(),
          ...e,
          id: asString(e.id) || uid(),
        }))
      : [],
    education: Array.isArray(c.education)
      ? (c.education as Record<string, unknown>[]).map((e) => ({
          ...emptyEducation(),
          ...e,
          id: asString(e.id) || uid(),
        }))
      : [],
    projects: Array.isArray(c.projects)
      ? (c.projects as Record<string, unknown>[]).map((p) => ({
          ...emptyProject(),
          ...p,
          id: asString(p.id) || uid(),
        }))
      : [],
    skills: Array.isArray(c.skills)
      ? (c.skills as Record<string, unknown>[]).map((s) => ({
          ...emptySkill(),
          ...s,
          id: asString(s.id) || uid(),
        }))
      : [],
    custom: Array.isArray(c.custom)
      ? (c.custom as Record<string, unknown>[]).map((s) => ({
          ...emptyCustom(),
          ...s,
          id: asString(s.id) || uid(),
        }))
      : [],
    design: mergeDesign(base.design, (c.design ?? {}) as Record<string, unknown>),
  };
}

/* ------------------------------------------------------------------ */
/* Completeness                                                        */
/* ------------------------------------------------------------------ */

export interface CompletenessItem {
  key: string;
  label: string;
  done: boolean;
}

export function completeness(doc: ResumeDoc): {
  percent: number;
  items: CompletenessItem[];
} {
  const hasText = (html: string) =>
    html.replace(/<[^>]*>/g, '').trim().length > 0;

  const items: CompletenessItem[] = [
    { key: 'name', label: 'Add your name', done: !!doc.basics.fullName.trim() },
    {
      key: 'headline',
      label: 'Add a professional headline',
      done: !!doc.basics.headline.trim(),
    },
    {
      key: 'contact',
      label: 'Add an email or phone',
      done: !!(doc.basics.email.trim() || doc.basics.phone.trim()),
    },
    { key: 'summary', label: 'Write a summary', done: hasText(doc.summary) },
    {
      key: 'experience',
      label: 'Add one work experience',
      done: doc.experience.some((e) => e.role.trim() || e.company.trim()),
    },
    {
      key: 'expDetail',
      label: 'Describe an experience',
      done: doc.experience.some((e) => hasText(e.description)),
    },
    {
      key: 'education',
      label: 'Add education',
      done: doc.education.some((e) => e.school.trim()),
    },
    {
      key: 'skills',
      label: 'Add at least 4 skills',
      done: doc.skills.filter((s) => s.name.trim()).length >= 4,
    },
  ];
  const done = items.filter((i) => i.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}
