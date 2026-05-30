import {
  BOOTSTRAP_ADMIN_EMAIL,
  BOOTSTRAP_ADMIN_PASSWORD,
} from '@/firebase/config';
import type {
  GuideStatus,
  PartnerStatus,
  ProtaxiUserProfile,
  UserCollection,
  UserRole,
} from '@/firebase/types';

export const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  client: '/',
  driver: '/drivers-dashboard',
  admin: '/admin-dashboard',
  partner: '/partner-dashboard',
  guide: '/guide-dashboard',
};

/** Routes accessibles au rôle guide (hors routes publiques déjà dans PUBLIC_ROUTES). */
export const GUIDE_PROTECTED_ROUTES = new Set(['guide-dashboard', 'guide-profile']);

export const GUIDE_ROUTES = new Set([
  'guide-register',
  ...GUIDE_PROTECTED_ROUTES,
]);

export const CLIENT_BLOCKED_ROUTES = new Set([
  'drivers-dashboard',
  'admin-dashboard',
  'admin-demo',
  'admin-partners',
  'admin-partner-details',
  'admin-guides',
  'admin-guide-details',
  'driver-profile',
  'tour-staff-dashboard',
  'partner-dashboard',
  'partner-new-booking',
  'partner-register',
  'partner-profile',
  'guide-dashboard',
  'guide-profile',
  'guide-register',
]);

export const DRIVER_ROUTES = new Set([
  'drivers-dashboard',
  'driver-profile',
  'tour-staff-dashboard',
  'course-tracking',
]);

export const ADMIN_ROUTES = new Set([
  'admin-dashboard',
  'admin-demo',
  'admin-partners',
  'admin-partner-details',
  'admin-guides',
  'admin-guide-details',
  'driver-profile',
  'tour-staff-dashboard',
]);

/** Routes accessibles au rôle partner (hors routes publiques). */
export const PARTNER_PROTECTED_ROUTES = new Set([
  'partner-dashboard',
  'partner-profile',
  'partner-new-booking',
  'hotel',
  'tour-booking',
  'discover-guelma',
  'discover-booking',
]);

export const PARTNER_ROUTES = new Set([
  'partner-register',
  ...PARTNER_PROTECTED_ROUTES,
]);

export const PUBLIC_ROUTES = new Set([
  'login',
  'register',
  'guide-register',
  'partner-register',
]);

