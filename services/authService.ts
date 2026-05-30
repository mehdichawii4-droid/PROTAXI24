import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  BOOTSTRAP_ADMIN_PASSWORD,
} from '@/firebase/config';
import { getFirebaseAuth } from '@/firebase/authInstance';
import type { AuthSessionUser } from '@/firebase/types';
import {
  assertProfileCanLogin,
  canRestoreAuthSession,
  getAuthErrorMessage,
  isBootstrapAdminCredentials,
} from './authUtils';
import { getGuideSelfErrorMessage, registerGuideProfile } from '@/services/guideSelfService';
import { GuideServiceError } from '@/types/guide';
import type { GuideFormInput } from '@/types/guide';
import {
  isLoginEmailRegistered,
  lookupLoginEmailByPhone,
} from './authLookupService';
import {
  createBootstrapAdminDocument,
  createClientDocument,
  ensureBootstrapAdminProfile,
  markUserOnlineState,
  resolveProfileForAuthUser,
} from './userService';

const BOOTSTRAP_ADMIN_AUTH_ERRORS = new Set([
  'auth/user-not-found',
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
]);

const buildSessionUser = (
  firebaseUser: User,
  profile: AuthSessionUser['profile']
): AuthSessionUser => ({
  uid: firebaseUser.uid,
  email: firebaseUser.email,
  profile,
});

const completeLogin = async (firebaseUser: User): Promise<AuthSessionUser> => {
  const profile = await resolveProfileForAuthUser(
    firebaseUser.uid,
    firebaseUser.email
  );

  if (!profile) {
    await signOut(getFirebaseAuth());
    const error = new Error(getAuthErrorMessage('protaxi/profile-not-found'));
    (error as Error & { code?: string }).code = 'protaxi/profile-not-found';
    throw error;
  }

  assertProfileCanLogin(profile);
  await markUserOnlineState(profile, true, 'authService/completeLogin');
  return buildSessionUser(firebaseUser, profile);
};

const bootstrapAdminAccount = async (): Promise<AuthSessionUser> => {
  const credential = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    BOOTSTRAP_ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD
  );

  const profile = await createBootstrapAdminDocument(credential.user.uid);
  await markUserOnlineState(profile, true);
  return buildSessionUser(credential.user, profile);
};

const shouldAttemptBootstrapAdmin = (
  error: unknown,
  email: string,
  password: string
) => {
  const code = (error as { code?: string })?.code;
  return (
    isBootstrapAdminCredentials(email, password) &&
    Boolean(code && BOOTSTRAP_ADMIN_AUTH_ERRORS.has(code))
  );
};

export const loginWithEmail = async (
  email: string,
  password: string
): Promise<AuthSessionUser> => {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const credential = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      normalizedEmail,
      password
    );

    return completeLogin(credential.user);
  } catch (error: any) {
    if (!shouldAttemptBootstrapAdmin(error, normalizedEmail, password)) {
      throw error;
    }

    try {
      return await bootstrapAdminAccount();
    } catch (bootstrapError: any) {
      if (bootstrapError?.code === 'auth/email-already-in-use') {
        const existingCredential = await signInWithEmailAndPassword(
          getFirebaseAuth(),
          BOOTSTRAP_ADMIN_EMAIL,
          BOOTSTRAP_ADMIN_PASSWORD
        );
        const profile = await ensureBootstrapAdminProfile(
          existingCredential.user.uid
        );
        await markUserOnlineState(profile, true);
        return buildSessionUser(existingCredential.user, profile);
      }

      throw bootstrapError;
    }
  }
};

export const loginWithPhone = async (
  phone: string,
  password: string
): Promise<AuthSessionUser> => {
  const email = await lookupLoginEmailByPhone(phone);

  if (email === null) {
    const error = new Error(getAuthErrorMessage('protaxi/phone-not-found'));
    (error as Error & { code?: string }).code = 'protaxi/phone-not-found';
    throw error;
  }

  if (!email) {
    const error = new Error(getAuthErrorMessage('protaxi/phone-without-email'));
    (error as Error & { code?: string }).code = 'protaxi/phone-without-email';
    throw error;
  }

  return loginWithEmail(email, password);
};

export const registerGuideWithEmail = async (
  email: string,
  password: string,
  guideInput: GuideFormInput,
): Promise<AuthSessionUser> => {
  const normalizedEmail = email.trim().toLowerCase();

  if (guideInput.email.trim().toLowerCase() !== normalizedEmail) {
    const error = new Error('L\'email du profil guide doit correspondre au compte.');
    (error as Error & { code?: string }).code = 'protaxi/guide-email-mismatch';
    throw error;
  }

  const emailAlreadyUsed = await isLoginEmailRegistered(normalizedEmail);
  if (emailAlreadyUsed) {
    const error = new Error(getAuthErrorMessage('auth/email-already-in-use'));
    (error as Error & { code?: string }).code = 'auth/email-already-in-use';
    throw error;
  }

  const credential = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    normalizedEmail,
    password,
  );

  try {
    await registerGuideProfile(credential.user.uid, {
      ...guideInput,
      guideUid: credential.user.uid,
      email: normalizedEmail,
    });

    const profile = await resolveProfileForAuthUser(
      credential.user.uid,
      credential.user.email,
    );

    if (!profile || profile.role !== 'guide') {
      throw new Error(getAuthErrorMessage('protaxi/profile-not-found'));
    }

    assertProfileCanLogin(profile);
    await markUserOnlineState(profile, true, 'authService/registerGuideWithEmail');
    return buildSessionUser(credential.user, profile);
  } catch (error) {
    await signOut(getFirebaseAuth());
    if (error instanceof GuideServiceError) {
      throw new Error(getGuideSelfErrorMessage(error));
    }
    throw error;
  }
};

export const registerClientWithEmail = async (
  fullName: string,
  email: string,
  password: string,
  phone: string
): Promise<AuthSessionUser> => {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = fullName.trim();

  if (!trimmedName) {
    const error = new Error('Le nom complet est requis.');
    (error as Error & { code?: string }).code = 'protaxi/invalid-name';
    throw error;
  }

  const emailAlreadyUsed = await isLoginEmailRegistered(normalizedEmail);
  if (emailAlreadyUsed) {
    const error = new Error(getAuthErrorMessage('auth/email-already-in-use'));
    (error as Error & { code?: string }).code = 'auth/email-already-in-use';
    throw error;
  }

  const credential = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    normalizedEmail,
    password
  );

  try {
    const profile = await createClientDocument({
      uid: credential.user.uid,
      fullName: trimmedName,
      email: normalizedEmail,
      phone,
    });

    await markUserOnlineState(profile, true);
    return buildSessionUser(credential.user, profile);
  } catch (error) {
    await signOut(getFirebaseAuth());
    throw error;
  }
};

export const logoutUser = async (profile?: AuthSessionUser['profile'] | null) => {
  if (profile) {
    await markUserOnlineState(profile, false);
  }

  await signOut(getFirebaseAuth());
};

export const restoreSessionUser = async (
  firebaseUser: User
): Promise<AuthSessionUser | null> => {
  const profile = await resolveProfileForAuthUser(
    firebaseUser.uid,
    firebaseUser.email
  );

  if (!profile || !canRestoreAuthSession(profile)) {
    await signOut(getFirebaseAuth());
    return null;
  }

  await markUserOnlineState(profile, true, 'authService/restoreSessionUser');
  return buildSessionUser(firebaseUser, profile);
};

export const mapFirebaseAuthError = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  return getAuthErrorMessage(code, (error as Error)?.message);
};
