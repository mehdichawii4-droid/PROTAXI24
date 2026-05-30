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
import { db, getGuideDocRef, getPartnerDocRef } from '@/firebase/firestore';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  BOOTSTRAP_ADMIN_PASSWORD,
} from '@/firebase/config';
import { getFirebaseAuth } from '@/firebase/authInstance';
import type { Guide, Partner, ProtaxiUserProfile, UserCollection } from '@/firebase/types';
import { normalizeGuideProfile } from '@/services/guideService';
import { normalizePartnerProfile } from '@/services/partnerCoreService';
import {
  collectionForRole,
  mapProfileData,
  normalizePhone,
  roleFromCollection,
} from './authUtils';
import { DRIVER_LIVE_OFFLINE_PAYLOAD } from '@/services/driverDispatchService';
import { devError, devLog } from '@/utils/devLog';

const STAFF_COLLECTIONS: UserCollection[] = ['admins', 'drivers', 'partners'];
const EMAIL_PHONE_LOOKUP_COLLECTIONS: UserCollection[] = ['admins', 'drivers', 'partners'];

export function mapGuideToProtaxiProfile(guide: Guide): ProtaxiUserProfile {
  return {
    uid: guide.uid,
    fullName: guide.displayName,
    phone: guide.phone,
    email: guide.email.trim().toLowerCase(),
    role: 'guide',
    createdAt: guide.createdAt ?? null,
    isOnline: false,
    isApproved: guide.status === 'active',
    guideStatus: guide.status,
  };
}

export function mapPartnerToProtaxiProfile(partner: Partner): ProtaxiUserProfile {
  return {
    uid: partner.uid,
    fullName:
      partner.companyName.trim() ||
      partner.contactName.trim() ||
      'Partenaire PROTAXI',
    phone: partner.phone,
    email: partner.email.trim().toLowerCase(),
    role: 'partner',
    createdAt: partner.createdAt ?? null,
    isOnline: false,
    isApproved: partner.status === 'active',
    partnerStatus: partner.status,
    companyName: partner.companyName,
    partnerType: partner.partnerType,
    contactName: partner.contactName,
  };
}

export async function fetchPartnerProfileByUid(
  uid: string,
): Promise<ProtaxiUserProfile | null> {
  const snapshot = await getDoc(getPartnerDocRef(uid.trim()));
  if (!snapshot.exists()) {
    return null;
  }

  const partner = normalizePartnerProfile(uid, snapshot.data() as Record<string, unknown>);
  if (!partner) {
    return null;
  }

  return mapPartnerToProtaxiProfile(partner);
}

async function fetchPartnerProfileByEmail(email: string): Promise<ProtaxiUserProfile | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const snapshot = await getDocs(
    query(collection(db, 'partners'), where('email', '==', normalizedEmail)),
  );

  if (snapshot.empty) {
    return null;
  }

  const match = snapshot.docs[0];
  const partner = normalizePartnerProfile(match.id, match.data() as Record<string, unknown>);
  if (!partner) {
    return null;
  }

  return mapPartnerToProtaxiProfile(partner);
}

async function fetchPartnerProfileByPhone(phone: string): Promise<ProtaxiUserProfile | null> {
  const normalizedPhone = normalizePhone(phone);
  const snapshot = await getDocs(
    query(collection(db, 'partners'), where('phone', '==', normalizedPhone)),
  );

  if (snapshot.empty) {
    return null;
  }

  const match = snapshot.docs[0];
  const partner = normalizePartnerProfile(match.id, match.data() as Record<string, unknown>);
  if (!partner) {
    return null;
  }

  return mapPartnerToProtaxiProfile(partner);
}

function mapPartnerDocToProfile(
  uid: string,
  data: Record<string, unknown>,
): ProtaxiUserProfile | null {
  const partner = normalizePartnerProfile(uid, data);
  if (!partner) {
    return null;
  }
  return mapPartnerToProtaxiProfile(partner);
}

export async function fetchGuideProfileByUid(
  uid: string,
): Promise<ProtaxiUserProfile | null> {
  const snapshot = await getDoc(getGuideDocRef(uid.trim()));
  if (!snapshot.exists()) {
    return null;
  }

  const guide = normalizeGuideProfile(uid, snapshot.data() as Record<string, unknown>);
  if (!guide) {
    return null;
  }

  return mapGuideToProtaxiProfile(guide);
}

