import { Timestamp } from 'firebase/firestore';

export type UserRole = 'client' | 'driver' | 'admin' | 'partner';

export type UserCollection = 'users' | 'drivers' | 'admins' | 'partners';

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
