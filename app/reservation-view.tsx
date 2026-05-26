import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
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
import { db } from '../firebaseConfig';

const gold = '#D4A017';
const green = '#2ECC71';
const red = '#FF4B4B';
const blue = '#008CFF';
const purple = '#9B59B6';

const phoneDisplay = '+213 671 421 448';
const phoneLink = '+213671421448';

export default function ReservationViewScreen() {
  const params = useLocalSearchParams();

  const [status, setStatus] = useState(
    String(params.status || 'En attente')
  );

  const reservationId = String(params.id || Date.now()).slice(-6);

  const priceNumber = parseInt(
    String(params.price || '0').replace(/\D/g, ''),
    10
  );

  const finalPrice = isNaN(priceNumber) ? 0 : priceNumber;
  const driverId = String(params.driverId || params.ratedDriverId || '').trim();
  const [driverAverageRating, setDriverAverageRating] = useState(5);

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

  const isRoundTrip =
    params.tripType === 'retour' ||
    params.tripType === 'aller-retour' ||
    params.tripType === 'round-trip';

  const getStatusColor = () => {
    if (status === 'Annulée') return red;
    if (status === 'Terminée') return green;
    if (status === 'Arrivé') return purple;
    if (status === 'En route') return blue;
    if (status === 'Acceptée') return green;
    if (status === 'Attribuée') return gold;
    return gold;
  };

  const getStatusIcon = () => {
    if (status === 'Annulée') return 'close-circle';
    if (status === 'Terminée') return 'checkmark-done-circle';
    if (status === 'Arrivé') return 'location';
    if (status === 'En route') return 'car-sport';
    if (status === 'Acceptée') return 'shield-checkmark';
    if (status === 'Attribuée') return 'person';
    return 'time';
  };

  const getStatusMessage = () => {
    if (status === 'Annulée') return 'Cette réservation a été annulée.';
    if (status === 'Terminée') return 'Cette course est terminée.';
    if (status === 'Arrivé') return 'Votre chauffeur est arrivé.';
    if (status === 'En route') return 'Votre chauffeur est en route.';
    if (status === 'Acceptée') return 'Votre chauffeur a accepté la course.';
    if (status === 'Attribuée') return 'Un chauffeur a été attribué à votre course.';
    return 'Votre demande est en attente de confirmation.';
  };

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
    if (status !== 'En attente' && status !== 'Attribuée') {
      Alert.alert(
        'Annulation impossible',
        'Cette réservation est déjà prise en charge. Contactez PROTAXI24 pour toute modification.'
      );
      return;
    }

    Alert.alert(
      'Annuler la réservation',
      'Voulez-vous vraiment annuler cette réservation ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            await addNotification('Annulée');

            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            );

            setStatus('Annulée');

            Alert.alert(
              'Réservation annulée',
              'Votre réservation a été annulée.',
              [{ text: 'OK', onPress: () => router.back() }]
            );
          },
        },
      ]
    );
  };

  const callTaxi = () => {
    Linking.openURL(`tel:${phoneLink}`);
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent(
      `Bonjour PROTAXI24, je vous contacte concernant ma réservation #${reservationId}.

Service : ${String(params.service || 'Transfert aéroport')}
Aéroport : ${String(params.airport || params.destination || '-')}
Adresse : ${String(params.address || params.departure || '-')}
Date : ${String(params.date || '-')}
Heure : ${String(params.time || '-')}
Passagers : ${String(params.passengers || '1')}
Bagages : ${String(params.bags || '0')}
Trajet : ${isRoundTrip ? 'Aller-retour' : 'Aller simple'}
Prix : ${finalPrice.toLocaleString('fr-FR')} DZD
Statut : ${status}`
    );

    Linking.openURL(
      `https://wa.me/${phoneLink.replace('+', '')}?text=${message}`
    );
  };

  const goTracking = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    router.push({
      pathname: '/course-tracking',
      params: {
        id: String(params.id || ''),
        rideId: String(params.id || ''),
        driverId: String(params.driverId || ''),
        address: String(params.address || params.departure || ''),
        airport: String(params.airport || params.destination || ''),
        time: String(params.time || ''),
        price: String(params.price || finalPrice || '0'),
        status,
      },
    });
  };

  const statusColor = getStatusColor();
  const statusIcon = getStatusIcon();

  const canCancel = status === 'En attente' || status === 'Attribuée';
  const canTrack = status !== 'Annulée' && status !== 'Terminée';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={30} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Détails réservation</Text>

          <View style={styles.backBtn} />
        </View>

        <View style={[styles.statusBox, { borderColor: statusColor }]}>
          <Ionicons name={statusIcon as any} size={26} color={statusColor} />

          <View style={{ flex: 1 }}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {status}
            </Text>

            <Text style={styles.statusMini}>
              Réservation #{reservationId}
            </Text>
          </View>
        </View>

        <Text style={styles.statusSub}>{getStatusMessage()}</Text>

        <View style={styles.timelineBox}>
          <TimelineStep active done icon="search" title="En attente" text="Demande envoyée" />
          <TimelineStep active={['Attribuée', 'Acceptée', 'En route', 'Arrivé', 'Terminée'].includes(status)} done={['Acceptée', 'En route', 'Arrivé', 'Terminée'].includes(status)} icon="person" title="Attribuée" text="Chauffeur attribué" />
          <TimelineStep active={['Acceptée', 'En route', 'Arrivé', 'Terminée'].includes(status)} done={['En route', 'Arrivé', 'Terminée'].includes(status)} icon="shield-checkmark" title="Acceptée" text="Course acceptée" />
          <TimelineStep active={['En route', 'Arrivé', 'Terminée'].includes(status)} done={['Arrivé', 'Terminée'].includes(status)} icon="car-sport" title="En route" text="Le chauffeur arrive" />
          <TimelineStep active={['Arrivé', 'Terminée'].includes(status)} done={status === 'Terminée'} icon="location" title="Arrivé" text="Chauffeur sur place" />
          <TimelineStep active={status === 'Terminée'} done={status === 'Terminée'} icon="checkmark-done-circle" title="Terminée" text="Course finalisée" last />
        </View>

        <View style={styles.driverBox}>
          <View style={styles.driverAvatar}>
            <Ionicons name="person" size={36} color="#111" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>
              {String(params.driverName || 'Taxi Mehdi 24')}
            </Text>
            <Text style={styles.driverSub}>Chauffeur professionnel</Text>
            <Text style={styles.driverCar}>
              {String(params.driverCar || 'Renault Clio • Berline')}
            </Text>
          </View>

          <View style={styles.ratingBox}>
            <Ionicons name="star" size={15} color={gold} />
            <Text style={styles.ratingText}>{driverAverageRating.toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <InfoRow
            icon="airplane"
            label="Destination"
            value={String(params.airport || params.destination || '-')}
          />

          <InfoRow
            icon="location"
            label="Adresse"
            value={String(params.address || params.departure || 'Non renseignée')}
          />

          <InfoRow
            icon="calendar"
            label="Date"
            value={String(params.date || '-')}
          />

          <InfoRow
            icon="time"
            label="Heure"
            value={String(params.time || '-')}
          />

          <InfoRow
            icon="people"
            label="Passagers"
            value={`${String(params.passengers || '1')} passagers`}
          />

          <InfoRow
            icon="briefcase"
            label="Bagages"
            value={`${String(params.bags || '0')} bagages`}
          />

          <InfoRow
            icon="repeat"
            label="Trajet"
            value={isRoundTrip ? 'Aller-retour' : 'Aller simple'}
          />

          <InfoRow
            icon="car-sport"
            label="Véhicule"
            value={String(params.driverCar || 'Berline')}
          />

          <InfoRow
            icon="cash"
            label="Prix total"
            value={`${finalPrice.toLocaleString('fr-FR')} DZD`}
            goldValue
          />
        </View>

        <View style={styles.infoBox}>
          <View style={styles.infoHeader}>
            <Ionicons
              name="information-circle-outline"
              size={26}
              color={gold}
            />

            <Text style={styles.infoTitle}>
              Informations importantes
            </Text>
          </View>

          <Text style={styles.infoText}>
            • PROTAXI24 vous contactera pour confirmer la disponibilité.
          </Text>

          <Text style={styles.infoText}>
            • Veuillez être prêt 10 minutes avant l’heure prévue.
          </Text>

          <Text style={styles.infoText}>
            • Pour modifier une réservation confirmée, contactez-nous.
          </Text>
        </View>

        {canTrack && (
          <TouchableOpacity
            style={styles.trackBtn}
            activeOpacity={0.9}
            onPress={goTracking}
          >
            <Ionicons name="navigate" size={27} color="#111" />

            <View style={styles.actionTextBox}>
              <Text style={styles.trackTitle}>Suivre la course</Text>
              <Text style={styles.trackSub}>
                Voir le chauffeur sur la carte
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={24} color="#111" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.callBtn}
          activeOpacity={0.85}
          onPress={callTaxi}
        >
          <Ionicons name="call" size={28} color={gold} />

          <View style={styles.actionTextBox}>
            <Text style={styles.actionTitle}>Appeler PROTAXI24</Text>
            <Text style={styles.actionSub}>{phoneDisplay}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.whatsappBtn}
          activeOpacity={0.85}
          onPress={openWhatsApp}
        >
          <Ionicons name="logo-whatsapp" size={30} color={green} />

          <View style={styles.actionTextBox}>
            <Text style={styles.actionTitle}>WhatsApp</Text>
            <Text style={styles.actionSub}>
              Envoyer les détails de la réservation
            </Text>
          </View>
        </TouchableOpacity>

        {canCancel && (
          <TouchableOpacity
            style={styles.cancelBtn}
            activeOpacity={0.85}
            onPress={cancelReservation}
          >
            <Ionicons name="trash" size={28} color={red} />
            <Text style={styles.cancelText}>Annuler la réservation</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TimelineStep({
  active,
  done,
  icon,
  title,
  text,
  last,
}: any) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineLeft}>
        <View
          style={[
            styles.timelineCircle,
            active && styles.timelineCircleActive,
            done && styles.timelineCircleDone,
          ]}
        >
          <Ionicons
            name={icon}
            size={15}
            color={active ? '#111' : '#777'}
          />
        </View>

        {!last && <View style={styles.timelineLine} />}
      </View>

      <View style={styles.timelineContent}>
        <Text
          style={[
            styles.timelineTitle,
            active && styles.timelineTitleActive,
          ]}
        >
          {title}
        </Text>

        <Text style={styles.timelineText}>{text}</Text>
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value, goldValue }: any) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={27} color={gold} />

      <Text style={styles.label}>{label}</Text>

      <Text
        style={[styles.value, goldValue && styles.valueGold]}
        numberOfLines={2}
      >
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
    paddingBottom: 42,
  },
  header: {
    paddingTop: 18,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 23,
    fontWeight: '900',
    flex: 1,
    textAlign: 'center',
  },
  statusBox: {
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  statusText: {
    fontSize: 22,
    fontWeight: '900',
  },
  statusMini: {
    color: '#AAA',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  statusSub: {
    color: '#BDBDBD',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 16,
    lineHeight: 22,
  },
  timelineBox: {
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.18)',
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 55,
  },
  timelineLeft: {
    width: 34,
    alignItems: 'center',
  },
  timelineCircle: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCircleActive: {
    backgroundColor: gold,
  },
  timelineCircleDone: {
    backgroundColor: green,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 10,
  },
  timelineTitle: {
    color: '#888',
    fontSize: 15,
    fontWeight: '900',
  },
  timelineTitleActive: {
    color: '#FFF',
  },
  timelineText: {
    color: '#AAA',
    fontSize: 13,
    marginTop: 3,
  },
  driverBox: {
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  driverAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  driverSub: {
    color: '#AAA',
    fontSize: 13,
    marginTop: 3,
  },
  driverCar: {
    color: gold,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 5,
  },
  ratingBox: {
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.4)',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },
  card: {
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  row: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  label: {
    color: '#BDBDBD',
    fontSize: 15,
    marginLeft: 14,
    flex: 1,
  },
  value: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    maxWidth: '50%',
    textAlign: 'right',
  },
  valueGold: {
    color: gold,
    fontSize: 17,
  },
  infoBox: {
    marginTop: 18,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  infoText: {
    color: '#BDBDBD',
    fontSize: 14,
    lineHeight: 23,
  },
  trackBtn: {
    minHeight: 76,
    borderRadius: 20,
    backgroundColor: gold,
    marginTop: 22,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  trackTitle: {
    color: '#111',
    fontSize: 18,
    fontWeight: '900',
  },
  trackSub: {
    color: '#222',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '700',
  },
  callBtn: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: gold,
    marginTop: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  whatsappBtn: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: green,
    marginTop: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionTextBox: {
    flex: 1,
  },
  actionTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
  },
  actionSub: {
    color: '#AAA',
    fontSize: 14,
    marginTop: 4,
  },
  cancelBtn: {
    height: 62,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: red,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  cancelText: {
    color: red,
    fontSize: 17,
    fontWeight: '900',
  },
});