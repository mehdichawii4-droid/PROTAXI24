import {
  validateAllowedExperienceIds,
  validateGuideBio,
  validateGuideLanguages,
  validateGuideSpecialties,
} from '@/services/guideService';
import { GUIDE_YEARS_EXPERIENCE_OPTIONS } from '@/constants/guideCatalog';
import type { GuideProfileFormValues } from '@/types/guideProfileForm';
import type { GuideFieldError } from '@/types/guide';

export function getGuideProfileFieldError(
  errors: GuideFieldError[],
  field: string,
): string | undefined {
  return errors.find((item) => item.field === field)?.message;
}

/** Validation UI alignée guideService / règles Firestore (sans I/O). */
export function validateGuideProfileFormValues(
  values: GuideProfileFormValues,
): GuideFieldError[] {
  const errors: GuideFieldError[] = [];

  if (!values.phone.trim()) {
    errors.push({ field: 'phone', message: 'Téléphone requis.' });
  }

  errors.push(...validateGuideBio(values.bio));
  errors.push(...validateGuideLanguages(values.languages));
  errors.push(...validateGuideSpecialties(values.specialties));
  errors.push(...validateAllowedExperienceIds(values.allowedExperienceIds));

  if (
    !GUIDE_YEARS_EXPERIENCE_OPTIONS.some((option) => option.id === values.yearsExperience)
  ) {
    errors.push({
      field: 'yearsExperience',
      message: 'Expérience professionnelle invalide.',
    });
  }

  return errors;
}

export function isGuideProfileFormValid(values: GuideProfileFormValues): boolean {
  return validateGuideProfileFormValues(values).length === 0;
}
