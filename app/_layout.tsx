import '@/bootstrap/firebaseDevLogBox';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { RouteGuard } from '@/components/auth/RouteGuard';
import { AuthProvider } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { configureNotificationHandler } from '@/services/notificationService';
import { setupPushNotificationRouting } from '@/services/pushNotificationRouting';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    configureNotificationHandler();
    return setupPushNotificationRouting(router);
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
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
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
