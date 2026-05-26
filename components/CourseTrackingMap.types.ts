import { Animated, ViewStyle } from 'react-native';

export type CourseTrackingMapRef = {
  animateCamera: (camera: object, options?: { duration?: number }) => void;
};

export type DirectionsReadyResult = {
  distance: number;
  duration: number;
};

export type CourseTrackingMapProps = {
  mapStyle: ViewStyle;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  clientPosition: { latitude: number; longitude: number };
  driverPosition: { latitude: number; longitude: number };
  destinationPosition: { latitude: number; longitude: number };
  status: string;
  drivers: any[];
  driverId: string;
  pulseSize: Animated.AnimatedInterpolation<string | number>;
  pulseOpacity: Animated.AnimatedInterpolation<string | number>;
  carRotation: number;
  gold: string;
  onDirectionsReady: (result: DirectionsReadyResult) => void;
  markerStyles: {
    driverMarkerWrap: ViewStyle;
    driverHalo: ViewStyle;
    driverMarker: ViewStyle;
    clientMarkerWrap: ViewStyle;
    pulseCircle: ViewStyle;
    clientMarker: ViewStyle;
  };
};
