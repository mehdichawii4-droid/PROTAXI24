import type {
  GuideExperienceId,
  GuideSpecialty,
  GuideStatus,
  GuideYearsExperience,
} from '@/firebase/types';

export type GuideErrorCode =
  | 'GUIDE_ID_REQUIRED'
  | 'GUIDE_UID_MISMATCH'
  | 'GUIDE_NOT_FOUND'
  | 'GUIDE_ALREADY_EXISTS'
  | 'GUIDE_VALIDATION_FAILED'
  | 'GUIDE_STATUS_TRANSITION_INVALID'
  | 'GUIDE_PROFILE_NOT_EDITABLE'
  | 'GUIDE_NOT_ASSIGNABLE'
  | 'EXPERIENCE_NOT_RESOLVED'
  | 'BOOKING_NOT_FOUND'
  | 'BOOKING_GUIDE_NOT_REQUESTED'
  | 'BOOKING_NOT_EXPERIENCES_PRIVATE'
  | 'GUIDE_EXPERIENCE_NOT_ALLOWED'
  | 'FIRESTORE_PERMISSION_DENIED'
  | 'FIRESTORE_WRITE_FAILED';

export type GuideFieldError = {
  field: string;
  message: string;
};

export type GuideValidationResult = {
  ok: boolean;
  errors: GuideFieldError[];
};

export type GuideFormInput = {
  guideUid: string;
  displayName: string;
  phone: string;
  email: string;
  bio: string;
  languages: string[];
  specialties: GuideSpecialty[];
  yearsExperience: GuideYearsExperience;
  allowedExperienceIds: GuideExperienceId[];
  photoUrl?: string;
  internalNotes?: string;
  status?: GuideStatus;
};

export type AdminGuideListItem = {
  uid: string;
  displayName: string;
  phone: string;
  email: string;
  status: GuideStatus;
  statusLabel: string;
  specialtiesSummary: string;
  allowedExperienceCount: number;
  yearsExperience: GuideYearsExperience;
  createdAt?: unknown;
  updatedAt?: unknown;
  validatedAt?: unknown;
};

export type AdminGuideDetail = AdminGuideListItem & {
  bio: string;
  languages: string[];
  specialties: GuideSpecialty[];
  allowedExperienceIds: GuideExperienceId[];
  photoUrl?: string;
  internalNotes?: string;
  validatedBy?: string;
};

/** Profil guide exposé à l'espace guide (Phase 2 — sans notes admin). */
export type GuideSelfProfile = {
  uid: string;
  displayName: string;
  phone: string;
  email: string;
  status: GuideStatus;
  statusLabel: string;
  specialtiesSummary: string;
  allowedExperienceCount: number;
  yearsExperience: GuideYearsExperience;
  bio: string;
  languages: string[];
  specialties: GuideSpecialty[];
  allowedExperienceIds: GuideExperienceId[];
  photoUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  validatedAt?: unknown;
};

export type AssignableGuideOption = {
  uid: string;
  displayName: string;
  phone: string;
  specialtiesSummary: string;
};

export type AssignGuideResult = {
  bookingId: string;
  assignedGuideId: string;
  assignedGuideName: string;
};

/** Mission assignée — lecture seule côté guide (Guide Missions V1). */
export type GuideMissionItem = {
  id: string;
  experience: string;
  date: string;
  meetingPoint: string;
  clientName: string;
  travelers: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  statusBg: string;
  statusBorder: string;
  createdAtMs: number;
};

export class GuideServiceError extends Error {
  code: GuideErrorCode;
  fieldErrors?: GuideFieldError[];

  constructor(
    code: GuideErrorCode,
    message: string,
    options?: { fieldErrors?: GuideFieldError[]; cause?: unknown },
  ) {
    super(message);
    this.name = 'GuideServiceError';
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
    if (options?.cause) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}
