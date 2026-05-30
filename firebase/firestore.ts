import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import { app } from './app';

let firestoreInstance: Firestore | null = null;

export function getFirestoreDb(): Firestore {
  if (!firestoreInstance) {
    if (!app) {
      throw new Error('Firebase app is not initialized.');
    }
    firestoreInstance = getFirestore(app);
  }

  if (!firestoreInstance) {
    throw new Error('Firestore is not initialized.');
  }

  return firestoreInstance;
}

export const db: Firestore = getFirestoreDb();

function splitPathSegments(path: string) {
  return path.split('/').filter(Boolean);
}

export function getCollectionRef(path: string): CollectionReference {
  const segments = splitPathSegments(path);
  if (segments.length === 0 || segments.length % 2 === 0) {
    throw new Error(`Invalid collection path: ${path}`);
  }

  return collection(getFirestoreDb(), ...(segments as [string, ...string[]]));
}

export function getSubCollectionRef(
  parentDocRef: DocumentReference,
  subcollection: string,
): CollectionReference {
  const subcollectionName = subcollection.trim();
  if (!subcollectionName) {
    throw new Error('subcollection is required.');
  }

  return collection(parentDocRef, subcollectionName);
}

export function getGuidesCollectionRef(): CollectionReference {
  return getCollectionRef('guides');
}

export function getGuideDocRef(guideId: string): DocumentReference {
  const normalizedGuideId = guideId.trim();
  if (!normalizedGuideId) {
    throw new Error('guideId is required to access a guides document.');
  }
  return doc(getFirestoreDb(), 'guides', normalizedGuideId);
}

export function getTourBookingsCollectionRef(): CollectionReference {
  return getCollectionRef('tourBookings');
}

export function getTourGroupsCollectionRef(): CollectionReference {
  return getCollectionRef('tourGroups');
}

export function getTourGroupMessagesCollectionRef(groupId: string): CollectionReference {
  const normalizedGroupId = groupId.trim();
  if (!normalizedGroupId) {
    throw new Error('groupId is required to access tour group messages.');
  }

  return collection(getTourGroupDocRef(normalizedGroupId), 'messages');
}

export function getTourGroupReviewsCollectionRef(groupId: string): CollectionReference {
  const normalizedGroupId = groupId.trim();
  if (!normalizedGroupId) {
    throw new Error('groupId is required to access tour group reviews.');
  }

  return collection(getTourGroupDocRef(normalizedGroupId), 'reviews');
}

export function getTourGroupMemoriesCollectionRef(groupId: string): CollectionReference {
  const normalizedGroupId = groupId.trim();
  if (!normalizedGroupId) {
    throw new Error('groupId is required to access tour group memories.');
  }

  return collection(getTourGroupDocRef(normalizedGroupId), 'memories');
}

export function getTourBookingDocRef(bookingId: string): DocumentReference {
  const normalizedBookingId = bookingId.trim();
  if (!normalizedBookingId) {
    throw new Error('bookingId is required to access a tourBookings document.');
  }
  return doc(getFirestoreDb(), 'tourBookings', normalizedBookingId);
}

export function getRideDocRef(rideId: string): DocumentReference {
  const normalizedRideId = rideId.trim();
  if (!normalizedRideId) {
    throw new Error('rideId is required to access a rides document.');
  }
  return doc(getFirestoreDb(), 'rides', normalizedRideId);
}

export function getRideMessagesCollectionRef(rideId: string): CollectionReference {
  const normalizedRideId = rideId.trim();
  if (!normalizedRideId) {
    throw new Error('rideId is required to access ride messages.');
  }

  return collection(getRideDocRef(normalizedRideId), 'messages');
}

export function buildRideRatingDocId(fromRole: string, fromUserId: string): string {
  const role = String(fromRole || '').trim();
  const uid = String(fromUserId || '').trim();
  if (!role || !uid) {
    throw new Error('fromRole and fromUserId are required to build a ride rating id.');
  }
  return `${role}_${uid}`;
}

export function getRideRatingsCollectionRef(rideId: string): CollectionReference {
  const normalizedRideId = rideId.trim();
  if (!normalizedRideId) {
    throw new Error('rideId is required to access ride ratings.');
  }

  return collection(getRideDocRef(normalizedRideId), 'ratings');
}

export function getRideRatingDocRef(
  rideId: string,
  fromRole: string,
  fromUserId: string,
): DocumentReference {
  return doc(
    getRideRatingsCollectionRef(rideId),
    buildRideRatingDocId(fromRole, fromUserId),
  );
}

export function getDriverLiveDocRef(driverId: string): DocumentReference {
  const normalizedDriverId = driverId.trim();
  if (!normalizedDriverId) {
    throw new Error('driverId is required to access a driversLive document.');
  }
  return doc(getFirestoreDb(), 'driversLive', normalizedDriverId);
}

export function getTourGroupDocRef(groupId: string): DocumentReference {
  const normalizedGroupId = groupId.trim();
  if (!normalizedGroupId) {
    throw new Error('groupId is required to access a tourGroups document.');
  }
  return doc(getFirestoreDb(), 'tourGroups', normalizedGroupId);
}

export function createTourGroupDocRef(): DocumentReference {
  return doc(getTourGroupsCollectionRef());
}
