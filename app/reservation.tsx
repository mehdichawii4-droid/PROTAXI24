import { Ionicons } from '@expo/vector-icons';

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {
  configureNotificationHandler,
  getClientEventFromStatus,
  mapRideNotificationContext,
  notifyClient,
  requestNotificationPermissions,
} from '@/services/notificationService';
import { getFirebaseAuth } from '@/firebase/authInstance';
import { useAuth } from '@/hooks/useAuth';
import { devError } from '@/utils/devLog';
import { canClientRateDriverFromRide } from '@/services/rideRating';
import {
  formatRidePaymentAmount,
  normalizeRidePayment,
} from '@/services/ridePayment';
import { formatRidePriceDzd } from '@/utils/rideTracking';
import {
  canClientCancelReservation,
  canClientOpenCourseTracking,
  getClientReservationStatusLabel,
  isScheduledAirportRide,
  isScheduledCityRide,
  isScheduledPrivateDriverRide,
  shouldShowAssignedDriverToClient,
} from '@/types/driver';
import { db } from '../firebaseConfig';

const SCHEDULED_AIRPORT_CONFIRMATION_MESSAGE =
  'Votre transfert aéroport est confirmé par PROTAXI. Notre équipe vérifiera les détails de votre vol et vous attribuera un chauffeur avant votre trajet.';

const SCHEDULED_PRIVATE_DRIVER_CONFIRMATION_MESSAGE =
  'Votre demande chauffeur privé est confirmée par PROTAXI. Notre équipe vous attribuera un chauffeur partenaire avant le jour J.';

const SCHEDULED_CITY_CONFIRMATION_MESSAGE =
  'Course ville confirmée — PROTAXI vous attribuera un chauffeur partenaire avant l\'horaire de votre course.';

const green = '#8BC53F';
const gold = '#D4A017';
const muted = '#8A8A8A';
const textPrimary = '#FFFFFF';
const textSecondary = '#B8B8B8';
const cardBg = 'rgba(14,14,14,0.98)';
const glassBg = 'rgba(255,255,255,0.04)';
const borderSoft = 'rgba(255,255,255,0.08)';
const greenSoft = 'rgba(139,197,63,0.14)';
const greenBorder = 'rgba(139,197,63,0.28)';
const red = '#FF4B4B';
const phoneLink = '+213671421448';

type ReservationServiceKind = 'city' | 'airport' | 'private' | 'other';

