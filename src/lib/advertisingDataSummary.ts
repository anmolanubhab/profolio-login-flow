import type { AdvertisingDataTopic } from '@/config/advertisingDataConfig';

/** Live snapshot of the caller's own data behind the "linked" rows. */
export interface AdvertisingDataSnapshot {
  connections: number | null;
  companiesFollowed: number | null;
  groups: number | null;
  education: number | null;
  skills: number | null;
  languages: number | null;
  experience: number | null;
  currentEmployer: string | null;
  profileLocation: string | null;
}

export const EMPTY_ADVERTISING_DATA_SNAPSHOT: AdvertisingDataSnapshot = {
  connections: null,
  companiesFollowed: null,
  groups: null,
  education: null,
  skills: null,
  languages: null,
  experience: null,
  currentEmployer: null,
  profileLocation: null,
};

/** Human summary of the real data behind a "linked" row. Never invents values. */
export function summariseAdvertisingData(
  dataKey: NonNullable<AdvertisingDataTopic['dataKey']>,
  d: AdvertisingDataSnapshot,
): string {
  switch (dataKey) {
    case 'connections':
      return d.connections == null
        ? 'Loading…'
        : d.connections === 0
          ? 'No connections yet'
          : `${d.connections} connection${d.connections === 1 ? '' : 's'}`;
    case 'companiesFollowed':
      return d.companiesFollowed == null
        ? 'Loading…'
        : d.companiesFollowed === 0
          ? 'Not following any companies'
          : `Following ${d.companiesFollowed} compan${d.companiesFollowed === 1 ? 'y' : 'ies'}`;
    case 'groups':
      return d.groups == null
        ? 'Loading…'
        : d.groups === 0
          ? 'Not in any groups'
          : `${d.groups} group${d.groups === 1 ? '' : 's'}`;
    case 'educationSkills': {
      if (d.education == null) return 'Loading…';
      const parts: string[] = [];
      if (d.education) parts.push(`${d.education} school${d.education === 1 ? '' : 's'}`);
      if (d.skills) parts.push(`${d.skills} skill${d.skills === 1 ? '' : 's'}`);
      if (d.languages) parts.push(`${d.languages} language${d.languages === 1 ? '' : 's'}`);
      return parts.length ? parts.join(' · ') : 'Nothing added yet';
    }
    case 'experience':
      return d.experience == null
        ? 'Loading…'
        : d.experience === 0
          ? 'No experience added'
          : `${d.experience} position${d.experience === 1 ? '' : 's'}`;
    case 'currentEmployer':
      return d.currentEmployer == null && d.experience == null
        ? 'Loading…'
        : d.currentEmployer
          ? d.currentEmployer
          : 'No current employer set';
    case 'profileLocation':
      return d.profileLocation == null && d.connections == null
        ? 'Loading…'
        : d.profileLocation
          ? d.profileLocation
          : 'No location added';
    default:
      return '';
  }
}
