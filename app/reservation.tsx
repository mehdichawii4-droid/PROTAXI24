import { Ionicons } from '@expo/vector-icons';

import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../firebaseConfig';

const gold = '#D4A017';
const red = '#FF4B4B';
const phoneLink = '+213671421448';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function ReservationsScreen() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [lastStatuses, setLastStatuses] = useState<any>({});

  useEffect(() => {
    Notifications.requestPermissionsAsync();

    
  }, []);

  
 useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'rides'),
    (snapshot) => {
      const ridesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
       
      }));
      snapshot.docs.forEach((doc) => {

  const ride: any = doc.data();
const previousStatus = lastStatuses[doc.id];

if (previousStatus === ride.status) return;
  if (ride.status === 'Attribuée' && ride.driverName) {
  Notifications.scheduleNotificationAsync({
    content: {
      title: 'Chauffeur attribué 🚖',
      body: `${ride.driverName} arrive pour votre course.`,
      sound: true,
    },
    trigger: null,
  });
}
if (ride.status === 'En route') {
  Notifications.scheduleNotificationAsync({
    content: {
      title: 'Chauffeur en route 🛣️',
      body: 'Votre chauffeur est en route vers vous.',
      sound: true,
    },
    trigger: null,
  });
}
if (ride.status === 'Arrivé') {
  Notifications.scheduleNotificationAsync({
    content: {
      title: 'Chauffeur arrivé 📍',
      body: 'Votre chauffeur est arrivé au point de prise en charge.',
      sound: true,
    },
    trigger: null,
  });
}
if (ride.status === 'Terminée') {
  Notifications.scheduleNotificationAsync({
    content: {
      title: 'Course terminée ✅',
      body: 'Merci d’avoir utilisé PROTAXI24.',
      sound: true,
    },
    trigger: null,
  });
}
setLastStatuses((prev: any) => ({
  ...prev,
  [doc.id]: ride.status,
}));
});

      const sorted = ridesData.sort((a: any, b: any) => {
        return (
          new Date(b.createdAt?.seconds
            ? b.createdAt.seconds * 1000
            : b.createdAt || 0
          ).getTime() -
          new Date(a.createdAt?.seconds
            ? a.createdAt.seconds * 1000
            : a.createdAt || 0
          ).getTime()
        );
      });

      setReservations(sorted);
    }
  );

  return () => unsubscribe();
}, []);

  const sendLocalNotification = async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null,
    });
  };

  const openWhatsApp = (item: any) => {
    const reservationId = String(item.id || '').slice(-6);

    const message = encodeURIComponent(
      `Bonjour PROTAXI24, je vous contacte concernant ma réservation #${reservationId}.

Service : ${item.service || 'Transfert'}
Aéroport : ${item.airport || '-'}
Adresse : ${item.address || '-'}
Date : ${item.date || '-'}
Heure : ${item.time || '-'}
Prix : ${Number(item.price || 0).toLocaleString('fr-FR')} DZD`
    );

    Linking.openURL(
      `https://wa.me/${phoneLink.replace('+', '')}?text=${message}`
    );
  };

  const cancelReservation = (item: any) => {
  Alert.alert(
    'Annuler la réservation',
    'Voulez-vous vraiment annuler cette réservation ?',
    [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: async () => {
          await updateDoc(doc(db, 'rides', item.id), {
            status: 'Annulée',
            cancelledAt: new Date(),
            driverId: '',
            driverName: '',
            driverPhone: '',
            driverCar: '',
          });

          if (item.driverId) {
            await updateDoc(doc(db, 'driversLive', item.driverId), {
              isBusy: false,
              currentRideId: '',
              updatedAt: new Date(),
            });
          }

          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning
          );

          await sendLocalNotification(
            'Réservation annulée',
            'Votre réservation PROTAXI24 a bien été annulée.'
          );

          Alert.alert(
            'Réservation annulée',
            'Votre chauffeur est maintenant libéré.'
          );
        },
      },
    ]
  );
};

 const getStatusStyle = (status: string) => {
  if (status === 'Annulée') return styles.cancelledBadge;
  if (status === 'Terminée') return styles.finishedBadge;
  if (status === 'Arrivé') return styles.arrivedBadge;
  if (status === 'En route') return styles.onWayBadge;
  if (status === 'Acceptée') return styles.confirmedBadge;
  if (status === 'Attribuée') return styles.searchBadge;
  return styles.pendingBadge;
};

 const getStatusIcon = (status: string) => {
  if (status === 'Annulée') return 'close-circle';
  if (status === 'Terminée') return 'checkmark-circle';
  if (status === 'Arrivé') return 'location';
  if (status === 'En route') return 'car';
  if (status === 'Acceptée') return 'shield-checkmark';
  if (status === 'Attribuée') return 'search';
  return 'time';
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

          <Text style={styles.headerTitle}>Mes réservations</Text>

          <TouchableOpacity onPress={() => {}}>
            <Ionicons name="refresh" size={25} color={gold} />
          </TouchableOpacity>
        </View>

        {reservations.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={54} color={gold} />
            <Text style={styles.emptyTitle}>Aucune réservation</Text>
            <Text style={styles.emptyText}>
              Vos prochaines courses apparaîtront ici.
            </Text>
          </View>
        )}

        {reservations.map((item, index) => {
         const status = item.status || 'En attente';
const isCancelled = status === 'Annulée';
const isFinished = status === 'Terminée';
const canCancel = ['En attente', 'Attribuée', 'Acceptée'].includes(status);
const reservationId = String(item.id || '').slice(-6);
          
          return (
           <View key={item.id} style={styles.card}>
             <View
  style={[
    styles.glowLine,
    {
      backgroundColor:
        !isCancelled && !isFinished
          ? 'rgba(212,160,23,0.35)'
          : 'transparent',
    },
  ]}
/>

              <View style={styles.topRow}>
                <View style={styles.airportBox}>
                  <View style={styles.airIconBox}>
                    <Ionicons name="airplane" size={22} color="#111" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.airport}>
                      {item.airport || 'Aéroport'}
                    </Text>
                    <Text style={styles.bookingId}>Réservation #{reservationId}</Text>
                  </View>
                </View>

                <View style={[styles.statusBadge, getStatusStyle(status)]}>
                  <Ionicons
                    name={getStatusIcon(status) as any}
                    size={14}
                    color="#FFF"
                  />
                  <Text style={styles.statusText}>{status}</Text>
                </View>
              </View>

              <View style={styles.infoBox}>
                <InfoRow icon="location-outline" text={item.address || '-'} />
                <InfoRow icon="calendar-outline" text={item.date || '-'} />
                <InfoRow icon="timer-outline" text={item.time || '-'} />
                <InfoRow
                  icon="people-outline"
                  text={`${item.passengers || '1'} passagers`}
                />
                <InfoRow
                  icon="briefcase-outline"
                  text={`${item.bags || '0'} bagages`}
                />
                  
                <InfoRow
  icon="cash-outline"
  text={`${Number(item.price || 0).toLocaleString('fr-FR')} DZD`}
/>

<InfoRow
  icon="gift-outline"
  text={`Points fidélité : ${item.clientPoints || 0}`}
/>
                {item.driverName ? (
  <>
    <InfoRow
      icon="person-circle-outline"
      text={`Chauffeur : ${item.driverName}`}
    />

    <InfoRow
      icon="car-sport-outline"
      text={item.driverCar || 'Véhicule PROTAXI'}
    />
  </>
) : null}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/reservation-view',
                      params: { ...item },
                    })
                  }
                >
                  <Ionicons name="eye-outline" size={19} color={gold} />
                  <Text style={styles.actionText}>Détails</Text>
                </TouchableOpacity>

                {!isCancelled && !isFinished && (
                  <TouchableOpacity
  style={styles.trackingBtn}
  onPress={async () => {
    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Medium
    );

    router.push({
      pathname: '/course-tracking',
        params: {
        id: item.id,
        driverId: item.driverId || 'DRV-001',
        address: item.address || item.departure || '',
        airport: item.airport || item.destination || '',
        time: item.time || '',
        price: item.price || '0',
        status: item.status || 'En attente',

        driverName: item.driverName || 'Taxi Mehdi 24',
driverCar: item.driverCar || 'Renault Clio',
driverPhone: item.driverPhone || '',
driverPlate: item.driverPlate || '24-000-16',
driverPhoto: item.driverPhoto || 'https://i.imgur.com/6VBx3io.png',
      },
    });
  }}
>
  <Ionicons name="navigate" size={19} color="#111" />
  <Text style={styles.trackingText}>Suivre</Text>
</TouchableOpacity>
                )}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => Linking.openURL(`tel:${phoneLink}`)}
                >
                  <Ionicons name="call" size={19} color={gold} />
                  <Text style={styles.actionText}>Appeler</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openWhatsApp(item)}
                >
                  <Ionicons name="chatbubble-ellipses" size={19} color={gold} />
                  <Text style={styles.actionText}>WhatsApp</Text>
                </TouchableOpacity>

                {canCancel && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                   onPress={() => cancelReservation(item)}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={19}
                      color={red}
                    />
                    <Text style={styles.cancelText}>Annuler</Text>
                  </TouchableOpacity>
                )}
              </View>
           </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, text }: any) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={19} color={gold} />
      <Text style={styles.infoText} numberOfLines={2}>
        {text}
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
    paddingHorizontal: 18,
    paddingBottom: 40,
  },

  header: {
    paddingTop: 18,
    marginBottom: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTitle: {
    color: '#FFF',
    fontSize: 23,
    fontWeight: '900',
  },

  emptyBox: {
    marginTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.25)',
  },

  emptyTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 15,
  },

  emptyText: {
    color: '#AAA',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
  },

  card: {
    backgroundColor: 'rgba(18,18,18,0.98)',
    borderRadius: 26,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },

  glowLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },

  airportBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  airIconBox: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
  },

  airport: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  bookingId: {
    color: gold,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 3,
  },

  statusBadge: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 145,
  },

  pendingBadge: {
    backgroundColor: 'rgba(212,160,23,0.18)',
  },

  searchBadge: {
    backgroundColor: 'rgba(212,160,23,0.25)',
  },

  confirmedBadge: {
    backgroundColor: 'rgba(46,204,113,0.18)',
  },

  onWayBadge: {
    backgroundColor: 'rgba(0,140,255,0.18)',
  },

  arrivedBadge: {
    backgroundColor: 'rgba(155,89,182,0.18)',
  },

  finishedBadge: {
    backgroundColor: 'rgba(46,204,113,0.24)',
  },

  cancelledBadge: {
    backgroundColor: 'rgba(255,75,75,0.16)',
  },

  statusText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },

  infoBox: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.035)',
    padding: 14,
    marginBottom: 12,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 11,
  },

  infoText: {
    color: '#DDD',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },

  actions: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 9,
  },

  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  actionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },

  trackingBtn: {
    flex: 1,
    height: 50,
    borderRadius: 17,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  trackingText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },

  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  cancelText: {
    color: red,
    fontSize: 13,
    fontWeight: '900',
  },
});