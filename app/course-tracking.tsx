import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';


import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import CourseTrackingMap from '@/components/CourseTrackingMap';
import {
  CourseTrackingMapRef,
  DirectionsReadyResult,
} from '@/components/CourseTrackingMap.types';
import {
  configureNotificationHandler,
  getClientEventFromStatus,
  mapRideNotificationContext,
  notifyClient,
  requestNotificationPermissions,
} from '@/services/notificationService';
import {
  DEFAULT_GUELMA_CLIENT,
  extractDriverLiveCoordinate,
  extractRideClientCoordinate,
  getDriverLocationUpdatedAtMs,
  isDriverMoving,
  isRideEnRoute,
  isValidMapCoordinate,
  normalizeRideTrackingStatus,
  resolveRideDestinationCoordinate,
} from '@/utils/rideTracking';
import { devError, devLog } from '@/utils/devLog';
import { db } from '../firebaseConfig';

configureNotificationHandler();

const gold = '#D4A017';
const green = '#2ECC71';
const red = '#FF4B4B';
const blue = '#008CFF';
const phoneLink = '+213671421448';
const GPS_STALE_MS = 30000;
const GPS_FALLBACK_INTERVAL_MS = 5000;
const GPS_AGE_TICK_MS = 1000;
const ACTIONS_ROW_HEIGHT = 44;
const PANEL_TOP_PADDING = 6;

type DriverGpsBadge = 'LIVE' | 'MOVING' | 'WEAK' | 'OFFLINE GPS' | 'SIMULATION';

function getCompactGpsBadgeLabel(badge: DriverGpsBadge): string | null {
  switch (badge) {
    case 'WEAK':
    case 'OFFLINE GPS':
      return 'GPS faible';
    case 'SIMULATION':
      return __DEV__ ? 'Demo' : null;
    default:
      return null;
  }
}

function getHeaderStatusShort(status: string, displayStatus: string): string {
  if (displayStatus === "Recherche d'un autre chauffeur") {
    return 'Recherche chauffeur';
  }
  if (status === 'En route') return 'En route';
  if (status === 'Arrivé') return 'Chauffeur arrivé';
  if (status === 'Acceptée') return 'Acceptée';
  if (status === 'Attribuée') return 'Attribuée';
  if (status === 'Terminée') return 'Terminée';
  return displayStatus.length > 22 ? `${displayStatus.slice(0, 22)}…` : displayStatus;
}

function getStatusAccentColor(label: string): string {
  if (label === 'En attente' || label === 'Recherche chauffeur') return gold;
  if (label === 'Chauffeur trouvé' || label === 'Attribuée') return blue;
  if (label === 'Le chauffeur arrive' || label === 'Acceptée') return green;
  if (label === 'Chauffeur proche') return green;
  if (label === 'En route') return green;
  return gold;
}

function PremiumActionButton({
  label,
  icon,
  onPress,
  style,
  textStyle,
  iconColor = '#FFF',
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  style: object;
  textStyle?: object;
  iconColor?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      friction: 5,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => animateTo(0.94)}
      onPressOut={() => animateTo(1)}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
        <Text style={textStyle}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function CourseTrackingScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const rideId = String(params.id || params.rideId || '');
  const hasValidRide = rideId.length > 0;
  const paramDriverId = String(params.driverId || '').trim();
  const [assignedDriverId, setAssignedDriverId] = useState(paramDriverId);
  const [assignedDriverName, setAssignedDriverName] = useState(
    String(params.driverName || '').trim(),
  );
  const driverId = assignedDriverId;
  const driverName = assignedDriverName || 'Votre chauffeur';
  const pulse = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<CourseTrackingMapRef | null>(null);

  const [region, setRegion] = useState({
    latitude: 36.462,
    longitude: 7.426,
    latitudeDelta: 0.035,
    longitudeDelta: 0.035,
  });

  const [clientPosition, setClientPosition] = useState({
    latitude: 36.462,
    longitude: 7.426,
  });

  const [driverPosition, setDriverPosition] = useState({
    latitude: 36.455,
    longitude: 7.415,
  });
const [carRotation, setCarRotation] = useState(0);
  const [status, setStatus] = useState(
    normalizeRideTrackingStatus(params.status || 'En attente')
  );
  const [uiStatusLabel, setUiStatusLabel] = useState('En attente');
  const [simulatedEtaMin, setSimulatedEtaMin] = useState(8);
  const [rejectedDriverIds, setRejectedDriverIds] = useState<string[]>([]);
  const [rideData, setRideData] = useState<Record<string, unknown> | null>(null);
const [demoMode, setDemoMode] = useState(false);
  const [driverGpsBadge, setDriverGpsBadge] = useState<DriverGpsBadge>('SIMULATION');
  const [driverLocationAgeSec, setDriverLocationAgeSec] = useState<number | null>(null);
  const [driverIsMoving, setDriverIsMoving] = useState(false);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driverAverageRating, setDriverAverageRating] = useState(5);

