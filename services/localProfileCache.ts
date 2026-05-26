import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProtaxiUserProfile } from '@/firebase/types';

const PROFILE_STORAGE_KEY = 'profile';

function formatProfileCreatedAt(value: ProtaxiUserProfile['createdAt']): string {
  if (!value) {
    return new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  const date =
    typeof value === 'object' && value !== null && 'toDate' in value
      ? (value as { toDate: () => Date }).toDate()
      : new Date(value as Date);

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export async function syncLocalProfileCache(
  profile: ProtaxiUserProfile
): Promise<void> {
  await AsyncStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify({
      name: profile.fullName,
      phone: profile.phone || '',
      email: profile.email.trim().toLowerCase(),
      city: 'Guelma',
      image: null,
      createdAt: formatProfileCreatedAt(profile.createdAt),
    })
  );
}

export async function clearLocalProfileCache(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_STORAGE_KEY);
}
