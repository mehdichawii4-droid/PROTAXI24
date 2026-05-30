import type { GuideExperienceId, GuideSpecialty, GuideYearsExperience } from '@/firebase/types';

/** Champs profil guide saisis par le guide (hors identité compte — lots 6+). */
export type GuideProfileFormValues = {
  phone: string;
  bio: string;
  languages: string[];
  specialties: GuideSpecialty[];
  yearsExperience: GuideYearsExperience;
  allowedExperienceIds: GuideExperienceId[];
};

export function createEmptyGuideProfileFormValues(): GuideProfileFormValues {
  return {
    phone: '',
    bio: '',
    languages: ['fr'],
    specialties: [],
    yearsExperience: '1-3',
    allowedExperienceIds: [],
  };
}
