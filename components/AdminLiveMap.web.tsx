import { ViewStyle } from 'react-native';
import WebMapPlaceholder from './WebMapPlaceholder';

type AdminLiveMapProps = {
  driversLive?: any[];
  mapStyle: ViewStyle;
};

export default function AdminLiveMap({ mapStyle }: AdminLiveMapProps) {
  return <WebMapPlaceholder style={mapStyle} />;
}
