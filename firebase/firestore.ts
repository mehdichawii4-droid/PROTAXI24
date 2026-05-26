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
