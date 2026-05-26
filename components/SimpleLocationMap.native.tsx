import { MapView, Marker } from './NativeMapView.native';
import { SimpleLocationMapProps } from './SimpleLocationMap.types';

export default function SimpleLocationMap({
  mapStyle,
  region,
  markerTitle,
}: SimpleLocationMapProps) {
  return (
    <MapView style={mapStyle} region={region}>
      <Marker coordinate={region} title={markerTitle} />
    </MapView>
  );
}
