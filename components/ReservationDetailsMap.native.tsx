import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import MapViewDirections from './CourseMapDirections.native';
import {
  AnimatedRegion,
  MapView,
  Marker,
} from './NativeMapView.native';
import {
  ReservationDetailsMapProps,
  ReservationDetailsMapRef,
} from './ReservationDetailsMap.types';
import { GOOGLE_MAPS_API_KEY } from '../googleMapsConfig';

const DRIVER_LAT = 36.4621;
const DRIVER_LNG = 7.4261;

const ReservationDetailsMap = forwardRef<
  ReservationDetailsMapRef,
  ReservationDetailsMapProps
>(function ReservationDetailsMap({ mapStyle, region, gold }, ref) {
  const mapRef = useRef<any>(null);
  const [driverPosition] = useState(
    new AnimatedRegion({
      latitude: DRIVER_LAT,
      longitude: DRIVER_LNG,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    })
  );

  useImperativeHandle(ref, () => ({
    fitToCoordinates: (coordinates, options) => {
      mapRef.current?.fitToCoordinates(coordinates, options);
    },
    setDriverPosition: (coords) => {
      driverPosition.setValue({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: coords.latitudeDelta ?? 0.02,
        longitudeDelta: coords.longitudeDelta ?? 0.02,
      });
    },
  }));

  return (
    <MapView ref={mapRef} style={mapStyle} region={region}>
      <Marker coordinate={region} title="Vous" />

      <Marker.Animated coordinate={driverPosition as any} title="Taxi Mehdi 24">
        <Ionicons name="car-sport" size={34} color={gold} />
      </Marker.Animated>

      <MapViewDirections
        origin={{
          latitude: DRIVER_LAT,
          longitude: DRIVER_LNG,
        }}
        destination={{
          latitude: region.latitude,
          longitude: region.longitude,
        }}
        apikey={GOOGLE_MAPS_API_KEY}
        strokeWidth={5}
        strokeColor={gold}
      />
    </MapView>
  );
});

export default ReservationDetailsMap;
