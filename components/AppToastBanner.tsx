import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  registerToastListener,
  type UserFeedbackVariant,
} from '@/services/userFeedback';

const gold = '#D4A017';
const green = '#8BC53F';
const errorColor = '#F87171';

type ToastState = {
  message: string;
  variant: UserFeedbackVariant;
};

const VARIANT_STYLES: Record<
  UserFeedbackVariant,
  { border: string; accent: string }
> = {
  info: { border: 'rgba(212,160,23,0.55)', accent: gold },
  success: { border: 'rgba(139,197,63,0.55)', accent: green },
  error: { border: 'rgba(248,113,113,0.55)', accent: errorColor },
};

export default function AppToastBanner() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    registerToastListener((message, variant) => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      setToast({ message, variant });
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();

      hideTimerRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            setToast(null);
          }
        });
      }, 3200);
    });

    return () => {
      registerToastListener(null);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [opacity]);

  if (!toast) {
    return null;
  }

  const theme = VARIANT_STYLES[toast.variant];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.host,
        { top: insets.top + 8, opacity },
      ]}
    >
      <Pressable
        style={[styles.banner, { borderColor: theme.border }]}
        onPress={() => setToast(null)}
      >
        <View style={[styles.accent, { backgroundColor: theme.accent }]} />
        <Text style={styles.message}>{toast.message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101010',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  accent: {
    width: 4,
    height: '100%',
    minHeight: 18,
    borderRadius: 4,
  },
  message: {
    flex: 1,
    color: '#F5F5F5',
    fontSize: 14,
    fontWeight: '700',
  },
});