function normalizeServiceKey(service: unknown) {
  return String(service || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function resolveReservationServiceKind(item: {
  rideType?: unknown;
  service?: unknown;
}): ReservationServiceKind {
  if (isScheduledCityRide(item) || String(item.rideType || '') === 'city') {
    return 'city';
  }
  if (isScheduledAirportRide(item) || String(item.rideType || '') === 'airport') {
    return 'airport';
  }
  if (
    isScheduledPrivateDriverRide(item)
    || String(item.rideType || '') === 'private_driver'
  ) {
    return 'private';
  }

  const key = normalizeServiceKey(item.service);
  if (key.includes('ville') || key.includes('24h')) return 'city';
  if (key.includes('aeroport') || key.includes('airport') || key.includes('transfert')) {
    return 'airport';
  }
  if (key.includes('chauffeur') || key.includes('prive') || key.includes('private')) {
    return 'private';
  }

  return 'other';
}

function getReservationCardIcon(
  kind: ReservationServiceKind,
): keyof typeof Ionicons.glyphMap {
  if (kind === 'city') return 'car';
  if (kind === 'airport') return 'airplane';
  if (kind === 'private') return 'briefcase';
  return 'car-outline';
}

function getReservationServiceTitle(item: {
  service?: unknown;
  rideType?: unknown;
}) {
  const kind = resolveReservationServiceKind(item);
  const raw = String(item.service || '').trim();

  if (kind === 'city') return raw || 'Taxi ville';
  if (kind === 'airport') return raw || 'Transfert aéroport';
  if (kind === 'private') return raw || 'Chauffeur privé';
  return raw || 'Réservation PROTAXI';
}

function formatReservationPaymentLine(
  item: {
    rideType?: unknown;
    rideMode?: unknown;
    service?: unknown;
  },
  paymentStatus: string,
): string {
  const kind = resolveReservationServiceKind(item);
  const isScheduledManaged =
    isScheduledCityRide(item)
    || isScheduledAirportRide(item)
    || isScheduledPrivateDriverRide(item);

  if (paymentStatus === 'paid') return 'Paiement : Réglé';
  if (paymentStatus === 'cancelled') return 'Paiement : Annulé';
  if (isScheduledManaged || kind === 'city') return 'Paiement : À bord';
  return 'Paiement : À bord';
}

configureNotificationHandler();

function formatReservationPassengers(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '1 passager';
  if (/passager/i.test(raw)) return raw;
  const count = Number.parseInt(raw, 10);
  if (Number.isFinite(count)) {
    return count > 1 ? `${count} passagers` : `${count} passager`;
  }
  return raw;
}

function formatReservationBags(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '0 bagage';
  if (/bagage/i.test(raw)) return raw;
  const count = Number.parseInt(raw, 10);
  if (Number.isFinite(count)) {
    return count > 1 ? `${count} bagages` : `${count} bagage`;
  }
  return raw;
}

export default function ReservationsScreen() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<any[]>([]);
  const lastStatusesRef = useRef<Record<string, string>>({});
  const isFirstLoadRef = useRef(true);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void requestNotificationPermissions();
  }, []);

  useEffect(() => {
    const clientUid = user?.uid ?? getFirebaseAuth().currentUser?.uid;

    if (!clientUid) {
      setReservations([]);
      lastStatusesRef.current = {};
      isFirstLoadRef.current = true;
      return undefined;
    }

    const ridesQuery = query(
      collection(db, 'rides'),
      where('clientUid', '==', clientUid),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      ridesQuery,
      (snapshot) => {
        const ridesData = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        snapshot.docs.forEach((docSnap) => {
          const ride: any = docSnap.data();
          const previousStatus = lastStatusesRef.current[docSnap.id];

          if (isFirstLoadRef.current) {
            lastStatusesRef.current[docSnap.id] = ride.status;
            return;
          }

          if (previousStatus === ride.status) return;

          lastStatusesRef.current[docSnap.id] = ride.status;

          const rideContext = mapRideNotificationContext({
            id: docSnap.id,
            ...ride,
          });
          const clientEvent = getClientEventFromStatus(ride.status, rideContext);

          if (clientEvent) {
            void notifyClient(notifiedRef.current, clientEvent, rideContext);
          }
        });

        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
        }

        setReservations(ridesData);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - reservation - rides]', error);
        setReservations([]);
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const openWhatsApp = (item: any) => {
    const reservationId = String(item.id || '').slice(-6);

    const message = encodeURIComponent(
      `Bonjour PROTAXI24, je vous contacte concernant ma réservation #${reservationId}.

Service : ${item.service || 'Transfert'}
Aéroport : ${item.airport || '-'}
${String(item.flightNumber || '').trim() ? `Vol : ${String(item.flightNumber).trim()}\n` : ''}Adresse : ${item.address || '-'}
Date : ${item.date || '-'}
Heure : ${item.time || '-'}
Prix : ${formatRidePriceDzd(item.price, item.estimatedPrice, item.totalPrice)}`
    );

    Linking.openURL(
      `https://wa.me/${phoneLink.replace('+', '')}?text=${message}`
    );
  };

  const cancelReservation = (item: any) => {
  Alert.alert(
    'Annuler la réservation',
    'Voulez-vous vraiment annuler cette réservation ?',
    [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: async () => {
          await updateDoc(doc(db, 'rides', item.id), {
            status: 'Annulée',
            cancelledAt: new Date(),
            driverId: '',
            driverName: '',
            driverPhone: '',
            driverCar: '',
          });

          if (item.driverId) {
            await updateDoc(doc(db, 'driversLive', item.driverId), {
              isBusy: false,
              currentRideId: '',
              updatedAt: new Date(),
            });
          }

          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning
          );

          void notifyClient(
            notifiedRef.current,
            'ride_cancelled',
            mapRideNotificationContext({ id: item.id, ...item })
          );

          Alert.alert(
            'Réservation annulée',
            'Votre chauffeur est maintenant libéré.'
          );
        },
      },
    ]
  );
};

 const getStatusStyle = (status: string) => {
  if (status === 'Annulée') return styles.cancelledBadge;
  if (status === 'Terminée' || status === 'Arrivé') return styles.successBadge;
  if (status === 'En route') return styles.successBadge;
  if (status === 'Acceptée' || status === 'Chauffeur confirmé') return styles.successBadge;
  if (status === 'Confirmée') return styles.successBadge;
  if (status === 'Attribuée' || status === 'En attente confirmation chauffeur') {
    return styles.progressBadge;
  }
  if (status === 'À attribuer') return styles.progressBadge;
  return styles.neutralBadge;
};

 const getStatusIcon = (status: string) => {
  if (status === 'Annulée') return 'close-circle';
  if (status === 'Terminée') return 'checkmark-circle';
  if (status === 'Arrivé') return 'location';
  if (status === 'En route') return 'car';
  if (status === 'Acceptée' || status === 'Chauffeur confirmé') return 'shield-checkmark';
  if (status === 'Attribuée' || status === 'En attente confirmation chauffeur') return 'search';
  if (status === 'Confirmée') return 'checkmark-circle';
  if (status === 'À attribuer') return 'calendar-outline';
  return 'time';
};

 
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Mes réservations</Text>

          <TouchableOpacity onPress={() => {}}>
            <Ionicons name="refresh" size={25} color={green} />
          </TouchableOpacity>
        </View>

        {reservations.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={54} color={green} />
            <Text style={styles.emptyTitle}>Aucune réservation</Text>
            <Text style={styles.emptyText}>
              Vos prochaines courses apparaîtront ici.
            </Text>
          </View>
        )}

        {reservations.map((item, index) => {
         const status = item.status || 'En attente';
const statusLabel = getClientReservationStatusLabel(status, item);
const isCancelled = status === 'Annulée';
const isFinished = status === 'Terminée';
const isScheduledAirport = isScheduledAirportRide(item);
const isScheduledPrivate = isScheduledPrivateDriverRide(item);
const isScheduledCity = isScheduledCityRide(item);
const canCancel = canClientCancelReservation(status, item);
const canTrack = canClientOpenCourseTracking(status, item);
const showDriverDetails = shouldShowAssignedDriverToClient(status, item) && item.driverName;
const canRate = isFinished && canClientRateDriverFromRide(item);
const ridePayment = normalizeRidePayment(item);
const reservationId = String(item.id || '').slice(-6);
const serviceKind = resolveReservationServiceKind(item);
const cardIcon = getReservationCardIcon(serviceKind);
const serviceTitle = getReservationServiceTitle(item);
const paymentLine = formatReservationPaymentLine(item, ridePayment.paymentStatus);
const showCityRoute =
  serviceKind === 'city'
  && (String(item.departure || '').trim() || String(item.destination || '').trim());
          
          return (
           <View key={item.id} style={styles.card}>
             <View
  style={[
    styles.glowLine,
    {
      backgroundColor:
        !isCancelled && !isFinished
          ? 'rgba(139,197,63,0.42)'
          : 'transparent',
    },
  ]}
/>

              <View style={styles.topRow}>
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceIconBox}>
                    <Ionicons name={cardIcon} size={22} color={green} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceTitle}>{serviceTitle}</Text>
                    <Text style={styles.bookingId}>Réservation #{reservationId}</Text>
                  </View>
                </View>

                <View style={[styles.statusBadge, getStatusStyle(status)]}>
                  <Ionicons
                    name={getStatusIcon(status) as any}
                    size={14}
                    color="#FFF"
                  />
                  <Text style={styles.statusText}>{statusLabel}</Text>
                </View>
              </View>

              {(isScheduledAirport || isScheduledPrivate || isScheduledCity) && status === 'Confirmée' ? (
                <View style={styles.scheduledBanner}>
                  <Ionicons name="shield-checkmark" size={18} color={green} />
                  <Text style={styles.scheduledBannerText}>
                    {isScheduledPrivate
                      ? SCHEDULED_PRIVATE_DRIVER_CONFIRMATION_MESSAGE
                      : isScheduledCity
                        ? SCHEDULED_CITY_CONFIRMATION_MESSAGE
                        : SCHEDULED_AIRPORT_CONFIRMATION_MESSAGE}
                  </Text>
                </View>
              ) : null}

              <View style={styles.infoBox}>
                {showCityRoute ? (
                  <>
                    <InfoRow
                      icon="radio-button-on"
                      text={`Départ : ${String(item.departure || item.address || '—').trim()}`}
                    />
                    <InfoRow
                      icon="flag-outline"
                      text={`Destination : ${String(item.destination || '—').trim()}`}
                    />
                  </>
                ) : (
                  <InfoRow
                    icon="location-outline"
                    text={item.address || item.departure || '-'}
                  />
                )}
                <InfoRow icon="calendar-outline" text={item.date || '-'} />
                <InfoRow icon="timer-outline" text={item.time || '-'} />
                <InfoRow
                  icon="people-outline"
                  text={formatReservationPassengers(item.passengers)}
                />
                <InfoRow
                  icon="briefcase-outline"
                  text={formatReservationBags(item.bags)}
                />
                {String(item.flightNumber || '').trim() ? (
                  <InfoRow
                    icon="airplane-outline"
                    text={`Vol : ${String(item.flightNumber).trim()}`}
                  />
                ) : null}
                {String(item.terminal || '').trim() ? (
                  <InfoRow icon="business-outline" text={`Terminal : ${item.terminal}`} />
                ) : null}
                {String(item.airline || '').trim() ? (
                  <InfoRow icon="ribbon-outline" text={`Compagnie : ${item.airline}`} />
                ) : null}
                {item.meetAndGreet ? (
                  <InfoRow icon="person-outline" text="Pancarte accueil : oui" />
                ) : null}
                {String(item.notes || '').trim() ? (
                  <InfoRow icon="document-text-outline" text={String(item.notes)} />
                ) : null}

                <InfoRow
                  icon="cash-outline"
                  text={formatRidePaymentAmount(ridePayment.fareAmount)}
                  accent="gold"
                />
                <InfoRow
                  icon="wallet-outline"
                  text={paymentLine}
                  accent={ridePayment.paymentStatus === 'paid' ? 'green' : 'muted'}
                />
                <InfoRow
                  icon="gift-outline"
                  text={`Points fidélité : ${item.clientPoints || 0}`}
                />
                {showDriverDetails ? (
  <>
    <InfoRow
      icon="person-circle-outline"
      text={`Chauffeur : ${item.driverName}`}
    />

    <InfoRow
      icon="car-sport-outline"
      text={item.driverCar || 'Véhicule PROTAXI'}
    />
  </>
) : null}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/reservation-view',
                      params: { ...item },
                    })
                  }
                >
                  <Ionicons name="eye-outline" size={19} color={green} />
                  <Text style={styles.actionText}>Détails</Text>
                </TouchableOpacity>

                {!isCancelled && !isFinished && canTrack && (
                  <TouchableOpacity
  style={styles.trackingBtn}
  onPress={async () => {
    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Medium
    );

    router.push({
      pathname: '/course-tracking',
        params: {
        id: item.id,
        rideId: item.id,
        driverId: item.driverId || '',
        address: item.address || item.departure || '',
        airport: item.airport || item.destination || '',
        time: item.time || '',
        price: item.price || '0',
        status: item.status || 'En attente',

        driverName: item.driverName || 'Taxi Mehdi 24',
driverCar: item.driverCar || 'Renault Clio',
driverPhone: item.driverPhone || '',
driverPlate: item.driverPlate || '24-000-16',
driverPhoto: item.driverPhoto || 'https://i.imgur.com/6VBx3io.png',
      },
    });
  }}
>
  <Ionicons name="navigate" size={19} color="#111" />
  <Text style={styles.trackingText}>Suivre</Text>
</TouchableOpacity>
                )}

                {canRate && (
                  <TouchableOpacity
                    style={styles.rateBtn}
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push({
                        pathname: '/rating',
                        params: {
                          rideId: item.id,
                          driverId: item.driverId || item.ratedDriverId || '',
                          driverName: item.driverName || 'Votre chauffeur',
                        },
                      });
                    }}
                  >
                    <Ionicons name="star-outline" size={19} color="#111" />
                    <Text style={styles.trackingText}>Noter</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => Linking.openURL(`tel:${phoneLink}`)}
                >
                  <Ionicons name="call" size={19} color={green} />
                  <Text style={styles.actionText}>Appeler</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openWhatsApp(item)}
                >
                  <Ionicons name="chatbubble-ellipses" size={19} color={green} />
                  <Text style={styles.actionText}>WhatsApp</Text>
                </TouchableOpacity>

                {canCancel && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                   onPress={() => cancelReservation(item)}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={19}
                      color={red}
                    />
                    <Text style={styles.cancelText}>Annuler</Text>
                  </TouchableOpacity>
                )}
              </View>
           </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  text,
  accent = 'muted',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  accent?: 'muted' | 'gold' | 'green';
}) {
  const iconColor = accent === 'gold' ? gold : accent === 'green' ? green : muted;

  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={19} color={iconColor} />
      <Text
        style={[
          styles.infoText,
          accent === 'gold' && styles.infoTextGold,
          accent === 'green' && styles.infoTextGreen,
        ]}
        numberOfLines={2}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },

  header: {
    paddingTop: 18,
    marginBottom: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTitle: {
    color: textPrimary,
    fontSize: 23,
    fontWeight: '900',
  },

  emptyBox: {
    marginTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
    borderRadius: 24,
    backgroundColor: cardBg,
    borderWidth: 1,
    borderColor: greenBorder,
  },

  emptyTitle: {
    color: textPrimary,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 15,
  },

  emptyText: {
    color: textSecondary,
    textAlign: 'center',
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
  },

  card: {
    backgroundColor: cardBg,
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: borderSoft,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  glowLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },

  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  serviceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: greenSoft,
    borderWidth: 1,
    borderColor: greenBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },

  serviceTitle: {
    color: textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },

  bookingId: {
    color: gold,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 3,
  },

  statusBadge: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 145,
  },

  successBadge: {
    backgroundColor: greenSoft,
    borderWidth: 1,
    borderColor: greenBorder,
  },

  progressBadge: {
    backgroundColor: 'rgba(212,160,23,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.28)',
  },

  neutralBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: borderSoft,
  },

  cancelledBadge: {
    backgroundColor: 'rgba(255,75,75,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.28)',
  },

  statusText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },

  scheduledBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: greenSoft,
    borderWidth: 1,
    borderColor: greenBorder,
  },
  scheduledBannerText: {
    flex: 1,
    color: textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  infoBox: {
    borderRadius: 18,
    backgroundColor: glassBg,
    borderWidth: 1,
    borderColor: borderSoft,
    padding: 14,
    marginBottom: 12,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 11,
  },

  infoText: {
    color: textSecondary,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },

  infoTextGold: {
    color: gold,
  },

  infoTextGreen: {
    color: green,
  },

  actions: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 9,
  },

  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: borderSoft,
    backgroundColor: 'rgba(255,255,255,0.02)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  actionText: {
    color: textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },

  trackingBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: green,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  rateBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: green,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  trackingText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },

  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  cancelText: {
    color: red,
    fontSize: 13,
    fontWeight: '900',
  },
});