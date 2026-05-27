import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

const green = '#4ADE80';

type Props = {
  rotation?: number | null;
};

export default function LiveDriverMapMarker({ rotation }: Props) {
  const haloPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(haloPulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(haloPulse, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [haloPulse]);

  const haloScale = haloPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.45],
  });

  const haloOpacity = haloPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.42, 0.08],
  });

  const rotateDeg = typeof rotation === 'number' && Number.isFinite(rotation) ? rotation : 0;

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.halo,
          {
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          },
        ]}
      />
      <View style={[styles.marker, { transform: [{ rotate: `${rotateDeg}deg` }] }]}>
        <Ionicons name="car-sport" size={20} color="#111" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(74,222,128,0.5)',
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111',
    ...Platform.select({
      ios: {
        shadowColor: green,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
});
