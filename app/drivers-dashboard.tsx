import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import DriverLiveMap from '@/components/DriverLiveMap';
import RideRatingSheet from '@/components/RideRatingSheet';
import { DriverLiveMapRef } from '@/components/DriverLiveMap.types';
import WebMapPlaceholder from '@/components/WebMapPlaceholder';
import { useAuthLogout } from '@/hooks/useAuthLogout';
import { useAuth } from '@/hooks/useAuth';
import { getFirebaseAuth } from '@/firebase/authInstance';
import {
  getRideWaitMinutes,
  mapRideNotificationContext,
  notifyDriver,
  requestNotificationPermissions,
} from '@/services/notificationService';
import {
  consumePendingOpenChat,
  consumePendingPushRideId,
} from '@/services/pushNotificationRouting';
import {
  canConfirmCashPayment,
  confirmCashPayment,
  formatRidePaymentAmount,
  getRideCollectedFareAmount,
  getRidePaymentMethodLabel,
  getRidePaymentStatusConfig,
  getRidePaymentStatusLabel,
  normalizeRidePayment,
  normalizeRidePaymentStatus,
  RidePaymentError,
} from '@/services/ridePayment';
import {
  canDriverRateClientFromRide,
  clientHasRatedDriverFromRide,
  driverHasRatedClientFromRide,
  getClientDisplayRating,
  readLegacyClientStars,
  resolveDriverHasRatedClient,
} from '@/services/rideRating';
import {
  getUnreadCountForRole,
  isRideChatOpen,
  normalizeRideChatUnread,
} from '@/services/rideChat';
import { showUserError, showUserSuccess } from '@/services/userFeedback';
import {
  buildMapCoordinate,
  haversineDistanceMeters,
  isValidMapCoordinate,
} from '@/utils/rideTracking';
import { db } from '../firebaseConfig';
import { devError, devLog, devWarn } from '@/utils/devLog';
import {
  acceptRide,
  DriverDispatchError,
} from '@/services/driverDispatchService';
import {
  buildDriverLiveAvailabilityPayload,
  computeIsBusyFromRides,
  DRIVER_ACTIVE_RIDE_STATUSES,
  DRIVER_ASSIGNMENT_FOCUS_STATUSES,
  getDriverLiveStateAfterRideTransition,
  isDriverAssignmentAlert,
  canDriverStartScheduledAirportTransfer,
  isScheduledAirportRide,
  isScheduledManagedRide,
  isScheduledPrivateDriverRide,
} from '@/types/driver';

const gold = '#FFD700';
const brandGreen = '#8BC53F';
const cockpitMuted = '#8A8A8A';
const bg = '#050505';
const card = '#0E0E0E';
const border = '#262626';
const CLIENT_WAITING_MS = 90000;
const PICKUP_ARRIVAL_RADIUS_M = 50;

type GpsTrackingMode = 'idle' | 'busy';

type GpsTrackingProfile = {
  mode: GpsTrackingMode;
  logTag: string;
  updateIntervalMs: number;
  watchTimeIntervalMs: number;
  watchDistanceMeters: number;
  minWriteDistanceMeters: number;
  watchAccuracy: Location.LocationAccuracy;
  initialAccuracy: Location.LocationAccuracy;
};

const GPS_BUSY_PROFILE: GpsTrackingProfile = {
  mode: 'busy',
  logTag: '[LIVE GPS][busy]',
  updateIntervalMs: 8000,
  watchTimeIntervalMs: 5000,
  watchDistanceMeters: 10,
  minWriteDistanceMeters: 10,
  watchAccuracy: Location.Accuracy.High,
  initialAccuracy: Location.Accuracy.High,
};

const GPS_IDLE_PROFILE: GpsTrackingProfile = {
  mode: 'idle',
  logTag: '[LIVE GPS][idle]',
  updateIntervalMs: 28000,
  watchTimeIntervalMs: 28000,
  watchDistanceMeters: 50,
  minWriteDistanceMeters: 50,
  watchAccuracy: Location.Accuracy.Balanced,
  initialAccuracy: Location.Accuracy.Balanced,
};

function getGpsTrackingProfile(isBusy: boolean): GpsTrackingProfile {
  return isBusy ? GPS_BUSY_PROFILE : GPS_IDLE_PROFILE;
}

const DEFAULT_DRIVER_LOCATION = {
  latitude: 36.462,
  longitude: 7.426,
};

type GpsTrackingHint = 'none' | 'stale' | 'waiting';

type GpsPosition = {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
};

const GPS_ERROR_LOG_INTERVAL_MS = 60_000;

function isDefaultDriverLocation(position: { latitude: number; longitude: number }) {
  return (
    Math.abs(position.latitude - DEFAULT_DRIVER_LOCATION.latitude) < 0.0001
    && Math.abs(position.longitude - DEFAULT_DRIVER_LOCATION.longitude) < 0.0001
  );
}

function mapExpoLocationToGpsPosition(
  location: Location.LocationObject,
): GpsPosition {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    heading: location.coords.heading,
    speed: location.coords.speed,
  };
}

function formatGpsError(error: unknown): string {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const code = record.code != null ? String(record.code) : '';
    const message = typeof record.message === 'string' ? record.message : '';
    if (code && message) return `${code}: ${message}`;
    if (message) return message;
  }

  return String(error ?? 'unknown');
}

function resolveLastKnownGpsPosition(
  driverLocation: { latitude: number; longitude: number },
  latestGpsPosition: GpsPosition | null,
  lastWrittenGps: { latitude: number; longitude: number } | null,
): GpsPosition | null {
  if (latestGpsPosition && isValidMapCoordinate(latestGpsPosition)) {
    return latestGpsPosition;
  }

  if (lastWrittenGps && isValidMapCoordinate(lastWrittenGps)) {
    return {
      latitude: lastWrittenGps.latitude,
      longitude: lastWrittenGps.longitude,
      heading: null,
      speed: null,
    };
  }

  if (isValidMapCoordinate(driverLocation) && !isDefaultDriverLocation(driverLocation)) {
    return {
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
      heading: null,
      speed: null,
    };
  }

  return null;
}

async function acquireGpsPosition(
  profile: GpsTrackingProfile,
  lastKnown: GpsPosition | null,
): Promise<
  | { position: GpsPosition; source: 'live' }
  | { position: GpsPosition; source: 'fallback'; error: unknown }
  | { position: null; source: 'none'; error: unknown }
> {
  const accuracyCandidates = [
    profile.initialAccuracy,
    Location.Accuracy.Balanced,
    Location.Accuracy.Low,
  ].filter((accuracy, index, list) => list.indexOf(accuracy) === index);

  let lastError: unknown = null;

  for (const accuracy of accuracyCandidates) {
    try {
      const location = await Location.getCurrentPositionAsync({ accuracy });
      return {
        position: mapExpoLocationToGpsPosition(location),
        source: 'live',
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastKnown) {
    return { position: lastKnown, source: 'fallback', error: lastError };
  }

  return { position: null, source: 'none', error: lastError };
}

function showDriverToast(message: string) {
  showUserSuccess(message);
}

const VISIBLE_STATUSES = [
  'Attribuée',
  'En attente confirmation chauffeur',
  'Chauffeur confirmé',
  'Acceptée',
  'En route',
  'Arrivé',
  'Terminée',
];
const UNASSIGNED_AVAILABLE_STATUSES = ['En attente'];

const ASSIGNMENT_FOCUS_STATUS_SET = new Set<string>(DRIVER_ASSIGNMENT_FOCUS_STATUSES);

function readRideSortTime(ride: any): number {
  const assignedAt = ride?.assignedAt?.toDate?.()?.getTime?.();
  if (typeof assignedAt === 'number' && !Number.isNaN(assignedAt)) {
    return assignedAt;
  }

  const updatedAt = ride?.updatedAt?.toDate?.()?.getTime?.()
    ?? (ride?.updatedAt ? new Date(ride.updatedAt).getTime() : 0);

  return typeof updatedAt === 'number' && !Number.isNaN(updatedAt) ? updatedAt : 0;
}

function sortDriverRidesForDisplay(
  rides: any[],
  options: {
    highlightRideId?: string | null;
    newAssignmentRideIds?: Record<string, boolean>;
  },
): any[] {
  const { highlightRideId, newAssignmentRideIds = {} } = options;

  const priorityScore = (ride: any) => {
    const rideId = String(ride?.id || '');
    if (highlightRideId && rideId === highlightRideId) {
      return 0;
    }
    if (newAssignmentRideIds[rideId]) {
      return 1;
    }
    if (ASSIGNMENT_FOCUS_STATUS_SET.has(normalizeStatus(ride.status))) {
      return 2;
    }
    return 3;
  };

  return [...rides].sort((left, right) => {
    const scoreDiff = priorityScore(left) - priorityScore(right);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return readRideSortTime(right) - readRideSortTime(left);
  });
}

function hasDriverActiveRideInList(rides: any[]): boolean {
  return rides.some((ride) =>
    DRIVER_ACTIVE_RIDE_STATUSES.includes(
      normalizeStatus(ride.status) as (typeof DRIVER_ACTIVE_RIDE_STATUSES)[number],
    ),
  );
}

const isRideVisibleToDriver = (ride: any, driverUid: string) => {
  if (!driverUid) return false;

  const status = normalizeStatus(ride.status);
  const assignedDriverId = String(ride.driverId || '').trim();

  if (assignedDriverId && assignedDriverId !== driverUid) {
    return false;
  }

  if (!assignedDriverId) {
    return UNASSIGNED_AVAILABLE_STATUSES.includes(status);
  }

  return VISIBLE_STATUSES.includes(status);
};

function mapRideSnapshotDocs(snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) {
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    return {
      id: docSnap.id,
      ...data,
      status: normalizeStatus(String(data.status || '')),
    };
  });
}

function mergeRideLists(...lists: any[][]) {
  const byId = new Map<string, any>();
  lists.flat().forEach((ride) => {
    if (ride?.id) {
      byId.set(ride.id, ride);
    }
  });
  return [...byId.values()];
}

const normalizeStatus = (status?: string) => {
  const s = String(status || '').toLowerCase().trim();

  if (s === 'attribuée' || s === 'attribuee') return 'Attribuée';
  if (s === 'acceptée' || s === 'acceptee') return 'Acceptée';
  if (s === 'en route') return 'En route';
  if (s === 'arrivé' || s === 'arrive') return 'Arrivé';
  if (s === 'terminée' || s === 'terminee') return 'Terminée';
  if (s === 'refusée' || s === 'refusee') return 'Refusée';
  if (s === 'confirmée' || s === 'confirmee') return 'Confirmée';
  if (s === 'à attribuer' || s === 'a attribuer') return 'À attribuer';
  if (
    s === 'en attente confirmation chauffeur'
    || s === 'en attente confirmation'
  ) {
    return 'En attente confirmation chauffeur';
  }
  if (s === 'chauffeur confirmé' || s === 'chauffeur confirme') {
    return 'Chauffeur confirmé';
  }

  return status || 'Inconnue';
};

const parsePrice = (price?: string) =>
  parseInt(String(price || '0').replace(/\D/g, ''), 10) || 0;

const getRideDate = (ride: any) =>
  ride.finishedAt?.toDate?.() ??
  ride.createdAt?.toDate?.() ??
  (ride.createdAt ? new Date(ride.createdAt) : null);

const formatHistoryDate = (ride: any) => {
  const date = getRideDate(ride);
  return date ? date.toLocaleString('fr-FR') : '—';
};

const RIDE_TIMELINE_STEPS = [
  'Attribuée',
  'Acceptée',
  'En route',
  'Arrivé',
  'Terminée',
] as const;

const getTimelineStepIndex = (status?: string) => {
  const normalized = normalizeStatus(status);
  const idx = RIDE_TIMELINE_STEPS.indexOf(
    normalized as (typeof RIDE_TIMELINE_STEPS)[number]
  );
  return idx >= 0 ? idx : 0;
};

const getStatusTheme = (status?: string) => {
  switch (normalizeStatus(status)) {
    case 'Attribuée':
      return {
        bg: 'rgba(255,149,0,0.18)',
        color: '#FF9500',
        label: 'ATTRIBUÉE',
      };
    case 'En attente confirmation chauffeur':
      return {
        bg: 'rgba(201,162,39,0.16)',
        color: gold,
        label: 'CONFIRMATION REQUISE',
      };
    case 'Chauffeur confirmé':
      return {
        bg: 'rgba(139,197,63,0.16)',
        color: brandGreen,
        label: 'TRANSFERT CONFIRMÉ',
      };
    case 'Acceptée':
      return {
        bg: 'rgba(59,130,246,0.18)',
        color: '#3B82F6',
        label: 'ACCEPTÉE',
      };
    case 'En route':
      return {
        bg: 'rgba(255,215,0,0.18)',
        color: gold,
        label: 'EN ROUTE',
      };
    case 'Arrivé':
      return {
        bg: 'rgba(74,222,128,0.18)',
        color: '#4ADE80',
        label: 'ARRIVÉ',
      };
    default:
      return {
        bg: 'rgba(255,215,0,0.15)',
        color: gold,
        label: String(normalizeStatus(status)).toUpperCase(),
      };
  }
};

const getSimulatedEta = (status?: string, ride?: any) => {
  if (ride?.eta) return String(ride.eta);
  switch (normalizeStatus(status)) {
    case 'Attribuée':
    case 'En attente confirmation chauffeur':
      return 'Acceptation requise';
    case 'Chauffeur confirmé':
      return 'Transfert planifié confirmé';
    case 'Acceptée':
      return '~8 min';
    case 'En route':
      return '~4 min';
    case 'Arrivé':
      return 'Sur place';
    default:
      return null;
  }
};

const getSimulatedDistance = (ride?: any) => {
  if (ride?.distanceKm) return String(ride.distanceKm);
  if (ride?.distance) return String(ride.distance);
  return '2.4 km';
};

const formatEtaSeconds = (totalSeconds: number) => {
  if (totalSeconds <= 0) return 'Imminent';
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `~${mins}:${secs.toString().padStart(2, '0')}`;
};

