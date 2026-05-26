export { app } from './app';
export { auth, getFirebaseAuth } from './authInstance';
export {
  createTourGroupDocRef,
  db,
  getCollectionRef,
  getFirestoreDb,
  getSubCollectionRef,
  getTourBookingDocRef,
  getTourBookingsCollectionRef,
  getTourGroupDocRef,
  getTourGroupMemoriesCollectionRef,
  getTourGroupMessagesCollectionRef,
  getTourGroupReviewsCollectionRef,
  getTourGroupsCollectionRef,
} from './firestore';
export {
  firebaseConfig,
  BOOTSTRAP_ADMIN_EMAIL,
  BOOTSTRAP_ADMIN_PASSWORD,
} from './config';
export type {
  AuthSessionUser,
  ProtaxiUserProfile,
  UserCollection,
  UserRole,
} from './types';
