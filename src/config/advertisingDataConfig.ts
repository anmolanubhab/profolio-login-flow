import {
  Users,
  Building2,
  UsersRound,
  GraduationCap,
  Briefcase,
  BadgeCheck,
  LayoutTemplate,
  MapPin,
  Navigation,
  Sparkles,
  CalendarRange,
  VenetianMask,
  Radio,
  Inbox,
  BarChart3,
  Share2,
  type LucideIcon,
} from 'lucide-react';

/**
 * Settings -> Advertising data.
 *
 * LinkedIn's "Advertising data" page is the UX reference; it is NOT the source
 * of truth for what Profolio actually holds. Every one of the 16 rows is mapped
 * to a real Profolio capability:
 *
 *   'linked'          -> Profolio genuinely stores data of this type. The detail
 *                        page shows a live summary + a deep-link to manage it,
 *                        plus a real, persisted permission
 *                        (profiles.preferences.data_use.<prefKey>, default ON)
 *                        governing whether that data may personalise your
 *                        Profolio experience.
 *   'personalisation' -> the one real activity-personalisation control, backed
 *                        by the existing profiles.preferences
 *                        .personalized_recommendations flag (gates the "For You"
 *                        feed ranking).
 *   'future'          -> Profolio has no such capability yet. A real preference
 *                        is stored (default OFF) so the choice is ready, but the
 *                        control is disabled until the capability ships.
 *   'not-collected'   -> Profolio does not collect / does not do this. The
 *                        detail page is informational only. No control, nothing
 *                        stored.
 *
 * Nothing here fabricates data or shows a value that isn't the user's real
 * stored state.
 */

export type AdvertisingDataKind = 'linked' | 'personalisation' | 'future' | 'not-collected';

export type AdvertisingDataTopicId =
  | 'connections'
  | 'companies-followed'
  | 'groups'
  | 'education-skills'
  | 'job-information'
  | 'employer'
  | 'customized-display-format'
  | 'profile-location'
  | 'inferred-city-location'
  | 'interests-and-traits'
  | 'age-range'
  | 'gender'
  | 'ads-off-profolio'
  | 'data-from-others'
  | 'measure-ad-success'
  | 'affiliates-partners';

/** Keys under profiles.preferences.data_use. All default to `true` (absent = true). */
export type DataUsePrefKey =
  | 'connections'
  | 'companies_followed'
  | 'groups'
  | 'education_skills'
  | 'job_information'
  | 'employer'
  | 'profile_location'
  | 'ads_off_profolio'
  | 'measure_ad_success';

export interface AdvertisingDataTopic {
  id: AdvertisingDataTopicId;
  section: 'profile' | 'activity' | 'off-platform';
  kind: AdvertisingDataKind;
  title: string;
  icon: LucideIcon;
  /** Short line under the title on the list page. */
  listBlurb: string;
  /** What the detail page explains this controls / represents. */
  detailBody: string;
  /** 'linked' + 'future' rows: the preferences.data_use key. */
  prefKey?: DataUsePrefKey;
  /** 'linked' rows: which live data snapshot to load. */
  dataKey?:
    | 'connections'
    | 'companiesFollowed'
    | 'groups'
    | 'educationSkills'
    | 'experience'
    | 'currentEmployer'
    | 'profileLocation';
  /** 'linked' rows: in-app route where the user manages this data. */
  manageRoute?: string;
  manageLabel?: string;
  /** 'future' rows: one-liner shown where the disabled control sits. */
  futureNote?: string;
}

export const ADVERTISING_DATA_SECTIONS: {
  id: AdvertisingDataTopic['section'];
  title: string;
}[] = [
  { id: 'profile', title: 'Profile data' },
  { id: 'activity', title: 'Activity and inferred data' },
  { id: 'off-platform', title: 'Off‑Profolio data' },
];

