import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  BOOTSTRAP_ADMIN_PASSWORD,
} from '@/firebase/config';
import { getFirebaseAuth } from '@/firebase/authInstance';
import type { ProtaxiUserProfile, UserCollection } from '@/firebase/types';
import {
  collectionForRole,
  mapProfileData,
  normalizePhone,
  roleFromCollection,
} from './authUtils';
import { DRIVER_LIVE_OFFLINE_PAYLOAD } from '@/services/driverDispatchService';
import { devError, devLog } from '@/utils/devLog';

const COLLECTIONS: UserCollection[] = ['admins', 'drivers', 'partners', 'users'];

export const fetchUserProfileByUid = async (
  uid: string
): Promise<ProtaxiUserProfile | null> => {
  for (const collectionName of COLLECTIONS) {
    const snapshot = await getDoc(doc(db, collectionName, uid));

    if (snapshot.exists()) {
      return mapProfileData(
        uid,
        snapshot.data() as Record<string, unknown>,
        roleFromCollection(collectionName)
      );
    }
  }

  return null;
};

export const fetchUserProfileByEmail = async (
  email: string
): Promise<ProtaxiUserProfile | null> => {
  const normalizedEmail = email.trim().toLowerCase();

  for (const collectionName of COLLECTIONS) {
    const snapshot = await getDocs(
      query(
        collection(db, collectionName),
        where('email', '==', normalizedEmail)
      )
    );

    if (!snapshot.empty) {
      const match = snapshot.docs[0];
      return mapProfileData(
        match.id,
        match.data() as Record<string, unknown>,
        roleFromCollection(collectionName)
      );
    }
  }

  return null;
};

export const fetchUserProfileByPhone = async (
  phone: string
): Promise<ProtaxiUserProfile | null> => {
  const normalizedPhone = normalizePhone(phone);

  for (const collectionName of COLLECTIONS) {
    const snapshot = await getDocs(
      query(
        collection(db, collectionName),
        where('phone', '==', normalizedPhone)
      )
    );

    if (!snapshot.empty) {
      const match = snapshot.docs[0];
      return mapProfileData(
        match.id,
        match.data() as Record<string, unknown>,
        roleFromCollection(collectionName)
      );
    }
  }

  return null;
};

export const createBootstrapAdminDocument = async (
  uid: string
): Promise<ProtaxiUserProfile> => {
  await setDoc(
    doc(db, 'admins', uid),
    {
      uid,
      email: BOOTSTRAP_ADMIN_EMAIL,
      fullName: 'Admin PROTAXI',
      role: 'admin',
      isApproved: true,
      isOnline: true,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return mapProfileData(
    uid,
    {
      uid,
      email: BOOTSTRAP_ADMIN_EMAIL,
      fullName: 'Admin PROTAXI',
      role: 'admin',
      isApproved: true,
      isOnline: true,
    },
    'admin'
  );
};

export const ensureBootstrapAdminProfile = async (
  uid: string
): Promise<ProtaxiUserProfile> => {
  const existing = await getDoc(doc(db, 'admins', uid));
  if (existing.exists()) {
    return mapProfileData(
      uid,
      existing.data() as Record<string, unknown>,
      'admin'
    );
  }

  return createBootstrapAdminDocument(uid);
};

export const resolveProfileForAuthUser = async (
  uid: string,
  email?: string | null
): Promise<ProtaxiUserProfile | null> => {
  const byUid = await fetchUserProfileByUid(uid);
  if (byUid) {
    return byUid;
  }

  if (email?.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) {
    return ensureBootstrapAdminProfile(uid);
  }

  if (email) {
    return fetchUserProfileByEmail(email);
  }

  return null;
};

export const saveUserProfile = async (
  profile: ProtaxiUserProfile
): Promise<void> => {
  const collectionName = collectionForRole(profile.role);

  await setDoc(
    doc(db, collectionName, profile.uid),
    {
      uid: profile.uid,
      fullName: profile.fullName,
      phone: profile.phone,
      email: profile.email.trim().toLowerCase(),
      role: profile.role,
      createdAt: profile.createdAt ?? new Date(),
      isOnline: profile.isOnline,
      isApproved: profile.isApproved,
    },
    { merge: true }
  );
};

export const createClientDocument = async (params: {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
}): Promise<ProtaxiUserProfile> => {
  const normalizedEmail = params.email.trim().toLowerCase();
  const normalizedPhone = normalizePhone(params.phone);
  const fullName = params.fullName.trim();

  await setDoc(
    doc(db, 'users', params.uid),
    {
      uid: params.uid,
      fullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      role: 'client',
      isApproved: true,
      isOnline: true,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return mapProfileData(
    params.uid,
    {
      uid: params.uid,
      fullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      role: 'client',
      isApproved: true,
      isOnline: true,
    },
    'client'
  );
};

export const markUserOnlineState = async (
  profile: ProtaxiUserProfile,
  isOnline: boolean,
  loginStep = 'markUserOnlineState',
) => {
  const collectionName = collectionForRole(profile.role);
  const payload = {
    isOnline,
    updatedAt: new Date(),
  };

  try {
    await setDoc(
      doc(db, collectionName, profile.uid),
      payload,
      { merge: true },
    );

    if (profile.role === 'driver' && !isOnline) {
      await setDoc(
        doc(db, 'driversLive', profile.uid),
        {
          ...DRIVER_LIVE_OFFLINE_PAYLOAD,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      devLog('[DRIVER AVAILABILITY] logout offline', {
        uid: profile.uid,
        availability: DRIVER_LIVE_OFFLINE_PAYLOAD.availability,
      });
    }
  } catch (error) {
    devError('[AUTH] markUserOnlineState failed', {
      step: loginStep,
      uid: profile.uid,
      role: profile.role,
      collectionName,
      error,
    });
    throw error;
  }
};

export const getBootstrapAdminCredentials = () => ({
  email: BOOTSTRAP_ADMIN_EMAIL,
  password: BOOTSTRAP_ADMIN_PASSWORD,
});

export const getCurrentAuthEmail = () => getFirebaseAuth().currentUser?.email ?? null;
