import { getGuideExperiencePickerOptions, getGuideSpecialtyLabel } from '@/constants/guideCatalog';
import type { GuideExperienceId } from '@/firebase/types';
import type { GuideFormInput } from '@/types/guide';
import type { GuideSelfProfile } from '@/types/guide';
import type { GuideProfileFormValues } from '@/types/guideProfileForm';

export function formatGuideTimestamp(value: unknown): string {
  if (!value) return '—';
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  else if (typeof value === 'object' && value !== null && 'toDate' in value) {
    date = (value as { toDate?: () => Date }).toDate?.() ?? null;
  }
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatGuideExperienceLabels(ids: GuideExperienceId[]): string {
  if (!ids.length) return '—';
  const labelById = new Map(
    getGuideExperiencePickerOptions().map((option) => [option.id, option.label]),
  );
  return ids.map((id) => labelById.get(id) ?? id).join(', ');
}

export function selfProfileToFormValues(profile: GuideSelfProfile): GuideProfileFormValues {
  return {
    phone: profile.phone,
    bio: profile.bio,
    languages: [...profile.languages],
    specialties: [...profile.specialties],
    yearsExperience: profile.yearsExperience,
    allowedExperienceIds: [...profile.allowedExperienceIds],
  };
}

export function buildGuideInputFromSelfProfile(
  profile: GuideSelfProfile,
  form: GuideProfileFormValues,
): GuideFormInput {
  return {
    guideUid: profile.uid,
    displayName: profile.displayName,
    phone: form.phone.trim(),
    email: profile.email,
    bio: form.bio.trim(),
    languages: [...form.languages],
    specialties: [...form.specialties],
    yearsExperience: form.yearsExperience,
    allowedExperienceIds: [...form.allowedExperienceIds],
    photoUrl: profile.photoUrl,
  };
}

export function isGuideProfileEditable(status: GuideSelfProfile['status']): boolean {
  return status === 'draft' || status === 'pending_review';
}
