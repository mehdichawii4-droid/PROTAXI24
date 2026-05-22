import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const gold = '#D4A017';
const green = '#2ECC71';
const red = '#FF4B4B';

export default function ProfileScreen() {
  const [reservationCount, setReservationCount] = useState(0);
  const [finishedCount, setFinishedCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  const [profile, setProfile] = useState({
    name: 'Client PROTAXI24',
    phone: '+213 671 421 448',
    email: 'client@protaxi24.com',
    city: 'Guelma',
    image: null,
    createdAt: '18 Mai 2026',
  });

  const loadProfile = async () => {
    const data = await AsyncStorage.getItem('profile');

    if (data) {
      setProfile(JSON.parse(data));
    }

    const reservationsData = await AsyncStorage.getItem('reservations');
    const reservations = reservationsData ? JSON.parse(reservationsData) : [];

    const notificationsData = await AsyncStorage.getItem('notifications');
    const notifications = notificationsData ? JSON.parse(notificationsData) : [];

    setReservationCount(reservations.length);
    setFinishedCount(
      reservations.filter((item: any) => item.status === 'Terminée').length
    );
    setNotificationCount(notifications.filter((item: any) => !item.read).length);
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const editProfile = () => {
    router.push('/edit-profile');
  };

  const logout = () => {
  Alert.alert(
    'Déconnexion',
    'Voulez-vous vraiment quitter votre compte ?',
    [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('isLoggedIn');
          await AsyncStorage.removeItem('userToken');
          router.replace('/');
        },
      },
    ]
  );
};

  const callSupport = () => {
    Linking.openURL('tel:+213671421448');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Mon profil</Text>

          <TouchableOpacity onPress={editProfile} style={styles.backBtn}>
            <Ionicons name="create-outline" size={25} color={gold} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.goldGlow} />

          <View style={styles.avatarBox}>
            <View style={styles.avatar}>
              {profile.image ? (
                <Image source={{ uri: profile.image }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={64} color="#111" />
              )}
            </View>

            <TouchableOpacity style={styles.cameraBtn} activeOpacity={0.85} onPress={editProfile}>
              <Ionicons name="camera" size={18} color="#111" />
            </TouchableOpacity>
          </View>

          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.role}>Membre premium PROTAXI24</Text>

          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={18} color={green} />
            <Text style={styles.verifiedText}>Profil vérifié</Text>
          </View>
        </View>

        <View style={styles.statsBox}>
          <StatItem icon="car-sport" value={reservationCount.toString()} label="Courses" />
          <StatItem icon="checkmark-done-circle" value={finishedCount.toString()} label="Terminées" />
          <StatItem icon="star" value="5.0" label="Note" />
        </View>

        <View style={styles.vipBox}>
          <Ionicons name="diamond" size={30} color={gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.vipTitle}>
              {reservationCount >= 5 ? 'Statut VIP activé' : 'Statut client premium'}
            </Text>
            <Text style={styles.vipText}>
              Confort, ponctualité et suivi personnalisé pour vos transferts.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations personnelles</Text>

          <InfoCard label="Nom complet" value={profile.name} icon="person-outline" />
          <InfoCard label="Téléphone" value={profile.phone} icon="call-outline" />
          <InfoCard label="Email" value={profile.email} icon="mail-outline" />
          <InfoCard label="Ville" value={profile.city} icon="location-outline" />
          <InfoCard label="Date d’inscription" value={profile.createdAt} icon="calendar-outline" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accès rapides</Text>

          <MenuItem
            icon="calendar-outline"
            title="Mes réservations"
            subtitle="Voir vos courses et statuts"
            onPress={() => router.push('/reservation')}
          />

          <MenuItem
            icon="notifications-outline"
            title="Notifications"
            subtitle={`${notificationCount} nouvelle${notificationCount > 1 ? 's' : ''} notification${notificationCount > 1 ? 's' : ''}`}
            badge={notificationCount > 0}
            onPress={() => router.push('/notifications')}
          />

          <MenuItem
            icon="time-outline"
            title="Historique"
            subtitle="Consulter vos anciennes courses"
            onPress={() => router.push('/history')}
          />

          <MenuItem
            icon="call-outline"
            title="Support PROTAXI24"
            subtitle="Appeler Taxi Mehdi 24"
            onPress={callSupport}
          />
        </View>

        <TouchableOpacity style={styles.mainBtn} activeOpacity={0.9} onPress={editProfile}>
          <Ionicons name="create-outline" size={22} color="#111" />
          <Text style={styles.mainBtnText}>Modifier mes informations</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.85} onPress={logout}>
          <Ionicons name="log-out-outline" size={24} color={red} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCard({ label, value, icon }: any) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={22} color={gold} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

function StatItem({ icon, value, label }: any) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={23} color={gold} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({ icon, title, subtitle, onPress, badge }: any) {
  return (
    <TouchableOpacity style={styles.menuItem} activeOpacity={0.86} onPress={onPress}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={23} color={gold} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.menuTitleRow}>
          <Text style={styles.menuTitle}>{title}</Text>
          {badge && <View style={styles.badgeDot} />}
        </View>
        <Text style={styles.menuSub}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={21} color="#777" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  scroll: { paddingHorizontal: 20, paddingBottom: 42 },

  header: {
    paddingTop: 18,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },

  heroCard: {
    borderRadius: 30,
    backgroundColor: 'rgba(18,18,18,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },

  goldGlow: {
    position: 'absolute',
    top: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(212,160,23,0.13)',
  },

  avatarBox: {
    alignItems: 'center',
  },

  avatar: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 2,
    borderColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: gold,
    overflow: 'hidden',
  },

  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },

  cameraBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -30,
    marginLeft: 88,
    borderWidth: 2,
    borderColor: '#050505',
  },

  name: {
    color: '#FFF',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 18,
    textAlign: 'center',
  },

  role: {
    color: '#AAA',
    fontSize: 14,
    marginTop: 6,
  },

  verifiedBadge: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.4)',
    backgroundColor: 'rgba(46,204,113,0.08)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  verifiedText: {
    color: green,
    fontSize: 13,
    fontWeight: '900',
  },

  statsBox: {
    marginTop: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  statItem: {
    alignItems: 'center',
    width: '30%',
  },

  statValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 8,
  },

  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },

  vipBox: {
    marginTop: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  vipTitle: {
    color: gold,
    fontSize: 17,
    fontWeight: '900',
  },

  vipText: {
    color: '#DDD',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 19,
  },

  section: {
    marginTop: 22,
  },

  sectionTitle: {
    color: gold,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 14,
  },

  infoCard: {
    minHeight: 76,
    borderRadius: 20,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 14,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: 'rgba(212,160,23,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  label: {
    color: '#888',
    fontSize: 13,
    marginBottom: 5,
  },

  value: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },

  menuItem: {
    minHeight: 78,
    borderRadius: 20,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 13,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(212,160,23,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  menuTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },

  menuSub: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },

  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: red,
  },

  mainBtn: {
    height: 62,
    borderRadius: 20,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
    flexDirection: 'row',
    gap: 9,
  },

  mainBtnText: {
    color: '#111',
    fontSize: 17,
    fontWeight: '900',
  },

  logoutBtn: {
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    flexDirection: 'row',
    gap: 9,
  },

  logoutText: {
    color: red,
    fontSize: 16,
    fontWeight: '900',
  },
});