export const normalizeRouteKey = (pathname: string) => {
  const routeKey = pathname.replace(/^\//, '').split('/')[0];
  if (!routeKey) return 'index';
  return routeKey;
};

export const redirectPathByRole = (role: UserRole) => ROLE_HOME_ROUTES[role];

export const canAccessRoute = (
  role: UserRole | null,
  routeKey: string
): boolean => {
  if (PUBLIC_ROUTES.has(routeKey)) return true;
  if (!role) return false;

  if (role === 'client') {
    return !CLIENT_BLOCKED_ROUTES.has(routeKey);
  }

  if (role === 'driver') {
    return DRIVER_ROUTES.has(routeKey);
  }

  if (role === 'admin') {
    return ADMIN_ROUTES.has(routeKey);
  }

  if (role === 'partner') {
    return PARTNER_ROUTES.has(routeKey);
  }

  if (role === 'guide') {
    return GUIDE_PROTECTED_ROUTES.has(routeKey) || routeKey === 'guide-register';
  }

  return false;
};

const GUIDE_LOGIN_BLOCKED_STATUSES: GuideStatus[] = ['suspended'];
const PARTNER_LOGIN_BLOCKED_STATUSES: PartnerStatus[] = ['suspended'];

/** Connexion autorisée pour guide draft / pending_review / active ; pas si suspendu. */
export const canGuideLogin = (guideStatus?: GuideStatus): boolean => {
  if (!guideStatus) return false;
  return !GUIDE_LOGIN_BLOCKED_STATUSES.includes(guideStatus);
};

/** Connexion autorisée pour partenaire draft / pending_review / active ; pas si suspendu. */
export const canPartnerLogin = (partnerStatus?: PartnerStatus): boolean => {
  if (!partnerStatus) return true;
  return !PARTNER_LOGIN_BLOCKED_STATUSES.includes(partnerStatus);
};

export const assertProfileCanLogin = (profile: ProtaxiUserProfile): void => {
  if (profile.role === 'guide') {
    if (!canGuideLogin(profile.guideStatus)) {
      const error = new Error(getAuthErrorMessage('protaxi/account-not-approved'));
      (error as Error & { code?: string }).code = 'protaxi/account-not-approved';
      throw error;
    }
    return;
  }

  if (profile.role === 'partner') {
    if (profile.partnerStatus) {
      if (!canPartnerLogin(profile.partnerStatus)) {
        const error = new Error(getAuthErrorMessage('protaxi/account-not-approved'));
        (error as Error & { code?: string }).code = 'protaxi/account-not-approved';
        throw error;
      }
      return;
    }

    if (!profile.isApproved) {
      const error = new Error(getAuthErrorMessage('protaxi/account-not-approved'));
      (error as Error & { code?: string }).code = 'protaxi/account-not-approved';
      throw error;
    }
    return;
  }

  if (!profile.isApproved) {
    const error = new Error(getAuthErrorMessage('protaxi/account-not-approved'));
    (error as Error & { code?: string }).code = 'protaxi/account-not-approved';
    throw error;
  }
};

export const canRestoreAuthSession = (profile: ProtaxiUserProfile): boolean => {
  if (profile.role === 'guide') {
    return canGuideLogin(profile.guideStatus);
  }

  if (profile.role === 'partner') {
    if (profile.partnerStatus) {
      return canPartnerLogin(profile.partnerStatus);
    }
    return profile.isApproved;
  }

  return profile.isApproved;
};

export const collectionForRole = (role: UserRole): UserCollection => {
  if (role === 'admin') return 'admins';
  if (role === 'driver') return 'drivers';
  if (role === 'partner') return 'partners';
  return 'users';
};

export const roleFromCollection = (
  collectionName: UserCollection
): UserRole => {
  if (collectionName === 'admins') return 'admin';
  if (collectionName === 'drivers') return 'driver';
  if (collectionName === 'partners') return 'partner';
  return 'client';
};

export const normalizePhone = (phone: string) =>
  phone.replace(/\s/g, '').replace(/^0/, '+213');

export const mapProfileData = (
  uid: string,
  data: Record<string, unknown>,
  role: UserRole
): ProtaxiUserProfile => ({
  uid,
  fullName: String(
    data.fullName || data.contactName || data.companyName || 'Utilisateur PROTAXI',
  ),
  phone: String(data.phone || ''),
  email: String(data.email || ''),
  role,
  createdAt: (data.createdAt as ProtaxiUserProfile['createdAt']) ?? null,
  isOnline: Boolean(data.isOnline),
  isApproved: Boolean(data.isApproved ?? data.isActive ?? true),
  companyName: data.companyName ? String(data.companyName) : undefined,
  partnerType: data.partnerType
    ? (String(data.partnerType) as ProtaxiUserProfile['partnerType'])
    : undefined,
  contactName: data.contactName ? String(data.contactName) : undefined,
});

export const getBootstrapAdminProfile = (
  uid: string
): Omit<ProtaxiUserProfile, 'createdAt'> & { createdAt: Date } => ({
  uid,
  fullName: 'Admin PROTAXI',
  phone: '',
  email: BOOTSTRAP_ADMIN_EMAIL,
  role: 'admin',
  createdAt: new Date(),
  isOnline: true,
  isApproved: true,
});

export const isBootstrapAdminEmail = (email: string) =>
  email.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

export const isBootstrapAdminCredentials = (email: string, password: string) =>
  isBootstrapAdminEmail(email) && password === BOOTSTRAP_ADMIN_PASSWORD;

export const getAuthErrorMessage = (code?: string, fallback?: string) => {
  switch (code) {
    case 'auth/invalid-email':
      return 'Adresse email invalide.';
    case 'auth/user-disabled':
      return 'Ce compte est désactivé.';
    case 'auth/user-not-found':
      return 'Aucun compte trouvé avec ces identifiants.';
    case 'auth/wrong-password':
      return 'Mot de passe incorrect.';
    case 'auth/invalid-credential':
      return 'Identifiants invalides.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessayez plus tard.';
    case 'auth/network-request-failed':
      return 'Connexion réseau impossible.';
    case 'auth/email-already-in-use':
      return 'Cet email est déjà utilisé.';
    case 'auth/weak-password':
      return 'Mot de passe trop faible.';
    case 'protaxi/profile-not-found':
      return 'Profil utilisateur introuvable.';
    case 'protaxi/account-not-approved':
      return 'Votre compte est en attente de validation.';
    case 'protaxi/phone-not-found':
      return 'Aucun compte associé à ce numéro.';
    case 'protaxi/phone-without-email':
      return 'Ce compte téléphone ne possède pas d’email de connexion.';
    default:
      return fallback || 'Connexion impossible. Vérifiez vos identifiants.';
  }
};
