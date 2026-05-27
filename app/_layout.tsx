import '@/bootstrap/firebaseDevLogBox';
import '@/bootstrap/productionStability';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import AppToastBanner from '@/components/AppToastBanner';
import { RouteGuard } from '@/components/auth/RouteGuard';
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { configureNotificationHandler } from '@/services/notificationService';
import { setupPushNotificationRouting } from '@/services/pushNotificationRouting';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [appResetKey, setAppResetKey] = useState(0);

  const handleAppRestart = useCallback(() => {
    setAppResetKey((value) => value + 1);
    router.replace('/');
  }, [router]);

  useEffect(() => {
    configureNotificationHandler();
    return setupPushNotificationRouting(router);
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GlobalErrorBoundary onRestart={handleAppRestart}>
        <AuthProvider key={appResetKey}>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <RouteGuard>
              <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="register" options={{ headerShown: false }} />
              <Stack.Screen name="discover-guelma" options={{ headerShown: false }} />
              <Stack.Screen name="discover-booking" options={{ headerShown: false }} />
              <Stack.Screen name="tour-booking" options={{ headerShown: false }} />
              <Stack.Screen name="tour-summary" options={{ headerShown: false }} />
              <Stack.Screen name="course-tracking" options={{ headerShown: false }} />
              <Stack.Screen name="city" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
            </RouteGuard>
            <AppToastBanner />
            <StatusBar style="auto" />
          </ThemeProvider>
        </AuthProvider>
      </GlobalErrorBoundary>
    </GestureHandlerRootView>
  );
}
