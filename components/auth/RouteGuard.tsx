import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  canAccessRoute,
  normalizeRouteKey,
  PUBLIC_ROUTES,
  redirectPathByRole,
} from '@/services/authUtils';

const gold = '#FFD700';

export function AuthLoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <MaterialCommunityIcons name="taxi" size={42} color={gold} />
      <Text style={styles.loadingTitle}>PROTAXI24</Text>
      <ActivityIndicator size="large" color={gold} style={{ marginTop: 18 }} />
      <Text style={styles.loadingText}>Chargement de la session...</Text>
    </View>
  );
}

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const normalizedRoute = normalizeRouteKey(pathname);
  const isPublicRoute = PUBLIC_ROUTES.has(normalizedRoute);
  const canAccess = user
    ? isPublicRoute || canAccessRoute(role, normalizedRoute)
    : isPublicRoute;

  useEffect(() => {
    if (loading) return;

    const loginHref = '/login' as Href;

    if (!user) {
      if (!isPublicRoute && pathname !== '/login') {
        router.replace(loginHref);
      }
      return;
    }

    const homeHref = redirectPathByRole(role || 'client') as Href;

    if (isPublicRoute) {
      if (pathname !== homeHref) {
        router.replace(homeHref);
      }
      return;
    }

    if (!canAccessRoute(role, normalizedRoute) && pathname !== homeHref) {
      router.replace(homeHref);
    }
  }, [user, role, loading, pathname, router, isPublicRoute, normalizedRoute]);

  const showBlockingScreen = loading || !canAccess;

  return (
    <>
      {children}
      {showBlockingScreen ? (
        <View style={styles.loadingOverlay}>
          <AuthLoadingScreen />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 12,
    letterSpacing: 1,
  },
  loadingText: {
    color: '#AAA',
    fontSize: 14,
    marginTop: 10,
    fontWeight: '600',
  },
});
