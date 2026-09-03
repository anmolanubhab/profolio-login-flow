/**
 * Curated writing help. This is a hand-written library of resume phrasing —
 * NOT a language model. Every suggestion below was authored for this feature.
 * `polishBullet()` is a deterministic rewrite (verb strengthening + cleanup),
 * so it works offline, is reproducible, and never fabricates achievements.
 */

export interface PhraseBucket {
  /** Lower-case keywords that map a job title to this bucket. */
  match: string[];
  label: string;
  bullets: string[];
  skills: string[];
}

const GENERIC_BULLETS: string[] = [
  'Delivered {n} projects on schedule by breaking scope into weekly milestones and tracking risk early.',
  'Partnered with cross-functional teams to align on goals, trade-offs, and delivery timelines.',
  'Introduced a lightweight process change that cut turnaround time and reduced rework.',
  'Owned a workstream end to end, from problem definition through rollout and follow-up.',
  'Mentored teammates and ran onboarding, shortening ramp-up for new hires.',
  'Presented progress and results to stakeholders, translating detail into clear decisions.',
];

const GENERIC_SKILLS = [
  'Communication',
  'Stakeholder management',
  'Problem solving',
  'Project planning',
  'Data analysis',
  'Documentation',
];

const BUCKETS: PhraseBucket[] = [
  {
    match: ['product design', 'ux', 'ui design', 'designer', 'product designer'],
    label: 'Product & UX design',
    bullets: [
      'Led design from discovery to launch across web and mobile, improving task success in usability testing.',
      'Ran user research and synthesised findings into a prioritised backlog of design improvements.',
      'Built and maintained a component library, cutting design-to-build handoff time.',
      'Partnered with engineering on feasibility and shipped iteratively behind feature flags.',
      'Facilitated design critiques and workshops to align stakeholders on direction.',
      'Defined success metrics with product and measured impact after each release.',
    ],
    skills: [
      'User research',
      'Interaction design',
      'Prototyping',
      'Design systems',
      'Usability testing',
      'Figma',
      'Accessibility',
      'Information architecture',
    ],
  },
  {
    match: ['engineer', 'developer', 'software', 'full stack', 'frontend', 'backend'],
    label: 'Software engineering',
    bullets: [
      'Designed and shipped features across the stack, from API endpoints to UI, with test coverage.',
      'Reduced page load time by profiling hot paths and removing redundant network calls.',
      'Led code reviews and set conventions that improved consistency across the codebase.',
      'Built CI checks and automated deploys, cutting release time and manual steps.',
      'Diagnosed and fixed production incidents, then added monitoring to catch regressions.',
      'Broke a legacy module into smaller services to make it testable and easier to change.',
    ],
    skills: [
      'TypeScript',
      'React',
      'Node.js',
      'REST APIs',
      'PostgreSQL',
      'CI/CD',
      'Testing',
      'System design',
    ],
  },
  {
    match: ['data', 'analyst', 'analytics', 'scientist', 'bi'],
    label: 'Data & analytics',
    bullets: [
      'Built dashboards and self-serve reports that replaced recurring manual data pulls.',
      'Partnered with teams to define metrics and instrument events for reliable tracking.',
      'Ran analyses that informed roadmap decisions and quantified the impact of launches.',
      'Automated a weekly reporting pipeline, saving several hours per week.',
      'Cleaned and validated source data, improving trust in downstream numbers.',
    ],
    skills: [
      'SQL',
      'Python',
      'Data visualisation',
      'Experimentation',
      'ETL',
      'Statistics',
      'Dashboarding',
    ],
  },
  {
    match: ['sales', 'account', 'business development', 'retail'],
    label: 'Sales & accounts',
    bullets: [
      'Managed a pipeline of prospects and consistently met quota through disciplined follow-up.',
      'Built relationships with key accounts, increasing renewals and expansion revenue.',
      'Partnered with marketing to refine messaging based on objections heard in calls.',
      'Onboarded new customers and handed off cleanly to account management.',
      'Kept CRM records current so forecasting stayed accurate.',
    ],
    skills: [
      'Pipeline management',
      'Negotiation',
      'CRM',
      'Account planning',
      'Forecasting',
      'Customer discovery',
    ],
  },
  {
    match: ['marketing', 'growth', 'content', 'brand'],
    label: 'Marketing & growth',
    bullets: [
      'Planned and ran campaigns across channels, tracking cost per result against targets.',
      'Produced content on a regular cadence and measured engagement to guide the calendar.',
      'Ran experiments on messaging and landing pages, keeping the winners.',
      'Partnered with product and sales to keep positioning consistent.',
      'Built reporting that tied spend to pipeline and revenue.',
    ],
    skills: [
      'Campaign management',
      'SEO',
      'Content strategy',
      'Analytics',
      'Email marketing',
      'A/B testing',
      'Copywriting',
    ],
  },
  {
    match: ['manager', 'lead', 'director', 'head of'],
    label: 'Management & leadership',
    bullets: [
      'Built and led a team of {n}, setting goals, running 1:1s, and supporting career growth.',
      'Set quarterly priorities with stakeholders and kept delivery on track against them.',
      'Improved a key operating metric by removing bottlenecks and clarifying ownership.',
      'Hired and onboarded new team members, raising the bar on the interview process.',
      'Reported progress and risk to leadership with clear recommendations.',
    ],
    skills: [
      'People management',
      'Hiring',
      'Roadmapping',
      'Stakeholder management',
      'Operating cadence',
      'Coaching',
    ],
  },
];