const computeCockpitPerformance = (
  rides: any[],
  todayRidesCount: number,
  liveEarnings: number
) => {
  const assigned = rides.filter((ride) => {
    const status = normalizeStatus(ride.status);
    return ['Attribuée', 'Acceptée', 'En route', 'Arrivé', 'Terminée'].includes(
      status
    );
  });
  const responded = assigned.filter(
    (ride) => normalizeStatus(ride.status) !== 'Attribuée'
  );
  const acceptanceRate =
    assigned.length > 0
      ? Math.min(Math.round((responded.length / assigned.length) * 100), 100)
      : 96;

  return {
    acceptanceRate: Math.max(acceptanceRate, 88),
    responseTime: '1m 12s',
    todayRidesCount,
    liveEarnings,
  };
};

function useLiveEta(status: string, ride: any) {
  const normalized = normalizeStatus(status);
  const [liveEta, setLiveEta] = useState(
    () => getSimulatedEta(status, ride) || '—'
  );

  useEffect(() => {
    const base = getSimulatedEta(status, ride);
    if (normalized !== 'Acceptée' && normalized !== 'En route') {
      setLiveEta(base || '—');
      return;
    }

    let totalSeconds = normalized === 'En route' ? 4 * 60 : 8 * 60;
    setLiveEta(formatEtaSeconds(totalSeconds));

    const interval = setInterval(() => {
      totalSeconds = Math.max(totalSeconds - 1, 0);
      setLiveEta(formatEtaSeconds(totalSeconds));
    }, 1000);

    return () => clearInterval(interval);
  }, [normalized, ride?.id, status]);

  return liveEta;
}

