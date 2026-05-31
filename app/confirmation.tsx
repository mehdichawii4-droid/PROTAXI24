import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { addDoc, collection } from 'firebase/firestore';
import { getFirebaseAuth } from '@/firebase/authInstance';
import { useAuth } from '@/hooks/useAuth';
import { db } from '../firebaseConfig';
import {
  buildConfirmationWhatsAppMessage,
  formatConfirmationPriceDisplay,
  isConfirmationRoundTrip,
  resolveConfirmationAirportModeLabel,
  resolveConfirmationContact,
  resolveConfirmationLocations,
  resolveConfirmationServiceLabel,
  resolveConfirmationTripTypeLabel,
  shouldShowConfirmationAirportType,
  shouldShowConfirmationNotes,
  shouldShowConfirmationRideMode,
  shouldShowConfirmationTripType,
  normalizeConfirmationParam,
} from '@/services/confirmationRidePayload';
import { pickPartnerFieldsFromParams } from '@/services/partnerService';
import { buildRidePaymentCreateFields } from '@/services/ridePayment';

import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const green = '#8BC53F';
const phoneNumber = '+213671421448';

export default function ConfirmationScreen() {
  const { profile } = useAuth();
  const params = useLocalSearchParams();
  const paramRecord = params as Record<string, string | string[] | undefined>;
  const {
    service,
    mode,
    date,
    time,
    passengers,
    bags,
    tripType,
    price,
    rideMode,
    notes,
  } = params;

  const partnerFields = pickPartnerFieldsFromParams(paramRecord);
  const { departure, destination } = resolveConfirmationLocations(paramRecord);
  const { clientName, clientPhone } = resolveConfirmationContact(paramRecord, profile);

  const serviceLabel = resolveConfirmationServiceLabel(service);
  const displayParams = { service, mode, tripType, rideMode, notes };
  const showAirportType = shouldShowConfirmationAirportType(displayParams);
  const showTripType = shouldShowConfirmationTripType(displayParams);
  const showRideMode = shouldShowConfirmationRideMode(displayParams);
  const showNotes = shouldShowConfirmationNotes(displayParams);
  const airportModeLabel = resolveConfirmationAirportModeLabel(mode);
  const tripTypeLabel = resolveConfirmationTripTypeLabel(tripType);
  const rideModeLabel = normalizeConfirmationParam(rideMode);
  const notesLabel = normalizeConfirmationParam(notes);

  const numericPrice = Number(price || 0);
  const isRoundTrip = isConfirmationRoundTrip(tripType);
  const finalPrice = isRoundTrip
    ? Math.round(numericPrice - numericPrice * 0.05)
    : numericPrice;
  const priceDisplay = formatConfirmationPriceDisplay(price, finalPrice);

  const confirmFinal = async () => {
    const clientUid = getFirebaseAuth().currentUser?.uid;
    if (!clientUid) {
      Alert.alert(
        'Connexion requise',
        'Connectez-vous pour confirmer votre réservation taxi PROTAXI.',
      );
      return;
    }

    const contact = resolveConfirmationContact(paramRecord, profile);

    try {
      const priceLabel = `${finalPrice} DA`;

      const rideDoc = await addDoc(collection(db, 'rides'), {
        clientUid,
        clientName: contact.clientName,
        client: contact.clientName,
        phone: contact.clientPhone,
        service: String(service || 'Transfert aéroport'),
        departure,
        destination,
        airport: destination,
        address: departure,
        date: String(date || ''),
        price: priceLabel,
        time: String(time || '—'),
        passengers: String(passengers || '1'),
        bags: String(bags || '0'),
        status: 'En attente',
        driverName: '',
        driverPhone: '',
        driverCar: '',
        driverId: '',
        createdAt: new Date(),
        ...buildRidePaymentCreateFields({ price: priceLabel }),
        ...partnerFields,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Demande envoyée',
        'Votre demande a été envoyée. Vous pouvez suivre votre course en direct.',
        [
          {
            text: 'Suivre la course',
            onPress: () =>
              router.push({
                pathname: '/course-tracking',
                params: {
                  id: rideDoc.id,
                  rideId: rideDoc.id,
                  address: departure,
                  airport: destination,
                  departure,
                  destination,
                  time: String(time || ''),
                  price: String(finalPrice || '0'),
                  status: 'En attente',
                },
              }),
          },
          {
            text: 'Mes réservations',
            onPress: () => router.push('/reservation'),
          },
        ],
      );
    } catch {
      Alert.alert(
        'Erreur',
        'Impossible d’enregistrer la réservation. Veuillez réessayer.',
      );
    }
  };

  const callTaxi = () => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent(
      buildConfirmationWhatsAppMessage({
        serviceLabel,
        departure: departure || 'Non renseigné',
        destination: destination || 'Non renseigné',
        date: String(date || 'Non renseignée'),
        time: String(time || 'Non renseignée'),
        passengers: String(passengers || '1'),
        bags: String(bags || '0'),
        clientName,
        clientPhone,
        priceDisplay,
        airportModeLabel,
        tripTypeLabel,
        rideMode: rideModeLabel,
        showAirportType,
        showTripType,
        showRideMode,
        showRoundTripDiscount: isRoundTrip && finalPrice > 0,
      }),
    );

    Linking.openURL(`https://wa.me/${phoneNumber.replace('+', '')}?text=${message}`);
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

          <Text style={styles.headerTitle}>Confirmation</Text>

          <View style={{ width: 28 }} />
        </View>

        <View style={styles.heroBox}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={44} color="#111" />
          </View>

          <Text style={styles.heroTitle}>Demande prête</Text>

          <Text style={styles.heroSubtitle}>
            Vérifiez les détails avant de confirmer votre demande PROTAXI.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trajet</Text>

          <InfoRow
            icon="car-outline"
            label="Service"
            value={serviceLabel}
          />

          {showAirportType ? (
            <InfoRow
              icon="airplane-outline"
              label="Type de transfert"
              value={airportModeLabel}
            />
          ) : null}

          {showRideMode ? (
            <InfoRow icon="flash-outline" label="Mode" value={rideModeLabel} />
          ) : null}

          <InfoRow
            icon="navigate-outline"
            label="Départ"
            value={departure || 'Non renseigné'}
          />

          <InfoRow
            icon="flag-outline"
            label="Destination"
            value={destination || 'Non renseigné'}
          />

          <InfoRow
            icon="calendar-outline"
            label="Date"
            value={String(date || 'Non renseignée')}
          />

          <InfoRow
            icon="time-outline"
            label="Heure"
            value={String(time || 'Non renseignée')}
          />

          <InfoRow
            icon="people-outline"
            label="Passagers"
            value={String(passengers || '1')}
          />

          <InfoRow
            icon="briefcase-outline"
            label="Bagages"
            value={String(bags || '0')}
            isLast={!showTripType && !showNotes}
          />

          {showTripType ? (
            <InfoRow
              icon="repeat-outline"
              label="Trajet"
              value={tripTypeLabel}
              isLast={!showNotes}
            />
          ) : null}

          {showNotes ? (
            <InfoRow
              icon="chatbubble-ellipses-outline"
              label="Notes"
              value={notesLabel}
              isLast
            />
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact</Text>

          <InfoRow icon="person-outline" label="Nom" value={clientName} />

          <InfoRow
            icon="call-outline"
            label="Téléphone"
            value={clientPhone}
            isLast
          />
        </View>

        <View style={styles.priceBox}>
          <View style={styles.priceHeader}>
            <MaterialCommunityIcons name="cash-multiple" size={20} color={green} />
            <Text style={styles.priceLabel}>Prix estimé</Text>
          </View>

          {isRoundTrip && finalPrice > 0 ? (
            <Text style={styles.discountText}>Réduction aller-retour −5 %</Text>
          ) : null}

          <Text style={styles.price}>{priceDisplay}</Text>

          <Text style={styles.priceNote}>Paiement à la fin du trajet</Text>
        </View>

        <TouchableOpacity
          style={styles.mainBtn}
          activeOpacity={0.9}
          onPress={confirmFinal}
        >
          <Text style={styles.mainBtnText}>Confirmer la demande</Text>
          <Ionicons name="arrow-forward" size={20} color="#111" />
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.85}
            onPress={callTaxi}
          >
            <Ionicons name="call-outline" size={22} color={green} />
            <Text style={styles.actionText}>Appeler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.85}
            onPress={openWhatsApp}
          >
            <Ionicons name="logo-whatsapp" size={22} color={green} />
            <Text style={styles.actionText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon} size={18} color={green} />
      </View>

      <View style={styles.rowText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  header: {
    paddingTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },

  heroBox: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 22,
  },

  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: green,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  heroTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },

  heroSubtitle: {
    color: '#BDBDBD',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    paddingHorizontal: 12,
  },

  card: {
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.18)',
    marginBottom: 14,
  },

  cardTitle: {
    color: green,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },

  rowLast: {
    borderBottomWidth: 0,
  },

  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(139,197,63,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rowText: {
    marginLeft: 12,
    flex: 1,
  },

  label: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: '600',
  },

  value: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 3,
  },

  priceBox: {
    backgroundColor: 'rgba(139,197,63,0.08)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
  },

  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  priceLabel: {
    color: '#DDD',
    fontSize: 15,
    fontWeight: '700',
  },

  discountText: {
    color: green,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },

  price: {
    color: green,
    fontSize: 34,
    fontWeight: '900',
    marginTop: 8,
  },

  priceNote: {
    color: '#CCC',
    fontSize: 13,
    marginTop: 4,
  },

  mainBtn: {
    height: 58,
    borderRadius: 999,
    backgroundColor: green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },

  mainBtnText: {
    color: '#111',
    fontSize: 17,
    fontWeight: '900',
  },

  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },

  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    backgroundColor: 'rgba(139,197,63,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  actionText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
