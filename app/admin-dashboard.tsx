import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, collectionGroup, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDistance } from 'geolib';
import { useEffect, useMemo, useRef, useState, type ComponentProps, type RefObject } from 'react';
import {
  Alert,


  Animated,
  ActivityIndicator,
  Dimensions,
  Easing,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  // Ajout de LinearGradient pour fond premium noir/vert PROTAXI
  // et d'Easing pour animations légères
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import AdminLiveMap from '@/components/AdminLiveMap';
import WebMapPlaceholder from '@/components/WebMapPlaceholder';
import { useAuthLogout } from '@/hooks/useAuthLogout';
import {
  configureNotificationHandler,
  mapRideNotificationContext,
  notifyAdmin,
  persistNotificationInbox,
  requestNotificationPermissions,
} from '@/services/notificationService';
import { db } from '@/firebase/firestore';
import { devError } from '@/utils/devLog';
import {
  assignRideToNearestEligibleDriver,
  DriverDispatchError,
  isDriverEligibleForDispatch,
  type DriversProfileDoc,
} from '@/services/driverDispatchService';
import {
  formatParticipantStatusLabel,
  hasTourGroupAssignment,
  isTourGroupAssignmentConfirmed,
  normalizeTourGroupParticipants,
  TOUR_GROUP_DRIVER_OPTIONS,
  TOUR_GROUP_GUIDE_OPTIONS,
  TOUR_GROUP_TRACKING_OPTIONS,
  TOUR_GROUP_VEHICLE_OPTIONS,
  getMockTrackingEta,
  getMockTrackingLocation,
  getTourGroupTrackingConfig,
  hasTourGroupTracking,
  normalizeTourGroupTrackingStatus,
  type TourGroupAssignment,
  type TourGroupParticipant,
  type TourGroupTrackingStatus,
} from '@/services/tourGroupMatching';
import {
  DEFAULT_ADMIN_SENDER_NAME,
  sendTourGroupMessage,
  TOUR_GROUP_ADMIN_ANNOUNCEMENTS,
} from '@/services/tourGroupChat';
import {
  computeTourGroupReviewStats,
  formatReviewAverage,
  getLatestTourGroupReviews,
  normalizeTourGroupReview,
  type TourGroupReview,
} from '@/services/tourGroupReviews';
import {
  getLatestTourGroupMemories,
  getMockGroupMemoryImage,
  isOfficialGroupMemory,
  normalizeTourGroupMemory,
  sendTourGroupMemory,
  type TourGroupMemory,
} from '@/services/tourGroupMemories';
import {
  checkInTourBooking,
  getCheckInStatusLabel,
  isTourBookingCheckedIn,
  normalizeTourCheckInStatus,
  type TourCheckInStatus,
} from '@/services/tourGroupTicket';
import {
  formatTourPaymentAmount,
  getPaymentMethodLabel,
  getPaymentStatusConfig,
  getPaymentStatusLabel,
  markTourBookingDepositPaid,
  markTourBookingFullyPaid,
  normalizeTourPaymentMethod,
  normalizeTourPaymentStatus,
  type TourPaymentStatus,
} from '@/services/tourGroupPayment';
import {
  computeTourismGlobalAnalytics,
  formatAnalyticsParticipants,
  formatAnalyticsRating,
  formatAnalyticsRevenue,
  getReviewGroupIdFromPath,
  type TourAnalyticsBooking,
  type TourAnalyticsGroup,
  type TourAnalyticsReview,
} from '@/services/tourAnalytics';

configureNotificationHandler();

const gold = '#FFD700';
const card = '#0E0E0E';
const border = '#262626';
const tourismGreen = '#8BC53F';
const tourismGlow = 'rgba(139,197,63,0.18)';
const tourismCard = '#0D0D0D';

type TourBookingStatus = 'pending' | 'confirmed' | 'cancelled';

type TourBooking = {
  id: string;
  clientUid?: string;
  experience?: string;
  circuitName?: string;
  formula?: string;
  bookingMode?: 'private' | 'group' | string;
  duration?: string;
  steps?: string;
  options?: string;
  travelers?: string;
  date?: string;
  meetingPoint?: string;
  notes?: string;
  price?: string;
  groupDeparture?: string;
  groupMeetingPoint?: string;
  groupSpotsLeft?: string;
  groupTravelers?: string;
  groupId?: string;
  ticketCode?: string;
  checkInStatus?: TourCheckInStatus | string;
  checkedInAt?: { toDate?: () => Date } | Date | string;
  paymentStatus?: TourPaymentStatus | string;
  depositAmount?: number;
  remainingAmount?: number;
  paymentMethod?: string;
  status?: TourBookingStatus | string;
  source?: string;
  createdAt?: { toDate?: () => Date } | Date | string;
};

type TourGroupStatus = 'open' | 'full';

type TourGroup = {
  id: string;
  experience?: string;
  date?: string;
  departure?: string;
  meetingPoint?: string;
  capacity?: number;
  booked?: number;
  remaining?: number;
  participants?: TourGroupParticipant[] | Array<{ bookingId?: string } | string>;
  status?: TourGroupStatus | string;
  assignedVehicle?: string;
  assignedDriver?: string;
  assignedGuide?: string;
  assignmentStatus?: string;
  trackingStatus?: string;
  etaMinutes?: number;
  liveLocation?: { latitude?: number; longitude?: number; label?: string };
  lastLocationUpdate?: { toDate?: () => Date } | Date | string;
  createdAt?: { toDate?: () => Date } | Date | string;
};

const LIVE_STATUSES = [
  'En attente',
  'Attribuée',
  'Acceptée',
  'En route',
  'Arrivé',
  'Terminée',
];

const FILTER_OPTIONS = [
  'Toutes',
  ...LIVE_STATUSES,
  'Refusée',
  'Expirée',
];

const STATUS_PRIORITY: Record<string, number> = {
  'En attente': 0,
  'Attribuée': 1,
  'Acceptée': 2,
  'En route': 3,
  'Arrivé': 4,
  'Terminée': 5,
  'Refusée': 6,
  'Expirée': 7,
};

const DRIVER_BADGE_STATUSES = ['Attribuée', 'En route'];

const PREMIUM_SERVICE_KEYWORDS = ['aéroport', 'aeroport', 'hôtel', 'hotel'];

const HEAT_ZONE_CONFIG = [
  { name: 'Guelma Centre', defaultLevel: 'forte', keywords: ['centre', 'guelma', 'ville'] },
  { name: 'Gare', defaultLevel: 'moyenne', keywords: ['gare'] },
  { name: 'Université', defaultLevel: 'moyenne', keywords: ['université', 'universite', 'univ'] },
  { name: 'Marché', defaultLevel: 'forte', keywords: ['marché', 'marche', 'souk'] },
  { name: 'Aéroport', defaultLevel: 'calme', keywords: ['aéroport', 'aeroport', 'airport'] },
] as const;

const HEAT_LEVEL_LABELS: Record<string, string> = {
  forte: 'Demande forte',
  moyenne: 'Demande moyenne',
  calme: 'Calme',
};

const HEAT_LEVEL_COLORS: Record<string, string> = {
  forte: '#EF4444',
  moyenne: '#F59E0B',
  calme: '#4ADE80',
};

const parsePrice = (price?: string) =>
  parseInt(String(price || '0').replace(/\D/g, ''), 10) || 0;

const getRideDate = (ride: any) =>
  ride.createdAt?.toDate?.() ??
  (ride.createdAt ? new Date(ride.createdAt) : null);

const getTourBookingDate = (booking: TourBooking) => {
  const createdAt = booking.createdAt;
  if (!createdAt) return null;
  if (createdAt instanceof Date) return createdAt;
  if (typeof createdAt === 'object' && 'toDate' in createdAt) {
    return createdAt.toDate?.() ?? null;
  }
  if (typeof createdAt === 'string' || typeof createdAt === 'number') {
    return new Date(createdAt);
  }
  return null;
};

const formatTourBookingCreatedAt = (booking: TourBooking) => {
  const date = getTourBookingDate(booking);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatTourPrice = (price?: string) => {
  if (!price) return '—';
  if (price.includes('DA') || price === 'Sur devis') return price;
  const amount = parseInt(String(price).replace(/\D/g, ''), 10);
  if (!amount) return price;
  return `${amount.toLocaleString('fr-FR')} DA`;
};

const getTourBookingModeLabel = (mode?: string) =>
  mode === 'group' ? 'Expérience groupe' : 'Expérience privée';

const getTourBookingStatusStyle = (status?: string) => {
  switch (status) {
    case 'confirmed':
      return { label: 'Confirmée', bg: 'rgba(139,197,63,0.18)', color: tourismGreen };
    case 'cancelled':
      return { label: 'Annulée', bg: 'rgba(239,68,68,0.18)', color: '#EF4444' };
    case 'pending':
    default:
      return { label: 'En attente', bg: 'rgba(245,158,11,0.18)', color: '#F59E0B' };
  }
};

const getTourGroupStatusStyle = (status?: string) => {
  if (status === 'full') {
    return { label: 'COMPLET', bg: 'rgba(245,158,11,0.18)', color: '#F59E0B' };
  }
  return { label: 'OUVERT', bg: 'rgba(139,197,63,0.18)', color: tourismGreen };
};

const formatTourGroupLabel = (groupId: string) =>
  groupId ? `#${groupId.slice(-6).toUpperCase()}` : '—';

const isToday = (date: Date | null) =>
  date?.toLocaleDateString('fr-FR') === new Date().toLocaleDateString('fr-FR');

const getWaitMinutes = (ride: any) => {
  const created = getRideDate(ride);
  if (!created) return 0;
  return (Date.now() - created.getTime()) / 1000 / 60;
};

const isPremiumService = (ride: any) => {
  const service = String(ride?.service || '').toLowerCase();
  return PREMIUM_SERVICE_KEYWORDS.some((keyword) => service.includes(keyword));
};

const getRidePriorityBadges = (ride: any) => {
  const badges: { label: string; bg: string; color: string }[] = [];
  const waitMinutes = getWaitMinutes(ride);

  if (ride.status === 'En attente' && waitMinutes > 5) {
    badges.push({
      label: 'URGENT',
      bg: 'rgba(239,68,68,0.18)',
      color: '#EF4444',
    });
  }

  if (isPremiumService(ride)) {
    badges.push({
      label: 'PREMIUM',
      bg: 'rgba(255,215,0,0.18)',
      color: gold,
    });
  }

  if (parsePrice(ride.price) > 8000) {
    badges.push({
      label: 'LONG TRAJET',
      bg: 'rgba(167,139,250,0.18)',
      color: '#A78BFA',
    });
  }

  return badges;
};

const getRideCoordinates = (ride: any) => ({
  latitude: ride.latitude || ride.clientLatitude || 36.462,
  longitude: ride.longitude || ride.clientLongitude || 7.426,
});

const getRecommendedDriver = (
  ride: any,
  driversList: any[],
  profileByDriverId?: Map<string, DriversProfileDoc>,
) => {
  const availableDrivers = driversList.filter((driver) => {
    const driverId = String(driver.driverId || driver.id || '');
    const profile = profileByDriverId?.get(driverId);
    return isDriverEligibleForDispatch(driver, profile);
  });

  if (availableDrivers.length === 0) return null;

  const rideCoords = getRideCoordinates(ride);

  return [...availableDrivers].sort((a, b) => {
    const distanceA = getDistance(rideCoords, {
      latitude: a.latitude || 36.462,
      longitude: a.longitude || 7.426,
    });
    const distanceB = getDistance(rideCoords, {
      latitude: b.latitude || 36.462,
      longitude: b.longitude || 7.426,
    });

    if (distanceA !== distanceB) return distanceA - distanceB;

    return (
      Number(b.averageRating || 5) - Number(a.averageRating || 5)
    );
  })[0];
};

const formatDistanceMeters = (meters: number) => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
};

type DriverValidationStatus =
  | 'En attente validation'
  | 'Validé'
  | 'Suspendu'
  | 'Hors ligne'
  | 'En ligne';

const resolveDriverLiveMatch = (driver: any, driversLiveList: any[]) =>
  driversLiveList.find(
    (live) =>
      live.driverId === driver.driverId ||
      live.id === driver.driverId ||
      live.driverId === driver.id ||
      live.uid === driver.uid ||
      live.id === driver.uid ||
      live.id === driver.id
  );

const getDriverValidationStatus = (
  driver: any,
  liveMatch?: any
): DriverValidationStatus => {
  if (Boolean(driver.isSuspended)) return 'Suspendu';
  if (!driver.isApproved) return 'En attente validation';

  const isOnline = Boolean(driver.isOnline || liveMatch?.isOnline);
  if (isOnline) return 'En ligne';
  if (liveMatch) return 'Hors ligne';
  return 'Validé';
};

const DRIVER_STATUS_STYLES: Record<
  DriverValidationStatus,
  { bg: string; color: string; dot: string }
> = {
  'En attente validation': {
    bg: 'rgba(255,215,0,0.12)',
    color: gold,
    dot: gold,
  },
  Validé: {
    bg: 'rgba(74,222,128,0.12)',
    color: '#4ADE80',
    dot: '#4ADE80',
  },
  Suspendu: {
    bg: 'rgba(239,68,68,0.15)',
    color: '#EF4444',
    dot: '#EF4444',
  },
  'Hors ligne': {
    bg: 'rgba(180,180,180,0.15)',
    color: '#D1D5DB',
    dot: '#9CA3AF',
  },
  'En ligne': {
    bg: 'rgba(74,222,128,0.18)',
    color: '#22C55E',
    dot: '#22C55E',
  },
};

const getDriverProfileId = (driver: any, liveMatch?: any) =>
  String(driver.driverId || liveMatch?.id || liveMatch?.driverId || driver.id || driver.uid || '');

const GPS_STALE_MS = 30000;

const getDriverUpdatedAtMs = (driver: any) => {
  const updatedAt =
    driver.updatedAt?.toDate?.() ??
    (driver.updatedAt ? new Date(driver.updatedAt) : null);

  return updatedAt?.getTime() ?? 0;
};

const getDriverGpsBadge = (driver: any): 'LIVE' | 'OFFLINE GPS' | null => {
  if (!driver.isOnline && !driver.isBusy) return null;
  if (!driver.latitude || !driver.longitude) return 'OFFLINE GPS';

  const updatedAtMs = getDriverUpdatedAtMs(driver);
  if (!updatedAtMs) return 'OFFLINE GPS';

  return Date.now() - updatedAtMs > GPS_STALE_MS ? 'OFFLINE GPS' : 'LIVE';
};

const formatDriverGpsUpdate = (driver: any) => {
  const updatedAtMs = getDriverUpdatedAtMs(driver);
  if (!updatedAtMs) return 'Jamais';

  const diffSeconds = Math.max(Math.floor((Date.now() - updatedAtMs) / 1000), 0);
  if (diffSeconds < 60) return `il y a ${diffSeconds}s`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;

  return new Date(updatedAtMs).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function AdminDashboardScreen() {
  const { confirmLogout } = useAuthLogout();
  const [filter, setFilter] = useState('Toutes');
  const [adminRequests, setAdminRequests] = useState<any[]>([]);
  const [driversLive, setDriversLive] = useState<any[]>([]);
  const [companyRevenue, setCompanyRevenue] = useState(0);
  const [driversRevenue, setDriversRevenue] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayRides, setTodayRides] = useState(0);
  const [weeklyRevenue, setWeeklyRevenue] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [topDriver, setTopDriver] = useState<any>(null);
  const [averageRide, setAverageRide] = useState(0);
  const [averageRating, setAverageRating] = useState(5);
const [ratingsCount, setRatingsCount] = useState(0);
const [drivers, setDrivers] = useState<any[]>([]);
  const [registeredDrivers, setRegisteredDrivers] = useState<any[]>([]);
  const [processingDriverId, setProcessingDriverId] = useState<string | null>(null);
  const [smartAssignRideId, setSmartAssignRideId] = useState<string | null>(null);
  const [tourBookings, setTourBookings] = useState<TourBooking[]>([]);
  const [tourGroups, setTourGroups] = useState<TourGroup[]>([]);
  const [processingTourBookingId, setProcessingTourBookingId] = useState<string | null>(null);
  const smartAssignSpin = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const driversSectionRef = useRef<View>(null);
  const reservationsSectionRef = useRef<View>(null);
  const tourismSectionRef = useRef<View>(null);
  const proV2Fade = useRef(new Animated.Value(0)).current;
  const proV2Slide = useRef(new Animated.Value(28)).current;
  const [totalClients, setTotalClients] = useState(0);
  const [totalPartners, setTotalPartners] = useState(0);
  const notifiedRef = useRef<Set<string>>(new Set());
  const lastRideStatusesRef = useRef<Record<string, string>>({});
  const isFirstRideLoadRef = useRef(true);
  const driverOnlineStateRef = useRef<Record<string, boolean>>({});
  const isFirstDriverLoadRef = useRef(true);

  useEffect(() => {
    void requestNotificationPermissions();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(proV2Fade, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(proV2Slide, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [proV2Fade, proV2Slide]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        let clients = 0;
        snapshot.docs.forEach((userDoc) => {
          const role = String(userDoc.data().role || 'client').toLowerCase();
          if (role === 'client') {
            clients += 1;
          }
        });
        setTotalClients(clients);
      },
      (error) => devError('Admin PRO V2 clients snapshot', error),
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'partners'),
      (snapshot) => {
        setTotalPartners(snapshot.size);
      },
      (error) => devError('Admin PRO V2 partners snapshot', error),
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'rides'),
      (snapshot) => {
      const ridesData = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          status: String(data.status || '').trim(),
        };
      });

ridesData.forEach(async (ride: any) => {
  if (
    ride.status === 'En attente' &&
    ride.createdAt?.toDate
  ) {

ridesData.forEach(async (ride: any) => {
  if (
    ride.status === 'Attribuée' &&
    ride.assignedAt?.toDate
  ) {
    const assigned =
      ride.assignedAt.toDate().getTime();

    const now = Date.now();

    const diffSeconds =
      (now - assigned) / 1000;

    if (diffSeconds >= 60) {
      await updateDoc(
        doc(db, 'rides', ride.id),
        {
          status: 'En attente',
          driverId: null,
          driverName: null,
          driverPhone: null,
          driverCar: null,
          driverPlate: null,
          driverPhoto: null,
        }
      );

      if (ride.driverId) {
        await updateDoc(
          doc(db, 'driversLive', ride.driverId),
          {
            isBusy: false,
            currentRideId: '',
            availability: 'available',
            updatedAt: new Date(),
          },
        );
      }
    }
  }
});


    const created =
      ride.createdAt.toDate().getTime();

    const now = Date.now();

    const diffMinutes =
      (now - created) / 1000 / 60;

    if (diffMinutes >= 5) {
      const rejectedCount = Array.isArray(ride.rejectedDriverIds)
        ? ride.rejectedDriverIds.length
        : 0;

      if (rejectedCount === 0) {
        await updateDoc(
          doc(db, 'rides', ride.id),
          {
            status: 'Expirée',
          }
        );
      }
    }
  }
});


      const finishedRides = ridesData.filter(
        (ride: any) => ride.status === 'Terminée'
      );

      let company = 0;
      let drivers = 0;
      let todayTotal = 0;
      let todayCount = 0;
      let totalFinishedAmount = 0;

      const weekData = [0, 0, 0, 0, 0, 0, 0];
      const driversStats: any = {};
      const today = new Date().toLocaleDateString('fr-FR');

      finishedRides.forEach((ride: any) => {
        const amount = parseInt(
          String(ride.price || '0').replace(/\D/g, ''),
          10
        );

        totalFinishedAmount += amount;
        company += amount * 0.15;
        drivers += amount * 0.85;

        if (ride.driverName) {
          if (!driversStats[ride.driverName]) {
            driversStats[ride.driverName] = {
              rides: 0,
              revenue: 0,
            };
          }

          driversStats[ride.driverName].rides += 1;
          driversStats[ride.driverName].revenue += amount;
        }

        const rideDate = ride.finishedAt?.toDate
          ? ride.finishedAt.toDate().toLocaleDateString('fr-FR')
          : null;

        if (rideDate === today) {
          todayTotal += amount;
          todayCount += 1;
        }

        const rideRealDate = ride.finishedAt?.toDate
          ? ride.finishedAt.toDate()
          : null;

        if (rideRealDate) {
          const dayIndex = rideRealDate.getDay();
          weekData[dayIndex] += amount;
        }
      });

      const bestDriver = Object.entries(driversStats).sort(
        (a: any, b: any) => b[1].revenue - a[1].revenue
      )[0];

      setTopDriver(
        bestDriver
          ? {
              name: bestDriver[0],
              rides: (bestDriver[1] as any).rides,
              revenue: (bestDriver[1] as any).revenue,
            }
          : null
      );

      setCompanyRevenue(company);
      setDriversRevenue(drivers);
      setTodayRevenue(todayTotal);
      setTodayRides(todayCount);
      setWeeklyRevenue(weekData);
      setAverageRide(
        finishedRides.length > 0
          ? Math.round(totalFinishedAmount / finishedRides.length)
          : 0
      );
      const ratedRides = ridesData.filter(
  (ride: any) => ride.rating
);

const totalRatings = ratedRides.reduce(
  (sum: number, ride: any) =>
    sum + Number(ride.rating || 0),
  0
);

setRatingsCount(ratedRides.length);

setAverageRating(
  ratedRides.length > 0
    ? totalRatings / ratedRides.length
    : 5
);
      setAdminRequests(ridesData);

      ridesData.forEach((ride: any) => {
        const previousStatus = lastRideStatusesRef.current[ride.id];

        if (isFirstRideLoadRef.current) {
          lastRideStatusesRef.current[ride.id] = ride.status;
          return;
        }

        if (previousStatus === ride.status) return;

        lastRideStatusesRef.current[ride.id] = ride.status;

        if (ride.status === 'En attente') {
          void notifyAdmin(
            notifiedRef.current,
            'new_reservation',
            mapRideNotificationContext(ride)
          );
        }
      });

      if (isFirstRideLoadRef.current) {
        isFirstRideLoadRef.current = false;
      }
    },
    (error) => {
      devError('[SNAPSHOT DENIED - admin-dashboard - Rides]', error);
    },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    driversLive.forEach((driver) => {
      const driverKey = String(driver.id || driver.driverId || '');
      if (!driverKey) return;

      const wasOnline = driverOnlineStateRef.current[driverKey];
      const isOnlineNow = Boolean(driver.isOnline);

      if (isFirstDriverLoadRef.current) {
        driverOnlineStateRef.current[driverKey] = isOnlineNow;
        return;
      }

      if (wasOnline === undefined) {
        driverOnlineStateRef.current[driverKey] = isOnlineNow;
        return;
      }

      if (wasOnline && !isOnlineNow) {
        void notifyAdmin(notifiedRef.current, 'driver_offline', {
          driverId: driverKey,
          driverName: driver.driverName || driver.name,
        });
      }

      driverOnlineStateRef.current[driverKey] = isOnlineNow;
    });

    if (isFirstDriverLoadRef.current) {
      isFirstDriverLoadRef.current = false;
    }
  }, [driversLive]);

  useEffect(() => {
    const pendingCount = adminRequests.filter(
      (ride) => ride.status === 'En attente'
    ).length;
    const availableCount = driversLive.filter((driver) => {
      const driverKey = String(driver.id || driver.driverId || '');
      return (
        driverKey &&
        registeredDrivers.some(
          (registered) => String(registered.id || registered.uid || '') === driverKey,
        ) &&
        driver.isOnline &&
        !driver.isBusy
      );
    }).length;

    if (pendingCount >= 3) {
      void notifyAdmin(notifiedRef.current, 'high_demand', { pendingCount });
    }

    if (pendingCount > 0 && availableCount === 0) {
      void notifyAdmin(notifiedRef.current, 'no_car_available', { pendingCount });
    }
  }, [adminRequests, driversLive, registeredDrivers]);

