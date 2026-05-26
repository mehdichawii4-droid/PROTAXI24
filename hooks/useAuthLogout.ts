import { Alert } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

export function useAuthLogout() {
  const { logout } = useAuth();
  const { redirectToLogin } = useAuthRedirect();

  const confirmLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment quitter votre compte ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: async () => {
          await logout();
          redirectToLogin();
        },
      },
    ]);
  };

  return { confirmLogout, logoutAndRedirect: async () => {
    await logout();
    redirectToLogin();
  } };
}