async function fetchGuideProfileByEmail(email: string): Promise<ProtaxiUserProfile | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const snapshot = await getDocs(
    query(collection(db, 'guides'), where('email', '==', normalizedEmail)),
  );

  if (snapshot.empty) {
    return null;
  }

  const match = snapshot.docs[0];
  const guide = normalizeGuideProfile(match.id, match.data() as Record<string, unknown>);
  if (!guide) {
    return null;
  }

  return mapGuideToProtaxiProfile(guide);
}

async function fetchGuideProfileByPhone(phone: string): Promise<ProtaxiUserProfile | null> {
  const normalizedPhone = normalizePhone(phone);
  const snapshot = await getDocs(
    query(collection(db, 'guides'), where('phone', '==', normalizedPhone)),
  );

  if (snapshot.empty) {
    return null;
  }

  const match = snapshot.docs[0];
  const guide = normalizeGuideProfile(match.id, match.data() as Record<string, unknown>);
  if (!guide) {
    return null;
  }

  return mapGuideToProtaxiProfile(guide);
}

export const fetchUserProfileByUid = async (
  uid: string
): Promise<ProtaxiUserProfile | null> => {
  for (const collectionName of STAFF_COLLECTIONS) {
    const snapshot = await getDoc(doc(db, collectionName, uid));

    if (snapshot.exists()) {
      if (collectionName === 'partners') {
        return mapPartnerDocToProfile(uid, snapshot.data() as Record<string, unknown>);
      }

      return mapProfileData(
        uid,
        snapshot.data() as Record<string, unknown>,
        roleFromCollection(collectionName)
      );
    }
  }

  const guideProfile = await fetchGuideProfileByUid(uid);
  if (guideProfile) {
    return guideProfile;
  }

  const userSnapshot = await getDoc(doc(db, 'users', uid));
  if (userSnapshot.exists()) {
    return mapProfileData(
      uid,
      userSnapshot.data() as Record<string, unknown>,
      'client',
    );
  }

  return null;
};

export const fetchUserProfileByEmail = async (
  email: string
): Promise<ProtaxiUserProfile | null> => {
  const normalizedEmail = email.trim().toLowerCase();

  for (const collectionName of EMAIL_PHONE_LOOKUP_COLLECTIONS) {
    const snapshot = await getDocs(
      query(
        collection(db, collectionName),
        where('email', '==', normalizedEmail)
      )
    );

    if (!snapshot.empty) {
      const match = snapshot.docs[0];
      if (collectionName === 'partners') {
        return mapPartnerDocToProfile(match.id, match.data() as Record<string, unknown>);
      }

      return mapProfileData(
        match.id,
        match.data() as Record<string, unknown>,
        roleFromCollection(collectionName)
      );
    }
  }

  const guideProfile = await fetchGuideProfileByEmail(normalizedEmail);
  if (guideProfile) {
    return guideProfile;
  }

  const clientSnapshot = await getDocs(
    query(collection(db, 'users'), where('email', '==', normalizedEmail)),
  );
  if (!clientSnapshot.empty) {
    const match = clientSnapshot.docs[0];
    return mapProfileData(
      match.id,
      match.data() as Record<string, unknown>,
      'client',
    );
  }

  return null;
};

export const fetchUserProfileByPhone = async (
  phone: string
): Promise<ProtaxiUserProfile | null> => {
  const normalizedPhone = normalizePhone(phone);

  for (const collectionName of EMAIL_PHONE_LOOKUP_COLLECTIONS) {
    const snapshot = await getDocs(
      query(
        collection(db, collectionName),
        where('phone', '==', normalizedPhone)
      )
    );

    if (!snapshot.empty) {
      const match = snapshot.docs[0];
      if (collectionName === 'partners') {
        return mapPartnerDocToProfile(match.id, match.data() as Record<string, unknown>);
      }

      return mapProfileData(
        match.id,
        match.data() as Record<string, unknown>,
        roleFromCollection(collectionName)
      );
    }
  }

  const guideProfile = await fetchGuideProfileByPhone(normalizedPhone);
  if (guideProfile) {
    return guideProfile;
  }

  const clientSnapshot = await getDocs(
    query(collection(db, 'users'), where('phone', '==', normalizedPhone)),
  );
  if (!clientSnapshot.empty) {
    const match = clientSnapshot.docs[0];
    return mapProfileData(
      match.id,
      match.data() as Record<string, unknown>,
      'client',
    );
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
  if (profile.role === 'guide') {
    devLog('[AUTH] markUserOnlineState skipped for guide', { uid: profile.uid, isOnline });
    return;
  }

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
