import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { db } from '../firebaseConfig';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const gold = '#FFD700';
const bg = '#050505';
const card = '#0E0E0E';
const border = '#262626';
const CURRENT_DRIVER_ID = 'DRV-001';

const ACTIVE_STATUSES = ['Acceptée', 'En route', 'Arrivé'];
const VISIBLE_STATUSES = ['Attribuée', 'Acceptée', 'En route', 'Arrivé', 'Terminée'];

const normalizeStatus = (status?: string) => {
  const s = String(status || '').toLowerCase().trim();

  if (s === 'attribuée' || s === 'attribuee') return 'Attribuée';
  if (s === 'acceptée' || s === 'acceptee') return 'Acceptée';
  if (s === 'en route') return 'En route';
  if (s === 'arrivé' || s === 'arrive') return 'Arrivé';
  if (s === 'terminée' || s === 'terminee') return 'Terminée';
  if (s === 'refusée' || s === 'refusee') return 'Refusée';

  return status || 'Inconnue';
};

export default function DriversDashboardScreen() {
  const [driverRating, setDriverRating] = useState(5);
  const [filter, setFilter] = useState('Toutes');
  const [rides, setRides] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  const [recentReviews, setRecentReviews] = useState<any[]>([]);

  const [driverLocation, setDriverLocation] = useState({
    latitude: 36.462,
    longitude: 7.426,
  });

  const mapRef = useRef<MapView | null>(null);
  const ridesRef = useRef<any[]>([]);
  const onlineRef = useRef(true);

  const hasBusyRide = (list = ridesRef.current) =>
    list.some((ride) => ACTIVE_STATUSES.includes(normalizeStatus(ride.status)));

  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);


  useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'rides'),
    (snapshot) => {
      const reviews = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter(
          (ride: any) =>
            ride.ratedDriverId === CURRENT_DRIVER_ID &&
            ride.rating
        )
        .sort(
          (a: any, b: any) =>
            new Date(b.ratedAt || 0).getTime() -
            new Date(a.ratedAt || 0).getTime()
        );

      setRecentReviews(reviews);
    }
  );

  return () => unsubscribe();
}, []);



  useEffect(() => {
    ridesRef.current = rides;
  }, [rides]);

  const updateDriverLive = async (position?: { latitude: number; longitude: number }) => {
    await setDoc(
      doc(db, 'driversLive', CURRENT_DRIVER_ID),
      {
        driverId: CURRENT_DRIVER_ID,
        ...(position
          ? {
              latitude: position.latitude,
              longitude: position.longitude,
            }
          : {}),
        isOnline: onlineRef.current,
       isBusy: onlineRef.current ? hasBusyRide() : false,
        updatedAt: new Date(),
      },
      { merge: true }
    );
  };

  useEffect(() => {
    onlineRef.current = isOnline;
    updateDriverLive(driverLocation);
  }, [isOnline]);
