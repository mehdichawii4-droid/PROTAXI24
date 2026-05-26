import { forwardRef, useImperativeHandle } from 'react';
import { ViewStyle } from 'react-native';
import { DriverLiveMapRef } from './DriverLiveMap.types';
import WebMapPlaceholder from './WebMapPlaceholder';

type DriverLiveMapProps = {
  driverLocation?: { latitude: number; longitude: number };
  activeRide?: any;
  clientLatitude?: number;
  clientLongitude?: number;
  mapStyle: ViewStyle;
  gold?: string;
};

const DriverLiveMap = forwardRef<DriverLiveMapRef, DriverLiveMapProps>(
  function DriverLiveMap({ mapStyle }, ref) {
    useImperativeHandle(ref, () => ({
      animateToRegion: () => {},
    }));

    return <WebMapPlaceholder style={mapStyle} />;
  }
);

export default DriverLiveMap;
