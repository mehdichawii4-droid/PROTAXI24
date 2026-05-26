import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';
import type { UserRole } from '@/firebase/types';
import { redirectPathByRole } from '@/services/authUtils';

export function useAuthRedirect() {
  const router = useRouter();

  const redirectByRole = useCallback(
    (role: UserRole) => {
      router.replace(redirectPathByRole(role) as Href);
    },
    [router]
  );

  const redirectToLogin = useCallback(() => {
    router.replace('/login' as Href);
  }, [router]);

  return { redirectByRole, redirectToLogin };
}
