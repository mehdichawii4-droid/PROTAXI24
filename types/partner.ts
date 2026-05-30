import type { PartnerStatus, PartnerType } from '@/firebase/types';

export type { PartnerStatus, PartnerType };

export type PartnerErrorCode =
  | 'PARTNER_ID_REQUIRED'
  | 'PARTNER_UID_MISMATCH'
  | 'PARTNER_NOT_FOUND'
  | 'PARTNER_ALREADY_EXISTS'
  | 'PARTNER_VALIDATION_FAILED'
  | 'PARTNER_STATUS_TRANSITION_INVALID'
  | 'PARTNER_PROFILE_NOT_EDITABLE'
  | 'PARTNER_NOT_ACTIVE'
  | 'PARTNER_HOTEL_SELF_ONLY'
  | 'FIRESTORE_PERMISSION_DENIED'
  | 'FIRESTORE_WRITE_FAILED';

export type PartnerFieldError = {
  field: string;
  message: string;
};

export type PartnerValidationResult = {
  ok: boolean;
  errors: PartnerFieldError[];
};

export type PartnerFormInput = {
  partnerUid: string;
  companyName: string;
  partnerType: PartnerType;
  contactName: string;
  phone: string;
  email: string;
  description: string;
  address?: string;
  city?: string;
  postalCode?: string;
  receptionPhone?: string;
  website?: string;
  internalNotes?: string;
  status?: PartnerStatus;
};

/** Profil partenaire exposé à l'espace hôtel (Phase 2 — sans notes admin). */
export type PartnerSelfProfile = {
  uid: string;
  companyName: string;
  partnerType: PartnerType;
  partnerTypeLabel: string;
  contactName: string;
  phone: string;
  email: string;
  status: PartnerStatus;
  statusLabel: string;
  isActive: boolean;
  description: string;
  address?: string;
  city?: string;
  postalCode?: string;
  receptionPhone?: string;
  website?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  validatedAt?: unknown;
};

export class PartnerServiceError extends Error {
  code: PartnerErrorCode;
  fieldErrors?: PartnerFieldError[];

  constructor(
    code: PartnerErrorCode,
    message: string,
    options?: { fieldErrors?: PartnerFieldError[]; cause?: unknown },
  ) {
    super(message);
    this.name = 'PartnerServiceError';
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
    if (options?.cause) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export type PartnerBookingType = 'transfer' | 'tour';

export type PartnerProfileRecord = {
  uid: string;
  companyName: string;
  partnerType: PartnerType;
  contactName: string;
  phone: string;
  email: string;
  isActive: boolean;
  createdAt?: unknown;
};

export type PartnerReservationItem = {
  id: string;
  kind: 'transfer' | 'excursion';
  title: string;
  subtitle: string;
  status: string;
  dateLabel: string;
  priceLabel: string;
  createdAtMs: number;
};

export type AdminPartnerListItem = {
  uid: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  partnerType: PartnerType;
  partnerTypeLabel: string;
  isActive: boolean;
  statusLabel: 'Actif' | 'Suspendu';
  totalBookings: number;
  totalRevenue: number;
  createdAt?: unknown;
};

export type AdminPartnerBookingPreview = {
  id: string;
  kind: 'transfer' | 'excursion';
  title: string;
  subtitle: string;
  status: string;
  priceLabel: string;
};

export type AdminPartnerDetail = Omit<AdminPartnerListItem, 'uid'> & {
  uid: string;
  recentBookings: AdminPartnerBookingPreview[];
};

/** Liste admin — hôtels partenaires (Phase 2 Lot 9). */
export type AdminHotelListItem = {
  uid: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  city?: string;
  status: PartnerStatus;
  statusLabel: string;
  isActive: boolean;
  descriptionPreview: string;
  validatedAt?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
};

/** Détail admin — hôtel partenaire (Phase 2 Lot 9). */
export type AdminHotelDetail = {
  uid: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address?: string;
  city?: string;
  postalCode?: string;
  receptionPhone?: string;
  website?: string;
  description: string;
  status: PartnerStatus;
  statusLabel: string;
  isActive: boolean;
  validatedAt?: unknown;
  validatedBy?: string;
  updatedAt?: unknown;
  createdAt?: unknown;
  internalNotes?: string;
};
