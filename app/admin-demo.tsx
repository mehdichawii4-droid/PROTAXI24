import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
    Alert,
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
const blue = '#008CFF';
const purple = '#9B59B6';

export default function AdminDemoScreen() {
  const [reservations, setReservations] = useState<any[]>([]);

  const loadReservations = async () => {
    const data = await AsyncStorage.getItem('reservations');
    setReservations(data ? JSON.parse(data) : []);
  };

  useFocusEffect(
    useCallback(() => {
      loadReservations();
    }, [])
  );

  const addNotification = async (reservationId: string, newStatus: string) => {
    const notifData = await AsyncStorage.getItem('notifications');
    const notifications = notifData ? JSON.parse(notifData) : [];

    notifications.unshift({
      id: Date.now().toString(),
      title: 'PROTAXI24',
      message: `Réservation #${reservationId.slice(-6)} : ${newStatus}`,
      date: new Date().toLocaleString('fr-FR'),
    });

    await AsyncStorage.setItem('notifications', JSON.stringify(notifications));
  };

  const updateStatus = async (id: string, status: string) => {
    const updated = reservations.map((item) =>
      item.id === id ? { ...item, status } : item
    );

    setReservations(updated);
    await AsyncStorage.setItem('reservations', JSON.stringify(updated));
    await addNotification(id, status);

    Alert.alert('Statut changé', `La réservation est maintenant : ${status}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Admin Demo</Text>

          <View style={{ width: 28 }} />
        </View>

        {reservations.length === 0 && (
          <Text style={styles.emptyText}>Aucune réservation trouvée.</Text>
        )}

        {reservations.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.topRow}>
              <Text style={styles.airport}>{item.airport || 'Aéroport'}</Text>
              <Text style={styles.status}>{item.status || 'En attente'}</Text>
            </View>

            <Text style={styles.detail}>#{String(item.id).slice(-6)}</Text>
            <Text style={styles.detail}>{item.date} • {item.time}</Text>
            <Text style={styles.detail}>
              {Number(item.price || 0).toLocaleString('fr-FR')} DZD
            </Text>

            <View style={styles.buttons}>
              <AdminButton
                title="Confirmer"
                color={green}
                onPress={() => updateStatus(item.id, 'Confirmée')}
              />
              <AdminButton
                title="En route"
                color={blue}
                onPress={() => updateStatus(item.id, 'Chauffeur en route')}
              />
              <AdminButton
                title="Arrivé"
                color={purple}
                onPress={() => updateStatus(item.id, 'Arrivé')}
              />
              <AdminButton
                title="Terminée"
                color={green}
                onPress={() => updateStatus(item.id, 'Terminée')}
              />
              <AdminButton
                title="Annulée"
                color={red}
                onPress={() => updateStatus(item.id, 'Annulée')}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function AdminButton({ title, color, onPress }: any) {
  return (
    <TouchableOpacity style={[styles.adminBtn, { borderColor: color }]} onPress={onPress}>
      <Text style={[styles.adminBtnText, { color }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  scroll: { paddingHorizontal: 18, paddingBottom: 42 },
  header: {
    paddingTop: 18,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },
  emptyText: {
    color: '#AAA',
    textAlign: 'center',
    marginTop: 60,
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  airport: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    flex: 1,
  },
  status: {
    color: gold,
    fontSize: 13,
    fontWeight: '900',
  },
  detail: {
    color: '#AAA',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  adminBtn: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminBtnText: {
    fontSize: 13,
    fontWeight: '900',
  },
});