import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuthLogout } from '@/hooks/useAuthLogout';

const gold = '#D4A017';
const red = '#FF4B4B';
const green = '#2ECC71';
const phoneNumber = '+213671421448';

export default function MenuScreen() {
  const { confirmLogout } = useAuthLogout();
  const [notifCount, setNotifCount] = useState(0);
  const [reservationCount, setReservationCount] = useState(0);

  const loadData = async () => {
    const notifData = await AsyncStorage.getItem('notifications');
    const notifications = notifData ? JSON.parse(notifData) : [];

    const reservationsData = await AsyncStorage.getItem('reservations');
    const reservations = reservationsData ? JSON.parse(reservationsData) : [];

    setNotifCount(notifications.filter((item: any) => !item.read).length);
    setReservationCount(reservations.length);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const callSupport = () => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const logout = () => {
    confirmLogout();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={31} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Menu</Text>

          <TouchableOpacity onPress={loadData} style={styles.closeBtn}>
            <Ionicons name="refresh" size={24} color={gold} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.goldGlow} />

          <View style={styles.avatar}>
            <Ionicons name="person" size={50} color="#111" />
          </View>

          <Text style={styles.hello}>Bonjour 👋</Text>
          <Text style={styles.name}>Client PROTAXI24</Text>
          <Text style={styles.subtitle}>Votre confort, notre priorité.</Text>

          <View style={styles.badgeRow}>
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={16} color={green} />
              <Text style={styles.verifiedText}>Compte vérifié</Text>
            </View>

            {notifCount > 0 && (
              <View style={styles.notifBadge}>
                <Ionicons name="notifications" size={15} color={red} />
                <Text style={styles.notifBadgeText}>{notifCount}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.statsBox}>
          <StatItem icon="calendar" value={reservationCount.toString()} label="Réservations" />
          <StatItem icon="star" value="5.0" label="Note" />
          <StatItem icon="diamond" value={reservationCount >= 5 ? 'VIP' : 'Premium'} label="Statut" />
        </View>

        <Text style={styles.sectionTitle}>Navigation</Text>

        <MenuItem
          icon="person-outline"
          title="Mon profil"
          subtitle="Gérer mes informations"
          onPress={() => router.push('/profile')}
        />

        <MenuItem
          icon="calendar-outline"
          title="Mes réservations"
          subtitle="Voir et gérer mes courses"
          onPress={() => router.push('/reservation')}
        />

        <MenuItem
          icon="notifications-outline"
          title="Notifications"
          subtitle="Voir les dernières alertes"
          badge={notifCount}
          onPress={() => router.push('/notifications')}
        />

        <MenuItem
          icon="time-outline"
          title="Historique"
          subtitle="Toutes mes courses passées"
          onPress={() => router.push('/history')}
        />

        <Text style={styles.sectionTitle}>Services</Text>

        <MenuItem
          icon="card-outline"
          title="Paiements"
          subtitle="Méthodes et transactions"
          onPress={() => router.push('/payments')}
        />

        <MenuItem
          icon="headset-outline"
          title="Support"
          subtitle="Aide et assistance"
          onPress={() => router.push('/support')}
        />

        <MenuItem
          icon="settings-outline"
          title="Paramètres"
          subtitle="Préférences de l’application"
          onPress={() => router.push('/settings')}
        />

        <MenuItem
          icon="shield-outline"
          title="Admin Demo"
          subtitle="Gestion des réservations"
          onPress={() => router.push('/admin-demo')}
        />

        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.85} onPress={logout}>
          <Ionicons name="log-out-outline" size={24} color={red} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.helpBox} activeOpacity={0.85} onPress={callSupport}>
          <View style={styles.helpIcon}>
            <Ionicons name="call-outline" size={22} color="#111" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.helpTitle}>Besoin d’aide ?</Text>
            <Text style={styles.helpPhone}>+213 671 421 448</Text>
          </View>

          <Ionicons name="chevron-forward" size={22} color="#777" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ icon, value, label }: any) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={22} color={gold} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({ icon, title, subtitle, onPress, badge }: any) {
  return (
    <TouchableOpacity style={styles.menuItem} activeOpacity={0.86} onPress={onPress}>
      <View style={styles.left}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={24} color={gold} />
        </View>

        <View style={styles.itemTextBox}>
          <Text style={styles.itemTitle}>{title}</Text>
          <Text style={styles.itemSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.rightBox}>
        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}

        <Ionicons name="chevron-forward" size={22} color="#777" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  scroll: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 34,
  },

  header: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  closeBtn: {
    width: 44,
    height: 44,
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
    top: -90,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(212,160,23,0.13)',
  },

  avatar: {
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#111',
  },

  hello: {
    color: '#DDD',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 16,
  },

  name: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'center',
  },

  subtitle: {
    color: '#AAA',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },

  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  verifiedBadge: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.4)',
    backgroundColor: 'rgba(46,204,113,0.08)',
    paddingVertical: 8,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  verifiedText: {
    color: green,
    fontSize: 13,
    fontWeight: '900',
  },

  notifBadge: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.45)',
    backgroundColor: 'rgba(255,75,75,0.08)',
    paddingVertical: 8,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  notifBadgeText: {
    color: red,
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
    width: '31%',
  },

  statValue: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 7,
  },

  statLabel: {
    color: '#888',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },

  sectionTitle: {
    color: gold,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 24,
    marginBottom: 12,
  },

  menuItem: {
    minHeight: 76,
    borderRadius: 22,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(212,160,23,0.08)',
    marginRight: 14,
  },

  itemTextBox: {
    flex: 1,
  },

  itemTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },

  itemSubtitle: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },

  rightBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  badge: {
    minWidth: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: red,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    paddingHorizontal: 6,
  },

  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },

  logoutBtn: {
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.45)',
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },

  logoutText: {
    color: red,
    fontSize: 16,
    fontWeight: '900',
  },

  helpBox: {
    minHeight: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    marginTop: 18,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  helpIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
  },

  helpTitle: {
    color: gold,
    fontSize: 15,
    fontWeight: '900',
  },

  helpPhone: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
  },
});