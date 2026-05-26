import { ViewStyle } from 'react-native';
import { MapView, Marker } from './NativeMapView.native';

type AdminLiveMapProps = {
  driversLive: any[];
  mapStyle: ViewStyle;
};

export default function AdminLiveMap({ driversLive, mapStyle }: AdminLiveMapProps) {
  return (
    <MapView
      style={mapStyle}
      initialRegion={{
        latitude: 36.462,
        longitude: 7.426,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      }}
    >
      {driversLive
        .filter((driver) => driver.latitude && driver.longitude)
        .map((driver) => (
          <Marker
            key={driver.id}
            coordinate={{
              latitude: driver.latitude,
              longitude: driver.longitude,
            }}
            title={driver.driverName || driver.driverId || 'Chauffeur'}
            description={
              driver.isBusy
                ? '🟠 Occupé'
                : driver.isOnline
                ? '🟢 Disponible'
                : '🔴 Hors ligne'
            }
            pinColor={driver.isBusy ? 'orange' : driver.isOnline ? 'green' : 'red'}
          />
        ))}
    </MapView>
  );
}
