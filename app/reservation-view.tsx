import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  formatPrivateDriverDuration,
  getPrivateDriverTypeLabel,
} from '@/services/privateDriverRideService';
import {
  canClientCancelReservation,
  canClientOpenCourseTracking,
  getClientReservationStatusLabel,
  isScheduledAirportRide,
  isScheduledManagedRide,
  isScheduledPrivateDriverRide,
  normalizeRideStatus,
  shouldShowAssignedDriverToClient,
} from '@/types/driver';
import { db } from '../firebaseConfig';

const brandGreen = '#8BC53F';
const gold = '#C9A227';
const red = '#E85D5D';
const muted = '#8A8A8A';
const borderIdle = 'rgba(255,255,255,0.09)';

const phoneDisplay = '+213 671 421 448';
const phoneLink = '+213671421448';

const TIMELINE_STEPS = [
  'Transfert confirmé',
  'Préparation',
  'Chauffeur confirmé',
  'En route',
  'Terminée',
] as const;

function getTimelineActiveIndex(status: string, isScheduledManaged: boolean): number {
  const normalized = normalizeRideStatus(status);

  if (normalized === 'Terminée') return 4;
  if (normalized === 'En route' || normalized === 'Arrivé') return 3;

  if (isScheduledManaged) {
    if (normalized === 'Chauffeur confirmé') return 2;
    if (normalized === 'À attribuer' || normalized === 'En attente confirmation chauffeur') {
      return 1;
    }
    if (normalized === 'Confirmée') return 0;
    return 0;
  }

  if (normalized === 'Acceptée') return 2;
  if (normalized === 'Attribuée') return 1;
  return 0;
}

function getStatusTone(
  status: string,
  isScheduledManaged: boolean,
): 'success' | 'waiting' | 'danger' | 'neutral' {
  const normalized = normalizeRideStatus(status);

  if (normalized === 'Annulée') return 'danger';
  if (normalized === 'Terminée' || normalized === 'En route' || normalized === 'Arrivé') {
    return 'success';
  }
  if (normalized === 'Acceptée' || normalized === 'Chauffeur confirmé' || normalized === 'Confirmée') {
    return 'success';
  }
  if (
    normalized === 'Attribuée'
    || normalized === 'À attribuer'
    || normalized === 'En attente confirmation chauffeur'
  ) {
    return 'waiting';
  }
  if (!isScheduledManaged && normalized === 'En attente') return 'waiting';
  return 'neutral';
}

function getPrivateDriverModeLabel(mode: unknown): string | null {
  const value = String(mode || '').trim();
  if (value === 'trajet' || value === 'disposition') {
    return getPrivateDriverTypeLabel(value as 'trajet' | 'disposition');
  }
  return null;
}

function getStatusHint(
  status: string,
  isScheduledManaged: boolean,
  isScheduledPrivate: boolean,
): string {
  const normalized = normalizeRideStatus(status);

  if (normalized === 'Annulée') return 'Cette réservation a été annulée.';
  if (normalized === 'Terminée') return 'Merci d’avoir voyagé avec PROTAXI.';
  if (normalized === 'Arrivé') return 'Votre chauffeur est sur place.';
  if (normalized === 'En route') return 'Suivez votre chauffeur en temps réel.';

  if (isScheduledManaged) {
    if (normalized === 'Confirmée') {
      return isScheduledPrivate
        ? 'Notre équipe prépare votre mise à disposition chauffeur.'
        : 'Notre équipe vérifie votre vol avant le jour du trajet.';
    }
    if (normalized === 'À attribuer' || normalized === 'En attente confirmation chauffeur') {
      return isScheduledPrivate
        ? 'PROTAXI prépare votre chauffeur privé.'
        : 'PROTAXI prépare votre transfert.';
    }
    if (normalized === 'Chauffeur confirmé') {
      return 'Votre chauffeur est confirmé pour la date prévue.';
    }
  }

  if (normalized === 'Acceptée') return 'Votre chauffeur a confirmé la course.';
  if (normalized === 'Attribuée') return 'Un chauffeur a été attribué à votre course.';
  return 'Votre demande est en cours de traitement.';
}