useEffect(() => {
  const unsubscribe = onSnapshot(
    doc(db, 'driversLive', CURRENT_DRIVER_ID),
    (snapshot) => {
      const data = snapshot.data();

      if (!data) return;

      setDriverRating(
        Number(data.averageRating || 5)
      );
    }
  );

  return () => unsubscribe();
}, []);
useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'rides'),
    (snapshot) => {

      const ridesData = snapshot.docs.map((d) => {
        const data: any = d.data();

        return {
          id: d.id,
          ...data,
          status: normalizeStatus(data.status),
        };
      });
      const driverRides = ridesData.filter(
        (ride) =>
          ride.driverId === CURRENT_DRIVER_ID &&
          VISIBLE_STATUSES.includes(normalizeStatus(ride.status))
      );

      const newAssignedIds = driverRides
        .filter((ride) => normalizeStatus(ride.status) === 'Attribuée')
        .map((ride) => ride.id);

      const oldAssignedIds = ridesRef.current
        .filter((ride) => normalizeStatus(ride.status) === 'Attribuée')
        .map((ride) => ride.id);

      const hasNewAssignedRide = newAssignedIds.some((id) => !oldAssignedIds.includes(id));

      if (hasNewAssignedRide) {
        Vibration.vibrate(500);

        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Nouvelle course 🚖',
            body: 'Une nouvelle course vient d’être attribuée.',
          },
          trigger: null,
        });
      }

      setRides(driverRides);
      ridesRef.current = driverRides;

      setDoc(
        doc(db, 'driversLive', CURRENT_DRIVER_ID),
        {
          driverId: CURRENT_DRIVER_ID,
          isOnline: onlineRef.current,
          isBusy: hasBusyRide(driverRides),
          updatedAt: new Date(),
        },
        { merge: true }
      );
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const startLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Localisation refusée',
          'Active la localisation pour voir le GPS chauffeur.'
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({});

      const currentPosition = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setDriverLocation(currentPosition);
      await updateDriverLive(currentPosition);

      mapRef.current?.animateToRegion({
        ...currentPosition,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 4000,
          distanceInterval: 5,
        },
        async (location) => {
          const newPosition = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          setDriverLocation(newPosition);
          await updateDriverLive(newPosition);

          mapRef.current?.animateToRegion({
            ...newPosition,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          });
        }
      );
    };

    startLocation();

    return () => {
  subscription?.remove();

  updateDriverLive({
    latitude: driverLocation.latitude,
    longitude: driverLocation.longitude,
  });

  setDoc(
    doc(db, 'driversLive', CURRENT_DRIVER_ID),
    {
      isOnline: false,
      updatedAt: new Date(),
    },
    { merge: true }
  );
};
  }, []);

  const filteredRides = useMemo(() => {
    if (filter === 'Toutes') return rides;
    return rides.filter((ride) => normalizeStatus(ride.status) === filter);
  }, [filter, rides]);

  const activeRide = rides.find((ride) => ACTIVE_STATUSES.includes(normalizeStatus(ride.status)));

  const completedRides = rides.filter((ride) => normalizeStatus(ride.status) === 'Terminée');
  const today = new Date().toLocaleDateString('fr-FR');

const todayCompletedRides = completedRides.filter(
  (ride) => {
    const rideDate = ride.finishedAt?.toDate
      ? ride.finishedAt
          .toDate()
          .toLocaleDateString('fr-FR')
      : null;

    return rideDate === today;
  }
);

const todayEarnings =
  todayCompletedRides.reduce(
    (sum, ride) => {
      const n = parseInt(
        String(ride.price || '0').replace(/\D/g, ''),
        10
      );

      return sum + (isNaN(n) ? 0 : n);
    },
    0
  );
const dailyGoal = 20000;
const progressPercent = Math.min(
  (todayEarnings / dailyGoal) * 100,
  100
);
const bonusReached =
  todayEarnings >= dailyGoal;
  const completedCount =
  completedRides.length;

const badges = [];
let driverLevel = '🥉 Bronze';

if (completedCount >= 20) {
  driverLevel = '🥈 Silver';
}

if (completedCount >= 50) {
  driverLevel = '🥇 Gold';
}

if (
  completedCount >= 100 &&
  driverRating >= 4.9
) {
  driverLevel = '💎 Diamond';
}

if (completedCount >= 10) {
  badges.push('🚖 Chauffeur actif');
}

if (driverRating >= 4.8) {
  badges.push('⭐ Chauffeur fiable');
}

if (bonusReached) {
  badges.push('💎 Objectif atteint');
}

if (isOnline) {
  badges.push('🟢 En ligne');
}
<View style={styles.levelCard}>
  <Text style={styles.levelTitle}>
    Niveau chauffeur
  </Text>

  <Text style={styles.levelValue}>
    {driverLevel}
  </Text>