export const ADVERTISING_DATA_TOPICS: AdvertisingDataTopic[] = [
  // ---------------- Profile data ----------------
  {
    id: 'connections',
    section: 'profile',
    kind: 'linked',
    title: 'Connections',
    icon: Users,
    listBlurb: 'Use your connections to personalise suggestions',
    detailBody:
      'Profolio can use who you’re connected to when ranking people, companies and posts to suggest to you. It is never shared with advertisers or used to build an ad‑targeting profile.',
    prefKey: 'connections',
    dataKey: 'connections',
    manageRoute: '/network',
    manageLabel: 'Manage your network',
  },
  {
    id: 'companies-followed',
    section: 'profile',
    kind: 'linked',
    title: 'Companies you follow',
    icon: Building2,
    listBlurb: 'Your choice for if the companies you follow are ever used to personalise Profolio',
    detailBody:
      'These are the companies you follow on Profolio. Profolio does not currently use them to personalise any suggestions, your feed or anything else, and it shows you no third‑party ads. This switch records your choice, so that if a feature ever draws on the companies you follow, it starts from your preference. It is never sold or shared with advertisers or partners.',
    prefKey: 'companies_followed',
    dataKey: 'companiesFollowed',
    manageRoute: '/companies',
    manageLabel: 'Browse companies',
  },
  {
    id: 'groups',
    section: 'profile',
    kind: 'linked',
    title: 'Groups',
    icon: UsersRound,
    listBlurb: 'Your choice for if your group memberships are ever used to personalise Profolio',
    detailBody:
      'These are the groups you’ve joined. Profolio does not currently use your group memberships to personalise which groups, people or discussions it shows you, or anything else, and it shows you no third‑party ads. This switch records your choice, so that if a feature ever uses group membership, it starts from your preference. It is never sold or shared with advertisers or partners.',
    prefKey: 'groups',
    dataKey: 'groups',
    manageRoute: '/groups',
    manageLabel: 'View your groups',
  },
  {
    id: 'education-skills',
    section: 'profile',
    kind: 'linked',
    title: 'Education and skills',
    icon: GraduationCap,
    listBlurb: 'Your choice for if your education, skills and languages are ever used to personalise Profolio',
    detailBody:
      'This is the education, skills and languages on your profile. Profolio does not currently use them to personalise the jobs, people or content it recommends, or anything else, and it shows you no third‑party ads. This switch records your choice, so that if a feature ever matches recommendations to your background, it starts from your preference. It is never sold or shared with advertisers or partners.',
    prefKey: 'education_skills',
    dataKey: 'educationSkills',
    manageRoute: '/profile',
    manageLabel: 'Edit your profile',
  },
  {
    id: 'job-information',
    section: 'profile',
    kind: 'linked',
    title: 'Job information',
    icon: Briefcase,
    listBlurb: 'Your choice for if your roles and experience are ever used to personalise Profolio',
    detailBody:
      'This is the work history on your profile. Profolio does not currently use your roles and experience to personalise the jobs, people or posts it recommends, or anything else, and it shows you no third‑party ads. This switch records your choice, so that if a feature ever draws on your work history, it starts from your preference. It is never sold or shared with advertisers or partners.',
    prefKey: 'job_information',
    dataKey: 'experience',
    manageRoute: '/profile',
    manageLabel: 'Edit your experience',
  },
  {
    id: 'employer',
    section: 'profile',
    kind: 'linked',
    title: 'Employer',
    icon: BadgeCheck,
    listBlurb: 'Your choice for if your current employer is ever used to personalise Profolio',
    detailBody:
      'This is the experience on your profile marked “I currently work here”. Profolio does not currently use your current employer to suggest colleagues, company updates or content, or anything else, and it shows you no third‑party ads. This switch records your choice, so that if a feature ever uses your current employer, it starts from your preference. It is never sold or shared with advertisers or partners.',
    prefKey: 'employer',
    dataKey: 'currentEmployer',
    manageRoute: '/profile',
    manageLabel: 'Edit your experience',
  },
  {
    id: 'customized-display-format',
    section: 'profile',
    kind: 'not-collected',
    title: 'Customised display format',
    icon: LayoutTemplate,
    listBlurb: 'Profolio doesn’t serve formatted ads to you',
    detailBody:
      'On some platforms this controls how sponsored content is formatted for you. Profolio shows no third‑party ads in your feed, so there is no display format to customise and nothing is stored.',
  },
  {
    id: 'profile-location',
    section: 'profile',
    kind: 'linked',
    title: 'Profile location',
    icon: MapPin,
    listBlurb: 'Your choice for if the location on your profile is ever used to personalise Profolio',
    detailBody:
      'This is the city/region you typed into your profile (Profolio never looks up a precise location). Profolio does not currently use it to recommend nearby jobs, people or companies, or anything else, and it shows you no third‑party ads. This switch records your choice, so that if a location‑based feature is ever added, it starts from your preference. It is never sold or shared with advertisers or partners.',
    prefKey: 'profile_location',
    dataKey: 'profileLocation',
    manageRoute: '/profile',
    manageLabel: 'Edit your profile',
  },

  // ---------------- Activity and inferred data ----------------
  {
    id: 'inferred-city-location',
    section: 'activity',
    kind: 'not-collected',
    title: 'Inferred city location',
    icon: Navigation,
    listBlurb: 'Profolio doesn’t infer your location',
    detailBody:
      'Profolio does not estimate your city from your IP address, device or activity. The only location used is the one you type into your profile — see “Profile location” above.',
  },
  {
    id: 'interests-and-traits',
    section: 'activity',
    kind: 'personalisation',
    title: 'Interests and traits',
    icon: Sparkles,
    listBlurb: 'Use your activity to personalise your “For You” feed',
    detailBody:
      'When this is on, Profolio uses your in‑app activity — the posts you react to, follow and mark “Interested” in — to rank your “For You” feed. Turn it off to see that feed strictly newest‑first. No interest or trait profile is built for advertising, and this is never shared.',
  },
  {
    id: 'age-range',
    section: 'activity',
    kind: 'not-collected',
    title: 'Age range',
    icon: CalendarRange,
    listBlurb: 'Profolio doesn’t collect your age or date of birth',
    detailBody:
      'Profolio has no date‑of‑birth or age field. No age or age‑range information is stored about you or used for any recommendation or advertising purpose.',
  },
  {
    id: 'gender',
    section: 'activity',
    kind: 'not-collected',
    title: 'Gender',
    icon: VenetianMask,
    listBlurb: 'Profolio doesn’t collect your gender',
    detailBody:
      'Profolio does not have a gender field and stores no gender information. (Pronouns are an optional, self‑expressed profile detail and are never used for targeting or recommendations.)',
  },

  // ---------------- Off-Profolio data ----------------
  {
    id: 'ads-off-profolio',
    section: 'off-platform',
    kind: 'future',
    title: 'Ads off Profolio',
    icon: Radio,
    listBlurb: 'Whether your Profolio data could personalise ads outside Profolio',
    detailBody:
      'Profolio does not operate an advertising network outside the app and shows you no ads on other sites. This preference is kept so that if such a feature is ever built, it starts switched off for you. It has no effect today.',
    prefKey: 'ads_off_profolio',
    futureNote: 'Not available — Profolio runs no external ad network. Kept off.',
  },
  {
    id: 'data-from-others',
    section: 'off-platform',
    kind: 'not-collected',
    title: 'Data from others for ads',
    icon: Inbox,
    listBlurb: 'Profolio receives no data about you from other businesses',
    detailBody:
      'Profolio does not ingest data about you from advertisers, data brokers or other businesses. There is no such data to use, and nothing is stored.',
  },
  {
    id: 'measure-ad-success',
    section: 'off-platform',
    kind: 'future',
    title: 'Measure ad success',
    icon: BarChart3,
    listBlurb: 'Whether your actions could measure the performance of ads shown to you',
    detailBody:
      'Profolio shows you no third‑party ads, so there is nothing to measure against your identity. Aggregate, k‑anonymised delivery analytics used by advertisers never identify individuals. This preference is stored so the choice is ready if user‑facing ads are ever introduced. It has no effect today.',
    prefKey: 'measure_ad_success',
    futureNote: 'Not available — no user‑facing ads to measure. Kept off.',
  },
  {
    id: 'affiliates-partners',
    section: 'off-platform',
    kind: 'not-collected',
    title: 'Share data with affiliates and partners',
    icon: Share2,
    listBlurb: 'Profolio doesn’t share your data with affiliates or partners',
    detailBody:
      'Profolio does not share your personal data with affiliates, partners or third parties for advertising or any other purpose. There is nothing to turn on or off.',
  },
];

export const ADVERTISING_DATA_TOPIC_MAP: Record<AdvertisingDataTopicId, AdvertisingDataTopic> =
  ADVERTISING_DATA_TOPICS.reduce(
    (acc, t) => {
      acc[t.id] = t;
      return acc;
    },
    {} as Record<AdvertisingDataTopicId, AdvertisingDataTopic>,
  );

export function isAdvertisingDataTopicId(v: string | undefined): v is AdvertisingDataTopicId {
  return !!v && v in ADVERTISING_DATA_TOPIC_MAP;
}

/** Defaults for every data_use key. */
export const DATA_USE_DEFAULTS: Record<DataUsePrefKey, boolean> = {
  connections: true,
  companies_followed: true,
  groups: true,
  education_skills: true,
  job_information: true,
  employer: true,
  profile_location: true,
  ads_off_profolio: false,
  measure_ad_success: false,
};
