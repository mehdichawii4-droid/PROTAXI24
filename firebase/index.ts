export { app } from './app';
export { auth, getFirebaseAuth } from './authInstance';
export {
  createTourGroupDocRef,
  db,
  getCollectionRef,
  getFirestoreDb,
  getGuideDocRef,
  getGuidesCollectionRef,
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
  Guide,
  GuideExperienceId,
  GuideSpecialty,
  GuideStatus,
  GuideYearsExperience,
  ProtaxiUserProfile,
  TourBookingGuideFields,
  UserCollection,
  UserRole,
} from './types';
