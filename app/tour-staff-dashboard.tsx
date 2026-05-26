import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  collection,
  collectionGroup,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getFirestoreDb, getTourGroupDocRef } from '@/firebase/firestore';
import { devError } from '@/utils/devLog';
import { useAuthLogout } from '@/hooks/useAuthLogout';
import {
  DEFAULT_GUIDE_SENDER_NAME,
  sendTourGroupMessage,
  TOUR_GROUP_GUIDE_ANNOUNCEMENTS,
} from '@/services/tourGroupChat';
import {
  formatParticipantStatusLabel,
  formatTourGroupNumber,
  getMockTrackingEta,
  getMockTrackingLocation,
  getTourGroupTrackingConfig,
  normalizeTourGroupParticipants,
  normalizeTourGroupTrackingStatus,
  TOUR_GROUP_TRACKING_OPTIONS,
  type TourGroupParticipant,
  type TourGroupTrackingStatus,
} from '@/services/tourGroupMatching';
import {
  getCheckInStatusLabel,
  normalizeTourCheckInStatus,
} from '@/services/tourGroupTicket';
import {
  getPaymentStatusLabel,
  normalizeTourPaymentStatus,
} from '@/services/tourGroupPayment';
import {
  formatTourWeatherTemperature,
  generateTourWeather,
  getGuideWeatherRecommendation,
  getTourWeatherGlowOpacity,
} from '@/services/tourWeather';
import {
  computeAssignedStaffAnalytics,
  formatAnalyticsRating,
  getReviewGroupIdFromPath,
  type TourAnalyticsGroup,
  type TourAnalyticsReview,
} from '@/services/tourAnalytics';

const green = '#8BC53F';
const bg = '#050505';
const card = '#0D0D0D';
const glow = 'rgba(139,197,63,0.18)';
const muted = '#8A8A8A';

const PLANNING_TIMELINE_STEPS = [
  { key: 'preparing', label: 'Préparation' },
  { key: 'on-the-way', label: 'Départ' },
  { key: 'arrived', label: 'Arrivée' },
  { key: 'in-tour', label: 'Circuit' },
  { key: 'completed', label: 'Terminé' },
] as const;

const TRACKING_SORT_WEIGHT: Record<string, number> = {
  'in-tour': 0,
  'on-the-way': 1,
  arrived: 2,
  preparing: 3,
  '': 4,
  completed: 5,
};

const TRACKING_PROGRESS_PERCENT: Record<string, number> = {
  preparing: 20,
  'on-the-way': 40,
  arrived: 60,
  'in-tour': 80,
  completed: 100,
  '': 10,
};

type StaffTourGroup = {
  id: string;
  experience?: string;
  date?: string;
  departure?: string;
  meetingPoint?: string;
  capacity?: number;
  booked?: number;
  remaining?: number;
  participants?: TourGroupParticipant[] | unknown[];
  assignedVehicle?: string;
  assignedDriver?: string;
  assignedGuide?: string;
  trackingStatus?: string;
  etaMinutes?: number;
  status?: string;
};

type StaffTourBooking = {
  id: string;
  checkInStatus?: string;
  paymentStatus?: string;
};

function isTodayGroupDate(dateValue?: string) {
  if (!dateValue) return false;
  const today = new Date();
  const todayLabel = today.toLocaleDateString('fr-FR');
  const normalized = dateValue.trim();
  if (normalized === todayLabel) return true;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return false;

  return (
    parsed.getDate() === today.getDate() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getFullYear() === today.getFullYear()
  );
}

function hasStaffAssignment(group: StaffTourGroup) {
  return Boolean(group.assignedDriver?.trim() || group.assignedGuide?.trim());
}

function getGroupOpsSummary(
  participants: TourGroupParticipant[],
  bookings: StaffTourBooking[],
) {
  let checkedIn = 0;
  let fullyPaid = 0;
  let depositPaid = 0;
  let unpaid = 0;

  participants.forEach((participant) => {
    const booking = bookings.find((item) => item.id === participant.bookingId);
    if (normalizeTourCheckInStatus(booking?.checkInStatus) === 'checked-in') {
      checkedIn += 1;
    }

    const paymentStatus = normalizeTourPaymentStatus(booking?.paymentStatus);
    if (paymentStatus === 'fully-paid') {
      fullyPaid += 1;
    } else if (paymentStatus === 'deposit-paid') {
      depositPaid += 1;
    } else {
      unpaid += 1;
    }
  });

  return {
    checkedIn,
    total: participants.length,
    fullyPaid,
    depositPaid,
    unpaid,
  };
}