function getTransferDirectionLabel(mode: unknown): string | null {
  const value = String(mode || '').trim();
  if (value === 'deposer') return 'Aller à l’aéroport';
  if (value === 'recuperer') return 'Depuis l’aéroport';
  return null;
}

export default function ReservationViewScreen() {
  const params = useLocalSearchParams();

  const [status, setStatus] = useState(String(params.status || 'En attente'));

  const rideContext = {
    rideType: params.rideType,
    rideMode: params.rideMode,
  };
  const isScheduledAirport = isScheduledAirportRide(rideContext);
  const isScheduledPrivate = isScheduledPrivateDriverRide(rideContext);
  const isScheduledManaged = isScheduledManagedRide(rideContext);
  const normalizedStatus = normalizeRideStatus(status);
  const statusLabel = getClientReservationStatusLabel(status, rideContext);
  const statusTone = getStatusTone(status, isScheduledManaged);
  const statusHint = getStatusHint(status, isScheduledManaged, isScheduledPrivate);
  const timelineActiveIndex = getTimelineActiveIndex(status, isScheduledManaged);

  const reservationId = String(params.id || Date.now()).slice(-6);
  const modePill = isScheduledManaged ? 'Planifié' : 'Maintenant';
  const headerTitle = isScheduledPrivate
    ? 'Votre chauffeur privé'
    : isScheduledAirport
      ? 'Votre transfert'
      : 'Votre réservation';

  const priceNumber = parseInt(String(params.price || '0').replace(/\D/g, ''), 10);
  const finalPrice = isNaN(priceNumber) ? 0 : priceNumber;
  const driverId = String(params.driverId || params.ratedDriverId || '').trim();
  const [driverAverageRating, setDriverAverageRating] = useState(5);

  const isRoundTrip =
    params.tripType === 'retour'
    || params.tripType === 'aller-retour'
    || params.tripType === 'round-trip';

  const airportLabel = String(params.airport || params.destination || '—');
  const addressLabel = String(params.address || params.departure || 'Non renseignée');
  const dateLabel = String(params.date || '—');
  const timeLabel = String(params.time || '—');
  const whenLabel = useMemo(() => {
    if (dateLabel === '—' && timeLabel === '—') return '—';
    if (dateLabel !== '—' && timeLabel !== '—') return `${dateLabel} · ${timeLabel}`;
    return dateLabel !== '—' ? dateLabel : timeLabel;
  }, [dateLabel, timeLabel]);

  const directionLabel = getTransferDirectionLabel(params.mode ?? params.transferMode);
  const privateDriverModeLabel = getPrivateDriverModeLabel(
    params.privateDriverType ?? params.mode,
  );
  const durationLabel = formatPrivateDriverDuration(
    String(params.durationHours || ''),
  );
  const passengersLabel = `${String(params.passengers || '1')} passager${Number(params.passengers || 1) > 1 ? 's' : ''}`;
  const bagsLabel = `${String(params.bags || '0')} bagage${Number(params.bags || 0) > 1 ? 's' : ''}`;

  const flightNumber = String(params.flightNumber || '').trim();
  const terminal = String(params.terminal || '').trim();
  const airline = String(params.airline || '').trim();
  const hasFlightBlock = Boolean(flightNumber || terminal || airline);
  const hasOptions =
    String(params.meetAndGreet || '') === 'true' || Boolean(String(params.notes || '').trim());

  useEffect(() => {
    if (!driverId) return;

    void getDoc(doc(db, 'driversLive', driverId)).then((snapshot) => {
      if (!snapshot.exists()) return;

      const liveAverage = Number(snapshot.data()?.averageRating ?? snapshot.data()?.rating);
      if (Number.isFinite(liveAverage) && liveAverage > 0) {
        setDriverAverageRating(liveAverage);
      }
    });
  }, [driverId]);

  const addNotification = async (newStatus: string) => {
    const notifData = await AsyncStorage.getItem('notifications');
    const notifications = notifData ? JSON.parse(notifData) : [];

    notifications.unshift({
      id: Date.now().toString(),
      title: 'PROTAXI24',
      message: `Réservation #${reservationId} : ${newStatus}`,
      date: new Date().toLocaleString('fr-FR'),
    });

    await AsyncStorage.setItem('notifications', JSON.stringify(notifications));
  };

  const cancelReservation = () => {
    if (!canClientCancelReservation(status, rideContext)) {
      Alert.alert(
        'Annulation impossible',
        'Cette réservation est déjà prise en charge. Contactez PROTAXI pour toute modification.',
      );
      return;
    }

    Alert.alert('Annuler la réservation', 'Voulez-vous vraiment annuler cette réservation ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler',
        style: 'destructive',
        onPress: async () => {
          await addNotification('Annulée');
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setStatus('Annulée');
          Alert.alert('Réservation annulée', 'Votre réservation a été annulée.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        },
      },
    ]);
  };

  const callTaxi = () => {
    Linking.openURL(`tel:${phoneLink}`);
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent(
      `Bonjour PROTAXI, réservation #${reservationId}.

Service : ${String(params.service || 'Transfert aéroport')}
Aéroport : ${airportLabel}
Adresse : ${addressLabel}
Date : ${dateLabel}
Heure : ${timeLabel}
Passagers : ${String(params.passengers || '1')}
Statut : ${statusLabel}`,
    );

    Linking.openURL(`https://wa.me/${phoneLink.replace('+', '')}?text=${message}`);
  };

  const openHelp = () => {
    Alert.alert('Besoin d’aide ?', 'Choisissez comment contacter PROTAXI.', [
      { text: 'Appeler', onPress: callTaxi },
      { text: 'WhatsApp', onPress: openWhatsApp },
      { text: 'Fermer', style: 'cancel' },
    ]);
  };

  const goTracking = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    router.push({
      pathname: '/course-tracking',
      params: {
        id: String(params.id || ''),
        rideId: String(params.id || ''),
        driverId: String(params.driverId || ''),
        address: addressLabel,
        airport: airportLabel,
        time: timeLabel,
        price: String(params.price || finalPrice || '0'),
        status,
      },
    });
  };

  const canCancel = canClientCancelReservation(status, rideContext);
  const canTrack = canClientOpenCourseTracking(status, rideContext);
  const showDriverDetails =
    shouldShowAssignedDriverToClient(status, rideContext)
    && String(params.driverName || '').trim().length > 0;
  const driverDisplayName = String(params.driverName || '').trim();
  const driverDisplayCar = String(params.driverCar || '').trim();

  const toneColor =
    statusTone === 'danger' ? red : statusTone === 'waiting' ? gold : brandGreen;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={18} color="#fff" />
          </TouchableOpacity>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.headerBlock}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={styles.headerAccentLine} />
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusTopRow}>
            <View style={[styles.statusDot, { backgroundColor: toneColor }]} />
            <Text style={styles.statusLabel}>{statusLabel}</Text>
          </View>
          <Text style={styles.statusHint}>{statusHint}</Text>
          <View style={styles.statusMetaRow}>
            <Text style={styles.statusMeta}>#{reservationId}</Text>
            <View style={styles.modePill}>
              <Text style={styles.modePillText}>{modePill}</Text>
            </View>
          </View>
        </View>

        {normalizedStatus !== 'Annulée' ? (
          <View style={styles.timelineCard}>
            {TIMELINE_STEPS.map((title, index) => (
              <TimelineStep
                key={title}
                title={title}
                last={index === TIMELINE_STEPS.length - 1}
                done={timelineActiveIndex > index || normalizedStatus === 'Terminée'}
                active={timelineActiveIndex === index && normalizedStatus !== 'Terminée'}
              />
            ))}
          </View>
        ) : null}

        {showDriverDetails ? (
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverInitial}>
                {driverDisplayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverDisplayName}</Text>
              {driverDisplayCar ? (
                <Text style={styles.driverCar}>{driverDisplayCar}</Text>
              ) : null}
            </View>
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={12} color={gold} />
              <Text style={styles.ratingText}>{driverAverageRating.toFixed(1)}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.tripCard}>
          <Text style={styles.tripCardTitle}>
            {isScheduledPrivate ? 'Votre demande' : 'Votre trajet'}
          </Text>

          {isScheduledPrivate && privateDriverModeLabel ? (
            <TripRow label="Service" value={privateDriverModeLabel} />
          ) : null}
          {!isScheduledPrivate ? (
            <TripRow label="Aéroport" value={airportLabel} />
          ) : null}
          {!isScheduledPrivate && directionLabel ? (
            <TripRow label="Sens" value={directionLabel} />
          ) : null}
          <TripRow
            label={isScheduledPrivate ? 'Départ' : 'Adresse'}
            value={String(params.departure || addressLabel)}
          />
          {isScheduledPrivate || String(params.destination || '').trim() ? (
            <TripRow
              label="Destination"
              value={String(params.destination || airportLabel)}
            />
          ) : null}
          {isScheduledPrivate && String(params.durationHours || '').trim() ? (
            <TripRow label="Durée" value={durationLabel} />
          ) : null}

          <View style={styles.divider} />

          <View style={styles.whenRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripLabel}>Quand</Text>
              <Text style={styles.tripValue}>{whenLabel}</Text>
            </View>
            <View style={styles.modePill}>
              <Text style={styles.modePillText}>{modePill}</Text>
            </View>
          </View>

          {hasFlightBlock ? (
            <>
              <View style={styles.divider} />
              {flightNumber ? <TripRow label="Vol" value={flightNumber} /> : null}
              {terminal ? <TripRow label="Terminal" value={terminal} /> : null}
              {airline ? <TripRow label="Compagnie" value={airline} /> : null}
            </>
          ) : null}

          <View style={styles.divider} />

          <TripRow label="Voyageurs" value={`${passengersLabel} · ${bagsLabel}`} />

          {!isScheduledManaged ? (
            <TripRow label="Type" value={isRoundTrip ? 'Aller-retour' : 'Aller simple'} />
          ) : null}

          {hasOptions ? (
            <>
              <View style={styles.divider} />
              {String(params.meetAndGreet || '') === 'true' ? (
                <TripRow label="Accueil" value="Pancarte à l’arrivée" />
              ) : null}
              {String(params.notes || '').trim() ? (
                <TripRow label="Options" value={String(params.notes)} />
              ) : null}
            </>
          ) : null}

          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Tarif indicatif</Text>
            <Text style={styles.priceValue}>
              {finalPrice > 0
                ? `${finalPrice.toLocaleString('fr-FR')} DZD`
                : String(params.price || '—')}
            </Text>
          </View>
        </View>

        {canTrack ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.9}
            onPress={goTracking}
          >
            <Ionicons name="navigate" size={20} color="#111" />
            <Text style={styles.primaryBtnText}>Suivre la course</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Besoin d’aide ?</Text>
          <View style={styles.contactActions}>
            <TouchableOpacity style={styles.contactBtn} onPress={openHelp} activeOpacity={0.85}>
              <Ionicons name="help-circle-outline" size={20} color={muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactBtn} onPress={callTaxi} activeOpacity={0.85}>
              <Ionicons name="call-outline" size={20} color={gold} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactBtn} onPress={openWhatsApp} activeOpacity={0.85}>
              <Ionicons name="logo-whatsapp" size={20} color={brandGreen} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.contactPhone}>{phoneDisplay}</Text>

        {canCancel ? (
          <TouchableOpacity style={styles.cancelLink} onPress={cancelReservation} activeOpacity={0.85}>
            <Text style={styles.cancelLinkText}>Annuler la réservation</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function TimelineStep({
  title,
  done,
  active,
  last,
}: {
  title: string;
  done?: boolean;
  active?: boolean;
  last?: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View
          style={[
            styles.timelineDot,
            done && styles.timelineDotDone,
            active && styles.timelineDotActive,
          ]}
        />
        {!last ? (
          <View style={[styles.timelineLine, done && styles.timelineLineDone]} />
        ) : null}
      </View>
      <Text
        style={[
          styles.timelineTitle,
          (done || active) && styles.timelineTitleEmphasis,
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

function TripRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tripRow}>
      <Text style={styles.tripLabel}>{label}</Text>
      <Text style={styles.tripValue} numberOfLines={3}>
        {value}
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
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    marginBottom: 8,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: borderIdle,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 18,
    gap: 6,
  },
  headerTitle: {
    color: '#F2F2F2',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerAccentLine: {
    width: 28,
    height: 1,
    borderRadius: 1,
    backgroundColor: gold,
    opacity: 0.55,
  },
  statusCard: {
    backgroundColor: 'rgba(28,28,28,0.72)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: borderIdle,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    color: '#F5F5F5',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  statusHint: {
    color: muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  statusMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  statusMeta: {
    color: muted,
    fontSize: 12,
    fontWeight: '600',
  },
  modePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: borderIdle,
  },
  modePillText: {
    color: '#C8C8C8',
    fontSize: 11,
    fontWeight: '600',
  },
  timelineCard: {
    marginBottom: 16,
    paddingVertical: 4,
    gap: 2,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 36,
  },
  timelineRail: {
    width: 18,
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 5,
  },
  timelineDotActive: {
    backgroundColor: brandGreen,
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineDotDone: {
    backgroundColor: brandGreen,
  },
  timelineLine: {
    flex: 1,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 4,
    minHeight: 18,
  },
  timelineLineDone: {
    backgroundColor: 'rgba(139,197,63,0.35)',
  },
  timelineTitle: {
    color: muted,
    fontSize: 14,
    fontWeight: '500',
    paddingTop: 1,
    flex: 1,
  },
  timelineTitleEmphasis: {
    color: '#E8E8E8',
    fontWeight: '600',
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(28,28,28,0.72)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: borderIdle,
    padding: 14,
    marginBottom: 16,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: borderIdle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitial: {
    color: '#F2F2F2',
    fontSize: 18,
    fontWeight: '700',
  },
  driverInfo: {
    flex: 1,
    gap: 3,
  },
  driverName: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '700',
  },
  driverCar: {
    color: muted,
    fontSize: 13,
    fontWeight: '500',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.35)',
  },
  ratingText: {
    color: '#F2F2F2',
    fontSize: 12,
    fontWeight: '700',
  },
  tripCard: {
    backgroundColor: 'rgba(28,28,28,0.72)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: borderIdle,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  tripCardTitle: {
    color: '#F2F2F2',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  tripRow: {
    gap: 3,
  },
  tripLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: '500',
  },
  tripValue: {
    color: '#F0F0F0',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  whenRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  priceLabel: {
    color: muted,
    fontSize: 13,
    fontWeight: '500',
  },
  priceValue: {
    color: gold,
    fontSize: 17,
    fontWeight: '700',
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: brandGreen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  primaryBtnText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '700',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  contactLabel: {
    color: muted,
    fontSize: 13,
    fontWeight: '500',
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: borderIdle,
  },
  contactPhone: {
    color: muted,
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 18,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelLinkText: {
    color: red,
    fontSize: 14,
    fontWeight: '600',
  },
});
