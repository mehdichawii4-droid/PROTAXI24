import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebaseConfig';


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

const gold = '#D4A017';
const phoneNumber = '+213671421448';

export default function ConfirmationScreen() {
  const {
    service,
    mode,
    airport,
    address,
    date,
    time,
    passengers,
    bags,
    tripType,
    price,
  } = useLocalSearchParams();

  const numericPrice = Number(price || 0);

  const isRoundTrip =
    tripType === 'aller-retour' ||
    tripType === 'retour' ||
    tripType === 'round-trip';

  const finalPrice = isRoundTrip
    ? Math.round(numericPrice - numericPrice * 0.05)
    : numericPrice;

 const confirmFinal = async () => {
  try {
    const newReservation = {
      id: Date.now().toString(),
      service: String(service || 'Transfert aéroport'),
      mode: String(mode || ''),
      airport: String(airport || ''),
      address: String(address || ''),
      date: String(date || ''),
      time: String(time || ''),
      passengers: String(passengers || '1'),
      bags: String(bags || '0'),
      tripType: isRoundTrip ? 'aller-retour' : 'aller-simple',
      price: String(finalPrice || '0'),
      status: 'En attente',
      createdAt: new Date().toISOString(),
    };

    const oldData = await AsyncStorage.getItem('reservations');
    const oldReservations = oldData ? JSON.parse(oldData) : [];
    const updatedReservations = [newReservation, ...oldReservations];

    await AsyncStorage.setItem(
      'reservations',
      JSON.stringify(updatedReservations)
    );

    const rideDoc = await addDoc(collection(db, 'rides'), {
      client: 'Mehdi',
      phone: '+213555000000',
      service: String(service || 'Transfert aéroport'),
      departure: String(address || 'À confirmer'),
      destination: String(airport || 'À confirmer'),
      airport: String(airport || ''),
      address: String(address || ''),
      date: String(date || ''),
      price: `${finalPrice} DA`,
      time: String(time || '—'),
      passengers: String(passengers || '1'),
      bags: String(bags || '0'),
      status: 'En attente',
      driverName: '',
      driverPhone: '',
      driverCar: '',
      driverId: '',
      createdAt: new Date(),
    });

    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    );

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
                driverId: 'DRV-001',
                address: String(address || ''),
                airport: String(airport || ''),
                time: String(time || ''),
                price: String(finalPrice || '0'),
              },
            }),
        },
        {
          text: 'Mes réservations',
          onPress: () => router.push('/reservation'),
        },
      ]
    );
  } catch (error) {
    Alert.alert(
      'Erreur',
      'Impossible d’enregistrer la réservation. Veuillez réessayer.'
    );
  }
};

  const callTaxi = () => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent(
      `Bonjour PROTAXI24, je souhaite confirmer ma réservation.

Service : ${String(service || 'Transfert aéroport')}
Type : ${
        mode === 'deposer'
          ? 'Déposer à l’aéroport'
          : 'Récupérer à l’aéroport'
      }
Adresse : ${String(address || 'Non renseignée')}
Aéroport : ${String(airport || 'Non renseigné')}
Date : ${String(date || 'Non renseignée')}
Heure : ${String(time || 'Non renseignée')}
Passagers : ${String(passengers || '1')}
Bagages : ${String(bags || '0')}
Trajet : ${isRoundTrip ? 'Aller-retour (-5%)' : 'Aller simple'}
Prix estimé : ${finalPrice.toLocaleString('fr-FR')} DZD`
    );

    Linking.openURL(
      `https://wa.me/${phoneNumber.replace('+', '')}?text=${message}`
    );
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

        <View style={styles.successBox}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={48} color="#111" />
          </View>

          <Text style={styles.title}>Réservation prête</Text>

          <Text style={styles.subtitle}>
            Vérifiez les détails avant de confirmer votre transfert.
          </Text>
        </View>

        <View style={styles.card}>
          <InfoRow
            icon="airplane"
            label="Service"
            value={String(service || 'Transfert aéroport')}
          />

          <InfoRow
            icon="swap-horizontal-outline"
            label="Type"
            value={
              mode === 'deposer'
                ? 'Déposer à l’aéroport'
                : 'Récupérer à l’aéroport'
            }
          />

          <InfoRow
            icon="location-outline"
            label="Adresse"
            value={String(address || 'Non renseignée')}
          />

          <InfoRow
            icon="airplane-outline"
            label="Aéroport"
            value={String(airport || 'Non renseigné')}
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
          />

          <InfoRow
            icon="repeat-outline"
            label="Trajet"
            value={isRoundTrip ? 'Aller-retour' : 'Aller simple'}
          />
        </View>

        <View style={styles.priceBox}>
          <Text style={styles.priceLabel}>Prix estimé</Text>

          {isRoundTrip && (
            <Text style={styles.discountText}>
              Réduction aller-retour -5%
            </Text>
          )}

          <Text style={styles.price}>
            {finalPrice.toLocaleString('fr-FR')} DZD
          </Text>

          <Text style={styles.priceNote}>
            Paiement à la fin du trajet
          </Text>
        </View>

        <TouchableOpacity
          style={styles.mainBtn}
          activeOpacity={0.9}
          onPress={confirmFinal}
        >
          <Text style={styles.mainBtnText}>
            Confirmer la réservation
          </Text>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.85}
            onPress={callTaxi}
          >
            <Ionicons name="call-outline" size={22} color={gold} />
            <Text style={styles.actionText}>Appeler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.85}
            onPress={openWhatsApp}
          >
            <Ionicons name="logo-whatsapp" size={22} color={gold} />
            <Text style={styles.actionText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={23} color={gold} />

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

  successBox: {
    alignItems: 'center',
    marginTop: 35,
    marginBottom: 25,
  },

  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },

  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },

  subtitle: {
    color: '#BDBDBD',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },

  card: {
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },

  rowText: {
    marginLeft: 14,
    flex: 1,
  },

  label: {
    color: '#AAA',
    fontSize: 13,
  },

  value: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 3,
  },

  priceBox: {
    marginTop: 20,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: gold,
  },

  priceLabel: {
    color: '#DDD',
    fontSize: 15,
  },

  discountText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 5,
  },

  price: {
    color: gold,
    fontSize: 36,
    fontWeight: '900',
    marginTop: 6,
  },

  priceNote: {
    color: '#CCC',
    fontSize: 13,
    marginTop: 4,
  },

  mainBtn: {
    height: 64,
    borderRadius: 22,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },

  mainBtnText: {
    color: '#111',
    fontSize: 18,
    fontWeight: '900',
  },

  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },

  actionBtn: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.45)',
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