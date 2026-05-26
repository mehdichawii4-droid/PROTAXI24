import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SimpleLocationMap from '../components/SimpleLocationMap';
import { getFirebaseAuth } from '@/firebase/authInstance';
import { useAuth } from '@/hooks/useAuth';
import {
  cityRideInputFromParams,
  cleanCityRidePrice,
  submitCityRide,
} from '@/services/cityRideService';

const gold = '#D4A017';

const getParam = (value: string | string[] | undefined, fallback = '') =>
  String(Array.isArray(value) ? value[0] : value || fallback);

export default function CitySummaryScreen() {
  const data = useLocalSearchParams();
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const priceClean = cleanCityRidePrice(String(data.price || 'Sur confirmation'));

  const goToTracking = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const result = await submitCityRide(
        cityRideInputFromParams(data as Record<string, string | string[] | undefined>),
        {
          clientUid: getFirebaseAuth().currentUser?.uid,
          profileFullName: profile?.fullName,
          profilePhone: profile?.phone,
        },
      );

      if (result.status === 'auth_required') {
        Alert.alert(
          'Connexion requise',
          'Connectez-vous pour réserver une course taxi PROTAXI.',
        );
        return;
      }

      if (result.status === 'missing_ride_id') {
        Alert.alert(
          'Erreur',
          'Impossible d’obtenir l’identifiant de la course. Veuillez réessayer.'
        );
        return;
      }

      if (result.status === 'error') {
        Alert.alert(
          'Erreur',
          'Impossible d’enregistrer la course. Veuillez réessayer.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const region = {
    latitude: 36.462,
    longitude: 7.426,
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={26} color="#FFF" />
          </TouchableOpacity>

          <View>
            <Text style={styles.title}>RÉSUMÉ</Text>
            <Text style={styles.subtitle}>Ville 24H</Text>
          </View>

          <TouchableOpacity style={styles.helpBtn}>
            <Ionicons name="shield-checkmark-outline" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.mapContainer}>
          <SimpleLocationMap
            mapStyle={styles.map}
            region={region}
            markerTitle="PROTAXI"
          />

          <View style={styles.mapBadge}>
            <Ionicons name="car-sport-outline" size={18} color="#111" />
            <Text style={styles.mapBadgeText}>Course prête</Text>
          </View>
        </View>

        <View style={styles.statusBox}>
          <View style={styles.statusIcon}>
            <MaterialCommunityIcons name="taxi" size={28} color={gold} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>Votre demande est presque prête</Text>
            <Text style={styles.statusText}>
              Vérifiez les informations avant de confirmer la course.
            </Text>
          </View>
        </View>

        <View style={styles.routeCard}>
          <Text style={styles.cardTitle}>Trajet</Text>

          <View style={styles.routeLine}>
            <View style={styles.timeline}>
              <View style={styles.dotStart} />
              <View style={styles.verticalLine} />
              <View style={styles.dotEnd} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.routeItem}>
                <Text style={styles.routeLabel}>Départ</Text>
                <Text style={styles.routeValue}>
                  {String(data.departure || 'Départ à confirmer')}
                </Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.routeItem}>
                <Text style={styles.routeLabel}>Destination</Text>
                <Text style={styles.routeValue}>
                  {String(data.destination || 'Destination à confirmer')}
                </Text>
              </View>
            </View>
          </View>
        </View>
                <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Détails de la réservation</Text>

          <SummaryRow
            icon="car-sport-outline"
            label="Service"
            value={String(data.service || 'Ville 24H')}
          />

          <SummaryRow
            icon="location-outline"
            label="Type"
            value={String(data.destinationType || 'Course en ville')}
          />

          <SummaryRow
            icon="time-outline"
            label="Mode"
            value={getParam(data.rideMode, 'Maintenant')}
          />

          <SummaryRow
            icon="calendar-outline"
            label="Date"
            value={String(data.date || 'Maintenant')}
          />

          <SummaryRow
            icon="hourglass-outline"
            label="Attente"
            value={String(data.waitingTime || '0 min')}
          />

          <SummaryRow
            icon="people-outline"
            label="Passagers"
            value={String(data.passengers || '1')}
          />

          <SummaryRow
            icon="briefcase-outline"
            label="Bagages"
            value={String(data.bags || '0')}
          />
        </View>

        <View style={styles.clientCard}>
          <Text style={styles.cardTitle}>Client</Text>

          <SummaryRow
            icon="person-outline"
            label="Nom"
            value={String(data.fullName || 'Client PROTAXI')}
          />

          <SummaryRow
            icon="call-outline"
            label="Téléphone"
            value={String(data.phone || 'Non renseigné')}
          />

          <SummaryRow
            icon="chatbubble-ellipses-outline"
            label="Notes"
            value={String(data.notes || 'Aucune note')}
          />
        </View>

        <View style={styles.priceCard}>
          <View style={styles.priceTop}>
            <Text style={styles.priceLabel}>Prix estimé</Text>

            <Ionicons
              name="information-circle-outline"
              size={22}
              color="#FFF"
            />
          </View>

          <Text style={styles.price}>
            {priceClean} <Text style={styles.dzd}>DZD</Text>
          </Text>

          <Text style={styles.priceSub}>
            Tarif confirmé avant départ • Paiement à la fin du trajet
          </Text>
        </View>

        <TouchableOpacity
          style={styles.mainBtn}
          activeOpacity={0.9}
          onPress={goToTracking}
          disabled={isSubmitting}
        >
          <Text style={styles.mainBtnText}>Confirmer la demande</Text>

          <View style={styles.mainBtnIcon}>
            <Ionicons name="arrow-forward" size={25} color="#FFF" />
          </View>
        </TouchableOpacity>

        <View style={styles.bottomInfo}>
          <InfoItem
            icon="shield-checkmark-outline"
            text="Chauffeur vérifié"
          />

          <InfoItem
            icon="time-outline"
            text="Disponible 24h/24"
          />

          <InfoItem
            icon="cash-outline"
            text="Prix transparent"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({ icon, label, value }: any) {
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryLeft}>
        <Ionicons name={icon} size={20} color={gold} />
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>

      <Text numberOfLines={2} style={styles.summaryValue}>
        {value}
      </Text>
    </View>
  );
}

