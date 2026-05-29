import { Ionicons } from '@expo/vector-icons';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

import { Animated, StyleSheet, View } from 'react-native';

import MapViewDirections from './CourseMapDirections.native';

import {

  CourseTrackingMapProps,

  CourseTrackingMapRef,

} from './CourseTrackingMap.types';

import { AnimatedRegion, MapView, Marker } from './NativeMapView.native';

import {

  buildMapCoordinate,

  extractDriverLiveCoordinate,

  isValidMapCoordinate,

  resolveTrackingDirections,

} from '@/utils/rideTracking';

import { devError, devLog } from '@/utils/devLog';



import { GOOGLE_MAPS_API_KEY } from '@/googleMapsConfig';

const GOLD = '#D4A017';



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



function PremiumDriverMarker({

  rotation,

  markerStyles,

}: {

  rotation: number;

  markerStyles: CourseTrackingMapProps['markerStyles'];

}) {

  const haloPulse = useRef(new Animated.Value(0)).current;



  useEffect(() => {

    const loop = Animated.loop(

      Animated.sequence([

        Animated.timing(haloPulse, {

          toValue: 1,

          duration: 1500,

          useNativeDriver: true,

        }),

        Animated.timing(haloPulse, {

          toValue: 0,

          duration: 1500,

          useNativeDriver: true,

        }),

      ]),

    );

    loop.start();

    return () => loop.stop();

  }, [haloPulse]);



  const haloScale = haloPulse.interpolate({

    inputRange: [0, 1],

    outputRange: [1, 1.45],

  });

  const haloOpacity = haloPulse.interpolate({

    inputRange: [0, 1],

    outputRange: [0.42, 0.08],

  });



  return (

    <View style={markerStyles.driverMarkerWrap}>

      <Animated.View

        style={[

          markerStyles.driverHalo,

          {

            opacity: haloOpacity,

            transform: [{ scale: haloScale }],

          },

        ]}

      />

      <View

        style={[

          markerStyles.driverMarker,

          {

            transform: [{ rotate: `${Number.isFinite(rotation) ? rotation : 0}deg` }],

          },

        ]}

      >

        <Ionicons name="car-sport" size={22} color="#111" />

      </View>

    </View>

  );

}



const CourseTrackingMap = forwardRef<CourseTrackingMapRef, CourseTrackingMapProps>(

  function CourseTrackingMap(

    {

      mapStyle,

      region,

      clientPosition,

      driverPosition,

      destinationPosition,

      status,

      drivers,

      driverId,

      pulseSize,

      pulseOpacity,

      carRotation,

      gold,

      onDirectionsReady,

      markerStyles,

    },

    ref,

  ) {

    const mapRef = useRef<any>(null);

    const driverAnimatedRegion = useRef(

      new AnimatedRegion({

        latitude: driverPosition.latitude,

        longitude: driverPosition.longitude,

        latitudeDelta: 0,

        longitudeDelta: 0,

      }),

    ).current;



    useEffect(() => {

      if (!isValidMapCoordinate(driverPosition)) return;



      (driverAnimatedRegion as any)

        .timing({

          latitude: driverPosition.latitude,

          longitude: driverPosition.longitude,

          latitudeDelta: 0,

          longitudeDelta: 0,

          duration: 1200,

          useNativeDriver: false,

        })

        .start();

    }, [driverAnimatedRegion, driverPosition.latitude, driverPosition.longitude]);



    const directions = useMemo(

      () =>

        resolveTrackingDirections({

          status,

          clientPosition,

          driverPosition,

          destinationPosition,

        }),

      [status, clientPosition, driverPosition, destinationPosition],

    );



    const safeClientPosition = isValidMapCoordinate(clientPosition)

      ? clientPosition

      : region;

    const safeDriverPosition = isValidMapCoordinate(driverPosition)

      ? driverPosition

      : safeClientPosition;



    useImperativeHandle(ref, () => ({

      animateCamera: (camera, options) => {

        try {

          mapRef.current?.animateCamera(camera, options);

        } catch (error) {

          devError('[CLIENT TRACKING ERROR - CourseTrackingMap - animateCamera]', error);

        }

      },

    }));



    return (

      <MapView

        ref={mapRef}

        style={mapStyle}

        initialRegion={region}

        customMapStyle={LUXURY_MAP_STYLE}

        showsBuildings

        showsCompass={false}

        showsTraffic={false}

        userInterfaceStyle="dark"

      >

        {directions &&
        isValidMapCoordinate(directions.origin) &&
        isValidMapCoordinate(directions.destination) ? (

          <MapViewDirections

            origin={directions.origin}

            destination={directions.destination}

            apikey={GOOGLE_MAPS_API_KEY}

            strokeWidth={5}

            strokeColor={gold || GOLD}

            lineDashPattern={[0]}

            onReady={onDirectionsReady}

            onError={(error) => {

              devLog('[CLIENT TRACKING - directions skipped]', error);

            }}

          />

        ) : null}



        {drivers

          .map((driver) => {

            if (String(driver.id) === String(driverId)) {

              return null;

            }



            const coordinate =

              extractDriverLiveCoordinate(driver) ??

              buildMapCoordinate(driver.latitude, driver.longitude);



            if (!isValidMapCoordinate(coordinate) || !driver.isOnline) {

              return null;

            }



            const latDiff = Math.abs(coordinate.latitude - safeClientPosition.latitude);

            const lngDiff = Math.abs(coordinate.longitude - safeClientPosition.longitude);



            if (latDiff >= 0.05 || lngDiff >= 0.05) {

              return null;

            }



            return (

              <Marker

                key={String(driver.id)}

                coordinate={coordinate}

                title={String(driver.driverName || 'PROTAXI')}

              >

                <View style={styles.nearbyDriverDot} />

              </Marker>

            );

          })

          .filter(Boolean)}



        {isValidMapCoordinate(safeDriverPosition) ? (

          <Marker.Animated coordinate={driverAnimatedRegion as any} title="Votre chauffeur">

            <PremiumDriverMarker rotation={carRotation} markerStyles={markerStyles} />

          </Marker.Animated>

        ) : null}



        {isValidMapCoordinate(safeClientPosition) ? (

          <Marker coordinate={safeClientPosition} title="Votre position">

            <View style={markerStyles.clientMarkerWrap}>

              <Animated.View

                style={[

                  markerStyles.pulseCircle,

                  {

                    width: pulseSize,

                    height: pulseSize,

                    opacity: pulseOpacity,

                  },

                ]}

              />

              <View style={markerStyles.clientMarker}>

                <Ionicons name="person" size={18} color="#FFF" />

              </View>

            </View>

          </Marker>

        ) : null}

      </MapView>

    );

  },

);



export default CourseTrackingMap;



const styles = StyleSheet.create({

  nearbyDriverDot: {

    width: 10,

    height: 10,

    borderRadius: 5,

    backgroundColor: 'rgba(212,160,23,0.55)',

    borderWidth: 1,

    borderColor: 'rgba(255,255,255,0.35)',

  },

});


