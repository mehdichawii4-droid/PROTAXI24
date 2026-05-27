import { Ionicons } from '@expo/vector-icons';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';

import MapViewDirections from './CourseMapDirections.native';
import { CityBookingMapProps, MapRegion } from './CityBookingMap.types';
import LiveDriverMapMarker from './LiveDriverMapMarker';
import { MapView, Marker } from './NativeMapView.native';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDYdlqeE8VAWNC8zry90jywNt5ia7vte9E';
const green = '#4ADE80';
const gold = '#D4A017';

const LUXURY_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0f0f0f' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f0f0f' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c1c1c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2b2418' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#090909' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#141414' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#151515' }] },
];

export default function CityBookingMap({
  mapStyle,
  region,
  pickupCoordinate,
  markerTitle = 'Vous',
  selectionMode = false,
  onSelectionRegionChange,
  destinationPin = null,
  routePreview = null,
  onRouteMetrics,
  mapRef,
  liveMapDrivers = [],
}: CityBookingMapProps) {
  const internalMapRef = useRef<any>(null);
  const regionRef = useRef(region);
  const selectionSeedRef = useRef<MapRegion | null>(null);

  regionRef.current = region;

  useEffect(() => {
    if (selectionMode) {
      selectionSeedRef.current = regionRef.current;
    } else {
      selectionSeedRef.current = null;
    }
  }, [selectionMode]);

  const clientCoordinate = pickupCoordinate ?? {
    latitude: region.latitude,
    longitude: region.longitude,
  };

  const fitRoute = () => {
    if (!internalMapRef.current || !routePreview) return;

    internalMapRef.current.fitToCoordinates(
      [routePreview.origin, routePreview.destination],
      {
        edgePadding: { top: 120, right: 48, bottom: 280, left: 48 },
        animated: true,
      },
    );
  };

  useImperativeHandle(mapRef, () => ({
    fitRoute,
  }), [routePreview]);

  useEffect(() => {
    if (routePreview) {
      const timer = setTimeout(fitRoute, 350);
      return () => clearTimeout(timer);
    }
  }, [routePreview]);

  const handleDirectionsReady = (result: { distance: number; duration: number }) => {
    onRouteMetrics?.({
      distanceKm: Math.round((result.distance / 1000) * 10) / 10,
      etaMin: Math.max(1, Math.round(result.duration / 60)),
    });
    fitRoute();
  };

  return (
    <MapView
      key={selectionMode ? 'city-map-selection' : 'city-map-default'}
      ref={internalMapRef}
      style={mapStyle}
      region={selectionMode ? undefined : region}
      initialRegion={selectionMode ? selectionSeedRef.current ?? region : undefined}
      customMapStyle={LUXURY_MAP_STYLE}
      showsCompass={false}
      showsTraffic={false}
      userInterfaceStyle="dark"
      onRegionChange={
        selectionMode
          ? (nextRegion) => {
              onSelectionRegionChange?.(nextRegion as MapRegion, true);
            }
          : undefined
      }
      onRegionChangeComplete={
        selectionMode
          ? (nextRegion) => {
              onSelectionRegionChange?.(nextRegion as MapRegion, false);
            }
          : undefined
      }
    >
      {!selectionMode
        ? liveMapDrivers.map((driver) => (
            <Marker
              key={driver.id}
              coordinate={{
                latitude: driver.latitude,
                longitude: driver.longitude,
              }}
              title={driver.driverName}
              description={
                typeof driver.etaMin === 'number' ? `${driver.etaMin} min` : undefined
              }
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <LiveDriverMapMarker rotation={driver.heading} />
            </Marker>
          ))
        : null}

      {!selectionMode ? (
        <Marker coordinate={clientCoordinate} title={markerTitle}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#111',
              borderWidth: 2,
              borderColor: gold,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="person" size={18} color="#FFF" />
          </View>
        </Marker>
      ) : null}

      {!selectionMode && destinationPin ? (
        <Marker coordinate={destinationPin} title="Destination">
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#111',
              borderWidth: 2,
              borderColor: green,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="flag" size={18} color={green} />
          </View>
        </Marker>
      ) : null}

      {routePreview ? (
        <>
          <MapViewDirections
            origin={routePreview.origin}
            destination={routePreview.destination}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={4}
            strokeColor={green}
            onReady={handleDirectionsReady}
          />
          <Marker coordinate={routePreview.origin} title="Départ">
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: gold,
                borderWidth: 2,
                borderColor: '#111',
              }}
            />
          </Marker>
          <Marker coordinate={routePreview.destination} title="Destination">
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: green,
                borderWidth: 2,
                borderColor: '#111',
              }}
            />
          </Marker>
        </>
      ) : null}
    </MapView>
  );
}
