import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const goldLight = '#FFD700';
const card = '#0E0E0E';
const border = '#262626';

export default function DriverProfileScreen() {
  const data = useLocalSearchParams();

  const name = String(data.name || 'Taxi Mehdi 24');
  const phone = String(data.phone || '+213555111222');
  const car = String(data.car || 'Renault Clio');
  const plate = String(data.plate || '24-000-16');
  const status = String(data.status || 'Disponible');
  const rating = String(data.rating || '4.9');

  const callDriver = () => Linking.openURL(`tel:${phone}`);

  const whatsappDriver = () => {
    const cleanPhone = phone.replace('+', '').replace(/\s/g, '');
    Linking.openURL(`https://wa.me/${cleanPhone}`);
  };
    return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>PROFIL CHAUFFEUR</Text>

          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="account-tie" size={24} color={goldLight} />
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons
              name="account-tie"
              size={65}
              color={goldLight}
            />
          </View>
<View style={styles.levelCard}>
  <Text style={styles.levelTitle}>
    Niveau chauffeur
  </Text>

  <Text style={styles.levelValue}>
    🥉 Bronze
  </Text>
</View>
          <Text style={styles.driverName}>{name}</Text>

          <View
            style={[
              styles.statusBadge,
              status === 'Disponible' && styles.availableBadge,
              status === 'Occupé' && styles.busyBadge,
              status === 'Hors ligne' && styles.offlineBadge,
            ]}
          >
            <Text style={styles.statusText}>{status}</Text>
          </View>

          <Text style={styles.carText}>
            {car} • {plate}
          </Text>

          <View style={styles.ratingRow}>
            <Ionicons name="star" size={18} color={goldLight} />
            <Text style={styles.ratingText}>{rating}/5</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard title="Courses" value="248" icon="car-outline" />
          <StatCard title="Revenus" value="420K" icon="cash-outline" />
          <StatCard title="Note" value={rating} icon="star-outline" />
         
        </View>

        <View style={styles.infoCard}>
          <InfoRow icon="call-outline" label="Téléphone" value={phone} />
          <InfoRow icon="car-outline" label="Véhicule" value={car} />
          <InfoRow icon="document-text-outline" label="Plaque" value={plate} />
          <InfoRow icon="location-outline" label="Ville" value="Guelma" />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={callDriver}>
            <Ionicons name="call-outline" size={24} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={whatsappDriver}>
            <Ionicons name="logo-whatsapp" size={24} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
  style={styles.primaryBtn}
  onPress={() => router.push('/admin-dashboard')}
>
            <Text style={styles.primaryBtnText}>Attribuer une course</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityCard}>
          <Text style={styles.sectionTitle}>Dernière activité</Text>

          <ActivityRow
            title="Aéroport Annaba"
            subtitle="Client VIP • 18:30"
          />

          <ActivityRow
            title="Constantine Marriott"
            subtitle="Réservation Hôtel • Hier"
          />

          <ActivityRow
            title="Centre-ville Guelma"
            subtitle="Course rapide • Aujourd’hui"
          />
        </View>
  



        <View style={{ height: 45 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
function StatCard({ title, value, icon }: any) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color={goldLight} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={19} color={goldLight} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>

      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ActivityRow({ title, subtitle }: any) {
  return (
    <View style={styles.activityRow}>
      <View style={styles.activityDot} />

      <View>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activitySubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    paddingHorizontal: 18,
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

  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },

  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#171307',
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileCard: {
    backgroundColor: card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: border,
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 20,
  },

  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#171307',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },

  driverName: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },

  statusBadge: {
    marginTop: 12,
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  availableBadge: {
    backgroundColor: 'rgba(74,222,128,0.15)',
  },

  busyBadge: {
    backgroundColor: 'rgba(255,165,0,0.15)',
  },

  offlineBadge: {
    backgroundColor: 'rgba(180,180,180,0.15)',
  },

  statusText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 13,
  },

  carText: {
    color: '#AFAFAF',
    fontSize: 15,
    marginTop: 14,
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },

  ratingText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 16,
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

  infoCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 18,
    marginBottom: 20,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
    paddingVertical: 15,
  },

  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  infoLabel: {
    color: '#BEBEBE',
    fontSize: 13,
  },

  infoValue: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },

  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#191919',
    justifyContent: 'center',
    alignItems: 'center',
  },

  primaryBtn: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    backgroundColor: goldLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  primaryBtnText: {
    color: '#111',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
  },

  activityCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    padding: 20,
  },

  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 18,
  },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },

  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: goldLight,
  },

  activityTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },

  activitySubtitle: {
    color: '#AFAFAF',
    fontSize: 12,
    marginTop: 4,
  },
  levelCard: {
  backgroundColor: card,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: border,
  padding: 22,
  marginBottom: 20,
  alignItems: 'center',
},

levelTitle: {
  color: '#AAA',
  fontSize: 14,
  fontWeight: '700',
},

levelValue: {
  color: goldLight,
  fontSize: 28,
  fontWeight: '900',
  marginTop: 10,
},

});