function InfoItem({ icon, text }: any) {
  return (
    <View style={styles.infoItem}>
      <Ionicons name={icon} size={22} color={gold} />
      <Text style={styles.infoItemText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  scroll: { paddingHorizontal: 18, paddingBottom: 35 },

  header: {
    paddingTop: 20,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
  },

  helpBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },

  title: {
    color: '#FFF',
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'center',
  },

  subtitle: {
    color: '#BEBEBE',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 2,
  },

  mapContainer: {
    height: 230,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
  },

  map: {
    flex: 1,
  },

  mapBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: gold,
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  mapBadgeText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
  },

  statusBox: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: gold,
    backgroundColor: 'rgba(212,160,23,0.08)',
    padding: 15,
    marginBottom: 18,
  },

  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#171307',
    justifyContent: 'center',
    alignItems: 'center',
  },

  statusTitle: {
    color: gold,
    fontSize: 15,
    fontWeight: '900',
  },

  statusText: {
    color: '#D8D8D8',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 19,
  },

  routeCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    backgroundColor: 'rgba(18,18,18,0.96)',
    padding: 18,
    marginBottom: 16,
  },

  cardTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 16,
  },

  routeLine: {
    flexDirection: 'row',
  },

  timeline: {
    width: 30,
    alignItems: 'center',
    marginRight: 10,
  },

  dotStart: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4ADE80',
  },

  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#444',
    marginVertical: 6,
  },

  dotEnd: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: gold,
  },

  routeItem: {
    minHeight: 58,
    justifyContent: 'center',
  },

  routeLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 5,
  },

  routeValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },

  separator: {
    height: 1,
    backgroundColor: '#222',
    marginVertical: 10,
  },

  detailsCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    backgroundColor: 'rgba(18,18,18,0.96)',
    padding: 18,
    marginBottom: 16,
  },

  clientCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    backgroundColor: 'rgba(18,18,18,0.96)',
    padding: 18,
    marginBottom: 16,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },

  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },

  summaryLabel: {
    color: '#DDD',
    fontSize: 14,
    fontWeight: '700',
  },

  summaryValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
    textAlign: 'right',
  },

  priceCard: {
    marginTop: 4,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: gold,
    backgroundColor: 'rgba(18,18,18,0.96)',
    padding: 18,
  },

  priceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  priceLabel: {
    color: '#DDD',
    fontSize: 15,
  },

  price: {
    color: gold,
    fontSize: 38,
    fontWeight: '900',
    marginTop: 8,
  },

  dzd: {
    fontSize: 18,
  },

  priceSub: {
    color: '#CFCFCF',
    fontSize: 13,
    marginTop: 4,
  },

  mainBtn: {
    marginTop: 20,
    height: 66,
    borderRadius: 22,
    backgroundColor: gold,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  mainBtnText: {
    flex: 1,
    textAlign: 'center',
    color: '#111',
    fontSize: 18,
    fontWeight: '900',
  },

  mainBtnIcon: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#101010',
    justifyContent: 'center',
    alignItems: 'center',
  },

  bottomInfo: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(18,18,18,0.96)',
    padding: 15,
    gap: 12,
  },

  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  infoItemText: {
    color: '#DDD',
    fontSize: 13.5,
    fontWeight: '700',
  },
});