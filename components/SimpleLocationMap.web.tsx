import WebMapPlaceholder from './WebMapPlaceholder';
import { SimpleLocationMapProps } from './SimpleLocationMap.types';

export default function SimpleLocationMap({ mapStyle }: SimpleLocationMapProps) {
  return <WebMapPlaceholder style={mapStyle} />;
}