function parseDepartureMinutes(value?: string) {
  if (!value) return 24 * 60;
  const match = value.match(/(\d{1,2})[:h](\d{2})/i);
  if (!match) return 24 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatDepartureLabel(value?: string) {
  if (!value) return '—';
  const match = value.match(/(\d{1,2})[:h](\d{2})/i);
  if (!match) return value;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function getTrackingSortWeight(status: string) {
  return TRACKING_SORT_WEIGHT[status] ?? 4;
}

function getTrackingProgressPercent(status: string) {
  return TRACKING_PROGRESS_PERCENT[status] ?? 10;
}

function isGroupInProgress(status: string) {
  return status === 'in-tour' || status === 'on-the-way' || status === 'arrived';
}

function sortGroupsForDailyPlanning(groups: StaffTourGroup[]) {
  return [...groups].sort((a, b) => {
    const departureDiff =
      parseDepartureMinutes(a.departure) - parseDepartureMinutes(b.departure);
    if (departureDiff !== 0) return departureDiff;

    const statusA = normalizeTourGroupTrackingStatus(a.trackingStatus) || '';
    const statusB = normalizeTourGroupTrackingStatus(b.trackingStatus) || '';
    return getTrackingSortWeight(statusA) - getTrackingSortWeight(statusB);
  });
}

function getPlanningCounters(groups: StaffTourGroup[]) {
  let completed = 0;
  let inProgress = 0;
  let upcoming = 0;

  groups.forEach((group) => {
    const status = normalizeTourGroupTrackingStatus(group.trackingStatus) || '';
    if (status === 'completed') {
      completed += 1;
    } else if (isGroupInProgress(status)) {
      inProgress += 1;
    } else {
      upcoming += 1;
    }
  });

  return { completed, inProgress, upcoming };
}

function getNextDepartureGroup(groups: StaffTourGroup[]) {
  const candidates = sortGroupsForDailyPlanning(groups).filter((group) => {
    const status = normalizeTourGroupTrackingStatus(group.trackingStatus) || '';
    return status !== 'completed';
  });

  return candidates[0] ?? null;
}

function getTimelineStepIndex(status: string) {
  switch (status) {
    case 'on-the-way':
      return 1;
    case 'arrived':
      return 2;
    case 'in-tour':
      return 3;
    case 'completed':
      return 4;
    default:
      return 0;
  }
}

export default function TourStaffDashboardScreen() {
  const { confirmLogout } = useAuthLogout();
  const [tourGroups, setTourGroups] = useState<StaffTourGroup[]>([]);
  const [tourBookings, setTourBookings] = useState<StaffTourBooking[]>([]);
  const [tourReviews, setTourReviews] = useState<TourAnalyticsReview[]>([]);

  useEffect(() => {
    let firestoreDb;

    try {
      firestoreDb = getFirestoreDb();
    } catch (error) {
      console.error('Tour staff Firestore init error:', error);
      setTourGroups([]);
      setTourBookings([]);
      setTourReviews([]);
      return undefined;
    }

    const groupsQuery = query(
      collection(firestoreDb, 'tourGroups'),
      orderBy('createdAt', 'desc'),
    );
    const bookingsQuery = query(
      collection(firestoreDb, 'tourBookings'),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribeGroups = onSnapshot(
      groupsQuery,
      (snapshot) => {
        const groups = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as StaffTourGroup[];
        setTourGroups(groups);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - tour-staff-dashboard - StaffTourGroups]', error);
      },
    );

    const unsubscribeBookings = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const bookings = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as StaffTourBooking[];
        setTourBookings(bookings);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - tour-staff-dashboard - StaffTourBookings]', error);
      },
    );

    const unsubscribeReviews = onSnapshot(
      query(collectionGroup(firestoreDb, 'reviews')),
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
        devError('[SNAPSHOT DENIED - tour-staff-dashboard - StaffTourReviews]', error);
      },
    );

    return () => {
      unsubscribeGroups();
      unsubscribeBookings();
      unsubscribeReviews();
    };
  }, []);

  const assignedGroups = useMemo(
    () => tourGroups.filter((group) => hasStaffAssignment(group)),
    [tourGroups],
  );

  const plannedGroups = useMemo(
    () => sortGroupsForDailyPlanning(assignedGroups),
    [assignedGroups],
  );

  const planningCounters = useMemo(
    () => getPlanningCounters(assignedGroups),
    [assignedGroups],
  );

  const nextDepartureGroup = useMemo(
    () => getNextDepartureGroup(assignedGroups),
    [assignedGroups],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <MaterialCommunityIcons name="account-group-outline" size={18} color={green} />
            <Text style={styles.headerTitle}>Tourisme Staff</Text>
          </View>

          <TouchableOpacity style={styles.headerBtn} onPress={confirmLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={20} color={green} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroTitle}>Groupes attribués</Text>
          <Text style={styles.heroSub}>
            Gérez le tracking, les participants et les annonces guide pour vos expériences PROTAXI.
          </Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{assignedGroups.length}</Text>
              <Text style={styles.heroStatLabel}>Groupes actifs</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>
                {assignedGroups.reduce(
                  (sum, group) => sum + normalizeTourGroupParticipants(group.participants).length,
                  0,
                )}
              </Text>
              <Text style={styles.heroStatLabel}>Participants</Text>
            </View>
          </View>
        </View>

        <DailyWeatherSection groups={plannedGroups} />

        <StaffGuideAnalyticsSection groups={assignedGroups} reviews={tourReviews} />

        <DailyPlanningSection
          groups={plannedGroups}
          counters={planningCounters}
          nextDepartureGroup={nextDepartureGroup}
        />

        <Text style={styles.detailSectionTitle}>Détail opérationnel</Text>

        {assignedGroups.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={28} color={green} />
            <Text style={styles.emptyTitle}>Aucun groupe attribué</Text>
            <Text style={styles.emptyText}>
              Les groupes apparaîtront ici dès qu&apos;un chauffeur ou un guide sera assigné par
              l&apos;admin.
            </Text>
          </View>
        ) : (
          assignedGroups.map((group) => (
            <StaffGroupCard
              key={group.id}
              group={group}
              relatedBookings={tourBookings}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StaffGuideAnalyticsSection({
  groups,
  reviews,
}: {
  groups: StaffTourGroup[];
  reviews: TourAnalyticsReview[];
}) {
  const analyticsGroups = groups as TourAnalyticsGroup[];
  const analytics = useMemo(
    () => computeAssignedStaffAnalytics(analyticsGroups, reviews, isTodayGroupDate),
    [analyticsGroups, reviews],
  );

  return (
    <View style={styles.analyticsSection}>
      <View style={styles.analyticsSectionHeader}>
        <View>
          <Text style={styles.analyticsSectionTitle}>Performance guide</Text>
          <Text style={styles.analyticsSectionSub}>Analytics live sur vos groupes attribués</Text>
        </View>
        {analytics.satisfactionScore >= 4 ? (
          <View style={styles.analyticsTopGuideBadge}>
            <Ionicons name="ribbon-outline" size={12} color={green} />
            <Text style={styles.analyticsTopGuideBadgeText}>TOP GUIDE</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.analyticsCard}>
        <View style={styles.analyticsGlow} />

        <View style={styles.analyticsStatsRow}>
          <View style={styles.analyticsStatCard}>
            <Text style={styles.analyticsStatValue}>
              {formatAnalyticsRating(analytics.satisfactionScore)}/5
            </Text>
            <Text style={styles.analyticsStatLabel}>Score satisfaction guide</Text>
          </View>
          <View style={styles.analyticsStatCard}>
            <Text style={styles.analyticsStatValue}>{analytics.completedToday}</Text>
            <Text style={styles.analyticsStatLabel}>Terminés aujourd&apos;hui</Text>
          </View>
          <View style={styles.analyticsStatCard}>
            <Text style={styles.analyticsStatValue}>
              {formatAnalyticsRating(analytics.averageExcursionRating)}/5
            </Text>
            <Text style={styles.analyticsStatLabel}>Note moyenne excursions</Text>
          </View>
        </View>

        <View style={styles.analyticsProgressTrack}>
          <View
            style={[
              styles.analyticsProgressFill,
              {
                width: `${Math.min(100, Math.round((analytics.satisfactionScore / 5) * 100))}%`,
              },
            ]}
          />
        </View>

        <Text style={styles.analyticsMetaText}>
          {analytics.reviewCount} avis • {analytics.groupCount} groupe
          {analytics.groupCount > 1 ? 's' : ''} attribué{analytics.groupCount > 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

function DailyWeatherSection({ groups }: { groups: StaffTourGroup[] }) {
  if (groups.length === 0) {
    return (
      <View style={styles.weatherSection}>
        <Text style={styles.weatherSectionTitle}>Météo du jour</Text>
        <View style={styles.weatherEmptyCard}>
          <Text style={styles.weatherEmptyText}>Aucune condition météo à afficher.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.weatherSection}>
      <View style={styles.weatherSectionHeader}>
        <View>
          <Text style={styles.weatherSectionTitle}>Météo du jour</Text>
          <Text style={styles.weatherSectionSub}>Conditions excursion live par groupe</Text>
        </View>
        <View style={styles.weatherSectionBadge}>
          <Ionicons name="partly-sunny-outline" size={14} color={green} />
          <Text style={styles.weatherSectionBadgeText}>{groups.length} groupe{groups.length > 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={styles.weatherCardsList}>
        {groups.map((group) => (
          <StaffGroupWeatherCard key={`weather-${group.id}`} group={group} />
        ))}
      </View>
    </View>
  );
}

function StaffGroupWeatherCard({ group }: { group: StaffTourGroup }) {
  const trackingStatus = normalizeTourGroupTrackingStatus(group.trackingStatus) || 'preparing';
  const isInTour = trackingStatus === 'in-tour';
  const weather = useMemo(
    () =>
      generateTourWeather({
        departure: group.departure,
        trackingStatus,
        experience: group.experience,
      }),
    [group.departure, group.experience, trackingStatus],
  );
  const glowOpacity = useRef(new Animated.Value(getTourWeatherGlowOpacity(trackingStatus))).current;
  const weatherIcon = weather.icon as keyof typeof Ionicons.glyphMap;
  const guideRecommendation = getGuideWeatherRecommendation(weather);

  useEffect(() => {
    if (!isInTour) {
      glowOpacity.setValue(getTourWeatherGlowOpacity(trackingStatus));
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.58,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: false,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [glowOpacity, isInTour, trackingStatus]);

  return (
    <Animated.View
      style={[
        styles.weatherGroupCard,
        {
          borderColor: weather.border,
          shadowColor: weather.color,
          shadowOpacity: glowOpacity,
        },
        isInTour && styles.weatherGroupCardLive,
      ]}
    >
      <View style={[styles.weatherGroupGlow, { backgroundColor: weather.glow }]} />

      <View style={styles.weatherGroupTopRow}>
        <View style={styles.weatherGroupDeparture}>
          <Ionicons name="time-outline" size={13} color={green} />
          <Text style={styles.weatherGroupDepartureText}>{formatDepartureLabel(group.departure)}</Text>
        </View>
        <Text style={[styles.weatherGroupTemperature, { color: weather.color }]}>
          {formatTourWeatherTemperature(weather.temperatureC)}
        </Text>
      </View>

      <Text style={styles.weatherGroupTitle} numberOfLines={2}>
        {group.experience || 'Expérience PROTAXI'}
      </Text>

      <View style={[styles.weatherGroupBadge, { backgroundColor: weather.glow, borderColor: weather.border }]}>
        <Ionicons name={weatherIcon} size={14} color={weather.color} />
        <Text style={[styles.weatherGroupBadgeText, { color: weather.color }]}>{weather.badge}</Text>
      </View>

      <Text style={styles.weatherGroupRecommendation}>{guideRecommendation}</Text>
    </Animated.View>
  );
}

function DailyPlanningSection({
  groups,
  counters,
  nextDepartureGroup,
}: {
  groups: StaffTourGroup[];
  counters: { completed: number; inProgress: number; upcoming: number };
  nextDepartureGroup: StaffTourGroup | null;
}) {
  const nextParticipants = nextDepartureGroup
    ? normalizeTourGroupParticipants(nextDepartureGroup.participants).length ||
      Number(nextDepartureGroup.booked || 0)
    : 0;
  const nextCapacity = Number(nextDepartureGroup?.capacity || 8);
  const nextRemaining = Number(
    nextDepartureGroup?.remaining ?? nextCapacity - nextParticipants,
  );

  return (
    <View style={styles.planningSection}>
      <View style={styles.planningHeaderRow}>
        <View>
          <Text style={styles.planningTitle}>Planning du jour</Text>
          <Text style={styles.planningSub}>Centre opérationnel excursion PROTAXI</Text>
        </View>
        <View style={styles.planningLiveBadge}>
          <View style={styles.planningLiveDot} />
          <Text style={styles.planningLiveText}>LIVE</Text>
        </View>
      </View>

      <View style={styles.planningCountersRow}>
        <View style={styles.planningCounterCard}>
          <Text style={styles.planningCounterValue}>{counters.upcoming}</Text>
          <Text style={styles.planningCounterLabel}>À venir</Text>
        </View>
        <View style={[styles.planningCounterCard, styles.planningCounterCardActive]}>
          <Text style={[styles.planningCounterValue, styles.planningCounterValueActive]}>
            {counters.inProgress}
          </Text>
          <Text style={styles.planningCounterLabel}>En cours</Text>
        </View>
        <View style={styles.planningCounterCard}>
          <Text style={styles.planningCounterValue}>{counters.completed}</Text>
          <Text style={styles.planningCounterLabel}>Terminés</Text>
        </View>
      </View>

      {nextDepartureGroup ? (
        <View style={styles.nextDepartureCard}>
          <View style={styles.nextDepartureGlow} />
          <Text style={styles.nextDepartureLabel}>Prochain départ</Text>
          <View style={styles.nextDepartureTopRow}>
            <Text style={styles.nextDepartureTime}>
              {formatDepartureLabel(nextDepartureGroup.departure)}
            </Text>
            <Text style={styles.nextDepartureExperience} numberOfLines={2}>
              {nextDepartureGroup.experience || 'Expérience PROTAXI'}
            </Text>
          </View>
          <Text style={styles.nextDepartureMeta}>
            {nextParticipants}/{nextCapacity} places • {nextRemaining} restantes •{' '}
            {nextDepartureGroup.assignedDriver || 'Chauffeur —'}
          </Text>
        </View>
      ) : null}

      {groups.length === 0 ? (
        <View style={styles.planningEmptyCard}>
          <Text style={styles.planningEmptyText}>Aucun groupe planifié pour aujourd&apos;hui.</Text>
        </View>
      ) : (
        <View style={styles.planningTimelineList}>
          {groups.map((group) => (
            <PlanningGroupTimelineCard key={`planning-${group.id}`} group={group} />
          ))}
        </View>
      )}
    </View>
  );
}

function PlanningGroupTimelineCard({ group }: { group: StaffTourGroup }) {
  const pulse = useRef(new Animated.Value(0.35)).current;
  const participants = normalizeTourGroupParticipants(group.participants);
  const participantsCount = participants.length || Number(group.booked || 0);
  const capacity = Number(group.capacity || 8);
  const trackingStatus = normalizeTourGroupTrackingStatus(group.trackingStatus) || 'preparing';
  const trackingConfig = getTourGroupTrackingConfig(trackingStatus);
  const progress = getTrackingProgressPercent(trackingStatus);
  const activeStepIndex = getTimelineStepIndex(trackingStatus);
  const isLiveNow = trackingStatus === 'in-tour';
  const etaMinutes = Number(group.etaMinutes ?? getMockTrackingEta(trackingStatus as TourGroupTrackingStatus));
  const weather = useMemo(
    () =>
      generateTourWeather({
        departure: group.departure,
        trackingStatus,
        experience: group.experience,
      }),
    [group.departure, group.experience, trackingStatus],
  );
  const weatherIcon = weather.icon as keyof typeof Ionicons.glyphMap;

  useEffect(() => {
    if (!isLiveNow) {
      pulse.setValue(0.35);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: false,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [isLiveNow, pulse]);

  return (
    <Animated.View
      style={[
        styles.planningGroupCard,
        isLiveNow && {
          borderColor: weather.border,
          shadowColor: weather.color,
          shadowOpacity: pulse,
        },
      ]}
    >
      <View style={[styles.planningWeatherGlow, { backgroundColor: weather.glow }]} />

      <View style={styles.planningGroupTopRow}>
        <View style={styles.planningDeparturePill}>
          <Ionicons name="time-outline" size={14} color={green} />
          <Text style={styles.planningDepartureText}>
            {formatDepartureLabel(group.departure)}
          </Text>
        </View>
        {isLiveNow ? (
          <View style={styles.liveNowBadge}>
            <View style={styles.liveNowDot} />
            <Text style={styles.liveNowText}>En cours maintenant</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.planningGroupTitle}>{group.experience || 'Expérience PROTAXI'}</Text>
      <Text style={styles.planningGroupMeta}>
        {group.assignedDriver || '—'} • {group.assignedGuide || '—'} • {participantsCount}/{capacity}{' '}
        participants
      </Text>
      <Text style={styles.planningGroupEta}>ETA {etaMinutes} min • {trackingConfig.label}</Text>

      <View style={styles.planningWeatherRow}>
        <Ionicons name={weatherIcon} size={14} color={weather.color} />
        <Text style={[styles.planningWeatherText, { color: weather.color }]}>
          {formatTourWeatherTemperature(weather.temperatureC)} • {weather.badge}
        </Text>
      </View>

      <View style={styles.planningProgressTrack}>
        <View
          style={[
            styles.planningProgressFill,
            {
              width: `${progress}%`,
              backgroundColor: trackingConfig.color,
            },
          ]}
        />
      </View>
      <Text style={styles.planningProgressText}>{progress}% progression live</Text>

      <View style={styles.verticalTimeline}>
        {PLANNING_TIMELINE_STEPS.map((step, index) => {
          const isDone = index < activeStepIndex;
          const isActive = index === activeStepIndex;
          const isLast = index === PLANNING_TIMELINE_STEPS.length - 1;

          return (
            <View key={step.key} style={styles.timelineStepRow}>
              <View style={styles.timelineRailCol}>
                <View
                  style={[
                    styles.timelineDot,
                    isDone && styles.timelineDotDone,
                    isActive && styles.timelineDotActive,
                  ]}
                />
                {!isLast ? (
                  <View
                    style={[
                      styles.timelineLine,
                      (isDone || isActive) && styles.timelineLineActive,
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.timelineContent}>
                <Text
                  style={[
                    styles.timelineStepLabel,
                    isActive && styles.timelineStepLabelActive,
                    isDone && styles.timelineStepLabelDone,
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

function StaffGroupCard({
  group,
  relatedBookings,
}: {
  group: StaffTourGroup;
  relatedBookings: StaffTourBooking[];
}) {
  const participants = normalizeTourGroupParticipants(group.participants);
  const participantsCount = participants.length || Number(group.booked || 0);
  const capacity = Number(group.capacity || 8);
  const remaining = Number(group.remaining ?? capacity - participantsCount);
  const trackingStatus = normalizeTourGroupTrackingStatus(group.trackingStatus);
  const trackingConfig = trackingStatus
    ? getTourGroupTrackingConfig(trackingStatus)
    : getTourGroupTrackingConfig('preparing');
  const opsSummary = getGroupOpsSummary(participants, relatedBookings);

  const [isUpdatingTracking, setIsUpdatingTracking] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);

  const updateGroupTracking = async (nextStatus: TourGroupTrackingStatus) => {
    const normalizedGroupId = group.id.trim();
    if (!normalizedGroupId) {
      Alert.alert('Tracking impossible', 'Identifiant de groupe manquant.');
      return;
    }

    setIsUpdatingTracking(true);

    try {
      await updateDoc(getTourGroupDocRef(normalizedGroupId), {
        trackingStatus: nextStatus,
        etaMinutes: getMockTrackingEta(nextStatus),
        liveLocation: getMockTrackingLocation(nextStatus),
        lastLocationUpdate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Tour staff tracking error:', error);
      Alert.alert(
        'Tracking impossible',
        'Le statut de trajet n\'a pas pu être mis à jour. Réessayez.',
      );
    } finally {
      setIsUpdatingTracking(false);
    }
  };

  const sendGuideAnnouncement = async (text: string) => {
    setIsSendingAnnouncement(true);

    try {
      await sendTourGroupMessage(group.id, {
        senderType: 'guide',
        senderName: DEFAULT_GUIDE_SENDER_NAME,
        text,
      });
    } catch (error) {
      console.error('Tour staff guide announcement error:', error);
      Alert.alert(
        'Annonce impossible',
        'Le message n\'a pas pu être envoyé au chat groupe. Réessayez.',
      );
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupGlow} />

      <View style={styles.groupTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.groupId}>{formatTourGroupNumber(group.id)}</Text>
          <Text style={styles.groupTitle}>{group.experience || 'Expérience PROTAXI'}</Text>
        </View>

        <View
          style={[
            styles.trackingBadge,
            {
              backgroundColor: trackingConfig.glow,
              borderColor: trackingConfig.border,
            },
          ]}
        >
          <Text style={[styles.trackingBadgeText, { color: trackingConfig.color }]}>
            {trackingConfig.label}
          </Text>
        </View>
      </View>

      <StaffInfoRow icon="calendar-outline" label="Date" value={group.date || '—'} />
      <StaffInfoRow icon="time-outline" label="Départ" value={group.departure || '—'} />
      <StaffInfoRow icon="location-outline" label="Rendez-vous" value={group.meetingPoint || '—'} />
      <StaffInfoRow
        icon="people-outline"
        label="Participants"
        value={`${participantsCount} / ${capacity}`}
      />
      <StaffInfoRow icon="ticket-outline" label="Places restantes" value={String(remaining)} />
      <StaffInfoRow icon="bus-outline" label="Véhicule" value={group.assignedVehicle || '—'} />
      <StaffInfoRow icon="person-outline" label="Chauffeur" value={group.assignedDriver || '—'} />
      <StaffInfoRow icon="map-outline" label="Guide" value={group.assignedGuide || '—'} />

      <View style={styles.opsSummaryCard}>
        <Text style={styles.opsSummaryTitle}>Paiement & check-in</Text>
        <Text style={styles.opsSummaryText}>
          Check-in {opsSummary.checkedIn}/{opsSummary.total} • Payé {opsSummary.fullyPaid} • Acompte{' '}
          {opsSummary.depositPaid} • Impayé {opsSummary.unpaid}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Actions rapides tracking</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trackingActionsRow}
      >
        {TOUR_GROUP_TRACKING_OPTIONS.map((option) => {
          const isActive = trackingStatus === option.status;
          const optionConfig = getTourGroupTrackingConfig(option.status);

          return (
            <TouchableOpacity
              key={option.status}
              style={[
                styles.trackingActionBtn,
                isActive && {
                  backgroundColor: optionConfig.glow,
                  borderColor: optionConfig.border,
                },
                isUpdatingTracking && styles.actionDisabled,
              ]}
              activeOpacity={0.85}
              disabled={isUpdatingTracking}
              onPress={() => updateGroupTracking(option.status)}
            >
              <Ionicons
                name={optionConfig.icon}
                size={14}
                color={isActive ? optionConfig.color : muted}
              />
              <Text
                style={[
                  styles.trackingActionText,
                  isActive && { color: optionConfig.color },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={styles.toggleSectionBtn}
        activeOpacity={0.85}
        onPress={() => setShowParticipants((value) => !value)}
      >
        <View style={styles.toggleSectionLeft}>
          <Ionicons name="people-outline" size={18} color={green} />
          <Text style={styles.toggleSectionTitle}>Participants</Text>
        </View>
        <Ionicons name={showParticipants ? 'chevron-up' : 'chevron-down'} size={18} color={green} />
      </TouchableOpacity>

      {showParticipants ? (
        <View style={styles.participantsPanel}>
          {participants.length === 0 ? (
            <Text style={styles.participantsEmpty}>Aucun participant enregistré.</Text>
          ) : (
            participants.map((participant, index) => {
              const relatedBooking = relatedBookings.find(
                (booking) => booking.id === participant.bookingId,
              );
              const checkInStatus = normalizeTourCheckInStatus(relatedBooking?.checkInStatus);
              const paymentStatus = normalizeTourPaymentStatus(relatedBooking?.paymentStatus);

              return (
                <View key={`${participant.bookingId}-${index}`} style={styles.participantRow}>
                  <View style={styles.participantAvatar}>
                    <Ionicons name="person-outline" size={15} color={green} />
                  </View>
                  <View style={styles.participantTextWrap}>
                    <Text style={styles.participantName}>{participant.displayName}</Text>
                    <Text style={styles.participantMeta}>
                      {participant.travelersCount} place{participant.travelersCount > 1 ? 's' : ''}
                      {' • '}
                      {formatParticipantStatusLabel(participant.status)}
                    </Text>
                    <Text style={styles.participantOps}>
                      {getCheckInStatusLabel(checkInStatus)} • {getPaymentStatusLabel(paymentStatus)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.toggleSectionBtn}
        activeOpacity={0.85}
        onPress={() => setShowAnnouncements((value) => !value)}
      >
        <View style={styles.toggleSectionLeft}>
          <MaterialCommunityIcons name="bullhorn-outline" size={18} color={green} />
          <Text style={styles.toggleSectionTitle}>Envoyer annonce</Text>
        </View>
        <Ionicons
          name={showAnnouncements ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={green}
        />
      </TouchableOpacity>

      {showAnnouncements ? (
        <View style={styles.announcementsPanel}>
          {TOUR_GROUP_GUIDE_ANNOUNCEMENTS.map((announcement) => (
            <TouchableOpacity
              key={announcement.label}
              style={[
                styles.announcementBtn,
                isSendingAnnouncement && styles.actionDisabled,
              ]}
              activeOpacity={0.85}
              disabled={isSendingAnnouncement}
              onPress={() => sendGuideAnnouncement(announcement.text)}
            >
              <View style={styles.announcementBadge}>
                <Text style={styles.announcementBadgeText}>GUIDE</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.announcementTitle}>{announcement.label}</Text>
                <Text style={styles.announcementText} numberOfLines={2}>
                  {announcement.text}
                </Text>
              </View>
              <Ionicons name="send-outline" size={16} color={green} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StaffInfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={15} color={green} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bg,
  },

  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 32,
  },

  header: {
    paddingTop: 12,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  heroCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    padding: 18,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },

  heroGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: glow,
  },

  heroTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },

  heroSub: {
    color: muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 19,
  },

  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },

  heroStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.14)',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },

  heroStatValue: {
    color: green,
    fontSize: 22,
    fontWeight: '900',
  },

  heroStatLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },

  emptyCard: {
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.16)',
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },

  emptyTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },

  emptyText: {
    color: muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },

  groupCard: {
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },

  groupGlow: {
    position: 'absolute',
    top: -24,
    left: -16,
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: glow,
  },

  groupTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },

  groupId: {
    color: green,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  groupTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4,
    lineHeight: 22,
  },

  trackingBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  trackingBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },

  infoLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
    width: 108,
  },

  infoValue: {
    color: '#D4D4D4',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  opsSummaryCard: {
    marginTop: 6,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  opsSummaryTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },

  opsSummaryText: {
    color: muted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },

  sectionLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },

  trackingActionsRow: {
    gap: 8,
    paddingBottom: 12,
  },

  trackingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.14)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  trackingActionText: {
    color: muted,
    fontSize: 11,
    fontWeight: '800',
  },

  toggleSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,197,63,0.1)',
    paddingTop: 12,
    marginTop: 4,
    marginBottom: 8,
  },

  toggleSectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  toggleSectionTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },

  participantsPanel: {
    gap: 8,
    marginBottom: 8,
  },

  participantsEmpty: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
  },

  participantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: glow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.2)',
  },

  participantTextWrap: {
    flex: 1,
  },

  participantName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },

  participantMeta: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  participantOps: {
    color: green,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },

  announcementsPanel: {
    gap: 8,
    marginBottom: 4,
  },

  announcementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.14)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  announcementBadge: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  announcementBadgeText: {
    color: '#A78BFA',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  announcementTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },

  announcementText: {
    color: muted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },

  actionDisabled: {
    opacity: 0.55,
  },

  detailSectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },

  analyticsSection: {
    marginBottom: 18,
  },

  analyticsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },

  analyticsSectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  analyticsSectionSub: {
    color: muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  analyticsTopGuideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.24)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  analyticsTopGuideBadgeText: {
    color: green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  analyticsCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.24)',
    padding: 16,
    overflow: 'hidden',
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
  },

  analyticsGlow: {
    position: 'absolute',
    top: -24,
    right: -16,
    width: 90,
    height: 90,
    borderRadius: 999,
    backgroundColor: glow,
  },

  analyticsStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },

  analyticsStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },

  analyticsStatValue: {
    color: green,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },

  analyticsStatLabel: {
    color: muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },

  analyticsProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 10,
  },

  analyticsProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: green,
  },

  analyticsMetaText: {
    color: muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  weatherSection: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.24)',
    padding: 16,
    marginBottom: 18,
    overflow: 'hidden',
  },

  weatherSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 10,
  },

  weatherSectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  weatherSectionSub: {
    color: muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  weatherSectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.24)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  weatherSectionBadgeText: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
  },

  weatherEmptyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    padding: 16,
  },

  weatherEmptyText: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  weatherCardsList: {
    gap: 10,
  },

  weatherGroupCard: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.16)',
    borderRadius: 18,
    padding: 14,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },

  weatherGroupCardLive: {
    borderWidth: 1.5,
  },

  weatherGroupGlow: {
    position: 'absolute',
    top: -24,
    right: -16,
    width: 90,
    height: 90,
    borderRadius: 999,
  },

  weatherGroupTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  weatherGroupDeparture: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  weatherGroupDepartureText: {
    color: green,
    fontSize: 12,
    fontWeight: '900',
  },

  weatherGroupTemperature: {
    fontSize: 22,
    fontWeight: '900',
  },

  weatherGroupTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
    lineHeight: 18,
  },

  weatherGroupBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },

  weatherGroupBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },

  weatherGroupRecommendation: {
    color: muted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },

  planningSection: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    padding: 16,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },

  planningHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },

  planningTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  planningSub: {
    color: muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  planningLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  planningLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: green,
  },

  planningLiveText: {
    color: green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  planningCountersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },

  planningCounterCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },

  planningCounterCardActive: {
    backgroundColor: glow,
    borderColor: 'rgba(139,197,63,0.35)',
  },

  planningCounterValue: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },

  planningCounterValueActive: {
    color: green,
  },

  planningCounterLabel: {
    color: muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },

  nextDepartureCard: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },

  nextDepartureGlow: {
    position: 'absolute',
    top: -20,
    right: -10,
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: glow,
  },

  nextDepartureLabel: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 8,
  },

  nextDepartureTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 6,
  },

  nextDepartureTime: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    minWidth: 72,
  },

  nextDepartureExperience: {
    color: '#D4D4D4',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    lineHeight: 19,
  },

  nextDepartureMeta: {
    color: muted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },

  planningEmptyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    padding: 16,
  },

  planningEmptyText: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  planningTimelineList: {
    gap: 12,
  },

  planningGroupCard: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.16)',
    borderRadius: 18,
    padding: 14,
    shadowColor: green,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },

  planningWeatherGlow: {
    position: 'absolute',
    top: -20,
    left: -12,
    width: 72,
    height: 72,
    borderRadius: 999,
  },

  planningWeatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },

  planningWeatherText: {
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
  },

  planningGroupTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },

  planningDeparturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.24)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  planningDepartureText: {
    color: green,
    fontSize: 12,
    fontWeight: '900',
  },

  liveNowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139,197,63,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  liveNowDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: green,
  },

  liveNowText: {
    color: green,
    fontSize: 9,
    fontWeight: '900',
  },

  planningGroupTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },

  planningGroupMeta: {
    color: muted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },

  planningGroupEta: {
    color: '#D4D4D4',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
  },

  planningProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 6,
  },

  planningProgressFill: {
    height: '100%',
    borderRadius: 999,
  },

  planningProgressText: {
    color: muted,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'right',
  },

  verticalTimeline: {
    gap: 0,
  },

  timelineStepRow: {
    flexDirection: 'row',
    minHeight: 34,
  },

  timelineRailCol: {
    width: 22,
    alignItems: 'center',
  },

  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#222',
    borderWidth: 2,
    borderColor: 'rgba(139,197,63,0.2)',
  },

  timelineDotDone: {
    backgroundColor: green,
    borderColor: green,
  },

  timelineDotActive: {
    backgroundColor: '#050505',
    borderColor: green,
    shadowColor: green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },

  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(139,197,63,0.12)',
    marginVertical: 2,
  },

  timelineLineActive: {
    backgroundColor: 'rgba(139,197,63,0.45)',
  },

  timelineContent: {
    flex: 1,
    paddingBottom: 10,
    paddingLeft: 8,
    justifyContent: 'flex-start',
  },

  timelineStepLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
  },

  timelineStepLabelDone: {
    color: '#BDBDBD',
  },

  timelineStepLabelActive: {
    color: green,
    fontWeight: '900',
  },
});
