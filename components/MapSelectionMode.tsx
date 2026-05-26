import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const green = '#4ADE80';

type Props = {
  visible: boolean;
  liveAddress: string;
  isDragging: boolean;
  isResolvingAddress: boolean;
  bottomInset: number;
  onCancel: () => void;
  onValidate: () => void;
};

export default function MapSelectionMode({
  visible,
  liveAddress,
  isDragging,
  isResolvingAddress,
  bottomInset,
  onCancel,
  onValidate,
}: Props) {
  const dimAnim = useRef(new Animated.Value(0)).current;
  const pinLiftAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(dimAnim, {
      toValue: isDragging ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [dimAnim, isDragging]);

  useEffect(() => {
    Animated.spring(pinLiftAnim, {
      toValue: isDragging ? 1 : 0,
      useNativeDriver: true,
      damping: 16,
      stiffness: 220,
    }).start();
  }, [isDragging, pinLiftAnim]);

  if (!visible) return null;

  const pinTranslateY = pinLiftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        style={[styles.dimLayer, { opacity: dimAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.28] }) }]}
        pointerEvents="none"
      />

      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.85}>
        <Ionicons name="close" size={22} color="#FFF" />
      </TouchableOpacity>

      <View style={styles.centerZone} pointerEvents="none">
        <Animated.View style={[styles.pinWrap, { transform: [{ translateY: pinTranslateY }] }]}>
          <View style={styles.pinHead}>
            <Ionicons name="flag" size={20} color={green} />
          </View>
          <View style={styles.pinStem} />
          <View style={styles.pinDot} />
        </Animated.View>

        <View style={styles.addressBar}>
          <Ionicons name="location" size={16} color={green} />
          {isResolvingAddress ? (
            <ActivityIndicator size="small" color={green} style={styles.loader} />
          ) : null}
          <Text style={styles.addressText} numberOfLines={2}>
            {liveAddress}
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(bottomInset, 12) + 8 }]}>
        <TouchableOpacity style={styles.validateBtn} onPress={onValidate} activeOpacity={0.88}>
          <Text style={styles.validateText}>Valider ce point</Text>
          <Ionicons name="checkmark-circle" size={22} color="#111" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
  },
  dimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  cancelBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 24,
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(8,8,8,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  centerZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '38%',
    alignItems: 'center',
    transform: [{ translateY: -48 }],
  },
  pinWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  pinHead: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111',
    borderWidth: 2.5,
    borderColor: green,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  pinStem: {
    width: 3,
    height: 14,
    backgroundColor: green,
    marginTop: -1,
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: green,
    marginTop: -1,
  },
  addressBar: {
    maxWidth: '88%',
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(8,8,8,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  loader: {
    marginRight: 2,
  },
  addressText: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
  },
  validateBtn: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  validateText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },
});
