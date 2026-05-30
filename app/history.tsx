import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useCallback, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AssignedGuideClientCard from '@/components/AssignedGuideClientCard';
import { getCollectionRef, getTourBookingsCollectionRef } from '@/firebase/firestore';
import { getFirebaseAuth } from '@/firebase/authInstance';
import { useAuth } from '@/hooks/useAuth';
import {
  buildTourSummaryParams,
  formatTourHistoryPrice,
  getTourBookingCreatedAtLabel,
  getTourBookingModeLabel,
  getTourBookingStatusConfig,
  getTourCheckInStatusLabel,
  getTourPaymentStatusLabel,
  isGroupTourBooking,
  normalizeTourBookingRecord,
  type TourBookingRecord,
} from '@/services/tourBookingHistory';
import {
  parseClientAssignedGuide,
  shouldShowClientAssignedGuide,
} from '@/services/clientAssignedGuide';
import {
  formatRidePaymentAmount,
  getRidePaymentStatusConfig,
  getRidePaymentStatusLabel,
  normalizeRidePayment,
} from '@/services/ridePayment';
import { devError, devLog } from '@/utils/devLog';
import { PROTAXI_ROUTES } from '@/utils/navigation';

const gold = '#D4A017';
const red = '#FF4B4B';
const green = '#2ECC71';
const tourismGreen = '#8BC53F';
const tourismGlow = 'rgba(139,197,63,0.18)';

type TaxiHistoryItem = {
  id: string;
  status?: string;
  airport?: string;
  flightNumber?: string;
  date?: string;
  time?: string;
  passengers?: string;
  price?: string | number;
  fareAmount?: unknown;
  paymentMethod?: unknown;
  paymentStatus?: unknown;
};

const TAXI_HISTORY_STATUSES = new Set(['Terminée', 'Annulée']);

function normalizeFirestoreRideToHistoryItem(
  id: string,
  data: Record<string, unknown>,
): TaxiHistoryItem {
  const priceRaw = data.price;
  let price: string | number = 0;

  if (typeof priceRaw === 'number') {
    price = priceRaw;
  } else if (typeof priceRaw === 'string') {
    const parsed = Number(priceRaw.replace(/[^\d.-]/g, ''));
    price = Number.isFinite(parsed) && parsed > 0 ? parsed : priceRaw;
  }

  return {
    id,
    status: String(data.status || ''),
    airport: String(data.airport || data.destination || 'Course'),
    flightNumber: String(data.flightNumber || '').trim(),
    date: String(data.date || ''),
    time: String(data.time || ''),
    passengers: String(data.passengers || '1'),
    price,
    fareAmount: data.fareAmount,
    paymentMethod: data.paymentMethod,
    paymentStatus: data.paymentStatus,
  };
}

function filterTaxiHistoryItems(items: TaxiHistoryItem[]) {
  return items.filter((item) => TAXI_HISTORY_STATUSES.has(String(item.status || '')));
}

