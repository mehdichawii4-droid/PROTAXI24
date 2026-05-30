import { Timestamp } from 'firebase/firestore';

export type UserRole = 'client' | 'driver' | 'admin' | 'partner' | 'guide';

export type UserCollection = 'users' | 'drivers' | 'admins' | 'partners';

// ---------------------------------------------------------------------------
// Guide PROTAXI — registre guides/{uid} (guideId === auth.uid)
// ---------------------------------------------------------------------------

export type GuideStatus = 'draft' | 'pending_review' | 'active' | 'suspended';

export type GuideSpecialty =
  | 'patrimoine'
  | 'histoire'
  | 'archéologie'
  | 'nature'
  | 'thermal'
  | 'culture_artisanat';

export type GuideYearsExperience = '1-3' | '4-10' | '10+';

/** Ids catalogue Expériences privées V1 (6 circuits). */
export type GuideExperienceId =
  | 'guelma-romaine'
  | 'memoire-de-guelma'
  | 'traces-civilisations'
  | 'nature-maouna'
  | 'hammam-debagh-signature'
  | 'route-thermale-premium';

export interface Guide {
  /** Identifiant document = Firebase Auth uid du guide. */
  uid: string;
  displayName: string;
  phone: string;
  email: string;
  /** 50–300 caractères (règles Firestore). */
  bio: string;
  languages: string[];
  /** 1 à 3 spécialités officielles. */
  specialties: GuideSpecialty[];
  yearsExperience: GuideYearsExperience;
  /** Expériences privées sur lesquelles le guide peut être assigné. */
  allowedExperienceIds: GuideExperienceId[];
  status: GuideStatus;
  photoUrl?: string;
  validatedAt?: Timestamp | Date | null;
  validatedBy?: string;
  internalNotes?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

/** Champs guide sur tourBookings — étape 2+ (createTourBooking / admin assign). */
export interface TourBookingGuideFields {
  guideRequested?: boolean;
  assignedGuideId?: string | null;
  assignedGuideName?: string | null;
  /** Snapshot client (assignation admin — stratégie C). */
  assignedGuidePhone?: string | null;
  assignedGuideSpecialtiesSummary?: string | null;
  guideAssignedAt?: Timestamp | Date | null;
  guideAssignedBy?: string | null;
}

// ---------------------------------------------------------------------------
// Profils utilisateurs (auth / rôles app)
// ---------------------------------------------------------------------------

export interface ProtaxiUserProfile {
  uid: string;
  fullName: string;
  phone: string;
  email: string;
  role: UserRole;
  createdAt: Timestamp | Date | null;
  isOnline: boolean;
  isApproved: boolean;
  companyName?: string;
  partnerType?: 'hotel' | 'agency' | 'transport';
  contactName?: string;
}

export interface AuthSessionUser {
  uid: string;
  email: string | null;
  profile: ProtaxiUserProfile;
}
