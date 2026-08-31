// ---------------------------------------------------------------------------
// Profile Strength engine — the SINGLE source of truth for the profile
// completion score, level, and recommendations. Pure function, no React, no
// I/O. Every input is a real Profolio field or a real section row count.
//
// LinkedIn inspires the interaction model (recommendation -> open the editor
// -> save -> the recommendation clears). The score itself is a transparent
// Profolio model (LinkedIn no longer exposes one). Nothing here is hard-coded
// or faked — a section that does not exist in Profolio earns 0.
// ---------------------------------------------------------------------------

export type StrengthCategory = 'completeness' | 'quality' | 'discoverability';

/** What the widget/sheet needs to route the user to the right editor.
 *  Reuses the app's existing edit surfaces — no second creation path. */
export type StrengthAction =
  | { type: 'editProfile' } //  name / headline / about / location  (EditProfileDialog)
  | { type: 'editContact' } //  phone / links                       (ContactInfoDialog)
  | { type: 'section'; key: 'experience' | 'education' | 'skills' | 'certifications' | 'projects' | 'languages' }
  | { type: 'resume' } //       /resume
  | { type: 'photo' }; //       banner camera buttons (scroll to header)

export interface StrengthItem {
  id: string;
  label: string;
  category: StrengthCategory;
  /** points this item is worth (all items sum to 100) */
  points: number;
  /** points actually earned (0..points, supports partial milestones) */
  earned: number;
  /** fully earned */
  done: boolean;
  action: StrengthAction;
}

export interface StrengthRecommendation {
  id: string;
  title: string;
  detail: string;
  /** points still on the table for this item */
  points: number;
  action: StrengthAction;
  category: StrengthCategory;
}

export interface ProfileStrengthResult {
  /** 0..100, rounded */
  score: number;
  /** same number, kept as an explicit name for the accessible progress value */
  percentage: number;
  level: string;
  pointsEarned: number;
  pointsAvailable: number; // always 100
  items: StrengthItem[];
  completed: StrengthItem[];
  recommendations: StrengthRecommendation[]; // sorted, highest points first
}

// --- level thresholds — the ONE place to tune the bands --------------------
export const PROFILE_STRENGTH_LEVELS: { min: number; label: string }[] = [
  { min: 100, label: 'Complete' },
  { min: 90, label: 'Excellent' },
  { min: 76, label: 'Strong' },
  { min: 61, label: 'Good' },
  { min: 41, label: 'Developing' },
  { min: 21, label: 'Basic' },
  { min: 0, label: 'Just Started' },
];

export function strengthLevel(score: number): string {
  return (PROFILE_STRENGTH_LEVELS.find((l) => score >= l.min) ?? PROFILE_STRENGTH_LEVELS[PROFILE_STRENGTH_LEVELS.length - 1]).label;
}

// --- inputs --------------------------------------------------------------
export interface ProfileStrengthInput {
  // profiles row fields (only what the score reads)
  avatarUrl?: string | null;
  photoUrl?: string | null;
  coverUrl?: string | null;
  displayName?: string | null;
  fullName?: string | null;
  headline?: string | null;
  profession?: string | null;
  bio?: string | null;
  location?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  twitterUrl?: string | null;
  /** profiles.projects jsonb — array of project objects */
  projects?: unknown;
  /** profiles.skills text[] — legacy skill store, still counts */
  legacySkills?: unknown;