function getTourBookingCreatedAtMs(value: unknown) {
  if (!value) return 0;

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate?: () => Date }).toDate?.()?.getTime() ?? 0;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function sortTourBookingsNewestFirst(bookings: TourBookingRecord[]) {
  return [...bookings].sort(
    (left, right) =>
      getTourBookingCreatedAtMs(right.createdAt) - getTourBookingCreatedAtMs(left.createdAt),
  );
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [firestoreTaxiHistory, setFirestoreTaxiHistory] = useState<TaxiHistoryItem[]>([]);
  const [tourBookings, setTourBookings] = useState<TourBookingRecord[]>([]);

  const history = firestoreTaxiHistory;

  useFocusEffect(
    useCallback(() => {
      const clientUid = user?.uid ?? getFirebaseAuth().currentUser?.uid;

      if (!clientUid) {
        setFirestoreTaxiHistory([]);
        setTourBookings([]);
        return undefined;
      }

      const ridesQuery = query(
        getCollectionRef('rides'),
        where('clientUid', '==', clientUid),
        orderBy('createdAt', 'desc'),
      );

      const unsubscribeRides = onSnapshot(
        ridesQuery,
        (snapshot) => {
          setFirestoreTaxiHistory(
            filterTaxiHistoryItems(
              snapshot.docs.map((docSnap) =>
                normalizeFirestoreRideToHistoryItem(
                  docSnap.id,
                  docSnap.data() as Record<string, unknown>,
                ),
              ),
            ),
          );
        },
        (error) => {
          devError('[SNAPSHOT DENIED - history - taxi rides]', error);
          setFirestoreTaxiHistory([]);
        },
      );

      const tourBookingsQuery = query(
        getTourBookingsCollectionRef(),
        where('clientUid', '==', clientUid),
      );

      devLog('[HISTORY QUERY]', {
        collection: 'tourBookings',
        filters: [{ field: 'clientUid', operator: '==', value: clientUid }],
        orderBy: 'createdAt desc (client-side after snapshot)',
      });

      const unsubscribeTourBookings = onSnapshot(
        tourBookingsQuery,
        (snapshot) => {
          const bookings = sortTourBookingsNewestFirst(
            snapshot.docs.map((docSnap) =>
              normalizeTourBookingRecord(docSnap.id, docSnap.data() as Record<string, unknown>),
            ),
          );
          setTourBookings(bookings);
        },
        (error) => {
          const message = String((error as { message?: string })?.message || error);
          const isIndexError =
            message.includes('requires an index') || message.includes('failed-precondition');

          if (isIndexError) {
            devError('[HISTORY INDEX REQUIRED]', {
              collection: 'tourBookings',
              requiredIndex: {
                fields: [
                  { fieldPath: 'clientUid', order: 'ASCENDING' },
                  { fieldPath: 'createdAt', order: 'DESCENDING' },
                ],
              },
              deployCommand:
                'npx firebase-tools deploy --only firestore:indexes --project protaxi24-8abf2',
              note:
                'history.tsx uses where(clientUid) only and sorts createdAt client-side; deploy this index if you re-enable orderBy(createdAt) server-side.',
              error,
            });
          }

          devError('[SNAPSHOT DENIED - history - TourBookings]', error);
        },
      );

      return () => {
        unsubscribeRides();
        unsubscribeTourBookings();
      };
    }, [user?.uid]),
  );

  const totalSpent = history
    .filter((item) => item.status === 'Terminée')
    .reduce((sum, item) => sum + Number(item.price || 0), 0);

  const privateTourBookings = useMemo(
    () => tourBookings.filter((booking) => !isGroupTourBooking(booking)),
    [tourBookings],
  );

  const groupTourBookings = useMemo(
    () => tourBookings.filter((booking) => isGroupTourBooking(booking)),
    [tourBookings],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Historique</Text>

          <View style={{ width: 28 }} />
        </View>

        <View style={styles.heroBox}>
          <View style={styles.heroIcon}>
            <Ionicons name="time-outline" size={42} color={gold} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Vos courses passées</Text>
            <Text style={styles.heroSub}>
              Retrouvez vos réservations terminées ou annulées.
            </Text>
          </View>
        </View>

        {history.length === 0 && (
          <Text style={styles.emptyText}>Aucun historique taxi pour le moment.</Text>
        )}

        {history.map((item) => {
          const isCancelled = item.status === 'Annulée';
          const ridePayment = normalizeRidePayment(item as Record<string, unknown>);
          const paymentStatusConfig = getRidePaymentStatusConfig(ridePayment.paymentStatus);

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.airportBox}>
                  <Ionicons name="airplane" size={25} color={gold} />
                  <Text style={styles.airport}>{item.airport || 'Aéroport'}</Text>
                </View>

                <View
                  style={[
                    styles.badge,
                    isCancelled ? styles.cancelledBadge : styles.finishedBadge,
                  ]}
                >
                  <Ionicons
                    name={isCancelled ? 'close' : 'checkmark'}
                    size={16}
                    color={isCancelled ? red : green}
                  />
                  <Text
                    style={[
                      styles.badgeText,
                      { color: isCancelled ? red : green },
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>

              <TaxiInfoRow icon="calendar-outline" text={item.date || '-'} />
              <TaxiInfoRow icon="time-outline" text={item.time || '-'} />
              {item.flightNumber ? (
                <TaxiInfoRow
                  icon="airplane-outline"
                  text={`Vol : ${item.flightNumber}`}
                />
              ) : null}
              <TaxiInfoRow icon="people-outline" text={`${item.passengers || '1'} passagers`} />
              <TaxiInfoRow
                icon="cash-outline"
                text={formatRidePaymentAmount(ridePayment.fareAmount)}
              />
              <View style={styles.paymentBadgeRow}>
                <View
                  style={[
                    styles.paymentBadge,
                    {
                      backgroundColor: paymentStatusConfig.glow,
                      borderColor: paymentStatusConfig.border,
                    },
                  ]}
                >
                  <Ionicons name="wallet-outline" size={14} color={paymentStatusConfig.color} />
                  <Text style={[styles.paymentBadgeText, { color: paymentStatusConfig.color }]}>
                    {getRidePaymentStatusLabel(ridePayment.paymentStatus)}
                  </Text>
                </View>
              </View>

              <View style={styles.bottomRow}>
                <View>
                  <Text style={styles.priceLabel}>Montant</Text>
                  <Text style={styles.price}>
                    {formatRidePaymentAmount(ridePayment.fareAmount)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.detailBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/reservation-view',
                      params: { ...item },
                    })
                  }
                >
                  <Text style={styles.detailText}>Voir détails</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <View style={styles.totalBox}>
          <View>
            <Text style={styles.totalTitle}>Total courses terminées</Text>
            <Text style={styles.totalSub}>{history.length} courses dans l’historique</Text>
          </View>

          <Text style={styles.totalPrice}>
            {totalSpent.toLocaleString('fr-FR')} DZD
          </Text>
        </View>

        <View style={styles.tourismSection}>
          <View style={styles.tourismHeroBox}>
            <View style={styles.tourismHeroIcon}>
              <MaterialCommunityIcons name="compass-outline" size={34} color={tourismGreen} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tourismHeroTitle}>Mes expériences PROTAXI</Text>
              <Text style={styles.tourismHeroSub}>
                Retrouvez vos réservations tourisme privées et groupe.
              </Text>
            </View>
          </View>

          {tourBookings.length === 0 ? (
            <Text style={styles.tourismEmptyText}>
              Aucune expérience tourisme enregistrée pour le moment.
            </Text>
          ) : null}

          {privateTourBookings.length > 0 ? (
            <View style={styles.tourismSubsection}>
              <View style={styles.tourismSubsectionHeader}>
                <Ionicons name="person-outline" size={16} color={tourismGreen} />
                <Text style={styles.tourismSubsectionTitle}>Expériences privées</Text>
                <Text style={styles.tourismSubsectionCount}>{privateTourBookings.length}</Text>
              </View>
              {privateTourBookings.map((booking) => (
                <TourExperienceCard key={booking.id} booking={booking} />
              ))}
            </View>
          ) : null}

          {groupTourBookings.length > 0 ? (
            <View style={styles.tourismSubsection}>
              <View style={styles.tourismSubsectionHeader}>
                <Ionicons name="people-outline" size={16} color={tourismGreen} />
                <Text style={styles.tourismSubsectionTitle}>Expériences groupe</Text>
                <Text style={styles.tourismSubsectionCount}>{groupTourBookings.length}</Text>
              </View>
              {groupTourBookings.map((booking) => (
                <TourExperienceCard key={booking.id} booking={booking} />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TourExperienceCard({ booking }: { booking: TourBookingRecord }) {
  const isGroup = isGroupTourBooking(booking);
  const statusConfig = getTourBookingStatusConfig(booking.status);
  const modeLabel = getTourBookingModeLabel(booking.bookingMode);
  const paymentLabel = getTourPaymentStatusLabel(booking);
  const checkInLabel = getTourCheckInStatusLabel(booking);

  const openDetail = () => {
    if (booking.source === 'experiences-private') {
      router.push({
        pathname: PROTAXI_ROUTES.experienceConfirmed,
        params: {
          tourBookingId: booking.id,
          experience: booking.experience || booking.circuitName || 'Expérience PROTAXI',
          formulaLabel: booking.formula || 'Expérience privée',
          date: booking.date || 'À confirmer',
          participants: booking.travelers || '1',
          notes: booking.notes || '',
          options: booking.options || '',
          bookingMode: booking.bookingMode || 'private',
          price: booking.price || 'Sur confirmation',
        },
      });
      return;
    }

    router.push({
      pathname: PROTAXI_ROUTES.tourSummary,
      params: buildTourSummaryParams(booking),
    });
  };

  const hasOptions =
    Boolean(booking.options?.trim()) &&
    booking.options !== 'Aucune option supplémentaire';
  const assignedGuide = shouldShowClientAssignedGuide(booking)
    ? parseClientAssignedGuide(booking)
    : null;

  return (
    <View style={[styles.tourismCard, isGroup && styles.tourismCardGroup]}>
      <View style={styles.tourismCardGlow} />

      <View style={styles.tourismCardTop}>
        <View style={styles.tourismCardTitleWrap}>
          <Text style={styles.tourismCardTitle} numberOfLines={2}>
            {booking.experience || booking.circuitName || 'Expérience PROTAXI'}
          </Text>
          <View style={styles.tourismModeBadge}>
            <Text style={styles.tourismModeBadgeText}>{modeLabel}</Text>
          </View>
        </View>

        <View
          style={[
            styles.tourismStatusBadge,
            {
              backgroundColor: statusConfig.bg,
              borderColor: statusConfig.border,
            },
          ]}
        >
          <Text style={[styles.tourismStatusBadgeText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <TourInfoRow icon="calendar-outline" label="Date" value={booking.date || '—'} />
      {booking.formula ? (
        <TourInfoRow icon="diamond-outline" label="Formule" value={booking.formula} />
      ) : null}
      {hasOptions ? (
        <TourInfoRow icon="options-outline" label="Options" value={booking.options || '—'} />
      ) : null}
      <TourInfoRow icon="cash-outline" label="Prix" value={formatTourHistoryPrice(booking.price)} />
      <TourInfoRow
        icon="time-outline"
        label="Réservée le"
        value={getTourBookingCreatedAtLabel(booking.createdAt)}
      />

      {isGroup && paymentLabel ? (
        <TourInfoRow icon="wallet-outline" label="Paiement" value={paymentLabel} />
      ) : null}

      {isGroup && booking.ticketCode ? (
        <TourInfoRow icon="ticket-outline" label="Ticket" value={booking.ticketCode} />
      ) : null}

      {isGroup && checkInLabel ? (
        <TourInfoRow icon="qr-code-outline" label="Check-in" value={checkInLabel} />
      ) : null}

      {assignedGuide ? (
        <AssignedGuideClientCard guide={assignedGuide} variant="compact" />
      ) : null}

      <View style={styles.tourismCardBottom}>
        <View>
          <Text style={styles.tourismCardPriceLabel}>Tarif</Text>
          <Text style={styles.tourismCardPrice}>{formatTourHistoryPrice(booking.price)}</Text>
        </View>

        <TouchableOpacity style={styles.tourismSummaryBtn} activeOpacity={0.85} onPress={openDetail}>
          <MaterialCommunityIcons
            name={booking.source === 'experiences-private' ? 'check-circle-outline' : 'map-marker-path'}
            size={16}
            color="#111"
          />
          <Text style={styles.tourismSummaryBtnText}>
            {booking.source === 'experiences-private' ? 'Voir la demande' : 'Voir le résumé'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TaxiInfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={gold} />
      <Text style={styles.infoText}>{text}</Text>
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
      <Ionicons name={icon} size={16} color={tourismGreen} />
      <Text style={styles.tourismInfoLabel}>{label}</Text>
      <Text style={styles.tourismInfoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },

  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 42,
  },

  header: {
    paddingTop: 18,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTitle: {
    color: '#FFF',
    fontSize: 25,
    fontWeight: '900',
  },

  heroBox: {
    minHeight: 112,
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(212,160,23,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  heroTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },

  heroSub: {
    color: '#AAA',
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },

  emptyText: {
    color: '#AAA',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
    fontWeight: '700',
  },

  card: {
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    marginBottom: 16,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  airportBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },

  airport: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  badge: {
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  finishedBadge: {
    backgroundColor: 'rgba(46,204,113,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.35)',
  },

  cancelledBadge: {
    backgroundColor: 'rgba(255,75,75,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.35)',
  },

  paymentBadgeRow: {
    marginBottom: 10,
    marginTop: 2,
  },
  paymentBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  paymentBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '900',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 10,
  },

  infoText: {
    color: '#CCC',
    fontSize: 14,
    fontWeight: '700',
  },

  bottomRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  priceLabel: {
    color: '#888',
    fontSize: 13,
  },

  price: {
    color: gold,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 3,
  },

  detailBtn: {
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },

  detailText: {
    color: gold,
    fontSize: 14,
    fontWeight: '900',
  },

  totalBox: {
    marginTop: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  totalTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
  },

  totalSub: {
    color: '#888',
    fontSize: 13,
    marginTop: 5,
  },

  totalPrice: {
    color: gold,
    fontSize: 18,
    fontWeight: '900',
  },

  tourismSection: {
    marginTop: 28,
    paddingTop: 8,
  },

  tourismHeroBox: {
    minHeight: 104,
    borderRadius: 24,
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: tourismGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },

  tourismHeroIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: tourismGlow,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.24)',
  },

  tourismHeroTitle: {
    color: '#FFF',
    fontSize: 19,
    fontWeight: '900',
  },

  tourismHeroSub: {
    color: '#8A8A8A',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 19,
    fontWeight: '600',
  },

  tourismEmptyText: {
    color: '#8A8A8A',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
    fontWeight: '700',
  },

  tourismSubsection: {
    marginBottom: 18,
  },

  tourismSubsectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },

  tourismSubsectionTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
  },

  tourismSubsectionCount: {
    color: tourismGreen,
    fontSize: 12,
    fontWeight: '900',
    backgroundColor: tourismGlow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.24)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  tourismCard: {
    borderRadius: 22,
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.18)',
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },

  tourismCardGroup: {
    borderColor: 'rgba(139,197,63,0.32)',
    shadowColor: tourismGreen,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },

  tourismCardGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 90,
    height: 90,
    borderRadius: 999,
    backgroundColor: tourismGlow,
  },

  tourismCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },

  tourismCardTitleWrap: {
    flex: 1,
    gap: 8,
  },

  tourismCardTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },

  tourismModeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: tourismGlow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.24)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  tourismModeBadgeText: {
    color: tourismGreen,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  tourismStatusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  tourismStatusBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },

  tourismInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },

  tourismInfoLabel: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '700',
    width: 88,
  },

  tourismInfoValue: {
    color: '#D4D4D4',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  tourismCardBottom: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,197,63,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  tourismCardPriceLabel: {
    color: '#8A8A8A',
    fontSize: 11,
    fontWeight: '700',
  },

  tourismCardPrice: {
    color: tourismGreen,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },

  tourismSummaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tourismGreen,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: tourismGreen,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },

  tourismSummaryBtnText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },
});
