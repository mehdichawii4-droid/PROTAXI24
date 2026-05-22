import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const gold = '#D4A017';
const red = '#FF4B4B';
const green = '#2ECC71';

export default function HistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = async () => {
    const data = await AsyncStorage.getItem('reservations');
    const reservations = data ? JSON.parse(data) : [];

    const filtered = reservations.filter(
      (item: any) => item.status === 'Terminée' || item.status === 'Annulée'
    );

    setHistory(filtered.reverse());
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const totalSpent = history
    .filter((item) => item.status === 'Terminée')
    .reduce((sum, item) => sum + Number(item.price || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Historique</Text>

          <View style={{ width: 28 }} />
        </View>

        <View style={styles.heroBox}>
          <View style={styles.heroIcon}>
            <Ionicons name="time-outline" size={42} color={gold} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Vos courses passées</Text>
            <Text style={styles.heroSub}>
              Retrouvez vos réservations terminées ou annulées.
            </Text>
          </View>
        </View>

        {history.length === 0 && (
          <Text style={styles.emptyText}>Aucun historique pour le moment.</Text>
        )}

        {history.map((item) => {
          const isCancelled = item.status === 'Annulée';

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.airportBox}>
                  <Ionicons name="airplane" size={25} color={gold} />
                  <Text style={styles.airport}>{item.airport || 'Aéroport'}</Text>
                </View>

                <View
                  style={[
                    styles.badge,
                    isCancelled ? styles.cancelledBadge : styles.finishedBadge,
                  ]}
                >
                  <Ionicons
                    name={isCancelled ? 'close' : 'checkmark'}
                    size={16}
                    color={isCancelled ? red : green}
                  />
                  <Text
                    style={[
                      styles.badgeText,
                      { color: isCancelled ? red : green },
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>

              <InfoRow icon="calendar-outline" text={item.date || '-'} />
              <InfoRow icon="time-outline" text={item.time || '-'} />
              <InfoRow icon="people-outline" text={`${item.passengers || '1'} passagers`} />

              <View style={styles.bottomRow}>
                <View>
                  <Text style={styles.priceLabel}>Prix</Text>
                  <Text style={styles.price}>
                    {Number(item.price || 0).toLocaleString('fr-FR')} DZD
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.detailBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/reservation-view',
                      params: { ...item },
                    })
                  }
                >
                  <Text style={styles.detailText}>Voir détails</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <View style={styles.totalBox}>
          <View>
            <Text style={styles.totalTitle}>Total courses terminées</Text>
            <Text style={styles.totalSub}>{history.length} courses dans l’historique</Text>
          </View>

          <Text style={styles.totalPrice}>
            {totalSpent.toLocaleString('fr-FR')} DZD
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, text }: any) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={gold} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },

  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 42,
  },

  header: {
    paddingTop: 18,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTitle: {
    color: '#FFF',
    fontSize: 25,
    fontWeight: '900',
  },

  heroBox: {
    minHeight: 112,
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(212,160,23,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  heroTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },

  heroSub: {
    color: '#AAA',
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },

  emptyText: {
    color: '#AAA',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
    fontWeight: '700',
  },

  card: {
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    marginBottom: 16,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  airportBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },

  airport: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  badge: {
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  finishedBadge: {
    backgroundColor: 'rgba(46,204,113,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.35)',
  },

  cancelledBadge: {
    backgroundColor: 'rgba(255,75,75,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.35)',
  },

  badgeText: {
    fontSize: 13,
    fontWeight: '900',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 10,
  },

  infoText: {
    color: '#CCC',
    fontSize: 14,
    fontWeight: '700',
  },

  bottomRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  priceLabel: {
    color: '#888',
    fontSize: 13,
  },

  price: {
    color: gold,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 3,
  },

  detailBtn: {
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },

  detailText: {
    color: gold,
    fontSize: 14,
    fontWeight: '900',
  },

  totalBox: {
    marginTop: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  totalTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
  },

  totalSub: {
    color: '#888',
    fontSize: 13,
    marginTop: 5,
  },

  totalPrice: {
    color: gold,
    fontSize: 18,
    fontWeight: '900',
  },
});