useEffect(() => {
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
      devError('[SNAPSHOT DENIED - admin-dashboard - DriversLivePrimary]', error);
    },
  );

  return () => unsubscribe();
}, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'drivers'),
      (snapshot) => {
        const driversData = snapshot.docs.map((item) => ({
          id: item.id,
          uid: item.id,
          ...item.data(),
          isApproved: Boolean(item.data().isApproved),
          isSuspended: Boolean(item.data().isSuspended),
          isOnline: Boolean(item.data().isOnline),
        }));

        setRegisteredDrivers(driversData);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - admin-dashboard - RegisteredDrivers]', error);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'driversLive'),
      (snapshot) => {
        const driversData = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setDriversLive(driversData);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - admin-dashboard - DriversLiveSecondary]', error);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const tourBookingsQuery = query(
      collection(db, 'tourBookings'),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      tourBookingsQuery,
      (snapshot) => {
        const bookings = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as TourBooking[];

        setTourBookings(bookings);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - admin-dashboard - TourBookings]', error);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const tourGroupsQuery = query(
      collection(db, 'tourGroups'),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      tourGroupsQuery,
      (snapshot) => {
        const groups = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as TourGroup[];

        setTourGroups(groups);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - admin-dashboard - TourGroups]', error);
      },
    );

    return () => unsubscribe();
  }, []);

  const activeTourGroups = useMemo(
    () =>
      tourGroups.filter(
        (group) => group.status === 'open' || group.status === 'full',
      ),
    [tourGroups],
  );

  const filteredRequests = useMemo(() => {
    const sorted = [...adminRequests].sort((a, b) => {
      const priorityA = STATUS_PRIORITY[a.status] ?? 99;
      const priorityB = STATUS_PRIORITY[b.status] ?? 99;

      if (priorityA !== priorityB) return priorityA - priorityB;

      const dateA = getRideDate(a)?.getTime() ?? 0;
      const dateB = getRideDate(b)?.getTime() ?? 0;

      return dateB - dateA;
    });

    if (filter === 'Toutes') return sorted;

    return sorted.filter(
      (item) =>
        String(item.status || '').toLowerCase().trim() ===
        filter.toLowerCase().trim()
    );
  }, [filter, adminRequests]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Toutes: adminRequests.length };

    FILTER_OPTIONS.forEach((status) => {
      if (status === 'Toutes') return;
      counts[status] = adminRequests.filter((ride) => ride.status === status).length;
    });

    return counts;
  }, [adminRequests]);

  const controlCenterStats = useMemo(() => {
    const todayRidesAll = adminRequests.filter((ride) =>
      isToday(getRideDate(ride))
    );

    return {
      totalToday: todayRidesAll.length,
      pending: adminRequests.filter((ride) => ride.status === 'En attente').length,
      enRoute: adminRequests.filter((ride) => ride.status === 'En route').length,
      finished: adminRequests.filter((ride) => ride.status === 'Terminée').length,
      estimatedRevenue: todayRidesAll
        .filter((ride) => !['Expirée', 'Refusée'].includes(ride.status))
        .reduce((sum, ride) => sum + parsePrice(ride.price), 0),
    };
  }, [adminRequests]);

  const todayTourBookings = useMemo(
    () =>
      tourBookings.filter((booking) => isToday(getTourBookingDate(booking))).length,
    [tourBookings],
  );

  const adminProStats = useMemo(
    () => ({
      totalClients,
      totalDrivers: registeredDrivers.length,
      totalPartners,
      todayReservations: controlCenterStats.totalToday + todayTourBookings,
      estimatedRevenue: controlCenterStats.estimatedRevenue,
    }),
    [
      totalClients,
      registeredDrivers.length,
      totalPartners,
      controlCenterStats.totalToday,
      controlCenterStats.estimatedRevenue,
      todayTourBookings,
    ],
  );

  const driverProfileById = useMemo(() => {
    const map = new Map<string, DriversProfileDoc>();

    registeredDrivers.forEach((driver) => {
      const driverId = String(driver.id || driver.uid || '');
      if (!driverId) return;

      map.set(driverId, {
        isApproved: Boolean(driver.isApproved),
        isSuspended: Boolean(driver.isSuspended),
      });
    });

    return map;
  }, [registeredDrivers]);

  const registeredDriversLive = useMemo(
    () =>
      driversLive.filter((driver) => {
        const driverKey = String(driver.driverId || driver.id || '');
        return driverKey && driverProfileById.has(driverKey);
      }),
    [driversLive, driverProfileById],
  );

  const scrollToSection = (sectionRef: RefObject<View | null>) => {
    if (!sectionRef.current || !scrollContentRef.current || !scrollViewRef.current) {
      return;
    }

    sectionRef.current.measureLayout(
      scrollContentRef.current,
      (_x, y) => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, y - 16),
          animated: true,
        });
      },
      () => {},
    );
  };

  const onlineDrivers = registeredDriversLive.filter((d) => d.isOnline).length;
  const busyDrivers = registeredDriversLive.filter((d) => d.isBusy).length;
  const availableDriversCount = registeredDriversLive.filter(
    (d) => d.isOnline && !d.isBusy
  ).length;

  const gpsLiveDrivers = useMemo(
    () =>
      registeredDriversLive.filter((driver) => {
        const badge = getDriverGpsBadge(driver);
        return badge === 'LIVE' && driver.latitude && driver.longitude;
      }),
    [registeredDriversLive]
  );

  const smartDispatchStats = useMemo(() => {
    const pendingRides = adminRequests.filter(
      (ride) => ride.status === 'En attente'
    );
    const avgWaitMinutes =
      pendingRides.length > 0
        ? pendingRides.reduce((sum, ride) => sum + getWaitMinutes(ride), 0) /
          pendingRides.length
        : 0;
    const urgentRides = pendingRides.filter(
      (ride) => getWaitMinutes(ride) > 5
    ).length;

    return {
      onlineDrivers,
      busyDrivers,
      avgWaitMinutes,
      urgentRides,
    };
  }, [adminRequests, onlineDrivers, busyDrivers]);

  const heatZones = useMemo(() => {
    const pendingRides = adminRequests.filter(
      (ride) => ride.status === 'En attente'
    );

    return HEAT_ZONE_CONFIG.map((zone) => {
      const matches = pendingRides.filter((ride) => {
        const text = `${ride.departure || ''} ${ride.destination || ''} ${ride.service || ''}`.toLowerCase();
        return zone.keywords.some((keyword) => text.includes(keyword));
      }).length;

      let level = zone.defaultLevel;
      if (matches >= 2) level = 'forte';
      else if (matches === 1 && level === 'calme') level = 'moyenne';

      return {
        name: zone.name,
        level,
        label: HEAT_LEVEL_LABELS[level],
        color: HEAT_LEVEL_COLORS[level],
      };
    });
  }, [adminRequests]);

  const businessAlerts = useMemo(() => {
    const alerts: { id: string; text: string; color: string; icon: string }[] =
      [];
    const pendingCount = adminRequests.filter(
      (ride) => ride.status === 'En attente'
    ).length;

    if (pendingCount >= 3) {
      alerts.push({
        id: 'demand',
        text: 'Forte demande détectée',
        color: '#EF4444',
        icon: 'flame',
      });
    }

    if (availableDriversCount === 1) {
      alerts.push({
        id: 'driver',
        text: '1 chauffeur disponible',
        color: '#F59E0B',
        icon: 'person',
      });
    }

    if (smartDispatchStats.avgWaitMinutes > 4) {
      alerts.push({
        id: 'wait',
        text: 'Temps attente élevé',
        color: gold,
        icon: 'time',
      });
    }

    return alerts;
  }, [adminRequests, availableDriversCount, smartDispatchStats.avgWaitMinutes]);

  const driverValidationStats = useMemo(() => {
    const validated = registeredDrivers.filter(
      (driver) => driver.isApproved && !driver.isSuspended
    ).length;
    const pending = registeredDrivers.filter(
      (driver) => !driver.isApproved && !driver.isSuspended
    ).length;
    const suspended = registeredDrivers.filter((driver) => driver.isSuspended).length;

    return { validated, pending, suspended };
  }, [registeredDrivers]);

  const sortedRegisteredDrivers = useMemo(
    () =>
      [...registeredDrivers].sort((a, b) => {
        const priority = (driver: any) => {
          if (!driver.isApproved && !driver.isSuspended) return 0;
          if (driver.isSuspended) return 2;
          return 1;
        };

        const priorityDiff = priority(a) - priority(b);
        if (priorityDiff !== 0) return priorityDiff;

        const nameA = String(a.fullName || a.name || '').toLowerCase();
        const nameB = String(b.fullName || b.name || '').toLowerCase();
        return nameA.localeCompare(nameB, 'fr');
      }),
    [registeredDrivers]
  );

  const priorityPendingRides = useMemo(
    () =>
      adminRequests
        .filter((ride) => ride.status === 'En attente')
        .sort((a, b) => {
          const badgesA = getRidePriorityBadges(a).length;
          const badgesB = getRidePriorityBadges(b).length;
          if (badgesB !== badgesA) return badgesB - badgesA;
          return getWaitMinutes(b) - getWaitMinutes(a);
        })
        .slice(0, 5),
    [adminRequests]
  );

  useEffect(() => {
    if (!smartAssignRideId) {
      smartAssignSpin.setValue(0);
      return;
    }

    const anim = Animated.loop(
      Animated.timing(smartAssignSpin, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      })
    );

    anim.start();
    return () => anim.stop();
  }, [smartAssignRideId, smartAssignSpin]);

  const getDriverOnlineLabel = (ride: any) => {
    if (!ride.driverId) return null;

    const driver = driversLive.find(
      (d) => d.driverId === ride.driverId || d.id === ride.driverId
    );

    if (!driver) return 'OFFLINE';

    return driver.isOnline ? 'ONLINE' : 'OFFLINE';
  };

  const openTracking = (ride: any) => {
    if (!ride?.id) return;

    router.push({
      pathname: '/course-tracking',
      params: {
        id: ride.id,
        rideId: ride.id,
        driverId: ride.driverId || '',
        status: ride.status || 'En attente',
        departure: ride.departure || '',
        destination: ride.destination || '',
        address: ride.address || ride.departure || '',
        airport: ride.destination || '',
        price: ride.price || '',
        time: ride.time || '',
      },
    });
  };

  const canShowTracking = (ride: any) =>
    Boolean(ride?.id) &&
    ride.status !== 'Terminée' &&
    ride.status !== 'Expirée';

  const persistAdminInbox = async (title: string, message: string) => {
    await persistNotificationInbox(title, message);
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

  const updateDriverValidation = async (
    driver: any,
    updates: Record<string, unknown>,
    successMessage: string
  ) => {
    const driverDocId = String(driver.id || driver.uid);
    if (!driverDocId) return;

    setProcessingDriverId(driverDocId);

    try {
      await updateDoc(doc(db, 'drivers', driverDocId), {
        ...updates,
        updatedAt: new Date(),
      });

      await persistAdminInbox('Chauffeurs PROTAXI', successMessage);
      Alert.alert('Succès', successMessage);
    } catch (error) {
      console.error('Driver validation update failed:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour ce chauffeur.');
    } finally {
      setProcessingDriverId(null);
    }
  };

  const approveDriver = (driver: any) => {
    updateDriverValidation(
      driver,
      {
        isApproved: true,
        isSuspended: false,
        isOnline: false,
      },
      `${driver.fullName || 'Chauffeur'} a été approuvé.`
    );
  };

  const suspendDriver = (driver: any) => {
    updateDriverValidation(
      driver,
      {
        isSuspended: true,
        isOnline: false,
      },
      `${driver.fullName || 'Chauffeur'} a été suspendu.`
    );
  };

  const refuseDriver = (driver: any) => {
    updateDriverValidation(
      driver,
      {
        isApproved: false,
        isSuspended: false,
        isOnline: false,
      },
      `La demande de ${driver.fullName || 'chauffeur'} a été refusée.`
    );
  };

  const openDriverProfile = (driver: any) => {
    const liveMatch = resolveDriverLiveMatch(driver, driversLive);
    const profileDriverId = getDriverProfileId(driver, liveMatch);

    if (!profileDriverId) {
      Alert.alert('Profil indisponible', 'Identifiant chauffeur introuvable.');
      return;
    }

    router.push({
      pathname: '/driver-profile',
      params: {
        driverId: profileDriverId,
        name: String(driver.fullName || driver.name || ''),
        phone: String(driver.phone || ''),
        car: String(driver.car || driver.vehicle || ''),
        plate: String(driver.plate || driver.driverPlate || ''),
        photo: String(driver.photo || driver.driverPhoto || ''),
      },
    });
  };

  const assignNearestDriver = async (ride: any) => {
    if (ride.driverId) {
      Alert.alert(
        'Déjà attribuée',
        'Cette course possède déjà un chauffeur.',
      );
      return;
    }

    if (ride.status === 'Annulée') {
      Alert.alert(
        'Course annulée',
        'Impossible d’attribuer une course annulée.',
      );
      return;
    }

    if (ride.status === 'Terminée') {
      Alert.alert(
        'Déjà terminée',
        'Cette course est déjà terminée.',
      );
      return;
    }

    try {
      const rideCoords = getRideCoordinates(ride);
      const result = await assignRideToNearestEligibleDriver({
        rideId: ride.id,
        rideLatitude: rideCoords.latitude,
        rideLongitude: rideCoords.longitude,
        rejectedDriverIds: Array.isArray(ride.rejectedDriverIds)
          ? ride.rejectedDriverIds.map(String)
          : [],
        candidates: registeredDriversLive.map((driver) => ({
          ...driver,
          id: String(driver.id),
        })),
        profileByDriverId: driverProfileById,
        getDistance,
      });

      await persistAdminInbox(
        'Chauffeur attribué',
        `${result.driverName} a reçu une course.`,
      );

      Alert.alert('Chauffeur attribué automatiquement 🚖');
    } catch (error) {
      if (error instanceof DriverDispatchError) {
        Alert.alert('Attribution impossible', error.message);
        return;
      }

      devError('[DISPATCH] assignNearestDriver failed', error);
      Alert.alert('Erreur', 'Impossible d\'attribuer la course.');
    }
  };

  const handleSmartAssign = async (ride: any) => {
    if (smartAssignRideId) return;

    setSmartAssignRideId(ride.id);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await assignNearestDriver(ride);
    setSmartAssignRideId(null);
  };

  const finishRequest = async (ride: any) => {
    await updateDoc(doc(db, 'rides', ride.id), {
      status: 'Terminée',
      finishedAt: new Date(),
    });

    if (ride.driverId) {
      const driverFound = driversLive.find(
        (driver) => driver.driverId === ride.driverId
      );

      if (driverFound) {
       await updateDoc(doc(db, 'driversLive', driverFound.id), {
  isBusy: false,
  currentRideId: '',
  availability: 'available',
  updatedAt: new Date(),
});
      }
    }

    await persistAdminInbox(
      'Course terminée',
      'Une course a été marquée comme terminée.'
    );
  };

  const updateTourBookingStatus = async (
    id: string,
    status: 'confirmed' | 'cancelled',
  ) => {
    if (processingTourBookingId) return;

    setProcessingTourBookingId(id);

    try {
      await updateDoc(doc(db, 'tourBookings', id), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Tour booking status update error:', error);
      Alert.alert(
        'Mise à jour impossible',
        'La réservation tourisme n\'a pas pu être mise à jour. Réessayez.',
      );
    } finally {
      setProcessingTourBookingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={styles.scrollContent}
      >
        <View ref={scrollContentRef} collapsable={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <View>
            <Text style={styles.title}>ADMIN PROTAXI</Text>
            <Text style={styles.subtitle}>PRO V2 • Dispatch • Business • Live GPS</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
              <Ionicons name="log-out-outline" size={20} color={gold} />
            </TouchableOpacity>

            <View style={styles.adminIcon}>
              <MaterialCommunityIcons name="shield-crown" size={28} color={gold} />
            </View>
          </View>
        </View>

        <Animated.View
          style={{
            opacity: proV2Fade,
            transform: [{ translateY: proV2Slide }],
          }}
        >
          <LinearGradient
            colors={['#101810', '#050505', '#050505']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.adminProHero}
          >
            <View style={styles.adminProHeroTop}>
              <View>
                <Text style={styles.adminProHeroEyebrow}>Centre de contrôle</Text>
                <Text style={styles.adminProHeroTitle}>Dashboard PRO V2</Text>
              </View>
              <View style={styles.adminProHeroBadge}>
                <View style={styles.adminProHeroBadgeDot} />
                <Text style={styles.adminProHeroBadgeText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.adminProHeroSubtitle}>
              Vue exécutive • Stats globales • Accès rapide
            </Text>
          </LinearGradient>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={styles.adminProStatsScroll}
          >
            <AdminProStatCard
              index={0}
              label="Total clients"
              value={adminProStats.totalClients}
              iconFamily="ionicons"
              icon="people-outline"
              accent={tourismGreen}
            />
            <AdminProStatCard
              index={1}
              label="Total chauffeurs"
              value={adminProStats.totalDrivers}
              icon="steering"
              accent={gold}
            />
            <AdminProStatCard
              index={2}
              label="Total partenaires"
              value={adminProStats.totalPartners}
              icon="handshake-outline"
              accent="#60A5FA"
            />
            <AdminProStatCard
              index={3}
              label="Réservations du jour"
              value={adminProStats.todayReservations}
              iconFamily="ionicons"
              icon="calendar-outline"
              accent="#A78BFA"
            />
            <AdminProStatCard
              index={4}
              label="Revenus estimés"
              value={`${adminProStats.estimatedRevenue.toLocaleString('fr-FR')} DA`}
              iconFamily="ionicons"
              icon="cash-outline"
              accent={tourismGreen}
            />
          </ScrollView>

          <Text style={styles.adminProSectionTitle}>Accès rapide</Text>
          <View style={styles.adminProQuickGrid}>
            <AdminProQuickActionCard
              index={0}
              label="Gestion partenaires"
              subtitle="Comptes hôtel & agence"
              icon="handshake-outline"
              accent="#60A5FA"
              onPress={() => router.push('/admin-partners')}
            />
            <AdminProQuickActionCard
              index={1}
              label="Gestion chauffeurs"
              subtitle="Validation & statuts"
              icon="account-check-outline"
              accent={gold}
              onPress={() => scrollToSection(driversSectionRef)}
            />
            <AdminProQuickActionCard
              index={2}
              label="Gestion réservations"
              subtitle="Courses en direct"
              icon="clipboard-list-outline"
              accent="#A78BFA"
              onPress={() => scrollToSection(reservationsSectionRef)}
            />
            <AdminProQuickActionCard
              index={3}
              label="Gestion tourisme"
              subtitle="Excursions & groupes"
              icon="compass-outline"
              accent={tourismGreen}
              onPress={() => scrollToSection(tourismSectionRef)}
            />
          </View>
        </Animated.View>

        <View style={styles.statsRow}>
          <StatCard
            title="Courses aujourd'hui"
            value={controlCenterStats.totalToday}
            icon="calendar"
          />
          <StatCard
            title="En attente"
            value={controlCenterStats.pending}
            icon="time-outline"
          />
          <StatCard
            title="En route"
            value={controlCenterStats.enRoute}
            icon="navigation-outline"
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard
            title="Terminées"
            value={controlCenterStats.finished}
            icon="checkmark-done-outline"
          />
          <StatCard
            title="Revenus estimés"
            value={`${controlCenterStats.estimatedRevenue.toLocaleString('fr-FR')} DA`}
            icon="cash-outline"
          />
          <StatCard title="Demandes" value={adminRequests.length} icon="file-document-outline" />
        </View>

        <View style={styles.analyticsRow}>
          <BigCard title="Revenus société" value={`${Math.round(companyRevenue).toLocaleString('fr-FR')} DA`} />
          <BigCard title="Revenus chauffeurs" value={`${Math.round(driversRevenue).toLocaleString('fr-FR')} DA`} />
        </View>

        <View style={styles.businessStatsContainer}>
          <BusinessCard icon="cash" color={gold} value={`${todayRevenue.toLocaleString('fr-FR')} DA`} label="Revenus Aujourd’hui" />
          <BusinessCard icon="car-sport" color="#4ADE80" value={todayRides} label="Courses Terminées" />
          <BusinessCard icon="business" color="#00BFFF" value={`${Math.round(companyRevenue).toLocaleString('fr-FR')} DA`} label="Commission Société" />
        </View>

        <View style={styles.businessStatsContainer}>
          <BusinessCard icon="radio-button-on" color="#4ADE80" value={onlineDrivers} label="Chauffeurs en ligne" />
          <BusinessCard icon="alert-circle" color="#F59E0B" value={busyDrivers} label="Chauffeurs occupés" />
          <BusinessCard icon="calculator" color="#A78BFA" value={`${averageRide.toLocaleString('fr-FR')} DA`} label="Moyenne course" />
        </View>

        <View style={styles.businessStatsContainer}>
          <BusinessCard
            icon="shield-checkmark"
            color={gold}
            value={driverValidationStats.validated}
            label="Chauffeurs validés"
          />
          <BusinessCard
            icon="hourglass"
            color="#F59E0B"
            value={driverValidationStats.pending}
            label="Chauffeurs en attente"
          />
          <BusinessCard
            icon="ban"
            color="#EF4444"
            value={driverValidationStats.suspended}
            label="Chauffeurs suspendus"
          />
        </View>

<BusinessCard
  icon="star"
  color="#FFD700"
  value={averageRating.toFixed(1)}
  label={`${ratingsCount} avis clients`}
/>
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Revenus de la semaine</Text>

          <LineChart
            data={{
              labels: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
              datasets: [{ data: weeklyRevenue }],
            }}
            width={Dimensions.get('window').width - 36}
            height={220}
            yAxisSuffix=" DA"
            chartConfig={{
              backgroundGradientFrom: '#111',
              backgroundGradientTo: '#111',
              decimalPlaces: 0,
              color: () => gold,
              labelColor: () => '#AAA',
              propsForDots: {
                r: '5',
                strokeWidth: '2',
                stroke: gold,
              },
            }}
            bezier
            style={styles.chart}
          />
        </View>

        {topDriver && (
          <View style={styles.topDriverCard}>
            <View style={styles.topDriverHeader}>
              <Ionicons name="trophy" size={30} color={gold} />
              <Text style={styles.topDriverTitle}>Chauffeur #1</Text>
            </View>

            <Text style={styles.topDriverName}>{topDriver.name}</Text>
            <Text style={styles.topDriverStats}>🚖 {topDriver.rides} courses</Text>
            <Text style={styles.topDriverRevenue}>
              💰 {topDriver.revenue.toLocaleString('fr-FR')} DA
            </Text>
          </View>
        )}

        <View style={styles.mapContainer}>
          <View style={styles.gpsLiveHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.gpsLiveTitle}>GPS Live Production</Text>
              <Text style={styles.gpsLiveSubtitle}>
                {gpsLiveDrivers.length} chauffeur
                {gpsLiveDrivers.length > 1 ? 's' : ''} en mouvement live
              </Text>
            </View>
            <View style={styles.gpsLiveLegend}>
              <View style={styles.gpsLegendItem}>
                <View style={[styles.gpsLegendDot, styles.gpsLegendDotLive]} />
                <Text style={styles.gpsLegendText}>LIVE</Text>
              </View>
              <View style={styles.gpsLegendItem}>
                <View style={[styles.gpsLegendDot, styles.gpsLegendDotOffline]} />
                <Text style={styles.gpsLegendText}>OFFLINE GPS</Text>
              </View>
            </View>
          </View>

          {Platform.OS === 'web' ? (
            <WebMapPlaceholder style={styles.map} />
          ) : (
            <AdminLiveMap driversLive={registeredDriversLive} mapStyle={styles.map} />
          )}

          <View style={styles.gpsLiveFeed}>
            {registeredDriversLive.length === 0 ? (
              <Text style={styles.gpsLiveEmpty}>Aucun chauffeur live connecté.</Text>
            ) : (
              registeredDriversLive.map((driver) => {
                const gpsBadge = getDriverGpsBadge(driver);
                const driverName =
                  driver.driverName || driver.name || driver.driverId || 'Chauffeur';

                return (
                  <View key={`gps-${driver.id}`} style={styles.gpsLiveRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gpsLiveDriverName}>{driverName}</Text>
                      <Text style={styles.gpsLiveUpdate}>
                        Dernière mise à jour : {formatDriverGpsUpdate(driver)}
                      </Text>
                      {driver.latitude && driver.longitude ? (
                        <Text style={styles.gpsLiveCoords}>
                          {Number(driver.latitude).toFixed(5)},{' '}
                          {Number(driver.longitude).toFixed(5)}
                          {typeof driver.speed === 'number'
                            ? ` • ${Math.max(Math.round(driver.speed * 3.6), 0)} km/h`
                            : ''}
                        </Text>
                      ) : (
                        <Text style={styles.gpsLiveCoords}>Position indisponible</Text>
                      )}
                    </View>

                    {gpsBadge ? (
                      <View
                        style={[
                          styles.gpsLiveBadge,
                          gpsBadge === 'LIVE'
                            ? styles.gpsLiveBadgeLive
                            : styles.gpsLiveBadgeOffline,
                        ]}
                      >
                        <View
                          style={[
                            styles.gpsLiveBadgeDot,
                            {
                              backgroundColor:
                                gpsBadge === 'LIVE' ? '#22C55E' : '#EF4444',
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.gpsLiveBadgeText,
                            {
                              color: gpsBadge === 'LIVE' ? '#22C55E' : '#EF4444',
                            },
                          ]}
                        >
                          {gpsBadge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </View>

        <View style={styles.smartDispatchSection}>
          <View style={styles.smartDispatchHeader}>
            <MaterialCommunityIcons name="brain" size={26} color={gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.smartDispatchTitle}>Smart Dispatch PROTAXI</Text>
              <Text style={styles.smartDispatchSubtitle}>
                Centre de contrôle live • Attribution intelligente
              </Text>
            </View>
          </View>

          <View style={styles.smartDispatchStatsRow}>
            <SmartDispatchStat
              label="Chauffeurs online"
              value={smartDispatchStats.onlineDrivers}
              color="#4ADE80"
            />
            <SmartDispatchStat
              label="Chauffeurs occupés"
              value={smartDispatchStats.busyDrivers}
              color="#F59E0B"
            />
            <SmartDispatchStat
              label="Attente moyenne"
              value={`${Math.round(smartDispatchStats.avgWaitMinutes)} min`}
              color={gold}
            />
            <SmartDispatchStat
              label="Courses urgentes"
              value={smartDispatchStats.urgentRides}
              color="#EF4444"
            />
          </View>

          {businessAlerts.length > 0 && (
            <View style={styles.businessAlertsWrap}>
              {businessAlerts.map((alert) => (
                <BusinessAlertChip key={alert.id} alert={alert} />
              ))}
            </View>
          )}

          <Text style={styles.smartDispatchBlockTitle}>Heat zones Guelma</Text>
          <View style={styles.heatZonesGrid}>
            {heatZones.map((zone) => (
              <View key={zone.name} style={styles.heatZoneCard}>
                <View style={[styles.heatZoneDot, { backgroundColor: zone.color }]} />
                <Text style={styles.heatZoneName}>{zone.name}</Text>
                <Text style={[styles.heatZoneLevel, { color: zone.color }]}>
                  {zone.label}
                </Text>
              </View>
            ))}
          </View>

          {priorityPendingRides.length > 0 && (
            <>
              <Text style={styles.smartDispatchBlockTitle}>
                Priorité courses en attente
              </Text>

              {priorityPendingRides.map((ride) => {
                const priorityBadges = getRidePriorityBadges(ride);
                const recommended = getRecommendedDriver(ride, registeredDriversLive, driverProfileById);
                const recommendedDistance = recommended
                  ? getDistance(getRideCoordinates(ride), {
                      latitude: recommended.latitude || 36.462,
                      longitude: recommended.longitude || 7.426,
                    })
                  : null;

                return (
                  <View key={`priority-${ride.id}`} style={styles.priorityRideCard}>
                    <View style={styles.priorityRideTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.priorityRideClient}>
                          {ride.client || 'Client'}
                        </Text>
                        <Text style={styles.priorityRideRoute} numberOfLines={1}>
                          {ride.departure || '—'} → {ride.destination || '—'}
                        </Text>
                      </View>
                      <Text style={styles.priorityRidePrice}>
                        {ride.price || '—'}
                      </Text>
                    </View>

                    {priorityBadges.length > 0 && (
                      <View style={styles.priorityBadgesRow}>
                        {priorityBadges.map((badge) => (
                          <View
                            key={`${ride.id}-${badge.label}`}
                            style={[
                              styles.priorityBadge,
                              { backgroundColor: badge.bg },
                            ]}
                          >
                            <Text
                              style={[styles.priorityBadgeText, { color: badge.color }]}
                            >
                              {badge.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {recommended ? (
                      <View style={styles.recommendedDriverBox}>
                        <Text style={styles.recommendedDriverTitle}>
                          Chauffeur recommandé
                        </Text>
                        <Text style={styles.recommendedDriverName}>
                          {recommended.driverName ||
                            recommended.name ||
                            'Chauffeur PROTAXI'}
                        </Text>
                        <Text style={styles.recommendedDriverMeta}>
                          {formatDistanceMeters(recommendedDistance || 0)} • ⭐{' '}
                          {Number(recommended.averageRating || 5).toFixed(1)} •
                          Disponible
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.recommendedDriverEmpty}>
                        <Text style={styles.recommendedDriverEmptyText}>
                          Aucun chauffeur disponible pour recommandation
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.smartAssignBtn,
                        smartAssignRideId === ride.id && styles.smartAssignBtnLoading,
                      ]}
                      onPress={() => handleSmartAssign(ride)}
                      disabled={Boolean(smartAssignRideId)}
                    >
                      {smartAssignRideId === ride.id ? (
                        <>
                          <Animated.View
                            style={{
                              transform: [
                                {
                                  rotate: smartAssignSpin.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0deg', '360deg'],
                                  }),
                                },
                              ],
                            }}
                          >
                            <MaterialCommunityIcons
                              name="sync"
                              size={22}
                              color="#111"
                            />
                          </Animated.View>
                          <Text style={styles.smartAssignText}>
                            Analyse en cours...
                          </Text>
                        </>
                      ) : (
                        <>
                          <MaterialCommunityIcons
                            name="robot-excited-outline"
                            size={22}
                            color="#111"
                          />
                          <Text style={styles.smartAssignText}>
                            Assignation intelligente
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}
        </View>

        <View ref={driversSectionRef} collapsable={false} style={styles.driverRequestsSection}>
          <View style={styles.driverRequestsHeader}>
            <MaterialCommunityIcons name="account-check-outline" size={26} color={gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Demandes chauffeurs</Text>
              <Text style={styles.driverRequestsSubtitle}>
                Validation • Approbation • Suspension
              </Text>
            </View>
          </View>

          {sortedRegisteredDrivers.length === 0 ? (
            <View style={styles.driverRequestsEmpty}>
              <MaterialCommunityIcons name="account-clock-outline" size={34} color={gold} />
              <Text style={styles.driverRequestsEmptyText}>
                Aucune demande chauffeur enregistrée pour le moment.
              </Text>
            </View>
          ) : (
            sortedRegisteredDrivers.map((driver) => {
              const liveMatch = resolveDriverLiveMatch(driver, driversLive);
              const statusLabel = getDriverValidationStatus(driver, liveMatch);
              const statusStyle = DRIVER_STATUS_STYLES[statusLabel];
              const driverName = driver.fullName || driver.name || 'Chauffeur PROTAXI';
              const driverPhone = driver.phone || '—';
              const driverCar = driver.car || driver.vehicle || 'Véhicule non renseigné';
              const driverPlate = driver.plate || driver.driverPlate || '—';
              const driverPhoto = driver.photo || driver.driverPhoto || '';
              const isProcessing = processingDriverId === String(driver.id || driver.uid);

              return (
                <DriverRequestCard
                  key={driver.id}
                  driver={driver}
                  driverName={driverName}
                  driverPhone={driverPhone}
                  driverCar={driverCar}
                  driverPlate={driverPlate}
                  driverPhoto={driverPhoto}
                  statusLabel={statusLabel}
                  statusStyle={statusStyle}
                  isProcessing={isProcessing}
                  onApprove={() => approveDriver(driver)}
                  onSuspend={() => suspendDriver(driver)}
                  onRefuse={() => refuseDriver(driver)}
                  onViewProfile={() => openDriverProfile(driver)}
                />
              );
            })
          )}
        </View>

<View style={styles.driversSection}>
  <Text style={styles.sectionTitle}>
    Chauffeurs en direct
  </Text>

  {registeredDriversLive.map((driver) => {
    const gpsBadge = getDriverGpsBadge(driver);

    return (
    <View
      key={driver.id}
      style={styles.driverLiveCard}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.driverLiveName}>
          {driver.driverName ||
            driver.name ||
            'Taxi Mehdi 24'}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            marginTop: 5,
          }}
        >
          <View
            style={[
              styles.driverStatus,
              {
                backgroundColor: driver.isBusy
                  ? '#FF9500'
                  : driver.isOnline
                  ? '#22C55E'
                  : '#FF4B4B',
              },
            ]}
          />

          <Text style={styles.driverStatusText}>
            {driver.isBusy
              ? 'Occupé'
              : driver.isOnline
              ? 'Disponible'
              : 'Hors ligne'}
          </Text>
        </View>

        <Text style={styles.driverGpsUpdateText}>
          GPS : {formatDriverGpsUpdate(driver)}
        </Text>

        {gpsBadge ? (
          <View
            style={[
              styles.driverGpsBadge,
              gpsBadge === 'LIVE'
                ? styles.driverGpsBadgeLive
                : styles.driverGpsBadgeOffline,
            ]}
          >
            <Text
              style={[
                styles.driverGpsBadgeText,
                {
                  color: gpsBadge === 'LIVE' ? '#22C55E' : '#EF4444',
                },
              ]}
            >
              {gpsBadge}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.driverCar}>
          {driver.car || 'Renault Clio'}
        </Text>

        <Text style={styles.driverPlate}>
          {driver.plate || '24-000-16'}
        </Text>
      </View>
    </View>
  );
  })}
</View>
        <View ref={tourismSectionRef} collapsable={false} style={styles.tourismSection}>
          <View style={styles.tourismSectionHeader}>
            <View style={styles.tourismSectionIconWrap}>
              <MaterialCommunityIcons name="compass-outline" size={22} color={tourismGreen} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tourismSectionTitle}>Tourisme PROTAXI</Text>
              <Text style={styles.tourismSectionSubtitle}>
                Réservations tourisme • {tourBookings.length} demande
                {tourBookings.length > 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.tourismCountBadge}>
              <Text style={styles.tourismCountBadgeText}>{tourBookings.length}</Text>
            </View>
          </View>

          {tourBookings.length === 0 ? (
            <View style={styles.tourismEmptyCard}>
              <MaterialCommunityIcons
                name="map-marker-radius-outline"
                size={28}
                color={tourismGreen}
              />
              <Text style={styles.tourismEmptyText}>
                Aucune réservation tourisme pour le moment.
              </Text>
            </View>
          ) : (
            tourBookings.map((booking) => (
              <TourBookingCard
                key={booking.id}
                booking={booking}
                isProcessing={processingTourBookingId === booking.id}
                onConfirm={() => updateTourBookingStatus(booking.id, 'confirmed')}
                onCancel={() => updateTourBookingStatus(booking.id, 'cancelled')}
              />
            ))
          )}
        </View>

        <TourismAnalyticsSection tourGroups={tourGroups} tourBookings={tourBookings} />

        <View style={styles.tourismSection}>
          <View style={styles.tourismSectionHeader}>
            <View style={styles.tourismSectionIconWrap}>
              <MaterialCommunityIcons name="account-group-outline" size={22} color={tourismGreen} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tourismSectionTitle}>Groupes actifs</Text>
              <Text style={styles.tourismSectionSubtitle}>
                Group matching live • {activeTourGroups.length} groupe
                {activeTourGroups.length > 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.tourismCountBadge}>
              <Text style={styles.tourismCountBadgeText}>{activeTourGroups.length}</Text>
            </View>
          </View>

          {activeTourGroups.length === 0 ? (
            <View style={styles.tourismEmptyCard}>
              <MaterialCommunityIcons
                name="account-multiple-outline"
                size={28}
                color={tourismGreen}
              />
              <Text style={styles.tourismEmptyText}>
                Aucun groupe actif pour le moment.
              </Text>
            </View>
          ) : (
            activeTourGroups.map((group) => (
              <ActiveTourGroupCard
                key={group.id}
                group={group}
                relatedBookings={tourBookings}
              />
            ))
          )}
        </View>

        <View ref={reservationsSectionRef} collapsable={false}>
        <Text style={styles.liveSectionTitle}>Courses en direct</Text>

        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.filterBtn, filter === item && styles.filterBtnActive]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
                {`${item} (${statusCounts[item] ?? 0})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredRequests.map((item) => {
          const driverOnlineLabel =
            DRIVER_BADGE_STATUSES.includes(item.status) && item.driverId
              ? getDriverOnlineLabel(item)
              : null;
          const priorityBadges = getRidePriorityBadges(item);
          const recommendedDriver = ['En attente', 'Refusée'].includes(item.status)
            ? getRecommendedDriver(item, registeredDriversLive, driverProfileById)
            : null;
          const recommendedDistance = recommendedDriver
            ? getDistance(getRideCoordinates(item), {
                latitude: recommendedDriver.latitude || 36.462,
                longitude: recommendedDriver.longitude || 7.426,
              })
            : null;

          return (
          <View key={item.id} style={styles.requestCard}>
            <View style={styles.requestTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestId}>{item.id}</Text>
                <Text style={styles.clientName}>{item.client || 'Client'}</Text>
              </View>

              <View style={styles.requestTopBadges}>
                {driverOnlineLabel && (
                  <View
                    style={[
                      styles.driverOnlineBadge,
                      driverOnlineLabel === 'ONLINE'
                        ? styles.driverOnlineBadgeOn
                        : styles.driverOnlineBadgeOff,
                    ]}
                  >
                    <Text style={styles.driverOnlineBadgeText}>
                      {driverOnlineLabel}
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    styles.statusBadge,
                    item.status === 'En attente' && styles.pendingBadge,
                    item.status === 'Attribuée' && styles.assignedBadge,
                    item.status === 'Acceptée' && styles.acceptedBadge,
                    item.status === 'En route' && styles.enRouteBadge,
                    item.status === 'Arrivé' && styles.arrivedBadge,
                    item.status === 'Terminée' && styles.finishedBadge,
                    item.status === 'Refusée' && styles.rejectedBadge,
                    item.status === 'Expirée' && styles.expiredBadge,
                  ]}
                >
                  <Text style={styles.statusText}>{item.status || '—'}</Text>
                </View>
              </View>
            </View>

            {priorityBadges.length > 0 && (
              <View style={styles.priorityBadgesRow}>
                {priorityBadges.map((badge) => (
                  <View
                    key={`${item.id}-${badge.label}`}
                    style={[styles.priorityBadge, { backgroundColor: badge.bg }]}
                  >
                    <Text style={[styles.priorityBadgeText, { color: badge.color }]}>
                      {badge.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <InfoRow icon="call-outline" label="Téléphone" value={item.phone} />
            <InfoRow icon="car-sport-outline" label="Service" value={item.service} />
            <InfoRow icon="location-outline" label="Départ" value={item.departure} />
            <InfoRow icon="navigate-outline" label="Destination" value={item.destination} />
            <InfoRow icon="cash-outline" label="Prix" value={item.price} />
            <InfoRow icon="time-outline" label="Horaire" value={item.time} />

            {item.driverName && (
              <>
                <InfoRow icon="person-outline" label="Chauffeur" value={item.driverName} />
                <InfoRow icon="car-outline" label="Véhicule" value={item.driverCar || 'À confirmer'} />
              </>
            )}

            {recommendedDriver && (
              <View style={styles.recommendedDriverBox}>
                <Text style={styles.recommendedDriverTitle}>Chauffeur recommandé</Text>
                <Text style={styles.recommendedDriverName}>
                  {recommendedDriver.driverName ||
                    recommendedDriver.name ||
                    'Chauffeur PROTAXI'}
                </Text>
                <Text style={styles.recommendedDriverMeta}>
                  {formatDistanceMeters(recommendedDistance || 0)} • ⭐{' '}
                  {Number(recommendedDriver.averageRating || 5).toFixed(1)} • Online
                </Text>
              </View>
            )}

            <View style={styles.actionsRow}>
              {item.status === 'Attribuée' && (
                <TouchableOpacity style={styles.finishBtn} onPress={() => finishRequest(item)}>
                  <Ionicons name="checkmark-done-outline" size={21} color="#111" />
                  <Text style={styles.finishText}>Terminer</Text>
                </TouchableOpacity>
              )}

              {canShowTracking(item) && (
                <TouchableOpacity
                  style={styles.trackingBtn}
                  onPress={() => openTracking(item)}
                >
                  <Ionicons name="navigate-outline" size={20} color="#111" />
                  <Text style={styles.trackingText}>Voir suivi</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.actionBtn} onPress={() => callClient(item.phone)}>
                <Ionicons name="call-outline" size={22} color="#FFF" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={() => whatsappClient(item.phone)}>
                <Ionicons name="logo-whatsapp" size={22} color="#FFF" />
              </TouchableOpacity>

             {['En attente', 'Refusée'].includes(item.status) && (
  <>
  <TouchableOpacity
    style={[
      styles.smartAssignBtnInline,
      smartAssignRideId === item.id && styles.smartAssignBtnLoading,
    ]}
    onPress={() => handleSmartAssign(item)}
    disabled={Boolean(smartAssignRideId)}
  >
    {smartAssignRideId === item.id ? (
      <>
        <Animated.View
          style={{
            transform: [
              {
                rotate: smartAssignSpin.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
          }}
        >
          <MaterialCommunityIcons name="sync" size={20} color="#111" />
        </Animated.View>
        <Text style={styles.smartAssignTextInline}>Analyse...</Text>
      </>
    ) : (
      <>
        <MaterialCommunityIcons
          name="robot-excited-outline"
          size={20}
          color="#111"
        />
        <Text style={styles.smartAssignTextInline}>Smart Dispatch</Text>
      </>
    )}
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.assignBtn}
    onPress={() => assignNearestDriver(item)}
  >
    <MaterialCommunityIcons
      name="account-tie"
      size={22}
      color="#111"
    />

    <Text style={styles.assignText}>
      Attribuer
    </Text>
  </TouchableOpacity>
  </>
)}
            </View>
          </View>
        );
        })}

        </View>

        <View style={{ height: 45 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TourismAnalyticsSection({
  tourGroups,
  tourBookings,
}: {
  tourGroups: TourGroup[];
  tourBookings: TourBooking[];
}) {
  const [tourReviews, setTourReviews] = useState<TourAnalyticsReview[]>([]);

  useEffect(() => {
    if (!db) {
      setTourReviews([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      query(collectionGroup(db, 'reviews')),
      (snapshot) => {
        setTourReviews(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            groupId: getReviewGroupIdFromPath(docSnap.ref.path),
            rating: Number(docSnap.data().rating || 0),
            guideRating: Number(docSnap.data().guideRating || 0),
            driverRating: Number(docSnap.data().driverRating || 0),
          })),
        );
      },
      (error) => {
        devError('[SNAPSHOT DENIED - admin-dashboard - TourismAnalyticsReviews]', error);
      },
    );

    return () => unsubscribe();
  }, []);

  const analyticsGroups = tourGroups as TourAnalyticsGroup[];
  const analyticsBookings = tourBookings as TourAnalyticsBooking[];
  const analytics = useMemo(
    () => computeTourismGlobalAnalytics(analyticsGroups, analyticsBookings, tourReviews),
    [analyticsGroups, analyticsBookings, tourReviews],
  );

  return (
    <View style={styles.tourismSection}>
      <View style={styles.tourismSectionHeader}>
        <View style={styles.tourismSectionIconWrap}>
          <MaterialCommunityIcons name="chart-line" size={22} color={tourismGreen} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tourismSectionTitle}>Analytics Tourisme</Text>
          <Text style={styles.tourismSectionSubtitle}>
            Popularité & classements live • {analytics.reviewCount} avis
          </Text>
        </View>
        <View style={styles.tourismCountBadge}>
          <Text style={styles.tourismCountBadgeText}>{analytics.activeGroups}</Text>
        </View>
      </View>

      <View style={styles.tourismAnalyticsCard}>
        <View style={styles.tourismAnalyticsGlow} />

        <View style={styles.tourismAnalyticsGrid}>
          <View style={styles.tourismAnalyticsStatCard}>
            <Text style={styles.tourismAnalyticsStatValue}>{analytics.activeGroups}</Text>
            <Text style={styles.tourismAnalyticsStatLabel}>Groupes actifs</Text>
          </View>
          <View style={styles.tourismAnalyticsStatCard}>
            <Text style={styles.tourismAnalyticsStatValue}>{analytics.averageFillRate}%</Text>
            <Text style={styles.tourismAnalyticsStatLabel}>Taux remplissage</Text>
          </View>
          <View style={styles.tourismAnalyticsStatCard}>
            <Text style={styles.tourismAnalyticsStatValue}>
              {formatAnalyticsRating(analytics.averageRating)}/5
            </Text>
            <Text style={styles.tourismAnalyticsStatLabel}>Moyenne notes</Text>
          </View>
          <View style={styles.tourismAnalyticsStatCard}>
            <Text style={styles.tourismAnalyticsStatValue}>{analytics.completedGroups}</Text>
            <Text style={styles.tourismAnalyticsStatLabel}>Groupes terminés</Text>
          </View>
        </View>

        <View style={styles.tourismAnalyticsProgressTrack}>
          <View
            style={[
              styles.tourismAnalyticsProgressFill,
              { width: `${analytics.averageFillRate}%` },
            ]}
          />
        </View>

        <View style={styles.tourismAnalyticsRevenueRow}>
          <MaterialCommunityIcons name="cash-multiple" size={18} color={tourismGreen} />
          <View style={{ flex: 1 }}>
            <Text style={styles.tourismAnalyticsRevenueLabel}>Revenu estimé (mock)</Text>
            <Text style={styles.tourismAnalyticsRevenueValue}>
              {formatAnalyticsRevenue(analytics.estimatedRevenue)}
            </Text>
          </View>
        </View>

        {analytics.topExperience ? (
          <View style={styles.tourismAnalyticsHighlightCard}>
            <View style={styles.tourismAnalyticsBestSellerBadge}>
              <Ionicons name="trophy-outline" size={12} color="#111" />
              <Text style={styles.tourismAnalyticsBestSellerText}>BEST SELLER</Text>
            </View>
            <Text style={styles.tourismAnalyticsHighlightTitle}>Top expérience</Text>
            <Text style={styles.tourismAnalyticsHighlightValue}>
              {analytics.topExperience.experience}
            </Text>
            <Text style={styles.tourismAnalyticsHighlightMeta}>
              {formatAnalyticsParticipants(analytics.topExperience.totalParticipants)} •{' '}
              {formatAnalyticsRating(analytics.topExperience.averageRating)}/5 •{' '}
              {analytics.topExperience.reviewCount} avis
            </Text>
          </View>
        ) : null}

        {analytics.topGuide ? (
          <View style={styles.tourismAnalyticsHighlightCard}>
            <View style={styles.tourismAnalyticsTopGuideBadge}>
              <Ionicons name="ribbon-outline" size={12} color={tourismGreen} />
              <Text style={styles.tourismAnalyticsTopGuideText}>TOP GUIDE</Text>
            </View>
            <Text style={styles.tourismAnalyticsHighlightTitle}>Meilleur guide</Text>
            <Text style={styles.tourismAnalyticsHighlightValue}>{analytics.topGuide.guideName}</Text>
            <Text style={styles.tourismAnalyticsHighlightMeta}>
              {formatAnalyticsRating(analytics.topGuide.averageRating)}/5 •{' '}
              {analytics.topGuide.completedGroups} groupe
              {analytics.topGuide.completedGroups > 1 ? 's' : ''} terminé
              {analytics.topGuide.completedGroups > 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function GroupReviewsSummary({ groupId }: { groupId: string }) {
  const [reviews, setReviews] = useState<TourGroupReview[]>([]);

  useEffect(() => {
    const reviewsQuery = query(
      collection(db, 'tourGroups', groupId, 'reviews'),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      reviewsQuery,
      (snapshot) => {
        const nextReviews = snapshot.docs.map((docSnap) =>
          normalizeTourGroupReview(docSnap.id, docSnap.data() as Record<string, unknown>),
        );
        setReviews(nextReviews);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - admin-dashboard - GroupReviewsSummary]', error);
      },
    );

    return () => unsubscribe();
  }, [groupId]);

  const stats = useMemo(() => computeTourGroupReviewStats(reviews), [reviews]);
  const latestReviews = useMemo(() => getLatestTourGroupReviews(reviews, 3), [reviews]);

  return (
    <View style={styles.tourismReviewsSection}>
      <Text style={styles.tourismReviewsTitle}>Avis expérience</Text>

      {reviews.length === 0 ? (
        <Text style={styles.tourismReviewsEmpty}>Aucun avis pour ce groupe.</Text>
      ) : (
        <>
          <View style={styles.tourismReviewsStatsRow}>
            <View style={styles.tourismReviewsStatCard}>
              <Text style={styles.tourismReviewsStatValue}>
                {formatReviewAverage(stats.averageRating)}
              </Text>
              <Text style={styles.tourismReviewsStatLabel}>Moyenne globale</Text>
            </View>
            <View style={styles.tourismReviewsStatCard}>
              <Text style={styles.tourismReviewsStatValue}>{stats.count}</Text>
              <Text style={styles.tourismReviewsStatLabel}>Avis reçus</Text>
            </View>
            <View style={styles.tourismReviewsStatCard}>
              <Text style={styles.tourismReviewsStatValue}>
                {formatReviewAverage(stats.averageDriverRating)}
              </Text>
              <Text style={styles.tourismReviewsStatLabel}>Chauffeur</Text>
            </View>
          </View>

          <View style={styles.tourismReviewsLatestSection}>
            <Text style={styles.tourismReviewsLatestTitle}>Derniers commentaires</Text>
            {latestReviews.map((review) => (
              <View key={review.id} style={styles.tourismReviewCommentCard}>
                <View style={styles.tourismReviewCommentTop}>
                  <Text style={styles.tourismReviewCommentName}>{review.senderName}</Text>
                  <Text style={styles.tourismReviewCommentRating}>{review.rating}/5</Text>
                </View>
                <Text style={styles.tourismReviewCommentMeta}>
                  Chauffeur {review.driverRating}/5 • Guide {review.guideRating}/5
                </Text>
                {review.comment ? (
                  <Text style={styles.tourismReviewCommentText} numberOfLines={3}>
                    "{review.comment}"
                  </Text>
                ) : (
                  <Text style={styles.tourismReviewCommentTextMuted}>Sans commentaire</Text>
                )}
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function AdminMemoryGalleryCard({ memory }: { memory: TourGroupMemory }) {
  return (
    <View style={styles.tourismMemoryCard}>
      <Image source={{ uri: memory.imageUrl }} style={styles.tourismMemoryImage} contentFit="cover" />
      <LinearGradient
        colors={['rgba(5,5,5,0)', 'rgba(5,5,5,0.45)', 'rgba(5,5,5,0.92)']}
        style={styles.tourismMemoryOverlay}
      />
      {isOfficialGroupMemory(memory) ? (
        <View style={styles.tourismMemoryOfficialBadge}>
          <Text style={styles.tourismMemoryOfficialBadgeText}>PHOTO OFFICIELLE</Text>
        </View>
      ) : null}
      <View style={styles.tourismMemoryContent}>
        <Text style={styles.tourismMemoryName} numberOfLines={1}>
          {memory.senderName}
        </Text>
        {memory.caption ? (
          <Text style={styles.tourismMemoryCaption} numberOfLines={2}>
            {memory.caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function GroupMemoriesSummary({ groupId }: { groupId: string }) {
  const [memories, setMemories] = useState<TourGroupMemory[]>([]);
  const [caption, setCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const memoriesQuery = query(
      collection(db, 'tourGroups', groupId, 'memories'),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      memoriesQuery,
      (snapshot) => {
        const nextMemories = snapshot.docs.map((docSnap) =>
          normalizeTourGroupMemory(docSnap.id, docSnap.data() as Record<string, unknown>),
        );
        setMemories(nextMemories);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - admin-dashboard - GroupMemoriesSummary]', error);
      },
    );

    return () => unsubscribe();
  }, [groupId]);

  const latestMemories = useMemo(() => getLatestTourGroupMemories(memories, 5), [memories]);

  const handleAddOfficialPhoto = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await sendTourGroupMemory(groupId, {
        imageUrl: getMockGroupMemoryImage(memories.length + 1),
        senderName: DEFAULT_ADMIN_SENDER_NAME,
        caption,
        senderType: 'admin',
      });
      setCaption('');
    } catch (error) {
      console.error('Tour group official memory error:', error);
      Alert.alert(
        'Photo impossible',
        'La photo officielle n\'a pas pu être ajoutée. Réessayez.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.tourismMemoriesSection}>
      <View style={styles.tourismMemoriesHeaderRow}>
        <Text style={styles.tourismMemoriesTitle}>Souvenirs du groupe</Text>
        <Text style={styles.tourismMemoriesCount}>
          {memories.length} photo{memories.length > 1 ? 's' : ''}
        </Text>
      </View>

      {latestMemories.length === 0 ? (
        <Text style={styles.tourismMemoriesEmpty}>Aucune photo souvenir pour ce groupe.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tourismMemoriesGalleryContent}
        >
          {latestMemories.map((memory) => (
            <AdminMemoryGalleryCard key={memory.id} memory={memory} />
          ))}
        </ScrollView>
      )}

      <Text style={styles.tourismMemoriesCaptionLabel}>Légende officielle (optionnelle)</Text>
      <TextInput
        style={styles.tourismMemoriesCaptionInput}
        value={caption}
        onChangeText={setCaption}
        placeholder="Photo officielle PROTAXI..."
        placeholderTextColor="#666"
        maxLength={120}
      />

      <TouchableOpacity
        style={[styles.tourismMemoriesAddBtn, isSubmitting && styles.tourismActionDisabled]}
        activeOpacity={0.85}
        disabled={isSubmitting}
        onPress={handleAddOfficialPhoto}
      >
        <MaterialCommunityIcons name="camera-plus-outline" size={18} color="#111" />
        <Text style={styles.tourismMemoriesAddBtnText}>
          {isSubmitting ? 'Ajout…' : 'Ajouter photo officielle'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function GroupPaymentSection({
  participants,
  relatedBookings,
}: {
  participants: TourGroupParticipant[];
  relatedBookings: TourBooking[];
}) {
  const [processingBookingId, setProcessingBookingId] = useState('');
  const [processingAction, setProcessingAction] = useState<'deposit' | 'full' | ''>('');

  const handleMarkDepositPaid = async (bookingId: string) => {
    if (processingBookingId) return;

    setProcessingBookingId(bookingId);
    setProcessingAction('deposit');
    try {
      await markTourBookingDepositPaid(bookingId);
    } catch (error) {
      console.error('Tour group deposit payment error:', error);
      Alert.alert(
        'Paiement impossible',
        'L\'acompte n\'a pas pu être enregistré. Réessayez.',
      );
    } finally {
      setProcessingBookingId('');
      setProcessingAction('');
    }
  };

  const handleMarkFullyPaid = async (bookingId: string) => {
    if (processingBookingId) return;

    setProcessingBookingId(bookingId);
    setProcessingAction('full');
    try {
      await markTourBookingFullyPaid(bookingId);
    } catch (error) {
      console.error('Tour group full payment error:', error);
      Alert.alert(
        'Paiement impossible',
        'Le paiement total n\'a pas pu être enregistré. Réessayez.',
      );
    } finally {
      setProcessingBookingId('');
      setProcessingAction('');
    }
  };

  return (
    <View style={styles.tourismPaymentSection}>
      <Text style={styles.tourismPaymentTitle}>Paiement participants</Text>

      {participants.length === 0 ? (
        <Text style={styles.tourismPaymentEmpty}>Aucun participant à facturer.</Text>
      ) : (
        participants.map((participant, index) => {
          const relatedBooking = relatedBookings.find(
            (booking) => booking.id === participant.bookingId,
          );
          const paymentStatus = normalizeTourPaymentStatus(relatedBooking?.paymentStatus);
          const paymentMethod = normalizeTourPaymentMethod(relatedBooking?.paymentMethod);
          const statusConfig = getPaymentStatusConfig(paymentStatus);
          const depositAmount = Number(relatedBooking?.depositAmount || 0);
          const remainingAmount = Number(relatedBooking?.remainingAmount || 0);
          const isProcessing = processingBookingId === participant.bookingId;
          const isFullyPaid = paymentStatus === 'fully-paid';
          const isDepositPaid = paymentStatus === 'deposit-paid';

          return (
            <View
              key={`payment-${participant.bookingId}-${index}`}
              style={[
                styles.tourismPaymentRow,
                { borderColor: statusConfig.border },
              ]}
            >
              <View style={styles.tourismPaymentRowTop}>
                <View style={styles.tourismPaymentAvatar}>
                  <MaterialCommunityIcons name="wallet-outline" size={16} color={tourismGreen} />
                </View>

                <View style={styles.tourismPaymentTextWrap}>
                  <Text style={styles.tourismPaymentName}>{participant.displayName}</Text>
                  <Text style={styles.tourismPaymentMeta}>
                    Acompte {formatTourPaymentAmount(depositAmount)} • Reste{' '}
                    {formatTourPaymentAmount(remainingAmount)}
                  </Text>
                  <Text style={styles.tourismPaymentMethod}>
                    {getPaymentMethodLabel(paymentMethod)}
                  </Text>
                  <Text style={[styles.tourismPaymentStatus, { color: statusConfig.color }]}>
                    {getPaymentStatusLabel(paymentStatus)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.tourismPaymentBadge,
                    {
                      backgroundColor: statusConfig.glow,
                      borderColor: statusConfig.border,
                    },
                  ]}
                >
                  <Text style={[styles.tourismPaymentBadgeText, { color: statusConfig.color }]}>
                    {statusConfig.badge}
                  </Text>
                </View>
              </View>

              {isFullyPaid ? (
                <View style={styles.tourismPaymentValidatedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#111" />
                  <Text style={styles.tourismPaymentValidatedBadgeText}>PAYÉ</Text>
                </View>
              ) : (
                <View style={styles.tourismPaymentActions}>
                  {!isDepositPaid ? (
                    <TouchableOpacity
                      style={[
                        styles.tourismPaymentDepositBtn,
                        isProcessing && styles.tourismActionDisabled,
                      ]}
                      activeOpacity={0.85}
                      disabled={isProcessing || !relatedBooking}
                      onPress={() => handleMarkDepositPaid(participant.bookingId)}
                    >
                      <Text style={styles.tourismPaymentDepositBtnText}>
                        {isProcessing && processingAction === 'deposit'
                          ? 'Enregistrement…'
                          : 'Marquer acompte payé'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.tourismPaymentFullBtn,
                      isProcessing && styles.tourismActionDisabled,
                    ]}
                    activeOpacity={0.85}
                    disabled={isProcessing || !relatedBooking}
                    onPress={() => handleMarkFullyPaid(participant.bookingId)}
                  >
                    <Text style={styles.tourismPaymentFullBtnText}>
                      {isProcessing && processingAction === 'full'
                        ? 'Enregistrement…'
                        : 'Marquer totalement payé'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

function GroupCheckInSection({
  participants,
  relatedBookings,
}: {
  participants: TourGroupParticipant[];
  relatedBookings: TourBooking[];
}) {
  const [checkingInBookingId, setCheckingInBookingId] = useState('');

  const handleCheckIn = async (bookingId: string) => {
    if (checkingInBookingId) return;

    setCheckingInBookingId(bookingId);
    try {
      await checkInTourBooking(bookingId);
    } catch (error) {
      console.error('Tour group check-in error:', error);
      Alert.alert(
        'Check-in impossible',
        'La présence n\'a pas pu être validée. Réessayez.',
      );
    } finally {
      setCheckingInBookingId('');
    }
  };

  return (
    <View style={styles.tourismCheckInSection}>
      <Text style={styles.tourismCheckInTitle}>Check-in participants</Text>

      {participants.length === 0 ? (
        <Text style={styles.tourismCheckInEmpty}>Aucun participant à valider.</Text>
      ) : (
        participants.map((participant, index) => {
          const relatedBooking = relatedBookings.find(
            (booking) => booking.id === participant.bookingId,
          );
          const checkInStatus = normalizeTourCheckInStatus(relatedBooking?.checkInStatus);
          const isCheckedIn = isTourBookingCheckedIn(checkInStatus);
          const ticketCode = relatedBooking?.ticketCode || '—';
          const isProcessing = checkingInBookingId === participant.bookingId;

          return (
            <View
              key={`checkin-${participant.bookingId}-${index}`}
              style={styles.tourismCheckInRow}
            >
              <View style={styles.tourismCheckInAvatar}>
                <Ionicons name="person-outline" size={16} color={tourismGreen} />
              </View>

              <View style={styles.tourismCheckInTextWrap}>
                <Text style={styles.tourismCheckInName}>{participant.displayName}</Text>
                <Text style={styles.tourismCheckInTicket}>{ticketCode}</Text>
                <Text
                  style={[
                    styles.tourismCheckInStatus,
                    isCheckedIn && styles.tourismCheckInStatusValidated,
                  ]}
                >
                  {getCheckInStatusLabel(checkInStatus)}
                </Text>
              </View>

              {isCheckedIn ? (
                <View style={styles.tourismCheckInValidatedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#111" />
                  <Text style={styles.tourismCheckInValidatedBadgeText}>VALIDÉ</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.tourismCheckInBtn,
                    isProcessing && styles.tourismActionDisabled,
                  ]}
                  activeOpacity={0.85}
                  disabled={isProcessing || !relatedBooking}
                  onPress={() => handleCheckIn(participant.bookingId)}
                >
                  <MaterialCommunityIcons name="qrcode-scan" size={16} color="#111" />
                  <Text style={styles.tourismCheckInBtnText}>
                    {isProcessing ? 'Validation…' : 'Valider présence'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

function ActiveTourGroupCard({
  group,
  relatedBookings,
}: {
  group: TourGroup;
  relatedBookings: TourBooking[];
}) {
  const statusStyle = getTourGroupStatusStyle(group.status);
  const booked = Number(group.booked || 0);
  const remaining = Number(group.remaining || 0);
  const capacity = Number(group.capacity || 8);
  const participants = normalizeTourGroupParticipants(group.participants);
  const participantsCount = participants.length || booked;
  const assignment: TourGroupAssignment = {
    assignedVehicle: group.assignedVehicle,
    assignedDriver: group.assignedDriver,
    assignedGuide: group.assignedGuide,
    assignmentStatus: group.assignmentStatus,
  };
  const hasAssignment = hasTourGroupAssignment(assignment);
  const assignmentConfirmed = isTourGroupAssignmentConfirmed(assignment);

  const [showAssignmentPanel, setShowAssignmentPanel] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(group.assignedVehicle || '');
  const [selectedDriver, setSelectedDriver] = useState(group.assignedDriver || '');
  const [selectedGuide, setSelectedGuide] = useState(group.assignedGuide || '');
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [showTrackingPanel, setShowTrackingPanel] = useState(false);
  const [isUpdatingTracking, setIsUpdatingTracking] = useState(false);
  const [showAnnouncementPanel, setShowAnnouncementPanel] = useState(false);
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);

  const currentTrackingStatus = normalizeTourGroupTrackingStatus(group.trackingStatus);
  const currentTrackingConfig = currentTrackingStatus
    ? getTourGroupTrackingConfig(currentTrackingStatus)
    : null;

  const openAssignmentPanel = () => {
    setSelectedVehicle(group.assignedVehicle || TOUR_GROUP_VEHICLE_OPTIONS[0]);
    setSelectedDriver(group.assignedDriver || TOUR_GROUP_DRIVER_OPTIONS[0]);
    setSelectedGuide(group.assignedGuide || TOUR_GROUP_GUIDE_OPTIONS[0]);
    setShowAssignmentPanel(true);
  };

  const saveGroupAssignment = async () => {
    if (!selectedVehicle || !selectedDriver || !selectedGuide) {
      Alert.alert('Attribution incomplète', 'Veuillez sélectionner un véhicule, un chauffeur et un guide.');
      return;
    }

    setIsSavingAssignment(true);

    try {
      await updateDoc(doc(db, 'tourGroups', group.id), {
        assignedVehicle: selectedVehicle,
        assignedDriver: selectedDriver,
        assignedGuide: selectedGuide,
        assignmentStatus: 'assigned',
        updatedAt: serverTimestamp(),
      });
      setShowAssignmentPanel(false);
    } catch (error) {
      console.error('Tour group assignment error:', error);
      Alert.alert(
        'Attribution impossible',
        'Le groupe n\'a pas pu être mis à jour. Réessayez.',
      );
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const updateGroupTracking = async (trackingStatus: TourGroupTrackingStatus) => {
    setIsUpdatingTracking(true);

    try {
      await updateDoc(doc(db, 'tourGroups', group.id), {
        trackingStatus,
        etaMinutes: getMockTrackingEta(trackingStatus),
        liveLocation: getMockTrackingLocation(trackingStatus),
        lastLocationUpdate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Tour group tracking error:', error);
      Alert.alert(
        'Tracking impossible',
        'Le statut de trajet n\'a pas pu être mis à jour. Réessayez.',
      );
    } finally {
      setIsUpdatingTracking(false);
    }
  };

  const sendGroupAnnouncement = async (text: string) => {
    setIsSendingAnnouncement(true);

    try {
      await sendTourGroupMessage(group.id, {
        senderType: 'admin',
        senderName: DEFAULT_ADMIN_SENDER_NAME,
        text,
      });
    } catch (error) {
      console.error('Tour group announcement error:', error);
      Alert.alert(
        'Annonce impossible',
        'Le message n\'a pas pu être envoyé au chat groupe. Réessayez.',
      );
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  return (
    <>
      <View style={styles.tourismBookingCard}>
        <View style={styles.tourismBookingGlow} />

        <View style={styles.tourismBookingTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tourismBookingId}>{formatTourGroupLabel(group.id)}</Text>
            <Text style={styles.tourismBookingTitle}>
              {group.experience || 'Expérience PROTAXI'}
            </Text>
          </View>

          <View style={[styles.tourismStatusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.tourismStatusBadgeText, { color: statusStyle.color }]}>
              {statusStyle.label}
            </Text>
          </View>
        </View>

        <TourGroupInfoRow icon="calendar-outline" label="Date" value={group.date || '—'} />
        <TourGroupInfoRow
          icon="people-outline"
          label="Total participants"
          value={`${participantsCount} / ${capacity}`}
        />
        <TourGroupInfoRow
          icon="ticket-outline"
          label="Places restantes"
          value={String(remaining)}
        />
        <TourGroupInfoRow
          icon="flag-outline"
          label="Statut"
          value={group.status === 'full' ? 'full' : 'open'}
        />

        {hasAssignment ? (
          <View style={styles.tourismAssignmentSummary}>
            <Text style={styles.tourismAssignmentSummaryTitle}>Équipe attribuée</Text>
            {group.assignedVehicle ? (
              <TourGroupInfoRow icon="bus-outline" label="Véhicule" value={group.assignedVehicle} />
            ) : null}
            {group.assignedDriver ? (
              <TourGroupInfoRow icon="person-outline" label="Chauffeur" value={group.assignedDriver} />
            ) : null}
            {group.assignedGuide ? (
              <TourGroupInfoRow icon="map-outline" label="Guide" value={group.assignedGuide} />
            ) : null}
            {assignmentConfirmed ? (
              <View style={styles.tourismAssignmentConfirmedBadge}>
                <Ionicons name="checkmark-circle" size={13} color={tourismGreen} />
                <Text style={styles.tourismAssignmentConfirmedText}>Organisation confirmée</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.tourismAssignBtn}
          activeOpacity={0.85}
          onPress={openAssignmentPanel}
        >
          <MaterialCommunityIcons name="account-cog-outline" size={18} color="#111" />
          <Text style={styles.tourismAssignBtnText}>Attribuer</Text>
        </TouchableOpacity>

        <View style={styles.tourismTrackingSection}>
          <TouchableOpacity
            style={styles.tourismTrackingToggle}
            activeOpacity={0.85}
            onPress={() => setShowTrackingPanel((value) => !value)}
          >
            <View style={styles.tourismTrackingToggleLeft}>
              <MaterialCommunityIcons name="crosshairs-gps" size={18} color={tourismGreen} />
              <View>
                <Text style={styles.tourismTrackingToggleTitle}>Tracking</Text>
                <Text style={styles.tourismTrackingToggleSubtitle}>
                  {currentTrackingConfig
                    ? currentTrackingConfig.label
                    : 'Statut trajet non défini'}
                </Text>
              </View>
            </View>
            <Ionicons
              name={showTrackingPanel ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={tourismGreen}
            />
          </TouchableOpacity>

          {currentTrackingStatus ? (
            <View style={styles.tourismTrackingCurrentRow}>
              <View
                style={[
                  styles.tourismTrackingCurrentBadge,
                  {
                    backgroundColor: currentTrackingConfig?.glow,
                    borderColor: currentTrackingConfig?.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tourismTrackingCurrentText,
                    { color: currentTrackingConfig?.color },
                  ]}
                >
                  {currentTrackingConfig?.label}
                </Text>
              </View>
              <Text style={styles.tourismTrackingCurrentMeta}>
                ETA {Number(group.etaMinutes || 0)} min
              </Text>
            </View>
          ) : null}

          {showTrackingPanel ? (
            <View style={styles.tourismTrackingPanel}>
              {TOUR_GROUP_TRACKING_OPTIONS.map((option) => {
                const isActive = currentTrackingStatus === option.status;
                const optionConfig = getTourGroupTrackingConfig(option.status);

                return (
                  <TouchableOpacity
                    key={option.status}
                    style={[
                      styles.tourismTrackingBtn,
                      isActive && {
                        backgroundColor: optionConfig.glow,
                        borderColor: optionConfig.border,
                      },
                      isUpdatingTracking && styles.tourismActionDisabled,
                    ]}
                    activeOpacity={0.85}
                    disabled={isUpdatingTracking}
                    onPress={() => updateGroupTracking(option.status)}
                  >
                    <Ionicons
                      name={optionConfig.icon}
                      size={15}
                      color={isActive ? optionConfig.color : '#BDBDBD'}
                    />
                    <Text
                      style={[
                        styles.tourismTrackingBtnText,
                        isActive && { color: optionConfig.color },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.tourismAnnouncementSection}>
          <TouchableOpacity
            style={styles.tourismAnnouncementToggle}
            activeOpacity={0.85}
            onPress={() => setShowAnnouncementPanel((value) => !value)}
          >
            <View style={styles.tourismAnnouncementToggleLeft}>
              <MaterialCommunityIcons name="bullhorn-outline" size={18} color={tourismGreen} />
              <View>
                <Text style={styles.tourismAnnouncementToggleTitle}>Envoyer annonce</Text>
                <Text style={styles.tourismAnnouncementToggleSubtitle}>
                  Message admin dans le chat groupe
                </Text>
              </View>
            </View>
            <Ionicons
              name={showAnnouncementPanel ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={tourismGreen}
            />
          </TouchableOpacity>

          {showAnnouncementPanel ? (
            <View style={styles.tourismAnnouncementPanel}>
              {TOUR_GROUP_ADMIN_ANNOUNCEMENTS.map((announcement) => (
                <TouchableOpacity
                  key={announcement.label}
                  style={[
                    styles.tourismAnnouncementBtn,
                    isSendingAnnouncement && styles.tourismActionDisabled,
                  ]}
                  activeOpacity={0.85}
                  disabled={isSendingAnnouncement}
                  onPress={() => sendGroupAnnouncement(announcement.text)}
                >
                  <View style={styles.tourismAnnouncementBtnBadge}>
                    <Text style={styles.tourismAnnouncementBtnBadgeText}>ADMIN</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tourismAnnouncementBtnTitle}>{announcement.label}</Text>
                    <Text style={styles.tourismAnnouncementBtnText} numberOfLines={2}>
                      {announcement.text}
                    </Text>
                  </View>
                  <Ionicons name="send-outline" size={16} color={tourismGreen} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <GroupReviewsSummary groupId={group.id} />

        <GroupMemoriesSummary groupId={group.id} />

        <GroupPaymentSection
          participants={participants}
          relatedBookings={relatedBookings}
        />

        <GroupCheckInSection
          participants={participants}
          relatedBookings={relatedBookings}
        />

        <View style={styles.tourismParticipantsSection}>
          <Text style={styles.tourismParticipantsTitle}>Liste participants</Text>
          {participants.length === 0 ? (
            <Text style={styles.tourismParticipantsEmpty}>Aucun participant enregistré.</Text>
          ) : (
            participants.map((participant, index) => {
              const relatedBooking = relatedBookings.find(
                (booking) => booking.id === participant.bookingId,
              );

              return (
                <View
                  key={`${participant.bookingId}-${index}`}
                  style={styles.tourismParticipantRow}
                >
                  <View style={styles.tourismParticipantAvatar}>
                    <Ionicons name="person-outline" size={16} color={tourismGreen} />
                  </View>
                  <View style={styles.tourismParticipantTextWrap}>
                    <Text style={styles.tourismParticipantName}>{participant.displayName}</Text>
                    <Text style={styles.tourismParticipantMeta}>
                      {participant.travelersCount} place{participant.travelersCount > 1 ? 's' : ''}
                      {' • '}
                      Réservation {participant.bookingId.slice(-6).toUpperCase()}
                    </Text>
                    {relatedBooking ? (
                      <Text style={styles.tourismParticipantBooking}>
                        {relatedBooking.experience || relatedBooking.circuitName || 'Expérience'} •{' '}
                        {formatTourPrice(relatedBooking.price)}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.tourismParticipantStatusPill}>
                    <Text style={styles.tourismParticipantStatusText}>
                      {formatParticipantStatusLabel(participant.status)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>

      <Modal
        visible={showAssignmentPanel}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAssignmentPanel(false)}
      >
        <Pressable
          style={styles.tourismAssignmentOverlay}
          onPress={() => setShowAssignmentPanel(false)}
        >
          <Pressable style={styles.tourismAssignmentPanel} onPress={() => undefined}>
            <View style={styles.tourismAssignmentPanelGlow} />

            <View style={styles.tourismAssignmentPanelHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tourismAssignmentPanelTitle}>Attribution groupe</Text>
                <Text style={styles.tourismAssignmentPanelSubtitle}>
                  {formatTourGroupLabel(group.id)} • {group.experience || 'Expérience PROTAXI'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.tourismAssignmentCloseBtn}
                onPress={() => setShowAssignmentPanel(false)}
              >
                <Ionicons name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            <GroupAssignmentOptionSection
              title="Véhicule groupe"
              options={TOUR_GROUP_VEHICLE_OPTIONS}
              selected={selectedVehicle}
              onSelect={setSelectedVehicle}
            />
            <GroupAssignmentOptionSection
              title="Chauffeur"
              options={TOUR_GROUP_DRIVER_OPTIONS}
              selected={selectedDriver}
              onSelect={setSelectedDriver}
            />
            <GroupAssignmentOptionSection
              title="Guide touristique"
              options={TOUR_GROUP_GUIDE_OPTIONS}
              selected={selectedGuide}
              onSelect={setSelectedGuide}
            />

            <TouchableOpacity
              style={[
                styles.tourismAssignmentSaveBtn,
                isSavingAssignment && styles.tourismActionDisabled,
              ]}
              activeOpacity={0.85}
              onPress={saveGroupAssignment}
              disabled={isSavingAssignment}
            >
              {isSavingAssignment ? (
                <ActivityIndicator size="small" color="#111" />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={18} color="#111" />
              )}
              <Text style={styles.tourismAssignmentSaveBtnText}>
                {isSavingAssignment ? 'Enregistrement…' : 'Confirmer attribution'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function GroupAssignmentOptionSection({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.tourismAssignmentSection}>
      <Text style={styles.tourismAssignmentSectionTitle}>{title}</Text>
      <View style={styles.tourismAssignmentOptionsRow}>
        {options.map((option) => {
          const isActive = selected === option;

          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.tourismAssignmentOptionChip,
                isActive && styles.tourismAssignmentOptionChipActive,
              ]}
              activeOpacity={0.85}
              onPress={() => onSelect(option)}
            >
              <Text
                style={[
                  styles.tourismAssignmentOptionText,
                  isActive && styles.tourismAssignmentOptionTextActive,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function TourGroupInfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.tourismInfoRow}>
      <View style={styles.tourismInfoLeft}>
        <Ionicons name={icon} size={16} color={tourismGreen} />
        <Text style={styles.tourismInfoLabel}>{label}</Text>
      </View>
      <Text style={styles.tourismInfoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function TourBookingCard({
  booking,
  isProcessing,
  onConfirm,
  onCancel,
}: {
  booking: TourBooking;
  isProcessing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const statusStyle = getTourBookingStatusStyle(booking.status);
  const isGroup = booking.bookingMode === 'group';
  const isPending = !booking.status || booking.status === 'pending';
  const experienceTitle =
    booking.experience || booking.circuitName || booking.formula || 'Expérience PROTAXI';

  return (
    <View style={styles.tourismBookingCard}>
      <View style={styles.tourismBookingGlow} />

      <View style={styles.tourismBookingTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tourismBookingId}>{booking.id}</Text>
          <Text style={styles.tourismBookingTitle}>{experienceTitle}</Text>
        </View>

        <View style={styles.tourismBookingTopBadges}>
          {isGroup ? (
            <View style={styles.tourismSharedBadge}>
              <Ionicons name="people-outline" size={11} color={tourismGreen} />
              <Text style={styles.tourismSharedBadgeText}>EXPÉRIENCE PARTAGÉE</Text>
            </View>
          ) : null}

          <View style={[styles.tourismStatusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.tourismStatusBadgeText, { color: statusStyle.color }]}>
              {statusStyle.label}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tourismModeBadge}>
        <Ionicons
          name={isGroup ? 'people-outline' : 'diamond-outline'}
          size={13}
          color={tourismGreen}
        />
        <Text style={styles.tourismModeBadgeText}>{getTourBookingModeLabel(booking.bookingMode)}</Text>
      </View>

      <TourInfoRow icon="calendar-outline" label="Date" value={booking.date || '—'} />
      <TourInfoRow icon="location-outline" label="Rendez-vous" value={booking.meetingPoint || '—'} />
      <TourInfoRow
        icon="people-outline"
        label="Voyageurs"
        value={
          booking.travelers
            ? `${booking.travelers} personne${Number(booking.travelers) > 1 ? 's' : ''}`
            : '—'
        }
      />
      <TourInfoRow icon="cash-outline" label="Prix" value={formatTourPrice(booking.price)} />
      <TourInfoRow icon="flag-outline" label="Statut" value={booking.status || 'pending'} />
      <TourInfoRow
        icon="time-outline"
        label="Créée le"
        value={formatTourBookingCreatedAt(booking)}
      />

      {isPending ? (
        <View style={styles.tourismActionsRow}>
          <TouchableOpacity
            style={[styles.tourismConfirmBtn, isProcessing && styles.tourismActionDisabled]}
            activeOpacity={0.85}
            onPress={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#111" />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={16} color="#111" />
            )}
            <Text style={styles.tourismConfirmBtnText}>Confirmer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tourismCancelBtn, isProcessing && styles.tourismActionDisabled]}
            activeOpacity={0.85}
            onPress={onCancel}
            disabled={isProcessing}
          >
            <Ionicons name="close-circle-outline" size={16} color="#FFF" />
            <Text style={styles.tourismCancelBtnText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function TourInfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.tourismInfoRow}>
      <View style={styles.tourismInfoLeft}>
        <Ionicons name={icon} size={16} color={tourismGreen} />
        <Text style={styles.tourismInfoLabel}>{label}</Text>
      </View>
      <Text style={styles.tourismInfoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function DriverRequestCard({
  driver,
  driverName,
  driverPhone,
  driverCar,
  driverPlate,
  driverPhoto,
  statusLabel,
  statusStyle,
  isProcessing,
  onApprove,
  onSuspend,
  onRefuse,
  onViewProfile,
}: {
  driver: any;
  driverName: string;
  driverPhone: string;
  driverCar: string;
  driverPlate: string;
  driverPhoto: string;
  statusLabel: DriverValidationStatus;
  statusStyle: { bg: string; color: string; dot: string };
  isProcessing: boolean;
  onApprove: () => void;
  onSuspend: () => void;
  onRefuse: () => void;
  onViewProfile: () => void;
}) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeIn, slideUp]);

  const canApprove = !driver.isApproved && !driver.isSuspended;
  const canSuspend = driver.isApproved && !driver.isSuspended;
  const canRefuse = !driver.isApproved && !driver.isSuspended;

  return (
    <Animated.View
      style={[
        styles.driverRequestCard,
        {
          opacity: fadeIn,
          transform: [{ translateY: slideUp }],
        },
      ]}
    >
      <View style={styles.driverRequestTop}>
        <View style={styles.driverRequestAvatarWrap}>
          {driverPhoto ? (
            <Image
              source={{ uri: driverPhoto }}
              style={styles.driverRequestAvatar}
              contentFit="cover"
            />
          ) : (
            <MaterialCommunityIcons name="account-tie" size={34} color={gold} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.driverRequestName}>{driverName}</Text>
          <Text style={styles.driverRequestPhone}>{driverPhone}</Text>

          <View
            style={[
              styles.driverValidationBadge,
              { backgroundColor: statusStyle.bg },
            ]}
          >
            <View
              style={[
                styles.driverValidationDot,
                { backgroundColor: statusStyle.dot },
              ]}
            />
            <Text
              style={[
                styles.driverValidationBadgeText,
                { color: statusStyle.color },
              ]}
            >
              {statusLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.driverRequestMetaRow}>
        <View style={styles.driverRequestMetaChip}>
          <Ionicons name="car-outline" size={16} color={gold} />
          <Text style={styles.driverRequestMetaText} numberOfLines={1}>
            {driverCar}
          </Text>
        </View>

        <View style={styles.driverRequestMetaChip}>
          <Ionicons name="document-text-outline" size={16} color={gold} />
          <Text style={styles.driverRequestMetaText} numberOfLines={1}>
            {driverPlate}
          </Text>
        </View>
      </View>

      <View style={styles.driverRequestActions}>
        {canApprove && (
          <TouchableOpacity
            style={[styles.driverApproveBtn, isProcessing && styles.driverActionDisabled]}
            onPress={onApprove}
            disabled={isProcessing}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#111" />
            <Text style={styles.driverApproveBtnText}>Approuver</Text>
          </TouchableOpacity>
        )}

        {canSuspend && (
          <TouchableOpacity
            style={[styles.driverSuspendBtn, isProcessing && styles.driverActionDisabled]}
            onPress={onSuspend}
            disabled={isProcessing}
          >
            <Ionicons name="pause-circle-outline" size={18} color="#FFF" />
            <Text style={styles.driverSuspendBtnText}>Suspendre</Text>
          </TouchableOpacity>
        )}

        {canRefuse && (
          <TouchableOpacity
            style={[styles.driverRefuseBtn, isProcessing && styles.driverActionDisabled]}
            onPress={onRefuse}
            disabled={isProcessing}
          >
            <Ionicons name="close-circle-outline" size={18} color="#FFF" />
            <Text style={styles.driverRefuseBtnText}>Refuser</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.driverProfileBtn}
          onPress={onViewProfile}
          disabled={isProcessing}
        >
          <Ionicons name="person-circle-outline" size={18} color="#111" />
          <Text style={styles.driverProfileBtnText}>Voir profil</Text>
        </TouchableOpacity>
      </View>

      {isProcessing ? (
        <View style={styles.driverProcessingRow}>
          <ActivityIndicator size="small" color={gold} />
          <Text style={styles.driverProcessingText}>Mise à jour en cours...</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function SmartDispatchStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <View style={styles.smartDispatchStatCard}>
      <Text style={[styles.smartDispatchStatValue, { color }]}>{value}</Text>
      <Text style={styles.smartDispatchStatLabel}>{label}</Text>
    </View>
  );
}

function BusinessAlertChip({
  alert,
}: {
  alert: { id: string; text: string; color: string; icon: string };
}) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.businessAlertChip,
        {
          opacity: pulse,
          borderColor: `${alert.color}55`,
          backgroundColor: `${alert.color}18`,
        },
      ]}
    >
      <Ionicons name={alert.icon as any} size={16} color={alert.color} />
      <Text style={[styles.businessAlertText, { color: alert.color }]}>
        {alert.text}
      </Text>
    </Animated.View>
  );
}

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type IonIconName = ComponentProps<typeof Ionicons>['name'];

type AdminProAnimatedStatIconProps =
  | {
      iconFamily: 'ionicons';
      icon: IonIconName;
      accent: string;
      animDelay: number;
    }
  | {
      iconFamily?: 'material';
      icon: MaterialIconName;
      accent: string;
      animDelay: number;
    };

function AdminProAnimatedStatIcon(props: AdminProAnimatedStatIconProps) {
  const { accent, animDelay } = props;
  const iconFade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const entrance = Animated.timing(iconFade, {
      toValue: 1,
      duration: 360,
      delay: animDelay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    entrance.start(({ finished }) => {
      if (finished) {
        pulseLoop.start();
      }
    });

    return () => {
      entrance.stop();
      pulseLoop.stop();
    };
  }, [animDelay, iconFade, pulse]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.16],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.5],
  });
  const iconScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  return (
    <View style={styles.adminProStatIconShell}>
      <Animated.View
        style={[
          styles.adminProStatIconGlow,
          {
            backgroundColor: `${accent}28`,
            borderColor: `${accent}55`,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
      <View
        style={[
          styles.adminProStatIconWrap,
          { backgroundColor: `${accent}22`, borderColor: `${accent}44` },
        ]}
      >
        <Animated.View style={{ opacity: iconFade, transform: [{ scale: iconScale }] }}>
          {props.iconFamily === 'ionicons' ? (
            <Ionicons name={props.icon} size={22} color={accent} />
          ) : (
            <MaterialCommunityIcons name={props.icon} size={22} color={accent} />
          )}
        </Animated.View>
      </View>
    </View>
  );
}

type AdminProStatCardProps = {
  label: string;
  value: string | number;
  accent: string;
  index: number;
} & (
  | {
      iconFamily?: 'material';
      icon: MaterialIconName;
    }
  | {
      iconFamily: 'ionicons';
      icon: IonIconName;
    }
);

function AdminProStatCard(props: AdminProStatCardProps) {
  const { label, value, accent, index } = props;
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        delay: index * 70,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 420,
        delay: index * 70,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide, index]);

  return (
    <Animated.View
      style={[
        styles.adminProStatCard,
        { opacity: fade, transform: [{ translateY: slide }] },
      ]}
    >
      <LinearGradient
        colors={['#141414', '#0A0A0A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.adminProStatGradient}
      >
        {props.iconFamily === 'ionicons' ? (
          <AdminProAnimatedStatIcon
            iconFamily="ionicons"
            icon={props.icon}
            accent={accent}
            animDelay={index * 70 + 120}
          />
        ) : (
          <AdminProAnimatedStatIcon
            icon={props.icon}
            accent={accent}
            animDelay={index * 70 + 120}
          />
        )}
        <Text style={styles.adminProStatValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.adminProStatLabel}>{label}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

function AdminProQuickActionCard({
  label,
  subtitle,
  icon,
  accent,
  onPress,
  index,
}: {
  label: string;
  subtitle: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  accent: string;
  onPress: () => void;
  index: number;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 400,
        delay: 280 + index * 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        delay: 280 + index * 60,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, scale, index]);

  return (
    <Animated.View
      style={[
        styles.adminProQuickCardWrap,
        { opacity: fade, transform: [{ scale }] },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.adminProQuickCard,
          pressed && styles.adminProQuickCardPressed,
        ]}
      >
        <LinearGradient
          colors={['#121212', '#080808']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.adminProQuickGradient}
        >
          <View
            style={[
              styles.adminProQuickIconWrap,
              { backgroundColor: `${accent}20`, borderColor: `${accent}55` },
            ]}
          >
            <MaterialCommunityIcons name={icon} size={24} color={accent} />
          </View>
          <Text style={styles.adminProQuickLabel}>{label}</Text>
          <Text style={styles.adminProQuickSubtitle}>{subtitle}</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color="#666"
            style={styles.adminProQuickChevron}
          />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

function BigCard({ title, value }: any) {
  return (
    <View style={styles.analyticsCard}>
      <Text style={styles.analyticsTitle}>{title}</Text>
      <Text style={styles.analyticsValue}>{value}</Text>
    </View>
  );
}

function StatCard({ title, value, icon }: any) {
  return (
    <View style={styles.statCard}>
      <MaterialCommunityIcons name={icon} size={25} color={gold} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

function BusinessCard({ icon, color, value, label }: any) {
  return (
    <View style={styles.businessStatCard}>
      <Ionicons name={icon} size={28} color={color} />
      <Text style={styles.businessStatValue}>{value}</Text>
      <Text style={styles.businessStatLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={19} color={gold} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>

      <Text numberOfLines={2} style={styles.infoValue}>
        {value || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505', paddingHorizontal: 18 },

  scrollContent: {
    paddingBottom: 48,
  },

  adminProHero: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
  },

  adminProHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },

  adminProHeroEyebrow: {
    color: tourismGreen,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },

  adminProHeroTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },

  adminProHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139,197,63,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  adminProHeroBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: tourismGreen,
  },

  adminProHeroBadgeText: {
    color: tourismGreen,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  adminProHeroSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },

  adminProStatsScroll: {
    gap: 12,
    paddingRight: 4,
    marginBottom: 20,
  },

  adminProStatCard: {
    width: 148,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },

  adminProStatGradient: {
    padding: 14,
    minHeight: 118,
    justifyContent: 'space-between',
  },

  adminProStatIconShell: {
    position: 'relative',
    width: 38,
    height: 38,
    marginBottom: 10,
  },

  adminProStatIconGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
  },

  adminProStatIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  adminProStatValue: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },

  adminProStatLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },

  adminProSectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  adminProQuickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 26,
  },

  adminProQuickCardWrap: {
    width: '48%',
    flexGrow: 1,
    minWidth: 150,
  },

  adminProQuickCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },

  adminProQuickCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },

  adminProQuickGradient: {
    padding: 14,
    minHeight: 118,
    position: 'relative',
  },

  adminProQuickIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  adminProQuickLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
    paddingRight: 18,
  },

  adminProQuickSubtitle: {
    color: '#777',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    paddingRight: 18,
  },

  adminProQuickChevron: {
    position: 'absolute',
    right: 12,
    top: 14,
  },

  header: {
    paddingTop: 55,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  adminIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#171307',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
  },

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

  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },

  subtitle: {
    color: '#AFAFAF',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },

  analyticsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },

  analyticsCard: {
    flex: 1,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.25)',
  },

  analyticsTitle: {
    color: '#AAA',
    fontSize: 13,
    fontWeight: '700',
  },

  analyticsValue: {
    color: gold,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 8,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 20,
  },

  statCard: {
    flex: 1,
    height: 110,
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  statValue: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
  },

  statTitle: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 4,
  },

  businessStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 10,
  },

  businessStatCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 18,
    padding: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },

  businessStatValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'center',
  },

  businessStatLabel: {
    color: '#AAA',
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
  },

  chartCard: {
    backgroundColor: '#111',
    borderRadius: 22,
    paddingVertical: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
  },

  chartTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 16,
    marginBottom: 12,
  },

  chart: {
    borderRadius: 18,
  },

  topDriverCard: {
    backgroundColor: '#111',
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },

  topDriverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  topDriverTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  topDriverName: {
    color: gold,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 14,
  },

  topDriverStats: {
    color: '#FFF',
    fontSize: 15,
    marginTop: 10,
  },

  topDriverRevenue: {
    color: '#4ADE80',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 8,
  },

  mapContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
    backgroundColor: '#111',
  },

  gpsLiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
  },

  gpsLiveTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },

  gpsLiveSubtitle: {
    color: '#AFAFAF',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },

  gpsLiveLegend: {
    gap: 8,
  },

  gpsLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  gpsLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  gpsLegendDotLive: {
    backgroundColor: '#22C55E',
  },

  gpsLegendDotOffline: {
    backgroundColor: '#EF4444',
  },

  gpsLegendText: {
    color: '#CCC',
    fontSize: 10,
    fontWeight: '800',
  },

  gpsLiveFeed: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },

  gpsLiveEmpty: {
    color: '#AAA',
    fontSize: 13,
    fontWeight: '600',
  },

  gpsLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#151515',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#242424',
    padding: 12,
  },

  gpsLiveDriverName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },

  gpsLiveUpdate: {
    color: '#AFAFAF',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },

  gpsLiveCoords: {
    color: gold,
    fontSize: 11,
    marginTop: 4,
    fontWeight: '700',
  },

  gpsLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },

  gpsLiveBadgeLive: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.35)',
  },

  gpsLiveBadgeOffline: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
  },

  gpsLiveBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  gpsLiveBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  driverGpsUpdateText: {
    color: '#888',
    fontSize: 11,
    marginTop: 8,
    fontWeight: '600',
  },

  driverGpsBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },

  driverGpsBadgeLive: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.35)',
  },

  driverGpsBadgeOffline: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
  },

  driverGpsBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  map: { height: 230, width: '100%' },

  smartDispatchSection: {
    backgroundColor: '#101010',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.28)',
    padding: 18,
    marginBottom: 20,
  },
  smartDispatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  smartDispatchTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  smartDispatchSubtitle: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  smartDispatchStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  smartDispatchStatCard: {
    width: '48%',
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    padding: 14,
  },
  smartDispatchStatValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  smartDispatchStatLabel: {
    color: '#AAA',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  businessAlertsWrap: {
    gap: 8,
    marginBottom: 16,
  },
  businessAlertChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  businessAlertText: {
    fontSize: 13,
    fontWeight: '800',
  },
  smartDispatchBlockTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
    marginTop: 4,
  },
  heatZonesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  heatZoneCard: {
    width: '48%',
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    padding: 12,
  },
  heatZoneDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 8,
  },
  heatZoneName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  heatZoneLevel: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  priorityRideCard: {
    backgroundColor: card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: border,
    padding: 14,
    marginBottom: 12,
  },
  priorityRideTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  priorityRideClient: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  priorityRideRoute: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  priorityRidePrice: {
    color: gold,
    fontSize: 15,
    fontWeight: '900',
  },
  priorityBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  recommendedDriverBox: {
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.22)',
    padding: 12,
    marginBottom: 12,
  },
  recommendedDriverTitle: {
    color: gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  recommendedDriverName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 6,
  },
  recommendedDriverMeta: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  recommendedDriverEmpty: {
    backgroundColor: '#151515',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#242424',
  },
  recommendedDriverEmptyText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
  },
  smartAssignBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: gold,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  smartAssignBtnInline: {
    flex: 1,
    minWidth: 130,
    height: 48,
    borderRadius: 16,
    backgroundColor: gold,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  smartAssignBtnLoading: {
    opacity: 0.85,
  },
  smartAssignText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },
  smartAssignTextInline: {
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
  },

  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    flexWrap: 'wrap',
  },

  filterBtn: {
    paddingHorizontal: 15,
    height: 42,
    borderRadius: 16,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  filterBtnActive: {
    backgroundColor: gold,
    borderColor: gold,
  },

  filterText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },

  filterTextActive: { color: '#111' },

  filterCount: {
    color: gold,
    fontSize: 11,
    fontWeight: '900',
  },

  liveSectionTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
    marginTop: 4,
  },

  tourismSection: {
    marginTop: 8,
    marginBottom: 24,
  },

  tourismSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },

  tourismSectionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: tourismGlow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  tourismSectionTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },

  tourismSectionSubtitle: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  tourismCountBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: tourismGlow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  tourismCountBadgeText: {
    color: tourismGreen,
    fontSize: 14,
    fontWeight: '900',
  },

  tourismEmptyCard: {
    backgroundColor: tourismCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.18)',
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },

  tourismEmptyText: {
    color: '#8A8A8A',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  tourismAnalyticsCard: {
    backgroundColor: tourismCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.24)',
    padding: 18,
    overflow: 'hidden',
    shadowColor: tourismGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
  },

  tourismAnalyticsGlow: {
    position: 'absolute',
    top: -28,
    right: -20,
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: tourismGlow,
  },

  tourismAnalyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },

  tourismAnalyticsStatCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },

  tourismAnalyticsStatValue: {
    color: tourismGreen,
    fontSize: 16,
    fontWeight: '900',
  },

  tourismAnalyticsStatLabel: {
    color: '#8A8A8A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },

  tourismAnalyticsProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 14,
  },

  tourismAnalyticsProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: tourismGreen,
  },

  tourismAnalyticsRevenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(139,197,63,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.18)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },

  tourismAnalyticsRevenueLabel: {
    color: '#8A8A8A',
    fontSize: 11,
    fontWeight: '700',
  },

  tourismAnalyticsRevenueValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },

  tourismAnalyticsHighlightCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.16)',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
  },

  tourismAnalyticsBestSellerBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tourismGreen,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },

  tourismAnalyticsBestSellerText: {
    color: '#111',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  tourismAnalyticsTopGuideBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tourismGlow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.24)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },

  tourismAnalyticsTopGuideText: {
    color: tourismGreen,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  tourismAnalyticsHighlightTitle: {
    color: '#8A8A8A',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },

  tourismAnalyticsHighlightValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },

  tourismAnalyticsHighlightMeta: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '600',
  },

  tourismBookingCard: {
    backgroundColor: tourismCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.18)',
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: tourismGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },

  tourismBookingGlow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: tourismGlow,
  },

  tourismBookingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 10,
  },

  tourismBookingTopBadges: {
    alignItems: 'flex-end',
    gap: 8,
  },

  tourismBookingId: {
    color: tourismGreen,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  tourismBookingTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },

  tourismSharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tourismGlow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  tourismSharedBadgeText: {
    color: tourismGreen,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  tourismStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },

  tourismStatusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'capitalize',
  },

  tourismModeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },

  tourismModeBadgeText: {
    color: '#D4D4D4',
    fontSize: 12,
    fontWeight: '800',
  },

  tourismInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    paddingVertical: 11,
    gap: 12,
  },

  tourismInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },

  tourismInfoLabel: {
    color: '#8A8A8A',
    fontSize: 13,
    fontWeight: '700',
  },

  tourismInfoValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
  },

  tourismParticipantsSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },

  tourismParticipantsTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },

  tourismParticipantsEmpty: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '700',
  },

  tourismParticipantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },

  tourismParticipantAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: tourismGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },

  tourismParticipantTextWrap: {
    flex: 1,
  },

  tourismParticipantName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },

  tourismParticipantMeta: {
    color: '#8A8A8A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  tourismParticipantBooking: {
    color: tourismGreen,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },

  tourismParticipantStatusPill: {
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  tourismParticipantStatusText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '900',
  },

  tourismAssignmentSummary: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },

  tourismAssignmentSummaryTitle: {
    color: tourismGreen,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },

  tourismAssignmentConfirmedBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tourismGlow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },

  tourismAssignmentConfirmedText: {
    color: tourismGreen,
    fontSize: 11,
    fontWeight: '900',
  },

  tourismAssignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tourismGreen,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 14,
    shadowColor: tourismGreen,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },

  tourismAssignBtnText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },

  tourismTrackingSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    paddingTop: 12,
  },

  tourismTrackingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  tourismTrackingToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  tourismTrackingToggleTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },

  tourismTrackingToggleSubtitle: {
    color: '#8A8A8A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  tourismTrackingCurrentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },

  tourismTrackingCurrentBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  tourismTrackingCurrentText: {
    fontSize: 11,
    fontWeight: '900',
  },

  tourismTrackingCurrentMeta: {
    color: '#8A8A8A',
    fontSize: 11,
    fontWeight: '700',
  },

  tourismTrackingPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },

  tourismTrackingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#111',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },

  tourismTrackingBtnText: {
    color: '#BDBDBD',
    fontSize: 11,
    fontWeight: '800',
  },

  tourismAnnouncementSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    paddingTop: 12,
  },

  tourismAnnouncementToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  tourismAnnouncementToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  tourismAnnouncementToggleTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },

  tourismAnnouncementToggleSubtitle: {
    color: '#8A8A8A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  tourismAnnouncementPanel: {
    marginTop: 12,
    gap: 8,
  },

  tourismAnnouncementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.22)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  tourismAnnouncementBtnBadge: {
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  tourismAnnouncementBtnBadgeText: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  tourismAnnouncementBtnTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 3,
  },

  tourismAnnouncementBtnText: {
    color: '#8A8A8A',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },

  tourismReviewsSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    paddingTop: 12,
  },

  tourismReviewsTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },

  tourismReviewsEmpty: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '700',
  },

  tourismReviewsStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },

  tourismReviewsStatCard: {
    flex: 1,
    backgroundColor: 'rgba(139,197,63,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.16)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },

  tourismReviewsStatValue: {
    color: tourismGreen,
    fontSize: 18,
    fontWeight: '900',
  },

  tourismReviewsStatLabel: {
    color: '#8A8A8A',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },

  tourismReviewsLatestSection: {
    gap: 8,
  },

  tourismReviewsLatestTitle: {
    color: '#D4D4D4',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },

  tourismReviewCommentCard: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  tourismReviewCommentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },

  tourismReviewCommentName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },

  tourismReviewCommentRating: {
    color: tourismGreen,
    fontSize: 12,
    fontWeight: '900',
  },

  tourismReviewCommentMeta: {
    color: '#8A8A8A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },

  tourismReviewCommentText: {
    color: '#D4D4D4',
    fontSize: 12,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 17,
  },

  tourismReviewCommentTextMuted: {
    color: '#666',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },

  tourismMemoriesSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    paddingTop: 12,
  },

  tourismMemoriesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  tourismMemoriesTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },

  tourismMemoriesCount: {
    color: '#8A8A8A',
    fontSize: 11,
    fontWeight: '700',
  },

  tourismMemoriesEmpty: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },

  tourismMemoriesGalleryContent: {
    gap: 10,
    paddingBottom: 12,
  },

  tourismMemoryCard: {
    width: 140,
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.18)',
  },

  tourismMemoryImage: {
    width: '100%',
    height: '100%',
  },

  tourismMemoryOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  tourismMemoryOfficialBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(245,158,11,0.92)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  tourismMemoryOfficialBadgeText: {
    color: '#111',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  tourismMemoryContent: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
  },

  tourismMemoryName: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },

  tourismMemoryCaption: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 14,
  },

  tourismMemoriesCaptionLabel: {
    color: '#D4D4D4',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },

  tourismMemoriesCaptionInput: {
    minHeight: 40,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.16)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },

  tourismMemoriesAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tourismGreen,
    borderRadius: 14,
    paddingVertical: 12,
    shadowColor: tourismGreen,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 6,
  },

  tourismMemoriesAddBtnText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },

  tourismCheckInSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    paddingTop: 12,
  },

  tourismCheckInTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },

  tourismCheckInEmpty: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '700',
  },

  tourismCheckInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.14)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },

  tourismCheckInAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: tourismGlow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.2)',
  },

  tourismCheckInTextWrap: {
    flex: 1,
  },

  tourismCheckInName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },

  tourismCheckInTicket: {
    color: tourismGreen,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.4,
  },

  tourismCheckInStatus: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },

  tourismCheckInStatusValidated: {
    color: tourismGreen,
  },

  tourismCheckInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tourismGreen,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  tourismCheckInBtnText: {
    color: '#111',
    fontSize: 10,
    fontWeight: '900',
  },

  tourismCheckInValidatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tourismGreen,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  tourismCheckInValidatedBadgeText: {
    color: '#111',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  tourismPaymentSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    paddingTop: 12,
  },

  tourismPaymentTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },

  tourismPaymentEmpty: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '700',
  },

  tourismPaymentRow: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.14)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },

  tourismPaymentRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  tourismPaymentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: tourismGlow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.2)',
  },

  tourismPaymentTextWrap: {
    flex: 1,
  },

  tourismPaymentName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },

  tourismPaymentMeta: {
    color: tourismGreen,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  tourismPaymentMethod: {
    color: '#8A8A8A',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },

  tourismPaymentStatus: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },

  tourismPaymentBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  tourismPaymentBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  tourismPaymentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },

  tourismPaymentDepositBtn: {
    flex: 1,
    minWidth: 140,
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
  },

  tourismPaymentDepositBtnText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },

  tourismPaymentFullBtn: {
    flex: 1,
    minWidth: 140,
    backgroundColor: tourismGreen,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
  },

  tourismPaymentFullBtnText: {
    color: '#111',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },

  tourismPaymentValidatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: tourismGreen,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 10,
    alignSelf: 'flex-start',
  },

  tourismPaymentValidatedBadgeText: {
    color: '#111',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  tourismAssignmentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },

  tourismAssignmentPanel: {
    backgroundColor: '#0D0D0D',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    padding: 18,
    overflow: 'hidden',
    shadowColor: tourismGreen,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },

  tourismAssignmentPanelGlow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: tourismGlow,
  },

  tourismAssignmentPanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },

  tourismAssignmentPanelTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  tourismAssignmentPanelSubtitle: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  tourismAssignmentCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  tourismAssignmentSection: {
    marginBottom: 14,
  },

  tourismAssignmentSectionTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },

  tourismAssignmentOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  tourismAssignmentOptionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  tourismAssignmentOptionChipActive: {
    borderColor: 'rgba(139,197,63,0.45)',
    backgroundColor: tourismGlow,
  },

  tourismAssignmentOptionText: {
    color: '#BDBDBD',
    fontSize: 12,
    fontWeight: '700',
  },

  tourismAssignmentOptionTextActive: {
    color: tourismGreen,
    fontWeight: '900',
  },

  tourismAssignmentSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tourismGreen,
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 6,
  },

  tourismAssignmentSaveBtnText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },

  tourismActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },

  tourismConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: tourismGreen,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    shadowColor: tourismGreen,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },

  tourismConfirmBtnText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },

  tourismCancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3A1515',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },

  tourismCancelBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },

  tourismActionDisabled: {
    opacity: 0.6,
  },

  requestTopBadges: {
    alignItems: 'flex-end',
    gap: 8,
  },

  driverOnlineBadge: {
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  driverOnlineBadgeOn: {
    backgroundColor: 'rgba(34,197,94,0.18)',
  },

  driverOnlineBadgeOff: {
    backgroundColor: 'rgba(239,68,68,0.18)',
  },

  driverOnlineBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  requestCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    marginBottom: 16,
  },

  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    gap: 10,
  },

  requestId: {
    color: gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },

  clientName: {
    color: '#FFF',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 4,
  },

  statusBadge: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  pendingBadge: { backgroundColor: 'rgba(255,165,0,0.15)' },
  assignedBadge: { backgroundColor: 'rgba(255,215,0,0.15)' },
  acceptedBadge: { backgroundColor: 'rgba(34,197,94,0.15)' },
  enRouteBadge: { backgroundColor: 'rgba(0,140,255,0.15)' },
  arrivedBadge: { backgroundColor: 'rgba(245,158,11,0.15)' },
  finishedBadge: { backgroundColor: 'rgba(74,222,128,0.15)' },
  rejectedBadge: { backgroundColor: 'rgba(239,68,68,0.18)' },
  expiredBadge: { backgroundColor: 'rgba(107,114,128,0.15)' },

  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
    paddingVertical: 12,
    gap: 12,
  },

  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },

  infoLabel: {
    color: '#BEBEBE',
    fontSize: 13,
  },

  infoValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 10,
  },

  actionBtn: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#191919',
    justifyContent: 'center',
    alignItems: 'center',
  },

  assignBtn: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: gold,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },

  assignText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  finishBtn: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#4ADE80',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },

  finishText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  trackingBtn: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: gold,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },

  trackingText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  driversSection: {
  marginBottom: 22,
},

sectionTitle: {
  color: '#FFF',
  fontSize: 20,
  fontWeight: '900',
  marginBottom: 14,
},

driverLiveCard: {
  backgroundColor: '#111',
  borderRadius: 20,
  borderWidth: 1,
  borderColor: '#222',
  padding: 16,
  marginBottom: 12,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

driverLiveName: {
  color: '#FFF',
  fontSize: 16,
  fontWeight: '900',
},

driverStatus: {
  width: 12,
  height: 12,
  borderRadius: 6,
},

driverStatusText: {
  color: '#DDD',
  fontSize: 13,
  fontWeight: '700',
},

driverCar: {
  color: gold,
  fontSize: 13,
  fontWeight: '800',
},

driverPlate: {
  color: '#AAA',
  fontSize: 12,
  marginTop: 4,
},

  driverRequestsSection: {
    marginBottom: 24,
  },

  driverRequestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },

  driverRequestsSubtitle: {
    color: '#AFAFAF',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },

  driverRequestsEmpty: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    padding: 28,
    alignItems: 'center',
  },

  driverRequestsEmptyText: {
    color: '#AAA',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '600',
  },

  driverRequestCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.22)',
    padding: 18,
    marginBottom: 14,
  },

  driverRequestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  driverRequestAvatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#171307',
    borderWidth: 2,
    borderColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  driverRequestAvatar: {
    width: '100%',
    height: '100%',
  },

  driverRequestName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  driverRequestPhone: {
    color: '#AFAFAF',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '700',
  },

  driverValidationBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  driverValidationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  driverValidationBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },

  driverRequestMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },

  driverRequestMetaChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  driverRequestMetaText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  driverRequestActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },

  driverApproveBtn: {
    flexGrow: 1,
    minWidth: '45%',
    height: 48,
    borderRadius: 16,
    backgroundColor: gold,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },

  driverApproveBtnText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  driverSuspendBtn: {
    flexGrow: 1,
    minWidth: '45%',
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },

  driverSuspendBtnText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  driverRefuseBtn: {
    flexGrow: 1,
    minWidth: '45%',
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },

  driverRefuseBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  driverProfileBtn: {
    flexGrow: 1,
    minWidth: '45%',
    height: 48,
    borderRadius: 16,
    backgroundColor: gold,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },

  driverProfileBtnText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  driverActionDisabled: {
    opacity: 0.55,
  },

  driverProcessingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },

  driverProcessingText: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: '700',
  },
});