export default function DriversDashboardScreen() {
  const { rideId: pushRideIdParam, openChat: openChatParam } = useLocalSearchParams<{
    rideId?: string;
    openChat?: string;
  }>();
  const { confirmLogout } = useAuthLogout();
  const { user, profile } = useAuth();
  const driverUid = user?.uid ?? getFirebaseAuth().currentUser?.uid ?? '';
  const driverDisplayName = profile?.fullName?.trim() || 'Chauffeur PROTAXI';
  const driverPhone = profile?.phone?.trim() || '';
  const [driverRating, setDriverRating] = useState(5);
  const [filter, setFilter] = useState('Toutes');
  const [highlightRideId, setHighlightRideId] = useState<string | null>(null);
  const [newAssignmentRideIds, setNewAssignmentRideIds] = useState<Record<string, boolean>>(
    {},
  );
  const [rides, setRides] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [driverRateRide, setDriverRateRide] = useState<any | null>(null);
  const [driverRateVisible, setDriverRateVisible] = useState(false);
  const [driverRatedByRideId, setDriverRatedByRideId] = useState<Record<string, boolean>>({});
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [localPaidRideIds, setLocalPaidRideIds] = useState<string[]>([]);
  const [revenueModalVisible, setRevenueModalVisible] = useState(false);

  const [driverLocation, setDriverLocation] = useState(DEFAULT_DRIVER_LOCATION);
  const [gpsTrackingHint, setGpsTrackingHint] = useState<GpsTrackingHint>('none');
  const [acceptingRideId, setAcceptingRideId] = useState<string | null>(null);

  const mapRef = useRef<DriverLiveMapRef | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const pendingCockpitScrollRef = useRef(false);
  const highlightRideIdRef = useRef<string | null>(null);
  const newAssignmentRideIdsRef = useRef<Record<string, boolean>>({});
  const ridesRef = useRef<any[]>([]);
  const localPaidRideIdsRef = useRef<string[]>([]);
  const onlineRef = useRef(true);

  useEffect(() => {
    localPaidRideIdsRef.current = localPaidRideIds;
  }, [localPaidRideIds]);

  const applyLocalPaidOverlay = (ride: any) => {
    if (!ride?.id || !localPaidRideIdsRef.current.includes(ride.id)) {
      return ride;
    }

    return {
      ...ride,
      paymentStatus: 'paid',
      confirmedByDriverId: driverUid,
    };
  };
  const notifiedRef = useRef<Set<string>>(new Set());
  const waitingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastGpsSyncRef = useRef(0);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const pendingGpsSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestGpsPositionRef = useRef<{
    latitude: number;
    longitude: number;
    heading?: number | null;
    speed?: number | null;
  } | null>(null);
  const lastWrittenGpsRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const driverLocationRef = useRef(DEFAULT_DRIVER_LOCATION);
  const lastGpsErrorLogAtRef = useRef(0);
  const autoArriveHandledRef = useRef<Set<string>>(new Set());
  const autoArriveInFlightRef = useRef<string | null>(null);
  const tryAutoMarkArrivedRef = useRef<
    ((position: { latitude: number; longitude: number }) => void) | null
  >(null);
  const assignedRidesRef = useRef<any[]>([]);
  const unassignedRidesRef = useRef<any[]>([]);
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');

  const hasBusyRide = (list = ridesRef.current) => computeIsBusyFromRides(list);

  useEffect(() => {
    driverLocationRef.current = driverLocation;
  }, [driverLocation]);

  useEffect(() => {
    newAssignmentRideIdsRef.current = newAssignmentRideIds;
  }, [newAssignmentRideIds]);

  useEffect(() => {
    highlightRideIdRef.current = highlightRideId;
  }, [highlightRideId]);

  const clearNewAssignment = useCallback((rideId: string) => {
    const trimmedRideId = String(rideId || '').trim();
    if (!trimmedRideId) {
      return;
    }

    setNewAssignmentRideIds((prev) => {
      if (!prev[trimmedRideId]) {
        return prev;
      }

      const next = { ...prev };
      delete next[trimmedRideId];
      return next;
    });

    setHighlightRideId((prev) => (prev === trimmedRideId ? null : prev));
  }, []);

  useEffect(() => {
    void requestNotificationPermissions();
  }, []);

  useEffect(() => {
    const fromParam = String(pushRideIdParam ?? '').trim();
    const fromPush = consumePendingPushRideId();
    const rideId = fromParam || fromPush;
    if (!rideId) return;

    setHighlightRideId(rideId);
    setFilter('Attribuée');
    devLog('[PUSH] dashboard focus ride', { rideId });
  }, [pushRideIdParam]);

  useEffect(() => {
    const wantsChat =
      String(openChatParam ?? '') === '1' || consumePendingOpenChat();
    if (!wantsChat) return;

    const targetId = String(pushRideIdParam ?? '').trim();
    if (!targetId) return;

    const ride = rides.find((item) => item.id === targetId);
    if (ride && isRideChatOpen(ride.status)) {
      openRideChat(ride);
    }
  }, [openChatParam, pushRideIdParam, rides]);

  useEffect(() => {
    if (!driverUid) {
      devLog('[DRIVER AUTH] missing uid — reviews listener skipped');
      setRecentReviews([]);
      return undefined;
    }

    devLog('[DRIVER AUTH]', { driverUid, driverName: driverDisplayName });

    const assignedReviewsQuery = query(
      collection(db, 'rides'),
      where('driverId', '==', driverUid),
    );

    const unsubscribe = onSnapshot(
      assignedReviewsQuery,
      (snapshot) => {
        const reviews = mapRideSnapshotDocs(snapshot)
          .filter(
            (ride: any) =>
              String(ride.driverId || '').trim() === driverUid
              && clientHasRatedDriverFromRide(ride),
          )
          .sort(
            (a: any, b: any) =>
              new Date(b.ratedAt || b.finishedAt || 0).getTime()
              - new Date(a.ratedAt || a.finishedAt || 0).getTime(),
          );

        setRecentReviews(reviews);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - drivers-dashboard - reviews]', error);
        setRecentReviews([]);
      },
    );

    return () => unsubscribe();
  }, [driverUid, driverDisplayName]);



  useEffect(() => {
    ridesRef.current = rides;
  }, [rides]);

  const driverRatingCheckRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!driverUid) return;

    let cancelled = false;

    rides.forEach((ride) => {
      const rideId = String(ride?.id ?? '').trim();
      const clientUid = String(ride?.clientUid ?? '').trim();
      if (!rideId || !clientUid) return;
      if (normalizeStatus(ride.status) !== 'Terminée') return;
      if (String(ride.driverId ?? '').trim() !== driverUid) return;

      if (driverHasRatedClientFromRide(ride)) {
        setDriverRatedByRideId((prev) => (
          prev[rideId] === true ? prev : { ...prev, [rideId]: true }
        ));
        driverRatingCheckRef.current.delete(rideId);
        return;
      }

      if (driverRatingCheckRef.current.has(rideId)) return;

      driverRatingCheckRef.current.add(rideId);
      void resolveDriverHasRatedClient(rideId, driverUid, ride).then((rated) => {
        if (cancelled) return;
        setDriverRatedByRideId((prev) => ({ ...prev, [rideId]: rated }));
      });
    });

    return () => {
      cancelled = true;
    };
  }, [rides, driverUid]);

  const showRateClientButton = useCallback(
    (ride: any) => {
      const rideId = String(ride?.id ?? '').trim();
      const clientUid = String(ride?.clientUid ?? '').trim();
      if (!rideId || !clientUid || !driverUid) return false;
      if (normalizeStatus(ride.status) !== 'Terminée') return false;
      if (String(ride.driverId ?? '').trim() !== driverUid) return false;

      if (driverRatedByRideId[rideId] === true) return false;
      if (driverRatedByRideId[rideId] === false) return true;
      return canDriverRateClientFromRide(ride);
    },
    [driverUid, driverRatedByRideId],
  );

  const openDriverRating = useCallback((ride: any) => {
    setDriverRateRide(ride);
    setDriverRateVisible(true);
  }, []);

  const patchRideAfterDriverRating = useCallback((rideId: string) => {
    const patch = (ride: any) => {
      if (String(ride?.id ?? '') !== rideId) return ride;
      const priorStatus =
        ride.ratingStatus && typeof ride.ratingStatus === 'object'
          ? ride.ratingStatus
          : {};
      return {
        ...ride,
        ratingStatus: {
          ...priorStatus,
          driverRatedClient: true,
        },
      };
    };

    setRides((prev) => prev.map(patch));
    ridesRef.current = ridesRef.current.map(patch);
    setDriverRatedByRideId((prev) => ({ ...prev, [rideId]: true }));
  }, []);

  const handleDriverRatingSubmitted = useCallback(() => {
    const rideId = String(driverRateRide?.id ?? '').trim();
    if (rideId) {
      patchRideAfterDriverRating(rideId);
    }
    setDriverRateVisible(false);
    setDriverRateRide(null);
  }, [driverRateRide, patchRideAfterDriverRating]);

  const isDriverBusy = useMemo(() => computeIsBusyFromRides(rides), [rides]);
  const isDriverBusyRef = useRef(isDriverBusy);
  const prevGpsBusyRef = useRef(isDriverBusy);

  useEffect(() => {
    isDriverBusyRef.current = isDriverBusy;
  }, [isDriverBusy]);

  const shouldTrackGps =
    Platform.OS !== 'web' && !!driverUid && isOnline && appIsActive;

  const warnGpsThrottled = useCallback(
    (logTag: string, message: string, error?: unknown) => {
      const now = Date.now();
      if (now - lastGpsErrorLogAtRef.current < GPS_ERROR_LOG_INTERVAL_MS) {
        return;
      }

      lastGpsErrorLogAtRef.current = now;
      devWarn(logTag, message, error != null ? formatGpsError(error) : undefined);
    },
    [],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppIsActive(nextState === 'active');
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!shouldTrackGps) {
      setGpsTrackingHint('none');
    }
  }, [shouldTrackGps]);

  const stopGpsTracking = () => {
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;

    if (pendingGpsSyncRef.current) {
      clearTimeout(pendingGpsSyncRef.current);
      pendingGpsSyncRef.current = null;
    }
  };

  const syncDriverLiveMetadata = async () => {
    if (!driverUid) return;

    const availabilityPayload = buildDriverLiveAvailabilityPayload(
      onlineRef.current,
      ridesRef.current,
    );

    devLog('[DRIVER AVAILABILITY] sync metadata', {
      driverUid,
      ...availabilityPayload,
    });

    await setDoc(
      doc(db, 'driversLive', driverUid),
      {
        driverId: driverUid,
        driverName: driverDisplayName,
        ...availabilityPayload,
        updatedAt: new Date(),
      },
      { merge: true },
    );
  };

  const syncDriverLivePosition = async (
    position: {
      latitude: number;
      longitude: number;
      heading?: number | null;
      speed?: number | null;
    },
    options?: { force?: boolean }
  ) => {
    const profile = getGpsTrackingProfile(isDriverBusyRef.current);
    const now = Date.now();

    if (
      !options?.force &&
      now - lastGpsSyncRef.current < profile.updateIntervalMs
    ) {
      latestGpsPositionRef.current = position;

      if (!pendingGpsSyncRef.current) {
        pendingGpsSyncRef.current = setTimeout(() => {
          pendingGpsSyncRef.current = null;
          const latest = latestGpsPositionRef.current;
          if (latest) {
            void syncDriverLivePosition(latest, { force: true });
          }
        }, profile.updateIntervalMs - (now - lastGpsSyncRef.current));
      }

      return;
    }

    lastGpsSyncRef.current = now;
    latestGpsPositionRef.current = position;

    if (!driverUid) return;

    if (!options?.force && lastWrittenGpsRef.current) {
      const movedMeters = haversineDistanceMeters(lastWrittenGpsRef.current, position);
      if (movedMeters < profile.minWriteDistanceMeters) {
        devLog(`${profile.logTag} skip write — movement below threshold`, {
          driverUid,
          movedMeters: Math.round(movedMeters),
        });
        return;
      }
    }

    const availabilityPayload = buildDriverLiveAvailabilityPayload(
      onlineRef.current,
      ridesRef.current,
    );

    devLog(`${profile.logTag} write driversLive`, {
      driverUid,
      latitude: position.latitude,
      longitude: position.longitude,
      heading: position.heading ?? null,
      speed: position.speed ?? null,
      ...availabilityPayload,
    });

    await setDoc(
      doc(db, 'driversLive', driverUid),
      {
        driverId: driverUid,
        driverName: driverDisplayName,
        latitude: position.latitude,
        longitude: position.longitude,
        heading:
          typeof position.heading === 'number' && Number.isFinite(position.heading)
            ? position.heading
            : null,
        speed:
          typeof position.speed === 'number' && Number.isFinite(position.speed)
            ? position.speed
            : null,
        locationUpdatedAt: serverTimestamp(),
        ...availabilityPayload,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    lastWrittenGpsRef.current = {
      latitude: position.latitude,
      longitude: position.longitude,
    };
  };

  useEffect(() => {
    onlineRef.current = isOnline;
    void syncDriverLiveMetadata();
  }, [isOnline, driverUid, driverDisplayName]);

  useEffect(() => {
    if (!driverUid) {
      setDriverRating(5);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'driversLive', driverUid),
      (snapshot) => {
        const data = snapshot.data();

        if (!data) return;

        setDriverRating(
          Number(data.averageRating || 5)
        );
      },
      (error) => {
        devError('[SNAPSHOT DENIED - drivers-dashboard - driverRating]', error);
      },
    );

    return () => unsubscribe();
  }, [driverUid]);

  useEffect(() => {
    if (!driverUid) {
      setRides([]);
      ridesRef.current = [];
      assignedRidesRef.current = [];
      unassignedRidesRef.current = [];
      return undefined;
    }

    const applyMergedDriverRides = () => {
      const ridesData = mergeRideLists(
        assignedRidesRef.current,
        unassignedRidesRef.current,
      );
      const visibleRides = ridesData.filter((ride) =>
        isRideVisibleToDriver(ride, driverUid),
      );

      const confirmedOnServer = visibleRides
        .filter(
          (ride) =>
            localPaidRideIdsRef.current.includes(ride.id)
            && normalizeRidePaymentStatus(ride.paymentStatus) === 'paid',
        )
        .map((ride) => ride.id);

      if (confirmedOnServer.length > 0) {
        const nextLocalPaidIds = localPaidRideIdsRef.current.filter(
          (id) => !confirmedOnServer.includes(id),
        );
        localPaidRideIdsRef.current = nextLocalPaidIds;
        setLocalPaidRideIds(nextLocalPaidIds);
      }

      const driverRides = visibleRides.map((ride) => applyLocalPaidOverlay(ride));

      let assignmentFocusRideId: string | null = null;
      const assignmentBatch: Record<string, boolean> = {};
      let shouldOpenCockpit = false;
      let shouldShowAllRidesFilter = false;

      driverRides.forEach((ride) => {
        const status = normalizeStatus(ride.status);
        const rideContext = mapRideNotificationContext(ride);
        const prevRide = ridesRef.current.find((r) => r.id === ride.id);
        const prevStatus = prevRide ? normalizeStatus(prevRide.status) : null;

        if (prevStatus === status) return;

        if (isDriverAssignmentAlert(ride, status)) {
          // Remote push (onRideUpdatedPush) is the single notification channel for new assignments.
          // Vibration only here avoids duplicate banner/sound with foreground Expo push.
          Vibration.vibrate(500);
          devLog('[DRIVER ASSIGNMENT] alert', {
            rideId: ride.id,
            status,
            scheduled: isScheduledManagedRide(ride),
          });

          assignmentFocusRideId = ride.id;
          assignmentBatch[ride.id] = true;

          if (!hasDriverActiveRideInList(ridesRef.current)) {
            shouldOpenCockpit = true;
          }

          if (status === 'En attente confirmation chauffeur') {
            shouldShowAllRidesFilter = true;
          }

          if (waitingTimersRef.current[ride.id]) {
            clearTimeout(waitingTimersRef.current[ride.id]);
          }

          if (status === 'Attribuée') {
            waitingTimersRef.current[ride.id] = setTimeout(() => {
              const currentAssignedRide = ridesRef.current.find((item) => item.id === ride.id);
              if (
                currentAssignedRide
                && normalizeStatus(currentAssignedRide.status) === 'Attribuée'
              ) {
                void notifyDriver(
                  notifiedRef.current,
                  'client_waiting',
                  mapRideNotificationContext(currentAssignedRide),
                );
              }
            }, CLIENT_WAITING_MS);
          }
        }

        if (status === 'Annulée' || status === 'Refusée') {
          if (waitingTimersRef.current[ride.id]) {
            clearTimeout(waitingTimersRef.current[ride.id]);
            delete waitingTimersRef.current[ride.id];
          }

          if (status === 'Annulée') {
            void notifyDriver(notifiedRef.current, 'ride_cancelled', rideContext);
          }
        }

        if (status !== 'Attribuée' && waitingTimersRef.current[ride.id]) {
          clearTimeout(waitingTimersRef.current[ride.id]);
          delete waitingTimersRef.current[ride.id];
        }
      });

      const nextNewAssignmentRideIds = { ...newAssignmentRideIdsRef.current };
      Object.keys(assignmentBatch).forEach((rideId) => {
        nextNewAssignmentRideIds[rideId] = true;
      });
      Object.keys(nextNewAssignmentRideIds).forEach((rideId) => {
        const trackedRide = driverRides.find((item) => item.id === rideId);
        if (!trackedRide) {
          delete nextNewAssignmentRideIds[rideId];
        } else if (
          !isDriverAssignmentAlert(trackedRide, trackedRide.status)
          && normalizeStatus(trackedRide.status) !== 'Chauffeur confirmé'
        ) {
          delete nextNewAssignmentRideIds[rideId];
        }
      });

      const nextHighlightRideId = assignmentFocusRideId ?? highlightRideIdRef.current;
      const sortedDriverRides = sortDriverRidesForDisplay(driverRides, {
        highlightRideId: nextHighlightRideId,
        newAssignmentRideIds: nextNewAssignmentRideIds,
      });

      if (assignmentFocusRideId) {
        setHighlightRideId(assignmentFocusRideId);
      }

      setNewAssignmentRideIds(nextNewAssignmentRideIds);

      if (shouldShowAllRidesFilter) {
        setFilter('Toutes');
      }

      if (shouldOpenCockpit) {
        pendingCockpitScrollRef.current = true;
      }

      setRides(sortedDriverRides);
      ridesRef.current = sortedDriverRides;

      void syncDriverLiveMetadata();
    };

    const assignedRidesQuery = query(
      collection(db, 'rides'),
      where('driverId', '==', driverUid),
    );
    const unassignedRidesQuery = query(
      collection(db, 'rides'),
      where('driverId', '==', ''),
    );

    const unsubscribeAssigned = onSnapshot(
      assignedRidesQuery,
      (snapshot) => {
        assignedRidesRef.current = mapRideSnapshotDocs(snapshot);
        applyMergedDriverRides();
      },
      (error) => {
        devError('[SNAPSHOT DENIED - drivers-dashboard - assignedRides]', error);
        assignedRidesRef.current = [];
        applyMergedDriverRides();
      },
    );

    const unsubscribeUnassigned = onSnapshot(
      unassignedRidesQuery,
      (snapshot) => {
        unassignedRidesRef.current = mapRideSnapshotDocs(snapshot);
        applyMergedDriverRides();
      },
      (error) => {
        devError('[SNAPSHOT DENIED - drivers-dashboard - unassignedRides]', error);
        unassignedRidesRef.current = [];
        applyMergedDriverRides();
      },
    );

    return () => {
      unsubscribeAssigned();
      unsubscribeUnassigned();
    };
  }, [driverUid, driverDisplayName]);

  useEffect(
    () => () => {
      Object.values(waitingTimersRef.current).forEach(clearTimeout);
      waitingTimersRef.current = {};
    },
    []
  );

  useEffect(() => {
    if (!shouldTrackGps) {
      prevGpsBusyRef.current = isDriverBusy;
      stopGpsTracking();
      return;
    }

    const modeChanged = prevGpsBusyRef.current !== isDriverBusy;
    prevGpsBusyRef.current = isDriverBusy;

    if (modeChanged) {
      const profile = getGpsTrackingProfile(isDriverBusy);
      devLog(`${profile.logTag} mode transition — restarting watch`, {
        driverUid,
        from: isDriverBusy ? 'idle' : 'busy',
        to: profile.mode,
      });
    }

    let cancelled = false;

    const applyGpsPosition = async (currentPosition: GpsPosition) => {
      if (cancelled) return;

      setDriverLocation({
        latitude: currentPosition.latitude,
        longitude: currentPosition.longitude,
      });

      void tryAutoMarkArrivedRef.current?.(currentPosition);

      await syncDriverLivePosition(currentPosition, { force: true });

      mapRef.current?.animateToRegion({
        latitude: currentPosition.latitude,
        longitude: currentPosition.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    };

    const startGpsWatch = async (profile: GpsTrackingProfile) => {
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: profile.watchAccuracy,
          timeInterval: profile.watchTimeIntervalMs,
          distanceInterval: profile.watchDistanceMeters,
        },
        (nextLocation) => {
          const newPosition = mapExpoLocationToGpsPosition(nextLocation);

          if (!isValidMapCoordinate(newPosition)) {
            return;
          }

          setGpsTrackingHint('none');

          setDriverLocation({
            latitude: newPosition.latitude,
            longitude: newPosition.longitude,
          });

          void tryAutoMarkArrivedRef.current?.(newPosition);

          void syncDriverLivePosition(newPosition);

          mapRef.current?.animateToRegion({
            latitude: newPosition.latitude,
            longitude: newPosition.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          });
        },
      );
    };

    const startGpsTracking = async () => {
      const profile = getGpsTrackingProfile(isDriverBusyRef.current);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          if (!cancelled) {
            Alert.alert(
              'Localisation refusée',
              'Active la localisation pour partager votre position live.'
            );
          }
          return;
        }

        if (locationSubscriptionRef.current) return;

        devLog(`${profile.logTag} tracking started`, {
          driverUid,
          mode: profile.mode,
        });

        const lastKnown = resolveLastKnownGpsPosition(
          driverLocationRef.current,
          latestGpsPositionRef.current,
          lastWrittenGpsRef.current,
        );

        const acquired = await acquireGpsPosition(profile, lastKnown);

        if (cancelled) return;

        if (acquired.position) {
          await applyGpsPosition(acquired.position);

          if (acquired.source === 'fallback') {
            warnGpsThrottled(
              profile.logTag,
              'GPS fix unavailable — using last known position',
              acquired.error,
            );
            setGpsTrackingHint('stale');
          } else {
            setGpsTrackingHint('none');
          }
        } else {
          warnGpsThrottled(
            profile.logTag,
            'GPS fix unavailable — waiting for watch updates',
            acquired.error,
          );
          setGpsTrackingHint('waiting');
        }

        try {
          await startGpsWatch(profile);
        } catch (watchError) {
          warnGpsThrottled(
            profile.logTag,
            'GPS watch unavailable — dashboard remains usable',
            watchError,
          );

          if (!acquired.position) {
            setGpsTrackingHint('waiting');
          }
        }
      } catch (error) {
        const lastKnown = resolveLastKnownGpsPosition(
          driverLocationRef.current,
          latestGpsPositionRef.current,
          lastWrittenGpsRef.current,
        );

        if (lastKnown) {
          warnGpsThrottled(
            `${profile.logTag}`,
            'GPS setup degraded — using last known position',
            error,
          );

          if (!cancelled) {
            await applyGpsPosition(lastKnown);
            setGpsTrackingHint('stale');
          }
          return;
        }

        warnGpsThrottled(
          `${profile.logTag}`,
          'GPS tracking degraded — waiting for signal',
          error,
        );

        if (!cancelled) {
          setGpsTrackingHint('waiting');
        }
      }
    };

    void startGpsTracking();

    return () => {
      cancelled = true;
      devLog('[LIVE GPS] tracking stopped', { driverUid });
      stopGpsTracking();
    };
  }, [shouldTrackGps, driverUid, isDriverBusy, warnGpsThrottled]);

  useEffect(
    () => () => {
      stopGpsTracking();
    },
    []
  );

  const filteredRides = useMemo(() => {
    if (filter === 'Toutes') return rides;
    return rides.filter((ride) => normalizeStatus(ride.status) === filter);
  }, [filter, rides]);

  const activeRide = useMemo(
    () =>
      rides.find((ride) =>
        DRIVER_ACTIVE_RIDE_STATUSES.includes(
          normalizeStatus(ride.status) as (typeof DRIVER_ACTIVE_RIDE_STATUSES)[number],
        ),
      ),
    [rides],
  );

  const paymentPendingRide = useMemo(() => {
    const pending = rides.filter((ride) => {
      const payment = normalizeRidePayment(ride);
      return (
        normalizeStatus(ride.status) === 'Terminée'
        && payment.paymentStatus === 'pending'
        && payment.paymentMethod === 'cash'
        && String(ride.driverId || '').trim() === driverUid
      );
    });

    if (pending.length === 0) {
      return null;
    }

    return [...pending].sort((a, b) => {
      const aTime = a.finishedAt?.toDate?.()?.getTime?.() ?? 0;
      const bTime = b.finishedAt?.toDate?.()?.getTime?.() ?? 0;
      return bTime - aTime;
    })[0];
  }, [rides, driverUid, localPaidRideIds]);

  const currentRide = useMemo(() => {
    if (activeRide) return activeRide;
    if (paymentPendingRide) return paymentPendingRide;

    const pendingRides = rides.filter((ride) => {
      const rideStatus = normalizeStatus(ride.status);
      return (
        DRIVER_ASSIGNMENT_FOCUS_STATUSES.includes(
          rideStatus as (typeof DRIVER_ASSIGNMENT_FOCUS_STATUSES)[number],
        )
        || rideStatus === 'Chauffeur confirmé'
      ) && String(ride.driverId || '').trim() === driverUid;
    });

    return pendingRides[0] ?? null;
  }, [rides, activeRide, paymentPendingRide, driverUid]);

  useEffect(() => {
    if (!pendingCockpitScrollRef.current) {
      return;
    }

    pendingCockpitScrollRef.current = false;

    const frame = requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      devLog('[DRIVER ASSIGNMENT] scrolled to cockpit', {
        rideId: highlightRideId,
        currentRideId: currentRide?.id ?? null,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [highlightRideId, currentRide?.id, rides.length]);

  const completedRides = useMemo(
    () => rides.filter((ride) => normalizeStatus(ride.status) === 'Terminée'),
    [rides]
  );

  const today = new Date().toLocaleDateString('fr-FR');

  const todayCompletedRides = useMemo(
    () =>
      completedRides.filter((ride) => {
        const rideDate = ride.finishedAt?.toDate
          ? ride.finishedAt.toDate().toLocaleDateString('fr-FR')
          : null;

        return rideDate === today;
      }),
    [completedRides, today]
  );

  const todayEarnings = useMemo(
    () =>
      todayCompletedRides.reduce(
        (sum, ride) => sum + getRideCollectedFareAmount(ride),
        0,
      ),
    [todayCompletedRides],
  );

  const driverKpi = useMemo(() => {
    const busy = hasBusyRide(rides);
    let availabilityLabel = 'Disponible';
    let availabilityColor = '#4ADE80';

    if (!isOnline) {
      availabilityLabel = 'Hors ligne';
      availabilityColor = '#EF4444';
    } else if (busy) {
      availabilityLabel = 'Occupé';
      availabilityColor = '#FF9500';
    }

    return {
      todayEarnings,
      todayRidesCount: todayCompletedRides.length,
      averageRating: driverRating,
      availabilityLabel,
      availabilityColor,
    };
  }, [rides, isOnline, todayEarnings, todayCompletedRides.length, driverRating]);

  const recentHistory = useMemo(
    () =>
      [...completedRides]
        .sort(
          (a, b) =>
            (getRideDate(b)?.getTime() ?? 0) - (getRideDate(a)?.getTime() ?? 0)
        )
        .slice(0, 5),
    [completedRides]
  );

  const dailyGoal = 20000;
  const progressPercent = Math.min((todayEarnings / dailyGoal) * 100, 100);
  const bonusReached = todayEarnings >= dailyGoal;
  const completedCount = completedRides.length;

  const badges: string[] = [];
  let driverLevel = '🥉 Bronze';

  if (completedCount >= 20) {
    driverLevel = '🥈 Silver';
  }

  if (completedCount >= 50) {
    driverLevel = '🥇 Gold';
  }

  if (completedCount >= 100 && driverRating >= 4.9) {
    driverLevel = '💎 Diamond';
  }

  if (completedCount >= 10) {
    badges.push('🚖 Chauffeur actif');
  }

  if (driverRating >= 4.8) {
    badges.push('⭐ Chauffeur fiable');
  }

  if (bonusReached) {
    badges.push('💎 Objectif atteint');
  }

  if (isOnline) {
    badges.push('🟢 En ligne');
  }

  const totalEarnings = useMemo(
    () =>
      completedRides.reduce(
        (sum, ride) => sum + getRideCollectedFareAmount(ride),
        0,
      ),
    [completedRides],
  );

  const liveEarnings = todayEarnings;

  const cockpitPerformance = useMemo(
    () =>
      computeCockpitPerformance(
        rides,
        todayCompletedRides.length,
        liveEarnings
      ),
    [rides, todayCompletedRides.length, liveEarnings]
  );

  const openRideTracking = (ride: any, options?: { openChat?: boolean }) => {
    const resolvedRideId = String(ride?.id || ride?.rideId || '').trim();
    if (!resolvedRideId) {
      devLog('[RIDE CHAT] openRideChat pressed — missing ride id', { ride });
      return;
    }

    devLog('[RIDE CHAT] openRideChat pressed', {
      rideId: resolvedRideId,
      driverId: ride?.driverId || driverUid,
      status: ride?.status,
      openChat: Boolean(options?.openChat),
    });

    router.push({
      pathname: '/course-tracking',
      params: {
        id: resolvedRideId,
        rideId: resolvedRideId,
        driverId: String(ride.driverId || driverUid || ''),
        driverName: ride.driverName || driverDisplayName,
        status: ride.status || 'En attente',
        departure: ride.departure || '',
        destination: ride.destination || '',
        address: ride.address || ride.departure || '',
        airport: ride.destination || '',
        price: ride.price || '',
        time: ride.time || '',
        ...(options?.openChat ? { openChat: '1' } : {}),
      },
    });
  };

  const openRideChat = (ride: any) => {
    openRideTracking(ride, { openChat: true });
  };

  const callClient = (phone?: string) => {
    if (!phone) return Alert.alert('Numéro indisponible');
    Linking.openURL(`tel:${phone}`);
  };

  const whatsappClient = (phone?: string) => {
    if (!phone) return Alert.alert('WhatsApp indisponible');
    const cleanPhone = phone.replace('+', '').replace(/\s/g, '');
    Linking.openURL(`https://wa.me/${cleanPhone}`);
  };

  const openNavigation = (latitude?: number, longitude?: number) => {
    if (!latitude || !longitude) {
      Alert.alert('Position indisponible', 'Les coordonnées du client ne sont pas encore disponibles.');
      return;
    }

    const url = Platform.select({
      ios: `maps://app?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });

    if (url) Linking.openURL(url);
  };

  const handleConfirmPayment = async (rideId: string) => {
    if (!driverUid || confirmingPaymentId) {
      return;
    }

    devLog('[RIDE PAYMENT] confirm pressed', { rideId, driverUid });

    setConfirmingPaymentId(rideId);
    try {
      await confirmCashPayment(rideId, driverUid);
      devLog('[RIDE PAYMENT] confirm success', { rideId, driverUid });

      const nextLocalPaidIds = localPaidRideIdsRef.current.includes(rideId)
        ? localPaidRideIdsRef.current
        : [...localPaidRideIdsRef.current, rideId];
      localPaidRideIdsRef.current = nextLocalPaidIds;
      setLocalPaidRideIds(nextLocalPaidIds);

      const patchRidePaymentPaid = (ride: any) => applyLocalPaidOverlay(ride);

      setRides((prev) => prev.map(patchRidePaymentPaid));
      ridesRef.current = ridesRef.current.map(patchRidePaymentPaid);

      showDriverToast('Paiement enregistré');
    } catch (error) {
      const message =
        error instanceof RidePaymentError
          ? error.message
          : 'Impossible de confirmer le paiement.';
      showUserError(message, 'Paiement');
      devError('[RIDE PAYMENT] confirm failed', { rideId, driverUid, error });
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  const updateRideStatus = async (rideId: string, status: string) => {
    if (!driverUid) {
      Alert.alert('Session expirée', 'Reconnectez-vous pour mettre à jour vos courses.');
      return;
    }

    const finalStatus = normalizeStatus(status);

    try {
      if (finalStatus === 'Acceptée') {
        if (acceptingRideId === rideId) {
          return;
        }

        setAcceptingRideId(rideId);
        try {
          await acceptRide({
            rideId,
            driverUid,
            driverName: driverDisplayName,
            driverPhone,
          });
        } catch (error) {
          if (error instanceof DriverDispatchError) {
            const message =
              error.code === 'ride_already_taken'
                ? 'Cette course a déjà été prise.'
                : error.message;
            showDriverToast(message);
            return;
          }
          throw error;
        } finally {
          setAcceptingRideId(null);
        }

        clearNewAssignment(rideId);
      } else if (finalStatus === 'Refusée') {
        const refusedRide = rides.find((ride) => ride.id === rideId);
        const scheduledManaged = isScheduledManagedRide(refusedRide);
        const refusePayload = {
          status: scheduledManaged ? 'À attribuer' : 'En attente',
          driverId: '',
          driverName: '',
          driverPhone: '',
          driverPhoto: '',
          driverPlate: '',
          driverCar: '',
          rejectedDriverIds: arrayUnion(driverUid),
          updatedAt: serverTimestamp(),
        };

        await updateDoc(doc(db, 'rides', rideId), refusePayload);

        const driversLivePayload = {
          driverId: driverUid,
          driverName: driverDisplayName,
          isOnline,
          isBusy: false,
          availability: 'available' as const,
          currentRideId: '',
          updatedAt: serverTimestamp(),
        };

        await setDoc(
          doc(db, 'driversLive', driverUid),
          driversLivePayload,
          { merge: true },
        );

        devLog('[RIDE STATE] driver refused → returned to admin pool', {
          rideId,
          driverUid,
        });

        clearNewAssignment(rideId);
        return;
      } else {
        await updateDoc(doc(db, 'rides', rideId), {
          status: finalStatus,
          updatedAt: serverTimestamp(),
          ...(finalStatus === 'En route' ? { startedAt: serverTimestamp() } : {}),
          ...(finalStatus === 'Terminée' ? { finishedAt: serverTimestamp() } : {}),
        });

        const transitioningRide = rides.find((item) => item.id === rideId);
        const liveState = getDriverLiveStateAfterRideTransition(
          isOnline,
          finalStatus,
          rideId,
          transitioningRide
            ? { ...transitioningRide, status: finalStatus }
            : { status: finalStatus },
        );

        devLog('[RIDE STATE] transition', {
          rideId,
          finalStatus,
          ...liveState,
        });

        await setDoc(
          doc(db, 'driversLive', driverUid),
          {
            driverId: driverUid,
            driverName: driverDisplayName,
            isOnline,
            ...liveState,
            updatedAt: new Date(),
          },
          { merge: true },
        );

        if (finalStatus === 'En route') {
          ridesRef.current = ridesRef.current.map((ride) =>
            ride.id === rideId ? { ...ride, status: 'En route' } : ride,
          );

          const position = latestGpsPositionRef.current ?? driverLocation;
          void tryAutoMarkArrivedRef.current?.(position);
        }

        if (finalStatus === 'Terminée') {
          const finishedRide = ridesRef.current.find((ride) => ride.id === rideId);
          const rideSnapshot = finishedRide
            ? { ...finishedRide, status: 'Terminée' }
            : { id: rideId, status: 'Terminée' };

          if (canDriverRateClientFromRide(rideSnapshot)) {
            setDriverRateRide(rideSnapshot);
            setDriverRateVisible(true);
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
          }
        }
      }

    } catch (error) {
      devError('[RIDE STATE] updateRideStatus failed', { rideId, finalStatus, driverUid, error });
      showUserError('Impossible de mettre à jour le statut de la course.');
    }
  };

  const tryAutoMarkArrived = useCallback(async (position: {
    latitude: number;
    longitude: number;
  }) => {
    if (!driverUid) return;
    if (autoArriveInFlightRef.current) return;

    const enRouteRide = ridesRef.current.find(
      (ride) =>
        ride?.id &&
        normalizeStatus(ride.status) === 'En route' &&
        String(ride.driverId || '').trim() === driverUid,
    );

    if (!enRouteRide?.id) return;

    const rideId = String(enRouteRide.id);

    if (autoArriveHandledRef.current.has(rideId)) return;

    const pickup = buildMapCoordinate(
      enRouteRide.clientLatitude ?? enRouteRide.latitude,
      enRouteRide.clientLongitude ?? enRouteRide.longitude,
    );

    if (!isValidMapCoordinate(pickup)) return;

    const distanceM = haversineDistanceMeters(position, pickup);

    if (distanceM > PICKUP_ARRIVAL_RADIUS_M) return;

    autoArriveHandledRef.current.add(rideId);
    autoArriveInFlightRef.current = rideId;

    try {
      await updateRideStatus(rideId, 'Arrivé');
      showDriverToast('Arrivée détectée automatiquement');
    } finally {
      if (autoArriveInFlightRef.current === rideId) {
        autoArriveInFlightRef.current = null;
      }
    }
  }, [driverUid, updateRideStatus]);

  useEffect(() => {
    tryAutoMarkArrivedRef.current = (position) => {
      void tryAutoMarkArrived(position);
    };
  }, [tryAutoMarkArrived]);

  const renderRideActions = (ride: any) => {
    const status = normalizeStatus(ride.status);

    return (
      <>
        <TouchableOpacity
          style={styles.roundBtn}
          onPress={() => callClient(ride.phone)}
        >
          <Ionicons name="call-outline" size={22} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.roundBtn}
          onPress={() => whatsappClient(ride.phone)}
        >
          <Ionicons name="logo-whatsapp" size={22} color="#FFF" />
        </TouchableOpacity>

        {(status === 'Attribuée' || status === 'En attente confirmation chauffeur') && (
          <>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => updateRideStatus(ride.id, 'Acceptée')}
            >
              <Text style={styles.acceptText}>ACCEPTER</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => updateRideStatus(ride.id, 'Refusée')}
            >
              <Text style={styles.rejectText}>REFUSER</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'Chauffeur confirmé'
        && canDriverStartScheduledManagedMission(ride) && (
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => updateRideStatus(ride.id, 'En route')}
          >
            <Text style={styles.acceptText}>
              {isScheduledPrivateDriverRide(ride)
                ? 'DÉMARRER LA MISSION'
                : 'DÉMARRER LE TRANSFERT'}
            </Text>
          </TouchableOpacity>
        )}

        {status === 'En attente' && (
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => updateRideStatus(ride.id, 'Acceptée')}
          >
            <Text style={styles.acceptText}>PRENDRE LA COURSE</Text>
          </TouchableOpacity>
        )}

        {status === 'Acceptée' && (
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => updateRideStatus(ride.id, 'En route')}
          >
            <Text style={styles.acceptText}>DÉMARRER</Text>
          </TouchableOpacity>
        )}

        {status === 'En route' && (
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => updateRideStatus(ride.id, 'Arrivé')}
          >
            <Text style={styles.acceptText}>ARRIVÉ</Text>
          </TouchableOpacity>
        )}

        {status === 'Arrivé' && (
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => updateRideStatus(ride.id, 'Terminée')}
          >
            <Text style={styles.acceptText}>TERMINER</Text>
          </TouchableOpacity>
        )}

        {canConfirmCashPayment(ride, driverUid) ? (
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => handleConfirmPayment(ride.id)}
            disabled={confirmingPaymentId === ride.id}
          >
            <Text style={styles.acceptText}>
              {confirmingPaymentId === ride.id ? 'ENREGISTREMENT…' : 'PAIEMENT REÇU'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </>
    );
  };

  const currentRideLatitude =
    currentRide?.clientLatitude || currentRide?.latitude || 36.47;
  const currentRideLongitude =
    currentRide?.clientLongitude || currentRide?.longitude || 7.435;

  const clientLatitude = activeRide?.clientLatitude || activeRide?.latitude || 36.47;
  const clientLongitude = activeRide?.clientLongitude || activeRide?.longitude || 7.435;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.title}>DRIVER DASHBOARD</Text>
            <Text style={styles.subtitle}>PROTAXI Driver Live System</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
              <Ionicons name="log-out-outline" size={20} color={gold} />
            </TouchableOpacity>

            <View style={styles.switchContainer}>
              <Text style={[styles.onlineText, { color: isOnline ? '#4ADE80' : '#EF4444' }]}>
                {isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
              </Text>

              <Switch
                value={isOnline}
               onValueChange={(value) => {
    setIsOnline(value);

    if (!value) {
      stopGpsTracking();
      void syncDriverLiveMetadata();
    }
  }}
                trackColor={{ false: '#3A3A3A', true: '#4ADE80' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View>
            <Text style={styles.heroHello}>Bonjour, Chauffeur 👋</Text>
            <Text style={styles.heroSub}>Votre activité PROTAXI en direct</Text>
          </View>

          <View style={styles.ratingCircle}>
            <Text style={styles.ratingText}>
              {driverKpi.averageRating.toFixed(1)}
            </Text>
            <Ionicons name="star" size={15} color={gold} />
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            title="Gains aujourd'hui"
            value={`${driverKpi.todayEarnings.toLocaleString('fr-FR')} DA`}
            icon="wallet-outline"
          />
          <StatCard
            title="Courses aujourd'hui"
            value={driverKpi.todayRidesCount.toString()}
            icon="speedometer-outline"
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard
            title="Note moyenne"
            value={`${driverKpi.averageRating.toFixed(1)} ⭐`}
            icon="star-outline"
          />
          <StatCard
            title="Statut"
            value={driverKpi.availabilityLabel}
            icon="radio-button-on-outline"
            valueColor={driverKpi.availabilityColor}
          />
        </View>

        <View style={styles.mapBox}>
          {Platform.OS === 'web' ? (
            <WebMapPlaceholder style={styles.map} />
          ) : (
            <DriverLiveMap
              ref={mapRef}
              driverLocation={driverLocation}
              activeRide={activeRide}
              clientLatitude={clientLatitude}
              clientLongitude={clientLongitude}
              mapStyle={styles.map}
              gold={gold}
            />
          )}
          {gpsTrackingHint !== 'none' && Platform.OS !== 'web' ? (
            <View style={styles.gpsHintBanner} pointerEvents="none">
              <Ionicons name="navigate-outline" size={14} color="#FBBF24" />
              <Text style={styles.gpsHintText}>
                {gpsTrackingHint === 'stale'
                  ? 'GPS instable — dernière position connue affichée.'
                  : 'Signal GPS en attente…'}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Course actuelle</Text>

        {currentRide ? (
          <CurrentRideCockpit
            ride={currentRide}
            showNewMissionBadge={Boolean(newAssignmentRideIds[currentRide.id])}
            latitude={currentRideLatitude}
            longitude={currentRideLongitude}
            isOnline={isOnline}
            performance={cockpitPerformance}
            onCall={() => callClient(currentRide.phone)}
            onWhatsapp={() => whatsappClient(currentRide.phone)}
            onNavigate={() =>
              openNavigation(currentRideLatitude, currentRideLongitude)
            }
            onTrack={() => openRideTracking(currentRide)}
            onAccept={() => updateRideStatus(currentRide.id, 'Acceptée')}
            onReject={() => updateRideStatus(currentRide.id, 'Refusée')}
            onStart={() => updateRideStatus(currentRide.id, 'En route')}
            onArrived={() => updateRideStatus(currentRide.id, 'Arrivé')}
            onFinish={() => updateRideStatus(currentRide.id, 'Terminée')}
            onConfirmPayment={() => handleConfirmPayment(currentRide.id)}
            isConfirmingPayment={confirmingPaymentId === currentRide.id}
            driverUid={driverUid}
            showChat={
              Boolean(currentRide.driverId)
              && isRideChatOpen(normalizeStatus(currentRide.status))
            }
            chatUnread={getUnreadCountForRole(
              normalizeRideChatUnread(currentRide.chatUnread),
              'driver',
            )}
            onOpenChat={() => {
              devLog('[RIDE CHAT] open', {
                rideId: currentRide.id,
                role: 'driver',
                driverId: currentRide.driverId,
                status: normalizeStatus(currentRide.status),
              });
              openRideChat(currentRide);
            }}
            showRateClient={showRateClientButton(currentRide)}
            onRateClient={() => openDriverRating(currentRide)}
          />
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="car-outline" size={42} color={gold} />
            <Text style={styles.emptyTitle}>Aucune course en cours</Text>
            <Text style={styles.emptyText}>
              Les nouvelles courses apparaîtront ici.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Historique rapide</Text>

        {recentHistory.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="time-outline" size={36} color={gold} />
            <Text style={styles.emptyTitle}>Aucune course terminée</Text>
            <Text style={styles.emptyText}>
              Vos 5 dernières courses s’afficheront ici.
            </Text>
          </View>
        ) : (
          recentHistory.map((ride) => (
            <View key={`history-${ride.id}`} style={styles.historyCard}>
              <View style={styles.historyTop}>
                <Text style={styles.historyDestination} numberOfLines={1}>
                  {ride.destination || 'Destination'}
                </Text>
                <Text style={styles.historyPrice}>
                  {ride.price || '—'}
                </Text>
              </View>
              <Text style={styles.historyDate}>{formatHistoryDate(ride)}</Text>
            </View>
          ))
        )}

        <TouchableOpacity
          style={styles.revenueBtn}
          onPress={() => setRevenueModalVisible(true)}
        >
          <Ionicons name="wallet" size={22} color="#111" />
          <Text style={styles.revenueBtnText}>Voir mes revenus</Text>
        </TouchableOpacity>

        <View style={styles.goalCard}>
          <View style={styles.goalTop}>
            <Text style={styles.goalTitle}>Objectif du jour 🎯</Text>
            <Text style={styles.goalMoney}>
              {todayEarnings}/{dailyGoal} DA
            </Text>
          </View>

          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPercent}%`,
                },
              ]}
            />
          </View>

          <Text style={styles.goalText}>
            {Math.round(progressPercent)}% atteint
          </Text>
        </View>

        {bonusReached && (
          <View style={styles.bonusReachedBox}>
            <Text style={styles.bonusReachedText}>🎉 Objectif atteint !</Text>
          </View>
        )}

        <View style={styles.levelCard}>
          <Text style={styles.levelTitle}>Niveau chauffeur</Text>
          <Text style={styles.levelValue}>{driverLevel}</Text>
        </View>

        <View style={styles.badgesCard}>
          <Text style={styles.badgesTitle}>Badges chauffeur</Text>

          <View style={styles.badgesRow}>
            {badges.map((badge, index) => (
              <View key={index} style={styles.badgeItem}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.filterRow}>
          {['Toutes', 'Attribuée', 'Acceptée', 'En route', 'Arrivé', 'Terminée'].map(
            (item) => (
              <TouchableOpacity
                key={item}
                style={[styles.filterBtn, filter === item && styles.filterBtnActive]}
                onPress={() => setFilter(item)}
              >
                <Text
                  style={[styles.filterText, filter === item && styles.filterTextActive]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>

        <Text style={styles.sectionTitle}>Courses chauffeur</Text>

        {filteredRides.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="car-outline" size={42} color={gold} />
            <Text style={styles.emptyTitle}>Aucune course</Text>
            <Text style={styles.emptyText}>Les courses apparaîtront ici.</Text>
          </View>
        ) : (
          filteredRides.map((ride) => {
            const chatUnread = getUnreadCountForRole(
              normalizeRideChatUnread(ride.chatUnread),
              'driver',
            );
            const showChatEntry =
              Boolean(ride.driverId) && isRideChatOpen(normalizeStatus(ride.status));
            const showNewMissionBadge = Boolean(newAssignmentRideIds[ride.id]);

            return (
            <TouchableOpacity
              key={ride.id}
              activeOpacity={0.92}
              onPress={() => clearNewAssignment(ride.id)}
              style={[
                styles.rideCard,
                highlightRideId === ride.id && styles.rideCardHighlight,
              ]}
            >
              <View style={styles.rideTop}>
                <View>
                  <Text style={styles.ridePrice}>{ride.price || 'Prix à confirmer'}</Text>
                  <Text style={styles.rideService}>{ride.service || 'Course PROTAXI'}</Text>
                </View>

                <View style={styles.rideTopRight}>
                  {showNewMissionBadge ? (
                    <View style={styles.newMissionBadge}>
                      <Text style={styles.newMissionBadgeText}>Nouvelle mission</Text>
                    </View>
                  ) : null}
                  {showChatEntry ? (
                    <TouchableOpacity
                      style={styles.chatEntryBtn}
                      onPress={() => openRideChat(ride)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="chatbubble-ellipses" size={16} color={gold} />
                      {chatUnread > 0 ? (
                        <View style={styles.chatUnreadBadge}>
                          <Text style={styles.chatUnreadBadgeText}>
                            {chatUnread > 9 ? '9+' : chatUnread}
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  ) : null}
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{normalizeStatus(ride.status)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.routeBox}>
                <RouteLine />
                <View style={{ flex: 1 }}>
                  <RouteItem title="Départ" value={ride.departure || 'À confirmer'} />
                  <RouteItem title="Destination" value={ride.destination || 'À confirmer'} />
                </View>
              </View>

              <View style={styles.infoGrid}>
                <MiniInfo icon="person-outline" label="Client" value={ride.client || 'Client'} />
                <MiniInfo icon="call-outline" label="Téléphone" value={ride.phone || '—'} />
                <MiniInfo icon="time-outline" label="Horaire" value={ride.time || '—'} />
                <MiniInfo icon="people-outline" label="Passagers" value={String(ride.passengers || '—')} />
                {String(ride.rideType || '') === 'airport'
                && String(ride.flightNumber || '').trim() ? (
                  <MiniInfo
                    icon="airplane-outline"
                    label="Aéroport"
                    value={`Vol : ${String(ride.flightNumber).trim()}`}
                  />
                ) : null}
              </View>

              {normalizeStatus(ride.status) === 'Terminée'
              && String(ride.driverId ?? '').trim() === driverUid ? (
                <View style={styles.rateClientRow}>
                  {showRateClientButton(ride) ? (
                    <TouchableOpacity
                      style={styles.rateClientBtn}
                      onPress={() => openDriverRating(ride)}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="star-outline" size={18} color="#111" />
                      <Text style={styles.rateClientBtnText}>Noter le client</Text>
                    </TouchableOpacity>
                  ) : getClientDisplayRating(ride) != null ? (
                    <Text style={styles.rateClientDoneText}>
                      Note client : {getClientDisplayRating(ride)} ⭐
                    </Text>
                  ) : driverRatedByRideId[ride.id] === true ? (
                    <Text style={styles.rateClientDoneText}>Client noté ✅</Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.actionsRow}>{renderRideActions(ride)}</View>
            </TouchableOpacity>
            );
          })
        )}


  <View style={styles.reviewsCard}>
  <Text style={styles.reviewsTitle}>
    Avis clients ⭐
  </Text>

  {recentReviews.slice(0, 5).map((review) => (
    <View
      key={review.id}
      style={styles.reviewItem}
    >
      <View>
        <Text style={styles.reviewRating}>
          ⭐ {readLegacyClientStars(review) ?? review.rating}/5
        </Text>

        <Text style={styles.reviewComment}>
          {review.comment || 'Aucun commentaire'}
        </Text>
      </View>
    </View>
  ))}
</View>



        <View style={{ height: 45 }} />
      </ScrollView>

      {driverRateRide
      && driverUid
      && String(driverRateRide.clientUid || '').trim() ? (
        <RideRatingSheet
          visible={driverRateVisible}
          onClose={() => {
            setDriverRateVisible(false);
          }}
          onLater={() => {
            setDriverRateVisible(false);
          }}
          onSubmitted={handleDriverRatingSubmitted}
          rideId={String(driverRateRide.id)}
          fromUserId={driverUid}
          fromRole="driver"
          toUserId={String(driverRateRide.clientUid || '').trim()}
          toRole="client"
          peerLabel={String(driverRateRide.client || 'Client')}
          existingStars={getClientDisplayRating(driverRateRide)}
          existingComment=""
        />
      ) : null}

      <Modal
        visible={revenueModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRevenueModalVisible(false)}
      >
        <View style={styles.revenueModalOverlay}>
          <View style={styles.revenueModalCard}>
            <View style={styles.revenueModalHeader}>
              <View style={styles.revenueModalTitleRow}>
                <Ionicons name="wallet" size={24} color={gold} />
                <Text style={styles.revenueModalTitle}>Mes revenus</Text>
              </View>
              <TouchableOpacity
                style={styles.revenueModalCloseIcon}
                onPress={() => setRevenueModalVisible(false)}
              >
                <Ionicons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.revenueModalStats}>
                <View style={styles.revenueModalStatBox}>
                  <Text style={styles.revenueModalStatLabel}>Aujourd&apos;hui</Text>
                  <Text style={styles.revenueModalStatValue}>
                    {todayEarnings.toLocaleString('fr-FR')} DA
                  </Text>
                </View>

                <View style={styles.revenueModalStatBox}>
                  <Text style={styles.revenueModalStatLabel}>Courses du jour</Text>
                  <Text style={styles.revenueModalStatValue}>
                    {todayCompletedRides.length}
                  </Text>
                </View>
              </View>

              <View style={styles.revenueModalGoalBox}>
                <View style={styles.revenueModalGoalTop}>
                  <Text style={styles.revenueModalGoalLabel}>Objectif du jour</Text>
                  <Text style={styles.revenueModalGoalValue}>
                    {todayEarnings.toLocaleString('fr-FR')}/{dailyGoal.toLocaleString('fr-FR')} DA
                  </Text>
                </View>

                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progressPercent}%` },
                    ]}
                  />
                </View>

                <Text style={styles.revenueModalGoalPercent}>
                  {Math.round(progressPercent)}% atteint
                </Text>
              </View>

              <View style={styles.revenueModalTotalBox}>
                <Text style={styles.revenueModalTotalLabel}>Total cumulé</Text>
                <Text style={styles.revenueModalTotalValue}>
                  {totalEarnings.toLocaleString('fr-FR')} DA
                </Text>
              </View>

              <Text style={styles.revenueModalHistoryTitle}>
                Dernières courses terminées
              </Text>

              {recentHistory.length === 0 ? (
                <View style={styles.revenueModalEmptyHistory}>
                  <Ionicons name="time-outline" size={28} color={gold} />
                  <Text style={styles.revenueModalEmptyText}>
                    Aucune course terminée pour le moment.
                  </Text>
                </View>
              ) : (
                recentHistory.map((ride) => (
                  <View key={`revenue-${ride.id}`} style={styles.revenueModalHistoryItem}>
                    <View style={styles.revenueModalHistoryTop}>
                      <Text style={styles.revenueModalHistoryDest} numberOfLines={1}>
                        {ride.destination || 'Destination'}
                      </Text>
                      <Text style={styles.revenueModalHistoryPrice}>
                        {ride.price || '—'}
                      </Text>
                    </View>
                    <Text style={styles.revenueModalHistoryDate}>
                      {formatHistoryDate(ride)}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.revenueModalCloseBtn}
              onPress={() => setRevenueModalVisible(false)}
            >
              <Text style={styles.revenueModalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function RideStatusTimeline({ currentStatus }: { currentStatus: string }) {
  const activeIndex = getTimelineStepIndex(currentStatus);
  const pulse = useRef(new Animated.Value(0.35)).current;
  const progressAnim = useRef(
    new Animated.Value((activeIndex / (RIDE_TIMELINE_STEPS.length - 1)) * 100)
  ).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    anim.start();
    return () => anim.stop();
  }, [pulse]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (activeIndex / (RIDE_TIMELINE_STEPS.length - 1)) * 100,
      duration: 650,
      useNativeDriver: false,
    }).start();
  }, [activeIndex, progressAnim]);

  return (
    <View style={styles.timelineWrap}>
      <View style={styles.timelineProgressTrack}>
        <Animated.View
          style={[
            styles.timelineProgressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <View style={styles.timelineRow}>
        {RIDE_TIMELINE_STEPS.map((step, index) => {
          const state =
            index < activeIndex
              ? 'done'
              : index === activeIndex
                ? 'active'
                : 'pending';
          const isLast = index === RIDE_TIMELINE_STEPS.length - 1;

          return (
            <View key={step} style={styles.timelineStep}>
              <View style={styles.timelineDotRow}>
                {state === 'active' ? (
                  <Animated.View
                    style={[
                      styles.timelineDotGlow,
                      {
                        opacity: pulse,
                        borderColor: gold,
                        backgroundColor: 'rgba(255,215,0,0.25)',
                      },
                    ]}
                  />
                ) : null}

                <View
                  style={[
                    styles.timelineDot,
                    state === 'done' && styles.timelineDotDone,
                    state === 'active' && styles.timelineDotActive,
                    state === 'pending' && styles.timelineDotPending,
                  ]}
                >
                  {state === 'done' ? (
                    <Ionicons name="checkmark" size={10} color="#050505" />
                  ) : null}
                </View>

                {!isLast ? (
                  <View
                    style={[
                      styles.timelineLine,
                      index < activeIndex && styles.timelineLineDone,
                    ]}
                  />
                ) : null}
              </View>

              <Text
                style={[
                  styles.timelineLabel,
                  state === 'done' && styles.timelineLabelDone,
                  state === 'active' && styles.timelineLabelActive,
                  state === 'pending' && styles.timelineLabelPending,
                ]}
                numberOfLines={1}
              >
                {step}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

type CockpitPerformance = {
  acceptanceRate: number;
  responseTime: string;
  todayRidesCount: number;
  liveEarnings: number;
};

const SCHEDULED_PRE_ROUTE_STATUSES = [
  'Attribuée',
  'En attente confirmation chauffeur',
  'Chauffeur confirmé',
] as const;

function isScheduledPreRouteCockpit(ride: any, status: string) {
  return (
    isScheduledManagedRide(ride)
    && SCHEDULED_PRE_ROUTE_STATUSES.includes(
      status as (typeof SCHEDULED_PRE_ROUTE_STATUSES)[number],
    )
  );
}

function isScheduledConfirmationCockpit(ride: any, status: string) {
  return (
    isScheduledManagedRide(ride)
    && (status === 'En attente confirmation chauffeur' || status === 'Attribuée')
  );
}

const PRIVATE_DRIVER_START_LEAD_MS = 20 * 60 * 1000;

function resolveRideScheduledAtMs(ride: any): number | null {
  const scheduledAt = ride?.scheduledAt;
  if (
    scheduledAt
    && typeof scheduledAt === 'object'
    && 'toDate' in scheduledAt
    && typeof scheduledAt.toDate === 'function'
  ) {
    const date = scheduledAt.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
  }

  if (scheduledAt instanceof Date && !Number.isNaN(scheduledAt.getTime())) {
    return scheduledAt.getTime();
  }

  return null;
}

function canDriverStartScheduledManagedMission(ride: any) {
  if (isScheduledAirportRide(ride)) {
    return canDriverStartScheduledAirportTransfer(ride);
  }

  if (isScheduledPrivateDriverRide(ride)) {
    const scheduledMs = resolveRideScheduledAtMs(ride);
    if (scheduledMs === null) {
      const dateStr = String(ride?.date || '').trim();
      if (!dateStr || dateStr === 'À confirmer' || dateStr === 'Maintenant') {
        return false;
      }
      return dateStr === new Date().toLocaleDateString('fr-FR');
    }

    const now = Date.now();
    if (now >= scheduledMs) {
      return true;
    }

    return now >= scheduledMs - PRIVATE_DRIVER_START_LEAD_MS;
  }

  return false;
}

function formatScheduledWhen(ride: any) {
  const scheduledAt = ride?.scheduledAt;
  if (
    scheduledAt
    && typeof scheduledAt === 'object'
    && 'toDate' in scheduledAt
    && typeof scheduledAt.toDate === 'function'
  ) {
    const date = scheduledAt.toDate();
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return date.toLocaleString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  const date = String(ride?.date || '').trim();
  const time = String(ride?.time || '').trim();
  if (date && time && date !== '—' && time !== '—') {
    return `${date} · ${time}`;
  }
  return date || time || '—';
}

function getTransferDirectionLabel(mode: unknown) {
  const value = String(mode || '').trim();
  if (value === 'deposer') return 'Aller à l’aéroport';
  if (value === 'recuperer') return 'Depuis l’aéroport';
  return null;
}

function formatFlightLine(ride: any) {
  const parts: string[] = [];
  const flight = String(ride?.flightNumber || '').trim();
  const terminal = String(ride?.terminal || '').trim();
  if (flight) parts.push(`Vol ${flight}`);
  if (terminal) parts.push(`Terminal ${terminal}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function ScheduledTripDetails({ ride }: { ride: any }) {
  const isPrivate = isScheduledPrivateDriverRide(ride);
  const airport = String(ride?.airport || ride?.destination || '—').trim();
  const direction = getTransferDirectionLabel(ride?.mode);
  const privateType =
    String(ride?.mode || ride?.privateDriverType || '').trim() === 'disposition'
      ? 'Chauffeur à disposition'
      : String(ride?.mode || ride?.privateDriverType || '').trim() === 'trajet'
        ? 'Trajet privé'
        : null;
  const address =
    String(ride?.address || '').trim()
    || String(ride?.departure || '').trim()
    || String(ride?.destination || '').trim()
    || '—';
  const flightLine = formatFlightLine(ride);
  const clientName = String(ride?.client || ride?.clientName || 'Client').trim();
  const clientPhone = String(ride?.phone || '—').trim();
  const durationHours = String(ride?.durationHours || '').trim();

  return (
    <View style={styles.scheduledTripCard}>
      <ScheduledDetailRow label="Quand" value={formatScheduledWhen(ride)} />
      {isPrivate && privateType ? (
        <ScheduledDetailRow label="Service" value={privateType} />
      ) : null}
      {!isPrivate ? <ScheduledDetailRow label="Aéroport" value={airport} /> : null}
      {!isPrivate && direction ? (
        <ScheduledDetailRow label="Sens" value={direction} />
      ) : null}
      <ScheduledDetailRow label="Départ" value={String(ride?.departure || address)} />
      <ScheduledDetailRow
        label="Destination"
        value={String(ride?.destination || '—')}
      />
      {isPrivate && durationHours ? (
        <ScheduledDetailRow label="Durée" value={`${durationHours} h`} />
      ) : null}
      {!isPrivate && flightLine ? (
        <ScheduledDetailRow label="Vol" value={flightLine} />
      ) : null}
      <View style={styles.scheduledDivider} />
      <ScheduledDetailRow label="Client" value={clientName} />
      <ScheduledDetailRow label="Téléphone" value={clientPhone} />
    </View>
  );
}

function ScheduledDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.scheduledDetailRow}>
      <Text style={styles.scheduledDetailLabel}>{label}</Text>
      <Text style={styles.scheduledDetailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function CockpitContactCompact({
  onCall,
  onWhatsapp,
}: {
  onCall: () => void;
  onWhatsapp: () => void;
}) {
  return (
    <View style={styles.cockpitContactCompact}>
      <Text style={styles.cockpitContactCompactLabel}>Besoin d&apos;aide ?</Text>
      <View style={styles.cockpitContactCompactActions}>
        <TouchableOpacity style={styles.cockpitContactIconBtn} onPress={onCall} activeOpacity={0.85}>
          <Ionicons name="call-outline" size={20} color={gold} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cockpitContactIconBtn}
          onPress={onWhatsapp}
          activeOpacity={0.85}
        >
          <Ionicons name="logo-whatsapp" size={20} color={brandGreen} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

type CurrentRideCockpitProps = {
  ride: any;
  showNewMissionBadge?: boolean;
  latitude: number;
  longitude: number;
  isOnline: boolean;
  performance: CockpitPerformance;
  onCall: () => void;
  onWhatsapp: () => void;
  onNavigate: () => void;
  onTrack: () => void;
  onAccept: () => void;
  onReject: () => void;
  onStart: () => void;
  onArrived: () => void;
  onFinish: () => void;
  onConfirmPayment: () => void;
  isConfirmingPayment: boolean;
  onOpenChat?: () => void;
  chatUnread?: number;
  showChat?: boolean;
  driverUid?: string;
  showRateClient?: boolean;
  onRateClient?: () => void;
};

function CockpitPerformanceGrid({ performance }: { performance: CockpitPerformance }) {
  return (
    <View style={styles.cockpitPerfSection}>
      <Text style={styles.cockpitSectionTitle}>Performance live</Text>
      <View style={styles.cockpitPerfGrid}>
        <View style={styles.cockpitPerfItem}>
          <Text style={styles.cockpitPerfValue}>{performance.acceptanceRate}%</Text>
          <Text style={styles.cockpitPerfLabel}>Taux acceptation</Text>
        </View>
        <View style={styles.cockpitPerfItem}>
          <Text style={styles.cockpitPerfValue}>{performance.responseTime}</Text>
          <Text style={styles.cockpitPerfLabel}>Temps réponse</Text>
        </View>
        <View style={styles.cockpitPerfItem}>
          <Text style={styles.cockpitPerfValue}>{performance.todayRidesCount}</Text>
          <Text style={styles.cockpitPerfLabel}>Courses aujourd&apos;hui</Text>
        </View>
        <View style={styles.cockpitPerfItem}>
          <Text style={[styles.cockpitPerfValue, { color: gold }]}>
            {performance.liveEarnings.toLocaleString('fr-FR')} DA
          </Text>
          <Text style={styles.cockpitPerfLabel}>Revenus live</Text>
        </View>
      </View>
    </View>
  );
}

function CurrentRideCockpit({
  ride,
  showNewMissionBadge = false,
  isOnline,
  performance,
  onCall,
  onWhatsapp,
  onNavigate,
  onTrack,
  onAccept,
  onReject,
  onStart,
  onArrived,
  onFinish,
  onConfirmPayment,
  isConfirmingPayment,
  onOpenChat,
  chatUnread = 0,
  showChat = false,
  driverUid = '',
  showRateClient = false,
  onRateClient,
}: CurrentRideCockpitProps) {
  const status = normalizeStatus(ride.status);
  const theme = getStatusTheme(status);
  const liveEta = useLiveEta(status, ride);
  const clientRating = getClientDisplayRating(ride);
  const payment = normalizeRidePayment(ride);
  const paymentStatusConfig = getRidePaymentStatusConfig(payment.paymentStatus);
  const showConfirmPayment = canConfirmCashPayment(ride, driverUid);
  const collectLabel = formatRidePaymentAmount(payment.fareAmount);
  const distance = getSimulatedDistance(ride);
  const scheduledPreRoute = isScheduledPreRouteCockpit(ride, status);
  const scheduledConfirmation = isScheduledConfirmationCockpit(ride, status);
  const isPrivateScheduled = isScheduledPrivateDriverRide(ride);
  const scheduledConfirmed =
    isScheduledManagedRide(ride) && status === 'Chauffeur confirmé';
  const showStartTransfer =
    scheduledConfirmed && canDriverStartScheduledManagedMission(ride);
  const showPendingStartHints = scheduledConfirmed && !showStartTransfer;

  useEffect(() => {
    devLog('[RIDE PAYMENT] cockpit render', {
      rideId: ride?.id,
      paymentStatus: payment.paymentStatus,
      rawPaymentStatus: ride?.paymentStatus,
      paidAt: ride?.paidAt ?? null,
    });
  }, [ride?.id, payment.paymentStatus, ride?.paymentStatus, ride?.paidAt]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  const statusPulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(18);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [ride?.id, fadeAnim, slideAnim]);

  useEffect(() => {
    if (scheduledPreRoute) {
      statusPulse.setValue(0.65);
      return;
    }

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(statusPulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(statusPulse, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    anim.start();
    return () => anim.stop();
  }, [statusPulse, status, scheduledPreRoute]);

  return (
    <Animated.View
      style={[
        styles.cockpitCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {scheduledPreRoute ? (
        <>
          <View style={styles.cockpitHeaderTop}>
            <View style={styles.cockpitOnlineBadge}>
              <View
                style={[
                  styles.cockpitOnlineDot,
                  { backgroundColor: isOnline ? brandGreen : '#EF4444' },
                ]}
              />
              <Text
                style={[
                  styles.cockpitOnlineText,
                  { color: isOnline ? brandGreen : '#EF4444' },
                ]}
              >
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </View>
            <View style={styles.scheduledModePill}>
              <Text style={styles.scheduledModePillText}>Planifié</Text>
            </View>
          </View>

          {showNewMissionBadge ? (
            <View style={styles.cockpitNewMissionBanner}>
              <Ionicons name="sparkles-outline" size={16} color="#111" />
              <Text style={styles.cockpitNewMissionBannerText}>Nouvelle mission</Text>
            </View>
          ) : null}

          <View style={styles.scheduledHero}>
            {scheduledConfirmation ? (
              <>
                <Text style={styles.scheduledHeroTitle}>Confirmation requise</Text>
                <Text style={styles.scheduledHeroSubtitle}>
                  {isPrivateScheduled ? 'Chauffeur privé planifié' : 'Transfert aéroport planifié'}
                </Text>
                <Text style={styles.scheduledHeroHint}>
                  Répondez pour confirmer votre disponibilité.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.scheduledHeroTitle}>
                  {isPrivateScheduled ? 'Mission confirmée' : 'Transfert confirmé'}
                </Text>
                <Text style={styles.scheduledHeroSubtitle}>
                  {isPrivateScheduled
                    ? 'Vous êtes réservé pour cette mise à disposition.'
                    : 'Vous êtes réservé pour ce transfert.'}
                </Text>
                {showPendingStartHints ? (
                  <>
                    <Text style={styles.scheduledAvailabilityHint}>
                      Vous restez disponible pour les courses immédiates.
                    </Text>
                    <Text style={styles.scheduledHeroHint}>
                      {isPrivateScheduled
                        ? 'Le démarrage sera disponible 20 min avant l&apos;horaire prévu.'
                        : 'Le démarrage sera disponible selon le temps d&apos;approche vers l&apos;aéroport.'}
                    </Text>
                  </>
                ) : null}
              </>
            )}
          </View>

          <ScheduledTripDetails ride={ride} />

          <View style={styles.scheduledPriceRow}>
            <Text style={styles.scheduledDetailLabel}>Tarif indicatif</Text>
            <Text style={styles.scheduledPriceValue}>{collectLabel}</Text>
          </View>

          <View style={styles.cockpitPrimaryActions}>
            {scheduledConfirmation ? (
              <>
                <TouchableOpacity
                  style={styles.cockpitPrimaryBtnGreen}
                  onPress={onAccept}
                  activeOpacity={0.9}
                >
                  <Ionicons name="checkmark-circle" size={22} color="#111" />
                  <Text style={styles.cockpitPrimaryText}>ACCEPTER</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cockpitRejectBtn}
                  onPress={onReject}
                  activeOpacity={0.9}
                >
                  <Ionicons name="close-circle" size={22} color="#FFF" />
                  <Text style={styles.cockpitRejectText}>REFUSER</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {showStartTransfer ? (
              <TouchableOpacity
                style={styles.cockpitPrimaryBtnGreen}
                onPress={onStart}
                activeOpacity={0.9}
              >
                <Ionicons name="play-circle" size={22} color="#111" />
                <Text style={styles.cockpitPrimaryText}>
                  {isPrivateScheduled ? 'DÉMARRER LA MISSION' : 'DÉMARRER LE TRANSFERT'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <CockpitContactCompact onCall={onCall} onWhatsapp={onWhatsapp} />
        </>
      ) : (
        <>
      <View style={styles.cockpitHeader}>
        <View style={styles.cockpitHeaderTop}>
          <View style={styles.cockpitOnlineBadge}>
            <View
              style={[
                styles.cockpitOnlineDot,
                { backgroundColor: isOnline ? '#4ADE80' : '#EF4444' },
              ]}
            />
            <Text
              style={[
                styles.cockpitOnlineText,
                { color: isOnline ? '#4ADE80' : '#EF4444' },
              ]}
            >
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>

          <View style={styles.cockpitServiceRow}>
            <Ionicons name="car-sport" size={15} color={gold} />
            <Text style={styles.cockpitServiceText}>
              {ride.service || 'Course PROTAXI'}
            </Text>
          </View>
        </View>

        {showNewMissionBadge ? (
          <View style={styles.cockpitNewMissionBanner}>
            <Ionicons name="sparkles-outline" size={16} color="#111" />
            <Text style={styles.cockpitNewMissionBannerText}>Nouvelle mission</Text>
          </View>
        ) : null}

        <View style={styles.cockpitStatusHero}>
          <Animated.View
            style={[
              styles.cockpitStatusGlow,
              {
                opacity: statusPulse,
                backgroundColor: theme.bg,
                borderColor: theme.color,
              },
            ]}
          />
          <Text style={[styles.cockpitStatusHeroText, { color: theme.color }]}>
            {theme.label}
          </Text>
        </View>

        <View style={styles.cockpitMetricsRow}>
          <View style={styles.cockpitMetricChip}>
            <Ionicons name="time" size={16} color={gold} />
            <View>
              <Text style={styles.cockpitMetricLabel}>ETA live</Text>
              <Text style={styles.cockpitMetricValue}>{liveEta}</Text>
            </View>
          </View>

          <View style={styles.cockpitMetricChip}>
            <Ionicons name="navigate" size={16} color={gold} />
            <View>
              <Text style={styles.cockpitMetricLabel}>Distance</Text>
              <Text style={styles.cockpitMetricValue}>{distance}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.cockpitPrice}>{collectLabel}</Text>
        <Text style={styles.cockpitPriceHint}>Montant à encaisser</Text>
      </View>

      <View style={styles.cockpitPaymentCard}>
        <View style={styles.cockpitPaymentRow}>
          <View>
            <Text style={styles.cockpitPaymentLabel}>Paiement</Text>
            <Text style={styles.cockpitPaymentMethod}>
              {getRidePaymentMethodLabel(payment.paymentMethod)}
            </Text>
          </View>
          <View
            style={[
              styles.cockpitPaymentBadge,
              {
                backgroundColor: paymentStatusConfig.glow,
                borderColor: paymentStatusConfig.border,
              },
            ]}
          >
            <Text style={[styles.cockpitPaymentBadgeText, { color: paymentStatusConfig.color }]}>
              {getRidePaymentStatusLabel(payment.paymentStatus)}
            </Text>
          </View>
        </View>
      </View>

      <RideStatusTimeline currentStatus={status} />

      <View style={styles.cockpitSection}>
        <Text style={styles.cockpitSectionTitle}>Informations client</Text>

        <View style={styles.cockpitInfoGrid}>
          <CockpitInfo
            icon="person"
            label="Client"
            value={ride.client || 'Client'}
          />
          <CockpitInfo
            icon="call"
            label="Téléphone"
            value={ride.phone || '—'}
          />
          <CockpitInfo
            icon="location"
            label="Départ"
            value={ride.departure || 'À confirmer'}
          />
          <CockpitInfo
            icon="flag"
            label="Destination"
            value={ride.destination || 'À confirmer'}
          />
          {String(ride.rideType || '') === 'airport'
          && String(ride.flightNumber || '').trim() ? (
            <CockpitInfo
              icon="airplane"
              label="Transfert"
              value={`Vol : ${String(ride.flightNumber).trim()}`}
            />
          ) : null}
          <CockpitInfo icon="time" label="Heure" value={ride.time || '—'} />
          <CockpitInfo
            icon="star"
            label="Note client"
            value={
              clientRating != null ? `${clientRating} ⭐` : '—'
            }
          />
        </View>
      </View>

      <View style={styles.cockpitActionCard}>
        <Text style={styles.cockpitSectionTitle}>Actions chauffeur</Text>

        <View style={styles.cockpitActionGrid}>
          <TouchableOpacity style={styles.cockpitActionBtn} onPress={onCall}>
            <View style={styles.cockpitActionIconWrap}>
              <Ionicons name="call" size={22} color={gold} />
            </View>
            <Text style={styles.cockpitActionLabel}>Appeler client</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cockpitActionBtn} onPress={onWhatsapp}>
            <View style={[styles.cockpitActionIconWrap, styles.cockpitActionWhatsapp]}>
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            </View>
            <Text style={styles.cockpitActionLabel}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cockpitActionBtn} onPress={onNavigate}>
            <View style={styles.cockpitActionIconWrap}>
              <Ionicons name="map" size={22} color={gold} />
            </View>
            <Text style={styles.cockpitActionLabel}>Google Maps</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cockpitActionBtn} onPress={onTrack}>
            <View style={styles.cockpitActionIconWrap}>
              <Ionicons name="locate" size={22} color={gold} />
            </View>
            <Text style={styles.cockpitActionLabel}>Voir suivi</Text>
          </TouchableOpacity>

          {showChat && onOpenChat ? (
            <TouchableOpacity style={styles.cockpitActionBtn} onPress={onOpenChat}>
              <View style={styles.cockpitActionIconWrap}>
                <Ionicons name="chatbubble-ellipses" size={22} color={gold} />
                {chatUnread > 0 ? (
                  <View style={styles.cockpitChatUnreadDot}>
                    <Text style={styles.cockpitChatUnreadText}>
                      {chatUnread > 9 ? '9+' : chatUnread}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cockpitActionLabel}>Messages</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <CockpitPerformanceGrid performance={performance} />

      <View style={styles.cockpitPrimaryActions}>
        {status === 'Attribuée' && !isScheduledManagedRide(ride) && (
          <>
            <TouchableOpacity style={styles.cockpitPrimaryBtn} onPress={onAccept}>
              <Ionicons name="checkmark-circle" size={24} color="#111" />
              <Text style={styles.cockpitPrimaryText}>ACCEPTER</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cockpitRejectBtn} onPress={onReject}>
              <Ionicons name="close-circle" size={24} color="#FFF" />
              <Text style={styles.cockpitRejectText}>REFUSER</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'Acceptée' && (
          <TouchableOpacity style={styles.cockpitPrimaryBtn} onPress={onStart}>
            <Ionicons name="play-circle" size={24} color="#111" />
            <Text style={styles.cockpitPrimaryText}>DÉMARRER</Text>
          </TouchableOpacity>
        )}

        {status === 'En route' && (
          <TouchableOpacity style={styles.cockpitPrimaryBtn} onPress={onArrived}>
            <Ionicons name="location" size={24} color="#111" />
            <Text style={styles.cockpitPrimaryText}>ARRIVÉ</Text>
          </TouchableOpacity>
        )}

        {status === 'Arrivé' && (
          <TouchableOpacity style={styles.cockpitPrimaryBtn} onPress={onFinish}>
            <Ionicons name="flag" size={24} color="#111" />
            <Text style={styles.cockpitPrimaryText}>TERMINER</Text>
          </TouchableOpacity>
        )}

        {showConfirmPayment && (
          <TouchableOpacity
            style={[
              styles.cockpitPaymentBtn,
              isConfirmingPayment && styles.cockpitPaymentBtnDisabled,
            ]}
            onPress={onConfirmPayment}
            disabled={isConfirmingPayment}
            activeOpacity={0.9}
          >
            <Ionicons name="cash" size={24} color="#111" />
            <Text style={styles.cockpitPrimaryText}>
              {isConfirmingPayment ? 'ENREGISTREMENT…' : 'PAIEMENT REÇU'}
            </Text>
          </TouchableOpacity>
        )}

        {status === 'Terminée' && showRateClient && onRateClient ? (
          <TouchableOpacity style={styles.cockpitPrimaryBtn} onPress={onRateClient}>
            <Ionicons name="star-outline" size={24} color="#111" />
            <Text style={styles.cockpitPrimaryText}>NOTER LE CLIENT</Text>
          </TouchableOpacity>
        ) : null}
      </View>
        </>
      )}
    </Animated.View>
  );
}

function CockpitInfo({
  icon,
  label,
  value,
  wide,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.cockpitInfoItem, wide && styles.cockpitInfoItemWide]}>
      <View style={styles.cockpitInfoIconWrap}>
        <Ionicons name={icon} size={16} color={gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cockpitInfoLabel}>{label}</Text>
        <Text style={styles.cockpitInfoValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function StatCard({ title, value, icon, valueColor }: any) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color={gold} />
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

function RouteLine() {
  return (
    <View style={styles.routeLineBox}>
      <View style={styles.greenDot} />
      <View style={styles.verticalLine} />
      <View style={styles.redDot} />
    </View>
  );
}

function RouteItem({ title, value }: any) {
  return (
    <View style={styles.routeItem}>
      <Text style={styles.routeTitle}>{title}</Text>
      <Text style={styles.routeValue}>{value}</Text>
    </View>
  );
}

function MiniInfo({ icon, label, value }: any) {
  return (
    <View style={styles.miniInfo}>
      <Ionicons name={icon} size={18} color={gold} />
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: bg, paddingHorizontal: 18 },
  header: {
    paddingTop: 54,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#AFAFAF', fontSize: 13, marginTop: 4 },
  switchContainer: { alignItems: 'center' },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoutBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineText: { fontSize: 11, fontWeight: '900', marginBottom: 2 },
  heroCard: {
    borderRadius: 28,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.22)',
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroHello: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  heroSub: { color: '#AAA', fontSize: 13, marginTop: 5 },
  ratingCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 3,
    borderColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  mapBox: {
    height: 190,
    borderRadius: 28,
    overflow: 'hidden',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },
  map: { flex: 1 },
  gpsHintBanner: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  gpsHintText: {
    flex: 1,
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    height: 102,
    borderRadius: 22,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: { color: '#FFF', fontSize: 18, fontWeight: '900', marginTop: 8 },
  statTitle: { color: '#AAA', fontSize: 12, marginTop: 4, textAlign: 'center' },
  historyCard: {
    backgroundColor: card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    marginBottom: 12,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  historyDestination: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  historyPrice: {
    color: gold,
    fontSize: 14,
    fontWeight: '900',
  },
  historyDate: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 8,
  },
  bonusReachedBox: {
    marginTop: 14,
    marginBottom: 14,
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
  },
  bonusReachedText: {
    color: '#22C55E',
    fontWeight: '900',
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  filterBtn: {
    height: 42,
    borderRadius: 16,
    paddingHorizontal: 15,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: gold, borderColor: gold },
  filterText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  filterTextActive: { color: '#111' },
  cockpitCard: {
    backgroundColor: '#101010',
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.32)',
    padding: 22,
    marginBottom: 22,
    overflow: 'hidden',
  },
  cockpitHeader: {
    marginBottom: 20,
  },
  cockpitHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cockpitOnlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(74,222,128,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
  },
  cockpitOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cockpitOnlineText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cockpitStatusHero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 56,
  },
  cockpitStatusGlow: {
    position: 'absolute',
    width: '88%',
    height: 52,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  cockpitStatusHeroText: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  cockpitMetricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  cockpitMetricChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#151515',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#242424',
    padding: 12,
  },
  cockpitMetricLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cockpitMetricValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  cockpitStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 8,
  },
  cockpitStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cockpitStatusText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cockpitEtaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },
  cockpitEtaText: {
    color: gold,
    fontSize: 12,
    fontWeight: '800',
  },
  cockpitServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cockpitServiceText: {
    color: '#D4D4D4',
    fontSize: 14,
    fontWeight: '800',
  },
  cockpitPriceHint: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  cockpitPaymentCard: {
    backgroundColor: '#111',
    borderColor: '#262626',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  cockpitPaymentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cockpitPaymentLabel: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  cockpitPaymentMethod: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  cockpitPaymentBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cockpitPaymentBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  cockpitPaymentBtn: {
    alignItems: 'center',
    backgroundColor: '#4ADE80',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 16,
    width: '100%',
  },
  cockpitPaymentBtnDisabled: {
    opacity: 0.65,
  },
  cockpitPrice: {
    color: '#FFF',
    fontSize: 40,
    fontWeight: '900',
    marginTop: 10,
    letterSpacing: -0.5,
  },
  timelineWrap: {
    marginBottom: 22,
    paddingVertical: 4,
  },
  timelineProgressTrack: {
    height: 4,
    borderRadius: 4,
    backgroundColor: '#252525',
    overflow: 'hidden',
    marginBottom: 16,
  },
  timelineProgressFill: {
    height: '100%',
    backgroundColor: gold,
    borderRadius: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineStep: {
    flex: 1,
    alignItems: 'center',
  },
  timelineDotRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 22,
  },
  timelineDotGlow: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  timelineDotDone: {
    backgroundColor: '#4ADE80',
  },
  timelineDotActive: {
    backgroundColor: gold,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  timelineDotPending: {
    backgroundColor: '#3A3A3A',
  },
  timelineLine: {
    position: 'absolute',
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: '#333',
    zIndex: 1,
  },
  timelineLineDone: {
    backgroundColor: '#4ADE80',
  },
  timelineLabel: {
    marginTop: 8,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 1,
  },
  timelineLabelDone: {
    color: '#4ADE80',
  },
  timelineLabelActive: {
    color: gold,
  },
  timelineLabelPending: {
    color: '#666',
  },
  cockpitSection: {
    backgroundColor: '#151515',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#242424',
    padding: 16,
    marginBottom: 18,
  },
  cockpitSectionTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 14,
  },
  cockpitInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cockpitInfoItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#101010',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  cockpitInfoItemWide: {
    width: '100%',
  },
  cockpitInfoIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,215,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cockpitInfoLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
  },
  cockpitInfoValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
    lineHeight: 18,
  },
  cockpitActionCard: {
    backgroundColor: '#151515',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#242424',
    padding: 16,
    marginBottom: 18,
  },
  cockpitActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cockpitActionBtn: {
    width: '48%',
    backgroundColor: '#101010',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 14,
    alignItems: 'center',
    gap: 10,
  },
  cockpitActionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,215,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cockpitActionWhatsapp: {
    backgroundColor: 'rgba(37,211,102,0.12)',
  },
  cockpitChatUnreadDot: {
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 16,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -4,
    top: -4,
  },
  cockpitChatUnreadText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  cockpitActionLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  cockpitPerfSection: {
    backgroundColor: '#151515',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#242424',
    padding: 16,
    marginBottom: 18,
  },
  cockpitPerfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cockpitPerfItem: {
    width: '48%',
    backgroundColor: '#101010',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    padding: 14,
  },
  cockpitPerfValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  cockpitPerfLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  cockpitQuickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  cockpitQuickBtn: {
    flex: 1,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  cockpitQuickText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  cockpitPrimaryActions: {
    gap: 12,
  },
  cockpitPrimaryBtn: {
    height: 64,
    borderRadius: 20,
    backgroundColor: gold,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: gold,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cockpitPrimaryBtnGreen: {
    height: 58,
    borderRadius: 16,
    backgroundColor: brandGreen,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  scheduledModePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scheduledModePillText: {
    color: '#C8C8C8',
    fontSize: 11,
    fontWeight: '600',
  },
  scheduledHero: {
    marginBottom: 14,
    gap: 5,
  },
  scheduledHeroTitle: {
    color: '#F2F2F2',
    fontSize: 20,
    fontWeight: '700',
  },
  scheduledHeroSubtitle: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: '600',
  },
  scheduledHeroHint: {
    color: cockpitMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  scheduledAvailabilityHint: {
    color: brandGreen,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    marginTop: 2,
  },
  scheduledTripCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  scheduledDetailRow: {
    gap: 3,
  },
  scheduledDetailLabel: {
    color: cockpitMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  scheduledDetailValue: {
    color: '#F0F0F0',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  scheduledDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 2,
  },
  scheduledPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  scheduledPriceValue: {
    color: gold,
    fontSize: 17,
    fontWeight: '700',
  },
  cockpitContactCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cockpitContactCompactLabel: {
    color: cockpitMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  cockpitContactCompactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cockpitContactIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  cockpitPrimaryText: {
    color: '#111',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cockpitRejectBtn: {
    height: 64,
    borderRadius: 20,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  cockpitRejectText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activeRideCard: {
    backgroundColor: '#131313',
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.35)',
    padding: 22,
    marginBottom: 22,
  },
  activeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeLabel: { color: gold, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  activePrice: { color: '#FFF', fontSize: 34, fontWeight: '900', marginTop: 6 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74,222,128,0.15)',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 18,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
    marginRight: 8,
  },
  liveText: { color: '#4ADE80', fontWeight: '900', fontSize: 13 },
  activeRouteTitle: {
    color: '#AFAFAF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 18,
  },
  activeRouteValue: { color: '#FFF', fontSize: 17, fontWeight: '900', marginTop: 5 },
  activeNavBtn: {
    height: 60,
    borderRadius: 18,
    backgroundColor: gold,
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeNavText: { color: '#000', fontSize: 16, fontWeight: '900', marginLeft: 10 },
  sectionTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', marginBottom: 12 },
  emptyBox: {
    borderRadius: 24,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    padding: 28,
    alignItems: 'center',
  },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', marginTop: 12 },
  emptyText: { color: '#AAA', fontSize: 13, marginTop: 6, textAlign: 'center' },
  rideCard: {
    backgroundColor: card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    marginBottom: 16,
  },
  rideCardHighlight: {
    borderColor: gold,
    borderWidth: 2,
  },
  newMissionBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,215,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.45)',
  },
  newMissionBadgeText: {
    color: gold,
    fontSize: 10,
    fontWeight: '800',
  },
  cockpitNewMissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: gold,
  },
  cockpitNewMissionBannerText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
  },
  rideTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rideTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatEntryBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatUnreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF4B4B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: '#050505',
  },
  chatUnreadBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  ridePrice: { color: '#FFF', fontSize: 28, fontWeight: '900' },
  rideService: { color: gold, fontSize: 13, fontWeight: '800', marginTop: 4 },
  statusBadge: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,215,0,0.15)',
  },
  statusText: { color: gold, fontSize: 12, fontWeight: '900' },
  routeBox: { flexDirection: 'row', marginTop: 20 },
  routeLineBox: { width: 28, alignItems: 'center', paddingTop: 6 },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  verticalLine: {
    width: 2,
    height: 46,
    backgroundColor: '#333',
    marginVertical: 5,
  },
  routeItem: { paddingBottom: 18 },
  routeTitle: { color: '#AAA', fontSize: 12, fontWeight: '700' },
  routeValue: { color: '#FFF', fontSize: 16, fontWeight: '900', marginTop: 4 },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  miniInfo: {
    width: '48%',
    borderRadius: 18,
    backgroundColor: '#151515',
    padding: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  miniLabel: { color: '#AAA', fontSize: 11, marginTop: 6 },
  miniValue: { color: '#FFF', fontSize: 13, fontWeight: '900', marginTop: 3 },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  roundBtn: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#191919',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptText: { color: '#111', fontSize: 15, fontWeight: '900' },
  rateClientRow: {
    marginTop: 14,
  },
  rateClientBtn: {
    height: 48,
    borderRadius: 16,
    backgroundColor: gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rateClientBtnText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },
  rateClientDoneText: {
    color: '#C8C8C8',
    fontSize: 13,
    fontWeight: '700',
  },
  rejectBtn: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  revenueBtn: {
  height: 56,
  borderRadius: 18,
  backgroundColor: gold,
  marginBottom: 18,
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 10,
},

revenueBtnText: {
  color: '#111',
  fontSize: 15,
  fontWeight: '900',
},

revenueModalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.78)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 20,
},
revenueModalCard: {
  width: '100%',
  maxWidth: 420,
  maxHeight: '88%',
  backgroundColor: '#101010',
  borderRadius: 28,
  borderWidth: 1.5,
  borderColor: 'rgba(255,215,0,0.35)',
  padding: 22,
},
revenueModalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 18,
},
revenueModalTitleRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},
revenueModalTitle: {
  color: '#FFF',
  fontSize: 22,
  fontWeight: '900',
},
revenueModalCloseIcon: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#1A1A1A',
  borderWidth: 1,
  borderColor: '#2A2A2A',
  justifyContent: 'center',
  alignItems: 'center',
},
revenueModalStats: {
  flexDirection: 'row',
  gap: 10,
  marginBottom: 14,
},
revenueModalStatBox: {
  flex: 1,
  backgroundColor: card,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: border,
  padding: 14,
},
revenueModalStatLabel: {
  color: '#AAA',
  fontSize: 12,
  fontWeight: '700',
},
revenueModalStatValue: {
  color: gold,
  fontSize: 20,
  fontWeight: '900',
  marginTop: 6,
},
revenueModalGoalBox: {
  backgroundColor: card,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: border,
  padding: 14,
  marginBottom: 14,
},
revenueModalGoalTop: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
},
revenueModalGoalLabel: {
  color: '#FFF',
  fontSize: 14,
  fontWeight: '800',
},
revenueModalGoalValue: {
  color: gold,
  fontSize: 13,
  fontWeight: '900',
},
revenueModalGoalPercent: {
  color: '#AAA',
  fontSize: 12,
  fontWeight: '700',
  marginTop: 10,
},
revenueModalTotalBox: {
  backgroundColor: 'rgba(255,215,0,0.08)',
  borderRadius: 18,
  borderWidth: 1,
  borderColor: 'rgba(255,215,0,0.25)',
  padding: 16,
  marginBottom: 18,
},
revenueModalTotalLabel: {
  color: '#AAA',
  fontSize: 12,
  fontWeight: '700',
},
revenueModalTotalValue: {
  color: '#FFF',
  fontSize: 28,
  fontWeight: '900',
  marginTop: 6,
},
revenueModalHistoryTitle: {
  color: '#FFF',
  fontSize: 16,
  fontWeight: '900',
  marginBottom: 12,
},
revenueModalHistoryItem: {
  backgroundColor: card,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: border,
  padding: 14,
  marginBottom: 10,
},
revenueModalHistoryTop: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
},
revenueModalHistoryDest: {
  color: '#FFF',
  fontSize: 14,
  fontWeight: '800',
  flex: 1,
},
revenueModalHistoryPrice: {
  color: gold,
  fontSize: 14,
  fontWeight: '900',
},
revenueModalHistoryDate: {
  color: '#888',
  fontSize: 12,
  marginTop: 6,
},
revenueModalEmptyHistory: {
  alignItems: 'center',
  paddingVertical: 24,
  paddingHorizontal: 12,
  backgroundColor: card,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: border,
  marginBottom: 8,
},
revenueModalEmptyText: {
  color: '#AAA',
  fontSize: 13,
  marginTop: 10,
  textAlign: 'center',
},
revenueModalCloseBtn: {
  height: 54,
  borderRadius: 18,
  backgroundColor: gold,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 16,
},
revenueModalCloseText: {
  color: '#111',
  fontSize: 16,
  fontWeight: '900',
},

reviewsCard: {
  backgroundColor: card,
  borderRadius: 28,
  borderWidth: 1,
  borderColor: border,
  padding: 20,
  marginTop: 12,
},

reviewsTitle: {
  color: '#FFF',
  fontSize: 18,
  fontWeight: '900',
  marginBottom: 16,
},

reviewItem: {
  borderBottomWidth: 1,
  borderBottomColor: '#1B1B1B',
  paddingBottom: 14,
  marginBottom: 14,
},

reviewRating: {
  color: gold,
  fontSize: 15,
  fontWeight: '900',
},

reviewComment: {
  color: '#DDD',
  fontSize: 13,
  marginTop: 6,
  lineHeight: 20,
},
goalCard: {
  backgroundColor: card,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: border,
  padding: 18,
  marginBottom: 18,
},

goalTop: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

goalTitle: {
  color: '#FFF',
  fontSize: 16,
  fontWeight: '900',
},

goalMoney: {
  color: gold,
  fontSize: 15,
  fontWeight: '900',
},

progressBar: {
  height: 12,
  borderRadius: 8,
  backgroundColor: '#1B1B1B',
  marginTop: 18,
  overflow: 'hidden',
},

progressFill: {
  height: '100%',
  backgroundColor: '#22C55E',
  borderRadius: 8,
},

goalText: {
  color: '#AAA',
  fontSize: 13,
  marginTop: 10,
  fontWeight: '700',
},
badgesCard: {
  backgroundColor: card,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: border,
  padding: 18,
  marginBottom: 18,
},

badgesTitle: {
  color: '#FFF',
  fontSize: 17,
  fontWeight: '900',
  marginBottom: 14,
},

badgesRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
},

badgeItem: {
  backgroundColor: '#1A1A1A',
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderWidth: 1,
  borderColor: '#2A2A2A',
},

badgeText: {
  color: '#FFF',
  fontSize: 13,
  fontWeight: '800',
}, 
levelCard: {
  backgroundColor: card,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: border,
  padding: 22,
  marginBottom: 18,
  alignItems: 'center',
},

levelTitle: {
  color: '#AAA',
  fontSize: 14,
  fontWeight: '700',
},

levelValue: {
  color: gold,
  fontSize: 28,
  fontWeight: '900',
  marginTop: 10,
},

});