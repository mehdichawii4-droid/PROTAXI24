import { ViewStyle } from 'react-native';

export type SimpleLocationMapProps = {
  mapStyle: ViewStyle;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  markerTitle?: string;
};
