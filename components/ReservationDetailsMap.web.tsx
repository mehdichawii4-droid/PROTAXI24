import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  ReservationDetailsMapProps,
  ReservationDetailsMapRef,
} from './ReservationDetailsMap.types';

const ReservationDetailsMap = forwardRef<
  ReservationDetailsMapRef,
  ReservationDetailsMapProps
>(function ReservationDetailsMap({ mapStyle }, ref) {
  useImperativeHandle(ref, () => ({
    fitToCoordinates: () => {},
    setDriverPosition: () => {},
  }));

  return (
    <View style={[styles.container, mapStyle]}>
      <Text style={styles.text}>Carte aéroport indisponible sur Web</Text>
    </View>
  );
});

export default ReservationDetailsMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  text: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
