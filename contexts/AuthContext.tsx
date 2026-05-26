import { onAuthStateChanged } from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getFirebaseAuth } from '@/firebase/authInstance';
import type { AuthSessionUser, ProtaxiUserProfile, UserRole } from '@/firebase/types';
import {
  loginWithEmail,
  loginWithPhone,
  logoutUser,
  mapFirebaseAuthError,
  registerClientWithEmail,
  restoreSessionUser,
} from '@/services/authService';
import {
  clearLocalProfileCache,
  syncLocalProfileCache,
} from '@/services/localProfileCache';
import { registerForPushNotificationsAsync } from '@/services/pushNotifications';

type AuthContextValue = {
  user: AuthSessionUser | null;
  profile: ProtaxiUserProfile | null;
  role: UserRole | null;
  loading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<UserRole>;
  loginWithPhoneNumber: (phone: string, password: string) => Promise<UserRole>;
  registerClient: (
    fullName: string,
    email: string,
    password: string,
    phone: string
  ) => Promise<UserRole>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const authOpInFlightRef = useRef(false);

  const persistSession = useCallback(async (sessionUser: AuthSessionUser | null) => {
    if (sessionUser) {
      await syncLocalProfileCache(sessionUser.profile);
      setUser(sessionUser);
      return;
    }

    await clearLocalProfileCache();
    setUser(null);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      if (authOpInFlightRef.current) {
        return;
      }

      try {
        if (!firebaseUser) {
          await persistSession(null);
          return;
        }

        const sessionUser = await restoreSessionUser(firebaseUser);
        await persistSession(sessionUser);
      } catch {
        await persistSession(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [persistSession]);

  useEffect(() => {
    if (loading || !user?.uid || !user.profile.role) {
      return;
    }

    void registerForPushNotificationsAsync(user.uid, user.profile.role);
  }, [loading, user?.uid, user?.profile.role]);

  const login = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    authOpInFlightRef.current = true;

    try {
      const sessionUser = await loginWithEmail(email, password);
      await persistSession(sessionUser);
      return sessionUser.profile.role;
    } catch (error) {
      const message = mapFirebaseAuthError(error);
      setAuthError(message);
      throw new Error(message);
    } finally {
      authOpInFlightRef.current = false;
    }
  }, [persistSession]);

  const loginWithPhoneNumber = useCallback(
    async (phone: string, password: string) => {
      setAuthError(null);
      authOpInFlightRef.current = true;

      try {
        const sessionUser = await loginWithPhone(phone, password);
        await persistSession(sessionUser);
        return sessionUser.profile.role;
      } catch (error) {
        const message = mapFirebaseAuthError(error);
        setAuthError(message);
        throw new Error(message);
      } finally {
        authOpInFlightRef.current = false;
      }
    },
    [persistSession]
  );

  const registerClient = useCallback(
    async (fullName: string, email: string, password: string, phone: string) => {
      setAuthError(null);
      authOpInFlightRef.current = true;

      try {
        const sessionUser = await registerClientWithEmail(
          fullName,
          email,
          password,
          phone
        );
        await persistSession(sessionUser);
        return sessionUser.profile.role;
      } catch (error) {
        const message = mapFirebaseAuthError(error);
        setAuthError(message);
        throw new Error(message);
      } finally {
        authOpInFlightRef.current = false;
      }
    },
    [persistSession]
  );

  const logout = useCallback(async () => {
    setAuthError(null);
    authOpInFlightRef.current = true;

    try {
      await logoutUser(user?.profile ?? null);
      await persistSession(null);
    } finally {
      authOpInFlightRef.current = false;
    }
  }, [user?.profile, persistSession]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile: user?.profile ?? null,
      role: user?.profile.role ?? null,
      loading,
      authError,
      login,
      loginWithPhoneNumber,
      registerClient,
      logout,
      clearAuthError,
    }),
    [user, loading, authError, login, loginWithPhoneNumber, registerClient, logout, clearAuthError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuthContext = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }

  return context;
};