const arrivedAlertShown = useRef(false);
const finishedAlertShown = useRef(false);
const nearAlertShown = useRef(false);
const notifiedRef = useRef<Set<string>>(new Set());
const statusRef = useRef(normalizeRideTrackingStatus(params.status || 'En attente'));
const simulationActiveRef = useRef(true);
const simulationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
const locationSubscriptionRef =
  useRef<Location.LocationSubscription | null>(null);
const driverPositionRef = useRef(driverPosition);
const clientPositionRef = useRef(clientPosition);
const lastRealGpsAtRef = useRef(0);
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(28)).current;
  const statusTextOpacity = useRef(new Animated.Value(1)).current;
  const statusTextScale = useRef(new Animated.Value(1)).current;
  const statusIconScale = useRef(new Animated.Value(1)).current;

  const destinationPosition = useMemo(
    () =>
      resolveRideDestinationCoordinate({
        rideData,
        paramLatitude: params.destinationLatitude,
        paramLongitude: params.destinationLongitude,
        clientPosition,
      }),
    [
      rideData,
      params.destinationLatitude,
      params.destinationLongitude,
      clientPosition,
    ],
  );

  const displayStatus =
    status === 'En attente' && rejectedDriverIds.length > 0
      ? 'Recherche d\'un autre chauffeur'
      : status;

  const headerStatusShort = getHeaderStatusShort(status, displayStatus);
  const compactGpsBadge = getCompactGpsBadgeLabel(driverGpsBadge);
  const etaMinutes = Math.max(1, Math.ceil(durationMin));
  const isUiSimulationActive =
    simulationActiveRef.current &&
    status === 'En attente' &&
    !driverId &&
    displayStatus === 'En attente';
  const effectiveStatusLabel = isUiSimulationActive ? uiStatusLabel : headerStatusShort;
  const effectiveEtaMinutes = isUiSimulationActive ? simulatedEtaMin : etaMinutes;
  const statusAccentColor = getStatusAccentColor(effectiveStatusLabel);
  const prevStatusLabelRef = useRef(effectiveStatusLabel);
  const panelBottomInset = Math.max(insets.bottom, 6) + 4;

  useEffect(() => {
    if (prevStatusLabelRef.current === effectiveStatusLabel) return;
    prevStatusLabelRef.current = effectiveStatusLabel;

    statusTextOpacity.setValue(0.72);
    statusTextScale.setValue(0.96);
    statusIconScale.setValue(1);

    Animated.parallel([
      Animated.timing(statusTextOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(statusTextScale, {
        toValue: 1,
        friction: 7,
        tension: 180,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(statusIconScale, {
          toValue: 1.12,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(statusIconScale, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [effectiveStatusLabel, statusIconScale, statusTextOpacity, statusTextScale]);

  const clearSimulationTimers = () => {
    simulationTimersRef.current.forEach(clearTimeout);
    simulationTimersRef.current = [];
  };

  const stopStatusSimulation = () => {
    if (!simulationActiveRef.current) return;
    simulationActiveRef.current = false;
    clearSimulationTimers();
  };

  const removeLocationSubscription = () => {
    const subscription = locationSubscriptionRef.current;
    if (subscription && typeof subscription.remove === 'function') {
      subscription.remove();
    }
    locationSubscriptionRef.current = null;
  };

  useEffect(() => {
    if (!hasValidRide) return;

    simulationActiveRef.current = true;
    setUiStatusLabel('En attente');
    setSimulatedEtaMin(8);
    clearSimulationTimers();

    const schedule = (delay: number, fn: () => void) => {
      const timerId = setTimeout(fn, delay);
      simulationTimersRef.current.push(timerId);
    };

    schedule(4000, () => {
      if (!simulationActiveRef.current) return;
      setUiStatusLabel('Chauffeur trouvé');
      setSimulatedEtaMin(6);
    });

    schedule(6000, () => {
      if (!simulationActiveRef.current) return;
      setUiStatusLabel('Le chauffeur arrive');
      setSimulatedEtaMin(4);
    });

    schedule(8000, () => {
      if (!simulationActiveRef.current) return;
      setUiStatusLabel('Chauffeur proche');
      setSimulatedEtaMin(2);
    });

    return () => {
      stopStatusSimulation();
    };
  }, [hasValidRide, rideId]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    driverPositionRef.current = driverPosition;
  }, [driverPosition]);

  useEffect(() => {
    clientPositionRef.current = clientPosition;
  }, [clientPosition]);

  useEffect(() => {
    if (demoMode) {
      setDriverGpsBadge('SIMULATION');
    }
  }, [demoMode]);

  useEffect(() => {
    if (!hasValidRide) return;

    panelOpacity.setValue(0);
    panelTranslateY.setValue(28);
    Animated.parallel([
      Animated.timing(panelOpacity, {
        toValue: 1,
        duration: 480,
        useNativeDriver: true,
      }),
      Animated.spring(panelTranslateY, {
        toValue: 0,
        friction: 9,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, [hasValidRide, panelOpacity, panelTranslateY]);

  useEffect(() => {
    if (!hasValidRide) return;

    void requestNotificationPermissions().catch((error) => {
      devError('[CLIENT TRACKING ERROR - requestNotificationPermissions]', error);
    });
    void getLocation().catch((error) => {
      devError('[CLIENT TRACKING ERROR - getLocation]', error);
    });

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    ).start();

    return () => {
      removeLocationSubscription();
    };
  }, [hasValidRide]);
  useEffect(() => {
  if (!hasValidRide) return;

  const unsubscribe = onSnapshot(
    collection(db, 'driversLive'),
    (snapshot) => {
      const driversData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setDrivers(driversData);
    },
    (error) => {
      devError('[CLIENT RIDE SNAPSHOT ERROR - driversLiveCollection]', error);
    },
  );

  return () => unsubscribe();
}, [hasValidRide]);
useEffect(() => {
  if (!hasValidRide || !demoMode) return;

  const interval = setInterval(() => {
    setDriverPosition((prev) => {
      const latDiff =
        clientPosition.latitude - prev.latitude;

      const lngDiff =
        clientPosition.longitude - prev.longitude;

      const step = 0.04;

      const newPosition = {
        latitude: prev.latitude + latDiff * step,
        longitude: prev.longitude + lngDiff * step,
      };

      const distance =
        Math.abs(latDiff) + Math.abs(lngDiff);

      if (
        distance < 0.0005 &&
        !arrivedAlertShown.current &&
        isRideEnRoute(status)
      ) {
        arrivedAlertShown.current = true;

        setStatus('Arrivé');

        void notifyClient(
          notifiedRef.current,
          'driver_arrived',
          mapRideNotificationContext({ id: rideId, status: 'Arrivé' })
        );

        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        clearInterval(interval);
      }

      return newPosition;
    });
  }, 500);

  return () => clearInterval(interval);
}, [hasValidRide, demoMode, clientPosition, status]);
useEffect(() => {
  if (!hasValidRide || !rideId) return;

  const unsubscribe = onSnapshot(
    doc(db, 'rides', rideId),
    (snapshot) => {
      try {
        const data = snapshot.data();
        if (!data) return;

        setRideData(data as Record<string, unknown>);

        setRejectedDriverIds(
          Array.isArray(data.rejectedDriverIds)
            ? data.rejectedDriverIds.map(String)
            : [],
        );

        const rideDriverId = String(data.driverId || '').trim();
        const rideDriverName = String(data.driverName || '').trim();
        if (rideDriverId) {
          setAssignedDriverId(rideDriverId);
        }
        if (rideDriverName) {
          setAssignedDriverName(rideDriverName);
        }

        const nextStatus = normalizeRideTrackingStatus(data.status);
        if (!nextStatus) return;

        if (rideDriverId || nextStatus !== 'En attente') {
          stopStatusSimulation();
        }

        const previousStatus = statusRef.current;
        statusRef.current = nextStatus;
        setStatus(nextStatus);

        const rideContext = mapRideNotificationContext({
          id: rideId,
          driverName: rideDriverName || String(params.driverName || ''),
          ...data,
        });
        const clientEvent = getClientEventFromStatus(nextStatus, rideContext);

        if (clientEvent && previousStatus !== nextStatus) {
          void notifyClient(notifiedRef.current, clientEvent, rideContext).catch((error) => {
            devError('[CLIENT TRACKING ERROR - notifyClient]', error);
          });
        }

        const rideClient = extractRideClientCoordinate(
          data as Record<string, unknown>,
          clientPositionRef.current,
        );
        if (isValidMapCoordinate(rideClient)) {
          setClientPosition(rideClient);
        }

        if (nextStatus === 'Arrivé' && !arrivedAlertShown.current) {
          arrivedAlertShown.current = true;

          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );

          Alert.alert(
            'Chauffeur arrivé 📍',
            'Votre chauffeur est arrivé au point de prise en charge.',
            [
              {
                text: 'J’ai compris',
                style: 'default',
              },
            ]
          );
        }

        if (nextStatus === 'Terminée' && !finishedAlertShown.current) {
          finishedAlertShown.current = true;

          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );

          Alert.alert(
            'Course terminée ✅',
            'Merci d’avoir utilisé PROTAXI24. Vous pouvez noter votre chauffeur.',
            [
              {
                text: 'Noter le chauffeur',
                onPress: () =>
                  router.push({
                    pathname: '/rating',
                    params: {
                      rideId,
                      driverId: rideDriverId || assignedDriverId,
                      driverName: rideDriverName || assignedDriverName || driverName,
                    },
                  }),
              },
              {
                text: 'Plus tard',
                onPress: () => router.push('/reservation'),
              },
            ]
          );
        }
      } catch (error) {
        devError('[CLIENT TRACKING ERROR - rideSnapshotHandler]', error);
      }
    },
    (error) => {
      devError('[CLIENT RIDE SNAPSHOT ERROR - rideDocument]', error);
    },
  );

  return () => unsubscribe();
}, [hasValidRide, rideId]);

useEffect(() => {
  if (!hasValidRide || !driverId || demoMode) return;

  const unsubscribe = onSnapshot(
    doc(db, 'driversLive', driverId),
    (snapshot) => {
      try {
        const data = snapshot.data();
        const liveAverage = Number(data?.averageRating ?? data?.rating);
        if (Number.isFinite(liveAverage) && liveAverage > 0) {
          setDriverAverageRating(liveAverage);
        }

        const liveCoordinate = extractDriverLiveCoordinate(
          (data as Record<string, unknown> | undefined) ?? null,
        );

        if (!liveCoordinate) {
          setDriverGpsBadge('OFFLINE GPS');
          setDriverIsMoving(false);
          return;
        }

        const updatedAtMs = getDriverLocationUpdatedAtMs(
          (data as Record<string, unknown> | undefined) ?? null,
        ) || Date.now();
        lastRealGpsAtRef.current = updatedAtMs;
        const ageSec = Math.max(0, Math.floor((Date.now() - updatedAtMs) / 1000));
        const isFresh = ageSec <= GPS_STALE_MS / 1000;
        const moving = isDriverMoving(data?.speed);
        setDriverLocationAgeSec(ageSec);
        setDriverIsMoving(moving);

        const prev = driverPositionRef.current;
        const computedHeading =
          Math.atan2(
            liveCoordinate.longitude - prev.longitude,
            liveCoordinate.latitude - prev.latitude,
          ) *
          (180 / Math.PI);

        const nextHeading =
          typeof data?.heading === 'number' && Number.isFinite(data.heading)
            ? data.heading
            : computedHeading;

        setCarRotation(Number.isFinite(nextHeading) ? nextHeading : 0);
        setDriverPosition(liveCoordinate);

        if (!isFresh) {
          setDriverGpsBadge('WEAK');
        } else if (moving) {
          setDriverGpsBadge('MOVING');
        } else {
          setDriverGpsBadge('LIVE');
        }

        devLog('[LIVE GPS] client marker update', {
          driverId,
          ageSec,
          moving,
          heading: nextHeading,
        });
      } catch (error) {
        devError('[CLIENT TRACKING ERROR - driverLiveSnapshotHandler]', error);
      }
    },
    (error) => {
      devError('[CLIENT RIDE SNAPSHOT ERROR - driverLiveDocument]', error);
    },
  );

  return () => unsubscribe();
}, [hasValidRide, driverId, demoMode, status]);

useEffect(() => {
  if (!hasValidRide || demoMode || !driverId) return;

  const interval = setInterval(() => {
    if (!lastRealGpsAtRef.current) return;

    const ageSec = Math.max(
      0,
      Math.floor((Date.now() - lastRealGpsAtRef.current) / 1000),
    );
    setDriverLocationAgeSec(ageSec);

    if (ageSec > GPS_STALE_MS / 1000) {
      setDriverGpsBadge((current) =>
        current === 'SIMULATION' ? current : 'WEAK',
      );
    }
  }, GPS_AGE_TICK_MS);

  return () => clearInterval(interval);
}, [hasValidRide, demoMode, driverId]);

useEffect(() => {
  if (!hasValidRide || demoMode || driverId) return;

  const interval = setInterval(() => {
    if (Date.now() - lastRealGpsAtRef.current <= GPS_STALE_MS) return;

    setDriverGpsBadge('OFFLINE GPS');

    setDriverPosition((prev) => {
      const client = clientPositionRef.current;
      const latDiff = client.latitude - prev.latitude;
      const lngDiff = client.longitude - prev.longitude;

      if (Math.abs(latDiff) + Math.abs(lngDiff) < 0.0002) {
        return prev;
      }

      return {
        latitude: prev.latitude + latDiff * 0.03,
        longitude: prev.longitude + lngDiff * 0.03,
      };
    });
  }, GPS_FALLBACK_INTERVAL_MS);

  return () => clearInterval(interval);
}, [hasValidRide, demoMode, driverId]);

  const getLocation = async () => {
    try {
      if (Platform.OS === 'web') {
        const lat = Number(params.destinationLatitude);
        const lng = Number(params.destinationLongitude);
        const fallbackPosition =
          Number.isFinite(lat) && Number.isFinite(lng)
            ? { latitude: lat, longitude: lng }
            : DEFAULT_GUELMA_CLIENT;

        setClientPosition(fallbackPosition);
        setRegion({
          ...fallbackPosition,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        });
        return;
      }

      const { status: permissionStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (permissionStatus !== 'granted') return;

      removeLocationSubscription();

      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 4000,
          distanceInterval: 8,
        },
        (position) => {
          void (async () => {
            try {
              const userPosition = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              };

              if (!isValidMapCoordinate(userPosition)) return;

              setClientPosition(userPosition);

              if (rideId) {
                await updateDoc(doc(db, 'rides', rideId), {
                  clientLatitude: userPosition.latitude,
                  clientLongitude: userPosition.longitude,
                  clientUpdatedAt: new Date(),
                });
              }

              setRegion({
                ...userPosition,
                latitudeDelta: 0.035,
                longitudeDelta: 0.035,
              });
            } catch (error) {
              devError('[CLIENT TRACKING ERROR - watchPositionUpdate]', error);
            }
          })();
        },
      );
    } catch (error) {
      devError('[CLIENT TRACKING ERROR - getLocation]', error);
    }
  };
  
  const reservationId = String(params.id || Date.now()).slice(-6);

  const pulseSize = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [54, 82],
  });

  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.02],
  });

  const handleDirectionsReady = (result: DirectionsReadyResult) => {
    if (!hasValidRide) return;

    try {
      setDistanceKm(result.distance);
      setDurationMin(result.duration);

      if (
        result.distance < 1 &&
        result.duration < 2 &&
        !nearAlertShown.current &&
        isRideEnRoute(status)
      ) {
        nearAlertShown.current = true;

        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      }

      if (result.distance < 0.08 && rideId && isRideEnRoute(status)) {
        void updateDoc(doc(db, 'rides', rideId), {
          status: 'Arrivé',
          arrivedAt: new Date(),
        }).catch((error) => {
          devError('[CLIENT TRACKING ERROR - autoArrivedUpdate]', error);
        });
      }
    } catch (error) {
      devError('[CLIENT TRACKING ERROR - handleDirectionsReady]', error);
    }
  };

  const callTaxi = () => {
    Linking.openURL(`tel:${phoneLink}`);
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent(
      `Bonjour PROTAXI24, je suis sur le suivi de ma course #${reservationId}.

Adresse : ${String(params.address || '-')}
Aéroport : ${String(params.airport || '-')}
Heure : ${String(params.time || '-')}
Statut : ${status}`
    );

    Linking.openURL(
      `https://wa.me/${phoneLink.replace('+', '')}?text=${message}`
    );
  };

const openNavigationToClient = () => {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${clientPosition.latitude},${clientPosition.longitude}`;

  Linking.openURL(url);
};


  const cancelRide = () => {
    Alert.alert('Quitter le suivi', 'Voulez-vous quitter cette course ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: () => router.back(),
      },
    ]);
  };


 

  if (!hasValidRide) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={gold} />
          <Text style={styles.errorTitle}>Course introuvable</Text>
          <Text style={styles.errorText}>
            Aucune course active n’a été trouvée. Veuillez confirmer votre
            réservation depuis l’accueil.
          </Text>
          <TouchableOpacity
            style={styles.errorBtn}
            activeOpacity={0.9}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.errorBtnText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.screenBody}>
      <View style={styles.mapSection}>
        <CourseTrackingMap
          ref={mapRef}
          mapStyle={styles.map}
          region={region}
          clientPosition={clientPosition}
          driverPosition={driverPosition}
          destinationPosition={destinationPosition}
          status={status}
          drivers={drivers}
          driverId={driverId}
          pulseSize={pulseSize}
          pulseOpacity={pulseOpacity}
          carRotation={carRotation}
          gold={gold}
          onDirectionsReady={handleDirectionsReady}
          markerStyles={{
            driverMarkerWrap: styles.driverMarkerWrap,
            driverHalo: styles.driverHalo,
            driverMarker: styles.driverMarker,
            clientMarkerWrap: styles.clientMarkerWrap,
            pulseCircle: styles.pulseCircle,
            clientMarker: styles.clientMarker,
          }}
        />

        <LinearGradient
          colors={['transparent', 'rgba(5,5,5,0.35)', 'rgba(5,5,5,0.88)']}
          style={styles.mapBottomFade}
          pointerEvents="none"
        />

        <View
          style={[styles.floatingHeader, { top: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity style={styles.compactBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.headerPill}>
            <Text style={styles.headerLogo} numberOfLines={1}>
              <Text style={{ color: gold }}>PRO</Text>TAXI24
            </Text>
            <Animated.View
              style={{
                opacity: statusTextOpacity,
                transform: [{ scale: statusTextScale }],
              }}
            >
              <Text style={[styles.headerStatus, { color: statusAccentColor }]} numberOfLines={1}>
                {effectiveStatusLabel}
              </Text>
            </Animated.View>
          </View>

          <TouchableOpacity
            style={styles.compactBtn}
            onPress={() => {
              if (!isValidMapCoordinate(driverPosition)) return;
              mapRef.current?.animateCamera(
                {
                  center: driverPosition,
                  pitch: 50,
                  heading: carRotation,
                  zoom: 17,
                },
                { duration: 900 },
              );
            }}
          >
            <Ionicons name="car-sport" size={18} color={gold} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.compactBtn}
            onPress={() => {
              void getLocation().catch((error) => {
                devError('[CLIENT TRACKING ERROR - getLocationButton]', error);
              });
            }}
          >
            <Ionicons name="locate" size={18} color={gold} />
          </TouchableOpacity>
        </View>

        {__DEV__ ? (
          <TouchableOpacity
            style={styles.mapFab}
            onPress={() => setDemoMode((prev) => !prev)}
          >
            <Ionicons name={demoMode ? 'pause' : 'play'} size={18} color="#111" />
          </TouchableOpacity>
        ) : null}
      </View>

      <Animated.View
        style={[
          styles.bottomPanel,
          {
            opacity: panelOpacity,
            transform: [{ translateY: panelTranslateY }],
            paddingBottom: panelBottomInset,
          },
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.panelContent}>
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Ionicons name="time-outline" size={13} color={statusAccentColor} />
              <Text style={[styles.etaValue, { color: statusAccentColor }]}>{effectiveEtaMinutes}</Text>
              <Text style={styles.metricLabel}>min</Text>
            </View>
            <View style={styles.metricsDivider} />
            <View style={styles.metricItem}>
              <Ionicons name="navigate-outline" size={13} color={gold} />
              <Text style={styles.metricValue}>{distanceKm.toFixed(1)}</Text>
              <Text style={styles.metricLabel}>km</Text>
            </View>
            <View style={styles.metricsDivider} />
            <View style={[styles.metricItem, { flex: 1 }]}>
              <Animated.View style={{ transform: [{ scale: statusIconScale }] }}>
                <Ionicons name="pulse-outline" size={13} color={statusAccentColor} />
              </Animated.View>
              <Animated.View
                style={{
                  opacity: statusTextOpacity,
                  transform: [{ scale: statusTextScale }],
                  flex: 1,
                  alignSelf: 'stretch',
                }}
              >
                <Text style={[styles.metricValue, { color: statusAccentColor }]} numberOfLines={1}>
                  {effectiveStatusLabel}
                </Text>
              </Animated.View>
              <Text style={styles.metricLabel}>statut</Text>
            </View>
          </View>

          <View style={styles.metaLine}>
          {compactGpsBadge ? (
            <View style={[styles.gpsCapsule, styles.gpsCapsuleWeak]}>
              <View style={styles.gpsLiveDotWeak} />
              <Text style={styles.gpsCapsuleTextWeak}>{compactGpsBadge}</Text>
            </View>
          ) : (
            <View style={[styles.gpsCapsule, styles.gpsCapsuleLive]}>
              <View style={styles.gpsLiveDot} />
              <Text style={styles.gpsCapsuleTextLive}>Live</Text>
            </View>
          )}
          {driverLocationAgeSec != null && driverId && !demoMode ? (
            <Text style={styles.locationAgeCompact}>{driverLocationAgeSec}s</Text>
          ) : null}
        </View>

        <View style={styles.driverCardPremium}>
          <View style={styles.avatarRing}>
            <Image
              source={{
                uri: String(params.driverPhoto) || 'https://i.imgur.com/6VBx3io.png',
              }}
              style={styles.avatarPremium}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.driverNameRow}>
              <Text style={styles.driverNamePremium} numberOfLines={1}>
                {String(params.driverName || driverName)}
              </Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={11} color="#111" />
              </View>
            </View>
            <Text style={styles.driverInfoPremium} numberOfLines={1}>
              {String(params.driverCar || 'Véhicule PROTAXI')}
            </Text>
            <Text style={styles.platePremium}>
              {String(params.driverPlate || '24-000-16')}
            </Text>
          </View>
          <View style={styles.ratingPremium}>
            <Ionicons name="star" size={12} color={gold} />
            <Text style={styles.ratingTextPremium}>{driverAverageRating.toFixed(1)}</Text>
          </View>
        </View>
        </View>

        <View style={[styles.actionsRow, { height: ACTIONS_ROW_HEIGHT }]}>
          <PremiumActionButton
            label="Appeler"
            icon="call"
            onPress={callTaxi}
            style={styles.actionBtnCall}
            textStyle={styles.actionTextPremium}
          />
          <PremiumActionButton
            label="WhatsApp"
            icon="logo-whatsapp"
            onPress={openWhatsApp}
            style={styles.actionBtnWhatsApp}
            textStyle={styles.actionTextPremium}
          />
          <PremiumActionButton
            label="Naviguer"
            icon="navigate"
            onPress={openNavigationToClient}
            style={styles.actionBtnNav}
            textStyle={styles.actionTextNav}
            iconColor="#111"
          />
          <PremiumActionButton
            label="Quitter"
            icon="close"
            onPress={cancelRide}
            style={styles.actionBtnQuit}
            textStyle={styles.actionTextPremium}
          />
        </View>
      </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    overflow: 'hidden',
  },

  screenBody: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  errorTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 18,
    textAlign: 'center',
  },

  errorText: {
    color: '#A3A3A3',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    textAlign: 'center',
  },

  errorBtn: {
    marginTop: 28,
    backgroundColor: gold,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },

  errorBtnText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '900',
  },
  map: {
    flex: 1,
    width: '100%',
  },

  mapSection: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050505',
  },

  mapBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },

  floatingHeader: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },

  compactBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(8,8,8,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },

  headerPill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(8,8,8,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.22)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.38,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
    }),
  },

  headerLogo: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  headerStatus: {
    color: 'rgba(212,160,23,0.95)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
    letterSpacing: 0.3,
  },

  mapFab: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.8)',
  },

  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    flexDirection: 'column',
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: PANEL_TOP_PADDING,
    borderTopWidth: 1,
    borderColor: 'rgba(212,160,23,0.18)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: { elevation: 22 },
    }),
  },

  panelContent: {
    width: '100%',
  },

  handle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#333',
    alignSelf: 'center',
    marginBottom: 4,
  },

  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },

  metricItem: {
    alignItems: 'flex-start',
    gap: 0,
    minWidth: 46,
  },

  etaValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },

  metricsDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 8,
  },

  metricValue: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },

  metricLabel: {
    color: '#666',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },

  gpsCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },

  gpsCapsuleLive: {
    backgroundColor: 'rgba(46,204,113,0.08)',
    borderColor: 'rgba(46,204,113,0.28)',
  },

  gpsCapsuleWeak: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderColor: 'rgba(245,158,11,0.28)',
  },

  gpsLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: green,
  },

  gpsLiveDotWeak: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },

  gpsCapsuleTextLive: {
    color: green,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  gpsCapsuleTextWeak: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  locationAgeCompact: {
    color: '#555',
    fontSize: 9,
    fontWeight: '700',
  },

  driverCardPremium: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.14)',
    padding: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },

  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(212,160,23,0.55)',
    padding: 2,
    backgroundColor: 'rgba(212,160,23,0.08)',
  },

  avatarPremium: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },

  driverNamePremium: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },

  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  driverInfoPremium: {
    color: '#888',
    fontSize: 10,
    marginTop: 1,
    fontWeight: '600',
  },

  platePremium: {
    color: 'rgba(212,160,23,0.85)',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
    letterSpacing: 0.6,
  },

  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ratingPremium: {
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.28)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(212,160,23,0.06)',
  },

  ratingTextPremium: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },

  driverMarkerWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },

  driverHalo: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(212,160,23,0.55)',
  },

  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111',
    ...Platform.select({
      ios: {
        shadowColor: gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.65,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },

  clientMarkerWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pulseCircle: {
    position: 'absolute',
    borderRadius: 28,
    backgroundColor: 'rgba(0,140,255,0.25)',
  },

  clientMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: gold,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
    marginTop: 2,
  },

  actionBtnCall: {
    flex: 1,
    height: ACTIONS_ROW_HEIGHT,
    borderRadius: 14,
    backgroundColor: 'rgba(15,122,53,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  actionBtnWhatsApp: {
    flex: 1,
    height: ACTIONS_ROW_HEIGHT,
    borderRadius: 14,
    backgroundColor: 'rgba(18,140,58,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  actionBtnNav: {
    flex: 1,
    height: ACTIONS_ROW_HEIGHT,
    borderRadius: 14,
    backgroundColor: gold,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.25)',
  },

  actionBtnQuit: {
    flex: 1,
    height: ACTIONS_ROW_HEIGHT,
    borderRadius: 14,
    backgroundColor: 'rgba(139,30,30,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  actionTextPremium: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  actionTextNav: {
    color: '#111',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

});