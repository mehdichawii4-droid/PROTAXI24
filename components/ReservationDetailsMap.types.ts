import { ViewStyle } from 'react-native';

export type ReservationDetailsMapRef = {
  fitToCoordinates: (
    coordinates: { latitude: number; longitude: number }[],
    options: {
      edgePadding: {
        top: number;
        right: number;
        bottom: number;
        left: number;
      };
      animated: boolean;
    }
  ) => void;
  setDriverPosition: (coords: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  }) => void;
};

export type ReservationDetailsMapProps = {
  mapStyle: ViewStyle;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  gold: string;
};