export function bucketForTitle(title: string): PhraseBucket {
  const t = title.toLowerCase();
  for (const b of BUCKETS) {
    if (b.match.some((m) => t.includes(m))) return b;
  }
  return {
    match: [],
    label: 'General',
    bullets: GENERIC_BULLETS,
    skills: GENERIC_SKILLS,
  };
}

export function suggestBullets(title: string, query = ''): string[] {
  const b = bucketForTitle(title);
  const pool = [...b.bullets, ...GENERIC_BULLETS];
  const seen = new Set<string>();
  const unique = pool.filter((x) => (seen.has(x) ? false : seen.add(x)));
  const q = query.trim().toLowerCase();
  if (!q) return unique;
  return unique.filter((x) => x.toLowerCase().includes(q));
}

export function suggestSkills(title: string): string[] {
  const b = bucketForTitle(title);
  const seen = new Set<string>();
  return [...b.skills, ...GENERIC_SKILLS].filter((x) =>
    seen.has(x.toLowerCase()) ? false : seen.add(x.toLowerCase()),
  );
}

/* ------------------------------------------------------------------ */
/* Deterministic bullet polish                                         */
/* ------------------------------------------------------------------ */

const WEAK_OPENERS: Record<string, string> = {
  'responsible for': 'Owned',
  'worked on': 'Delivered',
  'helped with': 'Contributed to',
  'helped to': 'Helped',
  'was tasked with': 'Led',
  'in charge of': 'Led',
  'assisted in': 'Supported',
  'assisted with': 'Supported',
  'part of a team that': 'Partnered to',
  'duties included': 'Delivered',
};

const FILLERS = [
  /\bvarious\b/gi,
  /\bsuccessfully\b/gi,
  /\bin order to\b/gi,
  /\bbasically\b/gi,
  /\ba lot of\b/gi,
];

export interface PolishResult {
  text: string;
  changed: boolean;
  notes: string[];
}

/** Strengthen a single bullet line. Pure + reproducible. */
export function polishBullet(input: string): PolishResult {
  const notes: string[] = [];
  let text = input.replace(/\s+/g, ' ').trim();
  if (!text) return { text: input, changed: false, notes };
  const original = text;

  const lower = text.toLowerCase();
  for (const [weak, strong] of Object.entries(WEAK_OPENERS)) {
    if (lower.startsWith(weak)) {
      text = strong + text.slice(weak.length);
      notes.push(`Replaced "${weak}" with a stronger verb`);
      break;
    }
    const idx = lower.indexOf(' ' + weak + ' ');
    if (idx !== -1) {
      text =
        text.slice(0, idx + 1) +
        strong.toLowerCase() +
        text.slice(idx + 1 + weak.length);
      notes.push(`Replaced "${weak}"`);
      break;
    }
  }

  for (const f of FILLERS) {
    if (f.test(text)) {
      text = text.replace(f, '').replace(/\s{2,}/g, ' ').trim();
      notes.push('Removed filler word');
    }
  }

  // Capitalise first letter.
  text = text.charAt(0).toUpperCase() + text.slice(1);
  // Drop trailing period for bullet style consistency.
  text = text.replace(/\.\s*$/, '');

  const changed = text !== original.replace(/\.\s*$/, '');
  if (!changed) notes.push('Already concise — no change needed');
  return { text, changed, notes: [...new Set(notes)] };
}

/** Split an HTML bullet list / paragraph blob into plain bullet strings. */
export function htmlToBullets(html: string): string[] {
  if (!html) return [];
  const li = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) =>
    stripTags(m[1]),
  );
  if (li.length) return li.filter(Boolean);
  const p = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) =>
    stripTags(m[1]),
  );
  if (p.length) return p.filter(Boolean);
  const plain = stripTags(html);
  return plain ? [plain] : [];
}

export function bulletsToHtml(bullets: string[]): string {
  const items = bullets.map((b) => b.trim()).filter(Boolean);
  if (!items.length) return '';
  return `<ul>${items.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
