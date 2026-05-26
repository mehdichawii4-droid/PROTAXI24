import { StyleSheet, Text, View } from 'react-native';

import { CityBookingMapProps } from './CityBookingMap.types';

export default function CityBookingMap({ mapStyle }: CityBookingMapProps) {
  return (
    <View style={[styles.container, mapStyle]}>
      <Text style={styles.text}>Carte indisponible sur Web</Text>
    </View>
  );
}

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
  },
});
