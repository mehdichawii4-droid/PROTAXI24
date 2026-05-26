import { forwardRef, useImperativeHandle, useRef } from 'react';
import { ViewStyle } from 'react-native';
import { DriverLiveMapRef } from './DriverLiveMap.types';
import { MapView, Marker, Polyline } from './NativeMapView.native';

type DriverLiveMapProps = {
  driverLocation: { latitude: number; longitude: number };
  activeRide: any | undefined;
  clientLatitude: number;
  clientLongitude: number;
  mapStyle: ViewStyle;
  gold: string;
};

const DriverLiveMap = forwardRef<DriverLiveMapRef, DriverLiveMapProps>(
  function DriverLiveMap(
    { driverLocation, activeRide, clientLatitude, clientLongitude, mapStyle, gold },
    ref
  ) {
    const mapRef = useRef<MapView>(null);

    useImperativeHandle(ref, () => ({
      animateToRegion: (region) => {
        mapRef.current?.animateToRegion(region);
      },
    }));

    return (
      <MapView
        ref={mapRef}
        style={mapStyle}
        initialRegion={{
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        }}
      >
        <Marker coordinate={driverLocation} title="Chauffeur" />

        {activeRide && (
          <>
            <Marker
              coordinate={{ latitude: clientLatitude, longitude: clientLongitude }}
              title="Client"
            />
            <Polyline
              coordinates={[
                driverLocation,
                { latitude: clientLatitude, longitude: clientLongitude },
              ]}
              strokeWidth={4}
              strokeColor={gold}
            />
          </>
        )}
      </MapView>
    );
  }
);

export default DriverLiveMap;