  // real section row counts (relational tables)
  experienceCount: number;
  educationCount: number;
  skillsCount: number;
  certificatesCount: number;
  languagesCount: number;
  resumesCount: number;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const nonEmpty = (v: unknown) => str(v).length > 0;

/** points for a milestone list: e.g. milestone(count, [[1,4],[3,8],[5,12]]) */
function milestone(count: number, tiers: [number, number][]): number {
  let earned = 0;
  for (const [need, pts] of tiers) if (count >= need) earned = pts;
  return earned;
}

export function calculateProfileStrength(input: ProfileStrengthInput): ProfileStrengthResult {
  const projectsArr = Array.isArray(input.projects) ? (input.projects as Record<string, unknown>[]) : [];
  const legacySkillsArr = Array.isArray(input.legacySkills) ? (input.legacySkills as unknown[]) : [];
  const skillsTotal = input.skillsCount + legacySkillsArr.length;

  const hasName = nonEmpty(input.displayName) || nonEmpty(input.fullName);
  const hasHeadline = nonEmpty(input.headline) || nonEmpty(input.profession);
  const bio = str(input.bio);
  const hasLocation = nonEmpty(input.location) || nonEmpty(input.address);
  const hasContact =
    nonEmpty(input.phone) ||
    nonEmpty(input.website) ||
    nonEmpty(input.linkedinUrl) ||
    nonEmpty(input.githubUrl) ||
    nonEmpty(input.twitterUrl);

  // a "quality" project has a description AND (link or media)
  const qualityProjects = projectsArr.filter((p) => {
    const desc = str(p.description) || str(p.summary);
    const link = str(p.link) || str(p.url) || str(p.demo) || str(p.repo);
    const media = str(p.image) || str(p.cover) || str(p.thumbnail) || (Array.isArray(p.media) && p.media.length > 0);
    return desc.length >= 20 && (link.length > 0 || media);
  }).length;

  const hasPhoto = nonEmpty(input.avatarUrl) || nonEmpty(input.photoUrl);

  // Weights sum to EXACTLY 100.
  const rawItems: StrengthItem[] = [
    {
      id: 'photo',
      label: 'Profile photo',
      category: 'completeness',
      points: 11,
      earned: hasPhoto ? 11 : 0,
      done: hasPhoto,
      action: { type: 'photo' },
    },
    {
      id: 'identity',
      label: 'Name & headline',
      category: 'discoverability',
      points: 11,
      earned: (hasName ? 5 : 0) + (hasHeadline ? 6 : 0),
      done: hasName && hasHeadline,
      action: { type: 'editProfile' },
    },
    {
      id: 'about',
      label: 'About',
      category: 'completeness',
      points: 11,
      // present -> 7, a real paragraph (>= 120 chars) -> 11. A short About is
      // never penalised; the remaining points surface as a quality nudge.
      earned: bio.length === 0 ? 0 : bio.length >= 120 ? 11 : 7,
      done: bio.length >= 120,
      action: { type: 'editProfile' },
    },
    {
      id: 'experience',
      label: 'Experience',
      category: 'completeness',
      points: 14,
      earned: milestone(input.experienceCount, [[1, 10], [2, 14]]),
      done: input.experienceCount >= 2,
      action: { type: 'section', key: 'experience' },
    },
    {
      id: 'education',
      label: 'Education',
      category: 'completeness',
      points: 9,
      earned: input.educationCount >= 1 ? 9 : 0,
      done: input.educationCount >= 1,
      action: { type: 'section', key: 'education' },
    },
    {
      id: 'skills',
      label: 'Skills',
      category: 'discoverability',
      points: 10,
      earned: milestone(skillsTotal, [[1, 3], [3, 7], [5, 10]]),
      done: skillsTotal >= 5,
      action: { type: 'section', key: 'skills' },
    },
    {
      id: 'projects',
      label: 'Projects',
      category: 'discoverability',
      points: 10,
      // 1 project -> 6; 2+ with description + link/media -> 10
      earned: projectsArr.length === 0 ? 0 : qualityProjects >= 2 ? 10 : 6,
      done: qualityProjects >= 2,
      action: { type: 'section', key: 'projects' },
    },
    {
      id: 'certifications',
      label: 'Licenses & certifications',
      category: 'completeness',
      points: 5,
      earned: input.certificatesCount >= 1 ? 5 : 0,
      done: input.certificatesCount >= 1,
      action: { type: 'section', key: 'certifications' },
    },
    {
      id: 'languages',
      label: 'Languages',
      category: 'completeness',
      points: 4,
      earned: input.languagesCount >= 1 ? 4 : 0,
      done: input.languagesCount >= 1,
      action: { type: 'section', key: 'languages' },
    },
    {
      id: 'resume',
      label: 'Resume',
      category: 'completeness',
      points: 5,
      earned: input.resumesCount >= 1 ? 5 : 0,
      done: input.resumesCount >= 1,
      action: { type: 'resume' },
    },
    {
      id: 'location',
      label: 'Location',
      category: 'discoverability',
      points: 4,
      earned: hasLocation ? 4 : 0,
      done: hasLocation,
      action: { type: 'editProfile' },
    },
    {
      id: 'contact',
      label: 'Contact & links',
      category: 'discoverability',
      points: 4,
      earned: hasContact ? 4 : 0,
      done: hasContact,
      action: { type: 'editContact' },
    },
    {
      id: 'cover',
      label: 'Cover image',
      category: 'completeness',
      points: 2,
      earned: nonEmpty(input.coverUrl) ? 2 : 0,
      done: nonEmpty(input.coverUrl),
      action: { type: 'photo' },
    },
  ];

  const pointsAvailable = rawItems.reduce((s, i) => s + i.points, 0); // 100 by construction
  const pointsEarned = rawItems.reduce((s, i) => s + i.earned, 0);
  const score = Math.round((pointsEarned / pointsAvailable) * 100);

  // --- recommendations: one per not-fully-earned item, richest first -----
  const REC_COPY: Record<string, { title: string; detail: string }> = {
    photo: { title: 'Add a profile photo', detail: 'Profiles with a photo get far more views. Use the camera button on your picture.' },
    identity: { title: 'Complete your name and headline', detail: 'A clear headline with your role and focus helps people (and recruiters) find you.' },
    about: { title: 'Write your About section', detail: 'A short professional introduction — what you do, what you are known for, what you are looking for.' },
    experience: { title: 'Add your experience', detail: 'List the roles you have held so people can understand your background.' },
    education: { title: 'Add your education', detail: 'Add a school, degree, or programme.' },
    skills: { title: 'Add more skills', detail: 'Add at least 5 relevant skills so people can discover you through skill search.' },
    projects: { title: 'Add a project', detail: 'Showcase your work with a description and a link or image — this is what sets a Profolio profile apart.' },
    certifications: { title: 'Add a certification', detail: 'Licenses and certifications add credibility.' },
    languages: { title: 'Add a language', detail: 'List the languages you speak.' },
    resume: { title: 'Add your resume', detail: 'Upload or build a resume so it is ready to share.' },
    location: { title: 'Add your location', detail: 'Location helps recruiters and connections in your area find you.' },
    contact: { title: 'Add contact details', detail: 'Add a phone number or a professional link so people can reach you.' },
    cover: { title: 'Add a cover image', detail: 'A cover image makes your profile feel finished.' },
  };

  const recommendations: StrengthRecommendation[] = rawItems
    .filter((i) => i.earned < i.points)
    .map((i) => ({
      id: i.id,
      title: REC_COPY[i.id]?.title ?? `Complete ${i.label}`,
      detail: REC_COPY[i.id]?.detail ?? '',
      points: i.points - i.earned,
      action: i.action,
      category: i.category,
    }))
    .sort((a, b) => b.points - a.points);

  return {
    score,
    percentage: score,
    level: strengthLevel(score),
    pointsEarned,
    pointsAvailable,
    items: rawItems,
    completed: rawItems.filter((i) => i.done),
    recommendations,
  };
}