</View>
  const totalEarnings = completedRides.reduce((sum, ride) => {
    const n = parseInt(String(ride.price || '0').replace(/\D/g, ''), 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const liveEarnings = rides.reduce((sum, ride) => {
    const n = parseInt(String(ride.price || '0').replace(/\D/g, ''), 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const callClient = (phone?: string) => {
    if (!phone) return Alert.alert('Numéro indisponible');
    Linking.openURL(`tel:${phone}`);
  };

  const whatsappClient = (phone?: string) => {
    if (!phone) return Alert.alert('WhatsApp indisponible');
    const cleanPhone = phone.replace('+', '').replace(/\s/g, '');
    Linking.openURL(`https://wa.me/${cleanPhone}`);
  };

  const openNavigation = (latitude?: number, longitude?: number) => {
    if (!latitude || !longitude) {
      Alert.alert('Position indisponible', 'Les coordonnées du client ne sont pas encore disponibles.');
      return;
    }

    const url = Platform.select({
      ios: `maps://app?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });

    if (url) Linking.openURL(url);
  };

  const updateRideStatus = async (rideId: string, status: string) => {
    const finalStatus = normalizeStatus(status);
    const isBusy = ACTIVE_STATUSES.includes(finalStatus);

    await updateDoc(doc(db, 'rides', rideId), {
  status: finalStatus,
 ...(finalStatus === 'Refusée'
    ? {
        driverId: null,
        driverName: null,
        driverPhone: null,
        driverCar: null,
driverPlate: null,
driverPhoto: null,
      }
    : {}),
  ...(finalStatus === 'Terminée' ? { finishedAt: new Date() } : {}),
});
if (finalStatus === 'Acceptée') {
  Notifications.scheduleNotificationAsync({
    content: {
      title: 'Course acceptée ✅',
      body: 'Le chauffeur a accepté la réservation.',
      sound: true,
    },
    trigger: null,
  });
}
if (finalStatus === 'En route') {
  Notifications.scheduleNotificationAsync({
    content: {
      title: 'Chauffeur en route 🚖',
      body: 'Votre chauffeur arrive vers vous.',
      sound: true,
    },
    trigger: null,
  });
}
if (finalStatus === 'Arrivé') {
  Notifications.scheduleNotificationAsync({
    content: {
      title: 'Chauffeur arrivé 📍',
      body: 'Votre chauffeur est arrivé sur place.',
      sound: true,
    },
    trigger: null,
  });
}
if (finalStatus === 'Terminée') {
  Notifications.scheduleNotificationAsync({
    content: {
      title: 'Course terminée ✅',
      body: 'Merci d’avoir utilisé PROTAXI24.',
      sound: true,
    },
    trigger: null,
  });
}

await updateDoc(doc(db, 'driversLive', CURRENT_DRIVER_ID), {
  isBusy: ['Acceptée', 'En route', 'Arrivé'].includes(finalStatus),
  currentRideId: ['Acceptée', 'En route', 'Arrivé'].includes(finalStatus)
    ? rideId
    : '',
  updatedAt: new Date(),
});
 
    await setDoc(
      doc(db, 'driversLive', CURRENT_DRIVER_ID),
      {
        driverId: CURRENT_DRIVER_ID,
        isBusy,
        isOnline,
        updatedAt: new Date(),
      },
      { merge: true }
    );
  };

  const clientLatitude = activeRide?.clientLatitude || activeRide?.latitude || 36.47;
  const clientLongitude = activeRide?.clientLongitude || activeRide?.longitude || 7.435;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.title}>DRIVER DASHBOARD</Text>
            <Text style={styles.subtitle}>PROTAXI Driver Live System</Text>
          </View>

          <View style={styles.switchContainer}>
            <Text style={[styles.onlineText, { color: isOnline ? '#4ADE80' : '#EF4444' }]}>
              {isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
            </Text>

            <Switch
              value={isOnline}
             onValueChange={(value) => {
  setIsOnline(value);

  if (!value) {
    updateDriverLive(driverLocation);
  }
}}
              trackColor={{ false: '#3A3A3A', true: '#4ADE80' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.heroCard}>
          <View>
            <Text style={styles.heroHello}>Bonjour, Chauffeur 👋</Text>
            <Text style={styles.heroSub}>Votre activité PROTAXI en direct</Text>
          </View>

          <View style={styles.ratingCircle}>
           <Text style={styles.ratingText}>
  {rides[0]?.averageRating
    ? Number(rides[0].averageRating).toFixed(1)
    : '5.0'}
</Text>
            <Ionicons name="star" size={15} color={gold} />
          </View>
        </View>

        <View style={styles.mapBox}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
              latitudeDelta: 0.035,
              longitudeDelta: 0.035,
            }}
          >
            <Marker coordinate={driverLocation} title="Chauffeur" />

            {activeRide && (
              <>
                <Marker
                  coordinate={{ latitude: clientLatitude, longitude: clientLongitude }}
                  title="Client"
                />
                <Polyline
                  coordinates={[
                    driverLocation,
                    { latitude: clientLatitude, longitude: clientLongitude },
                  ]}
                  strokeWidth={4}
                  strokeColor={gold}
                />
              </>
            )}
          </MapView>
        </View>

        <View style={styles.statsRow}>
          <StatCard title="Courses" value={rides.length.toString()} icon="car-sport-outline" />
          <StatCard title="Gains" value={`${totalEarnings} DA`} icon="cash-outline" />
          <StatCard title="Live" value={`${liveEarnings} DA`} icon="flash-outline" />
          <StatCard
                        title="Aujourd’hui"
                          value={`${todayEarnings} DA`}
                              icon="wallet-outline"
        />
          <StatCard
                     title="Courses jour"
                            value={todayCompletedRides.length.toString()}
                               icon="speedometer-outline"
        />

        </View>
<TouchableOpacity
  style={styles.revenueBtn}
  onPress={() => Alert.alert(
    'Revenus chauffeur',
    `Aujourd’hui : ${todayEarnings} DA\nCourses du jour : ${todayCompletedRides.length}\nTotal : ${totalEarnings} DA`
  )}
>
  <Ionicons name="wallet" size={22} color="#111" />
  <Text style={styles.revenueBtnText}>Voir mes revenus</Text>
</TouchableOpacity>

<View style={styles.goalCard}>
  <View style={styles.goalTop}>
    <Text style={styles.goalTitle}>
      Objectif du jour 🎯
    </Text>
<View style={styles.badgesCard}>
  <Text style={styles.badgesTitle}>
    Badges chauffeur
  </Text>

  <View style={styles.badgesRow}>
    {badges.map((badge, index) => (
      <View
        key={index}
        style={styles.badgeItem}
      >
        <Text style={styles.badgeText}>
          {badge}
        </Text>
      </View>
    ))}
  </View>
</View>
    <Text style={styles.goalMoney}>
      {todayEarnings}/{dailyGoal} DA
    </Text>
  </View>

  <View style={styles.progressBar}>
    <View
      style={[
        styles.progressFill,
        {
          width: `${progressPercent}%`,
        },
      ]}
    />
  </View>

  <Text style={styles.goalText}>
    {Math.round(progressPercent)}% atteint
  </Text>
</View>
{bonusReached && (
  <View
    style={{
      marginTop: 14,
      backgroundColor:
        'rgba(34,197,94,0.15)',
      paddingVertical: 10,
      borderRadius: 14,
      alignItems: 'center',
    }}
  >
    <Text
      style={{
        color: '#22C55E',
        fontWeight: '900',
        fontSize: 14,
      }}
    >
      🎉 Objectif atteint !
    </Text>
  </View>
)}
        <View style={styles.filterRow}>
          {['Toutes', 'Attribuée', 'Acceptée', 'En route', 'Arrivé', 'Terminée'].map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.filterBtn, filter === item && styles.filterBtnActive]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeRide && (
          <View style={styles.activeRideCard}>
            <View style={styles.activeTop}>
              <View>
                <Text style={styles.activeLabel}>COURSE ACTIVE</Text>
                <Text style={styles.activePrice}>{activeRide.price || 'Prix à confirmer'}</Text>
              </View>

              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>

            <Text style={styles.activeRouteTitle}>Départ</Text>
            <Text style={styles.activeRouteValue}>{activeRide.departure || 'À confirmer'}</Text>

            <Text style={[styles.activeRouteTitle, { marginTop: 14 }]}>Destination</Text>
            <Text style={styles.activeRouteValue}>{activeRide.destination || 'À confirmer'}</Text>

            <TouchableOpacity
              style={styles.activeNavBtn}
              onPress={() => openNavigation(clientLatitude, clientLongitude)}
            >
              <Ionicons name="navigate" size={22} color="#000" />
              <Text style={styles.activeNavText}>NAVIGUER</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>Courses chauffeur</Text>

        {filteredRides.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="car-outline" size={42} color={gold} />
            <Text style={styles.emptyTitle}>Aucune course</Text>
            <Text style={styles.emptyText}>Les courses apparaîtront ici.</Text>
          </View>
        ) : (
          filteredRides.map((ride) => (
            <View key={ride.id} style={styles.rideCard}>
              <View style={styles.rideTop}>
                <View>
                  <Text style={styles.ridePrice}>{ride.price || 'Prix à confirmer'}</Text>
                  <Text style={styles.rideService}>{ride.service || 'Course PROTAXI'}</Text>
                </View>

                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{normalizeStatus(ride.status)}</Text>
                </View>
              </View>

              <View style={styles.routeBox}>
                <RouteLine />
                <View style={{ flex: 1 }}>
                  <RouteItem title="Départ" value={ride.departure || 'À confirmer'} />
                  <RouteItem title="Destination" value={ride.destination || 'À confirmer'} />
                </View>
              </View>

              <View style={styles.infoGrid}>
                <MiniInfo icon="person-outline" label="Client" value={ride.client || 'Client'} />
                <MiniInfo icon="time-outline" label="Horaire" value={ride.time || '—'} />
                <MiniInfo icon="people-outline" label="Passagers" value={String(ride.passengers || '—')} />
                <MiniInfo icon="briefcase-outline" label="Bagages" value={String(ride.bags || '—')} />
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.roundBtn} onPress={() => callClient(ride.phone)}>
                  <Ionicons name="call-outline" size={22} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.roundBtn} onPress={() => whatsappClient(ride.phone)}>
                  <Ionicons name="logo-whatsapp" size={22} color="#FFF" />
                </TouchableOpacity>

                {normalizeStatus(ride.status) === 'Attribuée' && (
                  <>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => updateRideStatus(ride.id, 'Acceptée')}>
                      <Text style={styles.acceptText}>ACCEPTER</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.rejectBtn} onPress={() => updateRideStatus(ride.id, 'Refusée')}>
                      <Text style={styles.rejectText}>REFUSER</Text>
                    </TouchableOpacity>
                  </>
                )}

                {normalizeStatus(ride.status) === 'Acceptée' && (
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => updateRideStatus(ride.id, 'En route')}>
                    <Text style={styles.acceptText}>EN ROUTE</Text>
                  </TouchableOpacity>
                )}

                {normalizeStatus(ride.status) === 'En route' && (
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => updateRideStatus(ride.id, 'Arrivé')}>
                    <Text style={styles.acceptText}>ARRIVÉ</Text>
                  </TouchableOpacity>
                )}

                {normalizeStatus(ride.status) === 'Arrivé' && (
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => updateRideStatus(ride.id, 'Terminée')}>
                    <Text style={styles.acceptText}>TERMINER</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}


  <View style={styles.reviewsCard}>
  <Text style={styles.reviewsTitle}>
    Avis clients ⭐
  </Text>

  {recentReviews.slice(0, 5).map((review) => (
    <View
      key={review.id}
      style={styles.reviewItem}
    >
      <View>
        <Text style={styles.reviewRating}>
          ⭐ {review.rating}/5
        </Text>

        <Text style={styles.reviewComment}>
          {review.comment || 'Aucun commentaire'}
        </Text>
      </View>
    </View>
  ))}
</View>



        <View style={{ height: 45 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ title, value, icon }: any) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color={gold} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

function RouteLine() {
  return (
    <View style={styles.routeLineBox}>
      <View style={styles.greenDot} />
      <View style={styles.verticalLine} />
      <View style={styles.redDot} />
    </View>
  );
}

function RouteItem({ title, value }: any) {
  return (
    <View style={styles.routeItem}>
      <Text style={styles.routeTitle}>{title}</Text>
      <Text style={styles.routeValue}>{value}</Text>
    </View>
  );
}

function MiniInfo({ icon, label, value }: any) {
  return (
    <View style={styles.miniInfo}>
      <Ionicons name={icon} size={18} color={gold} />
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: bg, paddingHorizontal: 18 },
  header: {
    paddingTop: 54,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#AFAFAF', fontSize: 13, marginTop: 4 },
  switchContainer: { alignItems: 'center' },
  onlineText: { fontSize: 11, fontWeight: '900', marginBottom: 2 },
  heroCard: {
    borderRadius: 28,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.22)',
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroHello: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  heroSub: { color: '#AAA', fontSize: 13, marginTop: 5 },
  ratingCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 3,
    borderColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  mapBox: {
    height: 190,
    borderRadius: 28,
    overflow: 'hidden',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },
  map: { flex: 1 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    height: 102,
    borderRadius: 22,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: { color: '#FFF', fontSize: 18, fontWeight: '900', marginTop: 8 },
  statTitle: { color: '#AAA', fontSize: 12, marginTop: 4 },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  filterBtn: {
    height: 42,
    borderRadius: 16,
    paddingHorizontal: 15,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: gold, borderColor: gold },
  filterText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  filterTextActive: { color: '#111' },
  activeRideCard: {
    backgroundColor: '#131313',
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.35)',
    padding: 22,
    marginBottom: 22,
  },
  activeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeLabel: { color: gold, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  activePrice: { color: '#FFF', fontSize: 34, fontWeight: '900', marginTop: 6 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74,222,128,0.15)',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 18,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
    marginRight: 8,
  },
  liveText: { color: '#4ADE80', fontWeight: '900', fontSize: 13 },
  activeRouteTitle: {
    color: '#AFAFAF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 18,
  },
  activeRouteValue: { color: '#FFF', fontSize: 17, fontWeight: '900', marginTop: 5 },
  activeNavBtn: {
    height: 60,
    borderRadius: 18,
    backgroundColor: gold,
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeNavText: { color: '#000', fontSize: 16, fontWeight: '900', marginLeft: 10 },
  sectionTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', marginBottom: 12 },
  emptyBox: {
    borderRadius: 24,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    padding: 28,
    alignItems: 'center',
  },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', marginTop: 12 },
  emptyText: { color: '#AAA', fontSize: 13, marginTop: 6, textAlign: 'center' },
  rideCard: {
    backgroundColor: card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    marginBottom: 16,
  },
  rideTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ridePrice: { color: '#FFF', fontSize: 28, fontWeight: '900' },
  rideService: { color: gold, fontSize: 13, fontWeight: '800', marginTop: 4 },
  statusBadge: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,215,0,0.15)',
  },
  statusText: { color: gold, fontSize: 12, fontWeight: '900' },
  routeBox: { flexDirection: 'row', marginTop: 20 },
  routeLineBox: { width: 28, alignItems: 'center', paddingTop: 6 },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  verticalLine: {
    width: 2,
    height: 46,
    backgroundColor: '#333',
    marginVertical: 5,
  },
  routeItem: { paddingBottom: 18 },
  routeTitle: { color: '#AAA', fontSize: 12, fontWeight: '700' },
  routeValue: { color: '#FFF', fontSize: 16, fontWeight: '900', marginTop: 4 },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  miniInfo: {
    width: '48%',
    borderRadius: 18,
    backgroundColor: '#151515',
    padding: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  miniLabel: { color: '#AAA', fontSize: 11, marginTop: 6 },
  miniValue: { color: '#FFF', fontSize: 13, fontWeight: '900', marginTop: 3 },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  roundBtn: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#191919',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptText: { color: '#111', fontSize: 15, fontWeight: '900' },
  rejectBtn: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  revenueBtn: {
  height: 56,
  borderRadius: 18,
  backgroundColor: gold,
  marginBottom: 18,
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 10,
},

revenueBtnText: {
  color: '#111',
  fontSize: 15,
  fontWeight: '900',
},

reviewsCard: {
  backgroundColor: card,
  borderRadius: 28,
  borderWidth: 1,
  borderColor: border,
  padding: 20,
  marginTop: 12,
},

reviewsTitle: {
  color: '#FFF',
  fontSize: 18,
  fontWeight: '900',
  marginBottom: 16,
},

reviewItem: {
  borderBottomWidth: 1,
  borderBottomColor: '#1B1B1B',
  paddingBottom: 14,
  marginBottom: 14,
},

reviewRating: {
  color: gold,
  fontSize: 15,
  fontWeight: '900',
},

reviewComment: {
  color: '#DDD',
  fontSize: 13,
  marginTop: 6,
  lineHeight: 20,
},
goalCard: {
  backgroundColor: card,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: border,
  padding: 18,
  marginBottom: 18,
},

goalTop: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

goalTitle: {
  color: '#FFF',
  fontSize: 16,
  fontWeight: '900',
},

goalMoney: {
  color: gold,
  fontSize: 15,
  fontWeight: '900',
},

progressBar: {
  height: 12,
  borderRadius: 8,
  backgroundColor: '#1B1B1B',
  marginTop: 18,
  overflow: 'hidden',
},

progressFill: {
  height: '100%',
  backgroundColor: '#22C55E',
  borderRadius: 8,
},

goalText: {
  color: '#AAA',
  fontSize: 13,
  marginTop: 10,
  fontWeight: '700',
},
badgesCard: {
  backgroundColor: card,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: border,
  padding: 18,
  marginBottom: 18,
},

badgesTitle: {
  color: '#FFF',
  fontSize: 17,
  fontWeight: '900',
  marginBottom: 14,
},

badgesRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
},

badgeItem: {
  backgroundColor: '#1A1A1A',
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderWidth: 1,
  borderColor: '#2A2A2A',
},

badgeText: {
  color: '#FFF',
  fontSize: 13,
  fontWeight: '800',
}, 
levelCard: {
  backgroundColor: card,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: border,
  padding: 22,
  marginBottom: 18,
  alignItems: 'center',
},

levelTitle: {
  color: '#AAA',
  fontSize: 14,
  fontWeight: '700',
},

levelValue: {
  color: gold,
  fontSize: 28,
  fontWeight: '900',
  marginTop: 10,
},

});