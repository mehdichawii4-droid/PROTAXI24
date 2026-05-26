import { RefObject } from 'react';
import { ViewStyle } from 'react-native';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type MapRegion = MapCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export type RoutePreview = {
  origin: MapCoordinate;
  destination: MapCoordinate;
};

export type RouteMetrics = {
  distanceKm: number;
  etaMin: number;
};

export type CityBookingMapProps = {
  mapStyle: ViewStyle;
  region: MapRegion;
  pickupCoordinate?: MapCoordinate | null;
  markerTitle?: string;
  selectionMode?: boolean;
  onSelectionRegionChange?: (region: MapRegion, dragging: boolean) => void;
  destinationPin?: MapCoordinate | null;
  routePreview?: RoutePreview | null;
  onRouteMetrics?: (metrics: RouteMetrics) => void;
  mapRef?: RefObject<{ fitRoute: () => void } | null>;
};
