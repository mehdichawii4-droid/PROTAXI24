import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
    ImageBackground,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { pickPartnerFieldsFromParams } from '@/services/partnerService';

const gold = '#D4A017';
const goldLight = '#FFD700';
const card = '#0E0E0E';
const border = '#262626';

export default function HotelSummaryScreen() {
  const data = useLocalSearchParams();

  const passengers = String(data.passengers || '2 passagers');
  const bags = String(data.bags || '2 bagages');
  const priceClean = String(data.price || 'Sur devis').replace(' DA', '');

  const partnerFields = pickPartnerFieldsFromParams(
    data as Record<string, string | string[] | undefined>,
  );

  const goToConfirmation = () => {
    router.push({
      pathname: '/confirmation',
      params: {
        service: data.service || 'Hôtel & séjour',
        mode: data.transferType || 'Hôtel',
        airport: data.destination || 'Destination à confirmer',
        address: data.hotelAddress || data.departure || 'Adresse à confirmer',
        date: data.date || 'À confirmer',
        time: data.time || 'À confirmer',
        passengers,
        bags,
        tripType:
  data.transferType === 'Aller / Retour'
    ? 'retour'
    : 'simple',
        price: String(data.price || '0')
  .replace(' DA', '')
  .replace(/\s/g, ''),
        ...partnerFields,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={25} color={goldLight} />
        </TouchableOpacity>

        <ImageBackground
          source={require('../assets/images/hotel.jpg')}
          style={styles.hero}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroOverlay}>
            <Text style={styles.logo}>PROTAXI</Text>
            <Text style={styles.title}>Résumé Hôtel</Text>
            <Text style={styles.subtitle}>Transfert premium hôtel & séjour</Text>

            <View style={styles.statusBadge}>
              <Ionicons name="time-outline" size={26} color={goldLight} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>EN ATTENTE DE VALIDATION</Text>
                <Text style={styles.statusText}>
                  Votre demande sera traitée par PROTAXI.
                </Text>
              </View>
            </View>
          </View>
        </ImageBackground>

        <SectionTitle icon="document-text-outline" title="Détails du trajet" />

        <View style={styles.card}>
          <InfoRow
            icon="car-sport-outline"
            label="Service"
            value={String(data.service || 'Hôtel & séjour')}
          />

          <InfoRow
            icon="flag-outline"
            label="Pays"
            value={String(data.country || 'Algérie')}
          />

          <InfoRow
            icon="location-outline"
            label="Départ"
            value={String(data.departure || 'Guelma, Algérie')}
          />

          <InfoRow
            icon="navigate-outline"
            label="Destination"
            value={String(data.destination || 'Destination à confirmer')}
          />

          <InfoRow
            icon="business-outline"
            label="Hôtel / adresse"
            value={String(data.hotelAddress || 'Non renseigné')}
          />

          <InfoRow
            icon="swap-horizontal-outline"
            label="Type de trajet"
            value={String(data.transferType || 'Aller simple')}
          />

          <InfoRow
            icon="calendar-outline"
            label="Date aller"
            value={`${String(data.date || 'À confirmer')} • ${String(data.time || 'À confirmer')}`}
          />

          <InfoRow
            icon="calendar-number-outline"
            label="Date retour"
            value={`${String(data.returnDate || 'Aucun retour')} • ${String(data.returnTime || '')}`}
          />
        </View>
                <View style={styles.row}>
          <StatCard
            icon="people-outline"
            title="VOYAGEURS"
            value={passengers}
            bigIcon="seat-passenger"
          />

          <StatCard
            icon="briefcase-outline"
            title="BAGAGES"
            value={bags}
            bigIcon="bag-suitcase-outline"
          />
        </View>

        <SectionTitle
          icon="person-outline"
          title="Vos coordonnées"
        />

        <View style={styles.card}>
          <SimpleRow
            label="Nom complet"
            value={String(data.fullName || 'Client PROTAXI')}
          />

          <SimpleRow
            label="Téléphone"
            value={String(data.phone || 'Non renseigné')}
          />

          <SimpleRow
            label="Notes"
            value={String(data.notes || 'Aucune note')}
          />
        </View>

        <SectionTitle
          icon="cash-outline"
          title="Prix estimé"
        />

        <View style={styles.priceCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.price}>
              {String(data.price || 'Sur devis')}
            </Text>

            <Text style={styles.priceText}>
              Le prix final sera confirmé avant le départ selon
              la destination et les horaires.
            </Text>
          </View>

          <MaterialCommunityIcons
            name="shield-check"
            size={72}
            color={goldLight}
          />
        </View>

        <SectionTitle
          icon="flag-outline"
          title="Étapes PROTAXI"
        />

        <View style={styles.stepsCard}>
          <Step number="1" label="Demande envoyée" active />
          <Step number="2" label="Validation PROTAXI" />
          <Step number="3" label="Chauffeur attribué" />
          <Step number="4" label="Trajet confirmé" />
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={goToConfirmation}
        >
          <Ionicons
            name="paper-plane-outline"
            size={23}
            color="#111"
          />

          <Text style={styles.buttonText}>
            Envoyer ma demande à PROTAXI
          </Text>
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Ionicons
            name="lock-closed-outline"
            size={17}
            color={goldLight}
          />

          <Text style={styles.footerText}>
            Paiement après confirmation
          </Text>
        </View>

        <View style={{ height: 55 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
function SectionTitle({ icon, title }: any) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={22} color={goldLight} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={20} color={goldLight} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text numberOfLines={2} style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SimpleRow({ label, value }: any) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.simpleLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StatCard({ icon, title, value, bigIcon }: any) {
  const cleanValue = String(value)
    .replace(' passagers', '')
    .replace(' passager', '')
    .replace(' bagages', '')
    .replace(' bagage', '');

  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={22} color={goldLight} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>

      <View style={styles.statContent}>
        <View>
          <Text style={styles.statNumber}>{cleanValue}</Text>
          <Text style={styles.statSub}>
            {title === 'VOYAGEURS' ? 'Passagers' : 'Bagages'}
          </Text>
        </View>

        <MaterialCommunityIcons name={bigIcon} size={62} color="#2D2D2D" />
      </View>
    </View>
  );
}

function Step({ number, label, active }: any) {
  return (
    <View style={styles.stepBox}>
      <View style={[styles.stepCircle, active && styles.stepCircleActive]}>
        <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>
          {number}
        </Text>
      </View>

      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030303',
    paddingHorizontal: 18,
  },

  backBtn: {
    marginTop: 44,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: border,
    zIndex: 2,
  },

  hero: {
    height: 330,
    borderRadius: 30,
    overflow: 'hidden',
    marginTop: -34,
    marginBottom: 24,
  },

  heroImage: {
    borderRadius: 30,
  },

  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    padding: 22,
    justifyContent: 'flex-end',
  },

  logo: {
    color: goldLight,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },

  title: {
    color: '#FFF',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 6,
  },

  subtitle: {
    color: '#CFCFCF',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 22,
  },

  statusBadge: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#4A3C08',
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  statusTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },

  statusText: {
    color: '#CFCFCF',
    marginTop: 4,
    fontSize: 12,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    marginTop: 8,
  },

  sectionTitle: {
    color: '#FFF',
    fontSize: 21,
    fontWeight: '900',
  },

  card: {
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
    paddingVertical: 15,
    gap: 12,
  },

  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },

  infoLabel: {
    color: '#CFCFCF',
    fontSize: 14,
    flex: 1,
  },

  simpleLabel: {
    color: '#CFCFCF',
    fontSize: 14,
    flex: 1,
  },

  infoValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
    textAlign: 'right',
  },

  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },

  statCard: {
    flex: 1,
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    minHeight: 145,
  },

  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },

  statTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },

  statContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },

  statNumber: {
    color: '#FFF',
    fontSize: 42,
    fontWeight: '900',
  },

  statSub: {
    color: '#D8D8D8',
    fontSize: 14,
  },

  priceCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#4A3C08',
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  price: {
    color: goldLight,
    fontSize: 34,
    fontWeight: '900',
  },

  priceText: {
    color: '#CFCFCF',
    fontSize: 13,
    marginTop: 8,
    lineHeight: 20,
  },

  stepsCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  stepBox: {
    width: '24%',
    alignItems: 'center',
  },

  stepCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#303030',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  stepCircleActive: {
    backgroundColor: goldLight,
    borderColor: goldLight,
  },

  stepNumber: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
  },

  stepNumberActive: {
    color: '#111',
  },

  stepLabel: {
    color: '#CFCFCF',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },

  stepLabelActive: {
    color: goldLight,
    fontWeight: '900',
  },

  button: {
    backgroundColor: goldLight,
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },

  buttonText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },

  footerText: {
    color: '#858585',
    fontSize: 12,
  },
});