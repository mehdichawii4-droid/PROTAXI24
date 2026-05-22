import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getDistance } from 'geolib';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import MapView, { Marker } from 'react-native-maps';
import { db } from '../firebaseConfig';

const gold = '#FFD700';
const card = '#0E0E0E';
const border = '#262626';

export default function AdminDashboardScreen() {
  const [filter, setFilter] = useState('Toutes');
  const [adminRequests, setAdminRequests] = useState<any[]>([]);
  const [driversLive, setDriversLive] = useState<any[]>([]);
  const [companyRevenue, setCompanyRevenue] = useState(0);
  const [driversRevenue, setDriversRevenue] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayRides, setTodayRides] = useState(0);
  const [weeklyRevenue, setWeeklyRevenue] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [topDriver, setTopDriver] = useState<any>(null);
  const [averageRide, setAverageRide] = useState(0);
  const [averageRating, setAverageRating] = useState(5);
const [ratingsCount, setRatingsCount] = useState(0);
const [drivers, setDrivers] = useState<any[]>([]);
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'rides'), (snapshot) => {
      const ridesData = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          status: String(data.status || '').trim(),
        };
      });

ridesData.forEach(async (ride: any) => {
  if (
    ride.status === 'En attente' &&
    ride.createdAt?.toDate
  ) {

ridesData.forEach(async (ride: any) => {
  if (
    ride.status === 'Attribuée' &&
    ride.assignedAt?.toDate
  ) {
    const assigned =
      ride.assignedAt.toDate().getTime();

    const now = Date.now();

    const diffSeconds =
      (now - assigned) / 1000;

    if (diffSeconds >= 60) {
      await updateDoc(
        doc(db, 'rides', ride.id),
        {
          status: 'En attente',
          driverId: null,
          driverName: null,
          driverPhone: null,
          driverCar: null,
          driverPlate: null,
          driverPhoto: null,
        }
      );

      if (ride.driverId) {
        await updateDoc(
          doc(db, 'driversLive', ride.driverId),
          {
            isBusy: false,
            currentRideId: '',
            updatedAt: new Date(),
          }
        );
      }
    }
  }
});


    const created =
      ride.createdAt.toDate().getTime();

    const now = Date.now();

    const diffMinutes =
      (now - created) / 1000 / 60;

    if (diffMinutes >= 5) {
      await updateDoc(
        doc(db, 'rides', ride.id),
        {
          status: 'Expirée',
        }
      );
    }
  }
});


      const finishedRides = ridesData.filter(
        (ride: any) => ride.status === 'Terminée'
      );

      let company = 0;
      let drivers = 0;
      let todayTotal = 0;
      let todayCount = 0;
      let totalFinishedAmount = 0;

      const weekData = [0, 0, 0, 0, 0, 0, 0];
      const driversStats: any = {};
      const today = new Date().toLocaleDateString('fr-FR');

      finishedRides.forEach((ride: any) => {
        const amount = parseInt(
          String(ride.price || '0').replace(/\D/g, ''),
          10
        );

        totalFinishedAmount += amount;
        company += amount * 0.15;
        drivers += amount * 0.85;

        if (ride.driverName) {
          if (!driversStats[ride.driverName]) {
            driversStats[ride.driverName] = {
              rides: 0,
              revenue: 0,
            };
          }

          driversStats[ride.driverName].rides += 1;
          driversStats[ride.driverName].revenue += amount;
        }

        const rideDate = ride.finishedAt?.toDate
          ? ride.finishedAt.toDate().toLocaleDateString('fr-FR')
          : null;

        if (rideDate === today) {
          todayTotal += amount;
          todayCount += 1;
        }

        const rideRealDate = ride.finishedAt?.toDate
          ? ride.finishedAt.toDate()
          : null;

        if (rideRealDate) {
          const dayIndex = rideRealDate.getDay();
          weekData[dayIndex] += amount;
        }
      });

      const bestDriver = Object.entries(driversStats).sort(
        (a: any, b: any) => b[1].revenue - a[1].revenue
      )[0];

      setTopDriver(
        bestDriver
          ? {
              name: bestDriver[0],
              rides: (bestDriver[1] as any).rides,
              revenue: (bestDriver[1] as any).revenue,
            }
          : null
      );

      setCompanyRevenue(company);
      setDriversRevenue(drivers);
      setTodayRevenue(todayTotal);
      setTodayRides(todayCount);
      setWeeklyRevenue(weekData);
      setAverageRide(
        finishedRides.length > 0
          ? Math.round(totalFinishedAmount / finishedRides.length)
          : 0
      );
      const ratedRides = ridesData.filter(
  (ride: any) => ride.rating
);

const totalRatings = ratedRides.reduce(
  (sum: number, ride: any) =>
    sum + Number(ride.rating || 0),
  0
);

setRatingsCount(ratedRides.length);

setAverageRating(
  ratedRides.length > 0
    ? totalRatings / ratedRides.length
    : 5
);
      setAdminRequests(ridesData);

      const latestRide = ridesData[0];

if (
  latestRide &&
  latestRide.status === 'En attente'
) {
  Notifications.scheduleNotificationAsync({
    content: {
      title: 'Nouvelle réservation 🚖',
     body: `${(latestRide as any).departure || 'Départ'} → ${(latestRide as any).destination || 'Destination'}`,
      sound: true,
    },
    trigger: null,
  });
}
    });

    return () => unsubscribe();
  }, []);
useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'driversLive'),
    (snapshot) => {
      const driversData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setDrivers(driversData);
    }
  );

  return () => unsubscribe();
}, []);
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'driversLive'), (snapshot) => {
      const driversData = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setDriversLive(driversData);
    });

    return () => unsubscribe();
  }, []);

  const filteredRequests = useMemo(() => {
    if (filter === 'Toutes') return adminRequests;

    return adminRequests.filter(
      (item) =>
        String(item.status || '').toLowerCase().trim() ===
        filter.toLowerCase().trim()
    );
  }, [filter, adminRequests]);

  const onlineDrivers = driversLive.filter((d) => d.isOnline).length;
  const busyDrivers = driversLive.filter((d) => d.isBusy).length;

  const saveNotification = async (title: string, message: string) => {
    const oldData = await AsyncStorage.getItem('notifications');
    const oldList = oldData ? JSON.parse(oldData) : [];

    const newNotification = {
      id: Date.now().toString(),
      title,
      message,
      date: new Date().toLocaleString('fr-FR'),
      read: false,
    };

    await AsyncStorage.setItem(
      'notifications',
      JSON.stringify([...oldList, newNotification])
    );
  };

  const callClient = (phone?: string) => {
    if (!phone) return Alert.alert('Numéro indisponible');
    Linking.openURL(`tel:${phone}`);
  };

  const whatsappClient = (phone?: string) => {
    if (!phone) return Alert.alert('WhatsApp indisponible');
    const cleanPhone = phone.replace('+', '').replace(/\s/g, '');
    Linking.openURL(`https://wa.me/${cleanPhone}`);
  };

  const assignNearestDriver = async (ride: any) => {
  const availableDrivers = drivers.filter(
  (driver) =>
    driver.isOnline &&
    !driver.isBusy
);
  if (availableDrivers.length === 0) {
    Alert.alert('Aucun chauffeur disponible');
    return;
  }

  const nearestDriver = availableDrivers
    .sort((a, b) => {
      const distanceA = getDistance(
        { latitude: ride.latitude || 36.462, longitude: ride.longitude || 7.426 },
        { latitude: a.latitude || 36.462, longitude: a.longitude || 7.426 }
      );

      const distanceB = getDistance(
        { latitude: ride.latitude || 36.462, longitude: ride.longitude || 7.426 },
        { latitude: b.latitude || 36.462, longitude: b.longitude || 7.426 }
      );

      return distanceA - distanceB;
    })[0];

if (nearestDriver.isBusy) {
  Alert.alert(
    'Chauffeur occupé',
    'Ce chauffeur possède déjà une course.'
  );

  return;
}


const finalDriverId =
  nearestDriver.driverId || nearestDriver.id;

const finalDriverName =
  nearestDriver.driverName ||
  nearestDriver.name ||
  'Taxi Mehdi 24';

const finalDriverPhone =
  nearestDriver.driverPhone ||
  nearestDriver.phone ||
  '';

const finalDriverPhoto =
  nearestDriver.photo ||
  'https://i.imgur.com/6VBx3io.png';

const finalDriverPlate =
  nearestDriver.plate || '24-000-16';

const finalDriverCar =
  nearestDriver.car || 'Renault Clio • Berline';
if (ride.driverId) {
  Alert.alert(
    'Déjà attribuée',
    'Cette course possède déjà un chauffeur.'
  );

  return;
}

if (ride.status === 'Annulée') {
  Alert.alert(
    'Course annulée',
    'Impossible d’attribuer une course annulée.'
  );

  return;
}


if (ride.status === 'Terminée') {
  Alert.alert(
    'Déjà terminée',
    'Cette course est déjà terminée.'
  );

  return;
}


await updateDoc(doc(db, 'rides', ride.id), {
  status: 'Attribuée',

  driverId: finalDriverId,
  driverName: finalDriverName,
  driverPhone: finalDriverPhone,

  driverPhoto: finalDriverPhoto,
  driverPlate: finalDriverPlate,
  driverCar: finalDriverCar,

  assignedAt: new Date(),
});
  await updateDoc(doc(db, 'driversLive', nearestDriver.id), {
    isBusy: true,
    currentRideId: ride.id,
    updatedAt: new Date(),
  });

  await saveNotification(
    'Chauffeur attribué',
    `${finalDriverName} a reçu une course.`
  );

  Alert.alert('Chauffeur attribué automatiquement 🚖');
};

  const finishRequest = async (ride: any) => {
    await updateDoc(doc(db, 'rides', ride.id), {
      status: 'Terminée',
      finishedAt: new Date(),
    });

    if (ride.driverId) {
      const driverFound = driversLive.find(
        (driver) => driver.driverId === ride.driverId
      );

      if (driverFound) {
       await updateDoc(doc(db, 'driversLive', driverFound.id), {
  isBusy: false,
  currentRideId: '',
  updatedAt: new Date(),
});
      }
    }

    await saveNotification(
      'Course terminée',
      'Une course a été marquée comme terminée.'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <View>
            <Text style={styles.title}>ADMIN PROTAXI</Text>
            <Text style={styles.subtitle}>Dispatch • Business • Live GPS</Text>
          </View>

          <View style={styles.adminIcon}>
            <MaterialCommunityIcons name="shield-crown" size={28} color={gold} />
          </View>
        </View>

        <View style={styles.analyticsRow}>
          <BigCard title="Revenus société" value={`${Math.round(companyRevenue).toLocaleString('fr-FR')} DA`} />
          <BigCard title="Revenus chauffeurs" value={`${Math.round(driversRevenue).toLocaleString('fr-FR')} DA`} />
        </View>

        <View style={styles.statsRow}>
          <StatCard title="Demandes" value={adminRequests.length} icon="file-document-outline" />
          <StatCard title="En attente" value={adminRequests.filter((i) => i.status === 'En attente').length} icon="time-outline" />
          <StatCard title="Chauffeurs" value={driversLive.length} icon="car-multiple" />
        </View>

        <View style={styles.businessStatsContainer}>
          <BusinessCard icon="cash" color={gold} value={`${todayRevenue.toLocaleString('fr-FR')} DA`} label="Revenus Aujourd’hui" />
          <BusinessCard icon="car-sport" color="#4ADE80" value={todayRides} label="Courses Terminées" />
          <BusinessCard icon="business" color="#00BFFF" value={`${Math.round(companyRevenue).toLocaleString('fr-FR')} DA`} label="Commission Société" />
        </View>

        <View style={styles.businessStatsContainer}>
          <BusinessCard icon="radio-button-on" color="#4ADE80" value={onlineDrivers} label="Chauffeurs en ligne" />
          <BusinessCard icon="alert-circle" color="#F59E0B" value={busyDrivers} label="Chauffeurs occupés" />
          <BusinessCard icon="calculator" color="#A78BFA" value={`${averageRide.toLocaleString('fr-FR')} DA`} label="Moyenne course" />
        </View>
<BusinessCard
  icon="star"
  color="#FFD700"
  value={averageRating.toFixed(1)}
  label={`${ratingsCount} avis clients`}
/>
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Revenus de la semaine</Text>

          <LineChart
            data={{
              labels: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
              datasets: [{ data: weeklyRevenue }],
            }}
            width={Dimensions.get('window').width - 36}
            height={220}
            yAxisSuffix=" DA"
            chartConfig={{
              backgroundGradientFrom: '#111',
              backgroundGradientTo: '#111',
              decimalPlaces: 0,
              color: () => gold,
              labelColor: () => '#AAA',
              propsForDots: {
                r: '5',
                strokeWidth: '2',
                stroke: gold,
              },
            }}
            bezier
            style={styles.chart}
          />
        </View>

        {topDriver && (
          <View style={styles.topDriverCard}>
            <View style={styles.topDriverHeader}>
              <Ionicons name="trophy" size={30} color={gold} />
              <Text style={styles.topDriverTitle}>Chauffeur #1</Text>
            </View>

            <Text style={styles.topDriverName}>{topDriver.name}</Text>
            <Text style={styles.topDriverStats}>🚖 {topDriver.rides} courses</Text>
            <Text style={styles.topDriverRevenue}>
              💰 {topDriver.revenue.toLocaleString('fr-FR')} DA
            </Text>
          </View>
        )}

        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: 36.462,
              longitude: 7.426,
              latitudeDelta: 0.3,
              longitudeDelta: 0.3,
            }}
          >
            {driversLive
              .filter((driver) => driver.latitude && driver.longitude)
              .map((driver) => (
                <Marker
                  key={driver.id}
                  coordinate={{
                    latitude: driver.latitude,
                    longitude: driver.longitude,
                  }}
                  title={driver.driverName || driver.driverId || 'Chauffeur'}
                  description={
                    driver.isBusy
                      ? '🟠 Occupé'
                      : driver.isOnline
                      ? '🟢 Disponible'
                      : '🔴 Hors ligne'
                  }
                  pinColor={driver.isBusy ? 'orange' : driver.isOnline ? 'green' : 'red'}
                />
              ))}
          </MapView>
        </View>
<View style={styles.driversSection}>
  <Text style={styles.sectionTitle}>
    Chauffeurs en direct
  </Text>

  {driversLive.map((driver) => (
    <View
      key={driver.id}
      style={styles.driverLiveCard}
    >
      <View>
        <Text style={styles.driverLiveName}>
          {driver.driverName ||
            driver.name ||
            'Taxi Mehdi 24'}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            marginTop: 5,
          }}
        >
          <View
            style={[
              styles.driverStatus,
              {
                backgroundColor: driver.isBusy
                  ? '#FF9500'
                  : driver.isOnline
                  ? '#22C55E'
                  : '#FF4B4B',
              },
            ]}
          />

          <Text style={styles.driverStatusText}>
            {driver.isBusy
              ? 'Occupé'
              : driver.isOnline
              ? 'Disponible'
              : 'Hors ligne'}
          </Text>
        </View>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.driverCar}>
          {driver.car || 'Renault Clio'}
        </Text>

        <Text style={styles.driverPlate}>
          {driver.plate || '24-000-16'}
        </Text>
      </View>
    </View>
  ))}
</View>
        <View style={styles.filterRow}>
          {['Toutes', 'En attente', 'Attribuée', 'Refusée', 'Expirée', 'Terminée'].map((item) => (
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

        {filteredRequests.map((item) => (
          <View key={item.id} style={styles.requestCard}>
            <View style={styles.requestTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestId}>{item.id}</Text>
                <Text style={styles.clientName}>{item.client || 'Client'}</Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  item.status === 'En attente' && styles.pendingBadge,
                  item.status === 'Attribuée' && styles.assignedBadge,
                  item.status === 'Terminée' && styles.finishedBadge,
                  item.status === 'Refusée' && styles.rejectedBadge,
                ]}
              >
                <Text style={styles.statusText}>{item.status || '—'}</Text>
              </View>
            </View>

            <InfoRow icon="car-sport-outline" label="Service" value={item.service} />
            <InfoRow icon="location-outline" label="Départ" value={item.departure} />
            <InfoRow icon="navigate-outline" label="Destination" value={item.destination} />
            <InfoRow icon="cash-outline" label="Prix" value={item.price} />
            <InfoRow icon="time-outline" label="Horaire" value={item.time} />

            {item.driverName && (
              <>
                <InfoRow icon="person-outline" label="Chauffeur" value={item.driverName} />
                <InfoRow icon="car-outline" label="Véhicule" value={item.driverCar || 'À confirmer'} />
              </>
            )}

            <View style={styles.actionsRow}>
              {item.status === 'Attribuée' && (
                <TouchableOpacity style={styles.finishBtn} onPress={() => finishRequest(item)}>
                  <Ionicons name="checkmark-done-outline" size={21} color="#111" />
                  <Text style={styles.finishText}>Terminer</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.actionBtn} onPress={() => callClient(item.phone)}>
                <Ionicons name="call-outline" size={22} color="#FFF" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={() => whatsappClient(item.phone)}>
                <Ionicons name="logo-whatsapp" size={22} color="#FFF" />
              </TouchableOpacity>

             {['En attente', 'Refusée'].includes(item.status) && (
  <TouchableOpacity
    style={styles.assignBtn}
    onPress={() => assignNearestDriver(item)}
  >
    <MaterialCommunityIcons
      name="account-tie"
      size={22}
      color="#111"
    />

    <Text style={styles.assignText}>
      Attribuer
    </Text>
  </TouchableOpacity>
)}
            </View>
          </View>
        ))}

        <View style={{ height: 45 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function BigCard({ title, value }: any) {
  return (
    <View style={styles.analyticsCard}>
      <Text style={styles.analyticsTitle}>{title}</Text>
      <Text style={styles.analyticsValue}>{value}</Text>
    </View>
  );
}

function StatCard({ title, value, icon }: any) {
  return (
    <View style={styles.statCard}>
      <MaterialCommunityIcons name={icon} size={25} color={gold} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

function BusinessCard({ icon, color, value, label }: any) {
  return (
    <View style={styles.businessStatCard}>
      <Ionicons name={icon} size={28} color={color} />
      <Text style={styles.businessStatValue}>{value}</Text>
      <Text style={styles.businessStatLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={19} color={gold} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>

      <Text numberOfLines={2} style={styles.infoValue}>
        {value || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505', paddingHorizontal: 18 },

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

  adminIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#171307',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
  },

  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },

  subtitle: {
    color: '#AFAFAF',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },

  analyticsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },

  analyticsCard: {
    flex: 1,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.25)',
  },

  analyticsTitle: {
    color: '#AAA',
    fontSize: 13,
    fontWeight: '700',
  },

  analyticsValue: {
    color: gold,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 8,
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

  businessStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 10,
  },

  businessStatCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 18,
    padding: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },

  businessStatValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'center',
  },

  businessStatLabel: {
    color: '#AAA',
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
  },

  chartCard: {
    backgroundColor: '#111',
    borderRadius: 22,
    paddingVertical: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
  },

  chartTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 16,
    marginBottom: 12,
  },

  chart: {
    borderRadius: 18,
  },

  topDriverCard: {
    backgroundColor: '#111',
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },

  topDriverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  topDriverTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  topDriverName: {
    color: gold,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 14,
  },

  topDriverStats: {
    color: '#FFF',
    fontSize: 15,
    marginTop: 10,
  },

  topDriverRevenue: {
    color: '#4ADE80',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 8,
  },

  mapContainer: {
    height: 230,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },

  map: { flex: 1 },

  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    flexWrap: 'wrap',
  },

  filterBtn: {
    paddingHorizontal: 15,
    height: 42,
    borderRadius: 16,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  filterBtnActive: {
    backgroundColor: gold,
    borderColor: gold,
  },

  filterText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },

  filterTextActive: { color: '#111' },

  requestCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    marginBottom: 16,
  },

  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    gap: 10,
  },

  requestId: {
    color: gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },

  clientName: {
    color: '#FFF',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 4,
  },

  statusBadge: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  pendingBadge: { backgroundColor: 'rgba(255,165,0,0.15)' },
  assignedBadge: { backgroundColor: 'rgba(255,215,0,0.15)' },
  finishedBadge: { backgroundColor: 'rgba(74,222,128,0.15)' },
  rejectedBadge: { backgroundColor: 'rgba(239,68,68,0.18)' },

  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
    paddingVertical: 12,
    gap: 12,
  },

  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },

  infoLabel: {
    color: '#BEBEBE',
    fontSize: 13,
  },

  infoValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 10,
  },

  actionBtn: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#191919',
    justifyContent: 'center',
    alignItems: 'center',
  },

  assignBtn: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: gold,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },

  assignText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  finishBtn: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#4ADE80',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },

  finishText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  driversSection: {
  marginBottom: 22,
},

sectionTitle: {
  color: '#FFF',
  fontSize: 20,
  fontWeight: '900',
  marginBottom: 14,
},

driverLiveCard: {
  backgroundColor: '#111',
  borderRadius: 20,
  borderWidth: 1,
  borderColor: '#222',
  padding: 16,
  marginBottom: 12,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

driverLiveName: {
  color: '#FFF',
  fontSize: 16,
  fontWeight: '900',
},

driverStatus: {
  width: 12,
  height: 12,
  borderRadius: 6,
},

driverStatusText: {
  color: '#DDD',
  fontSize: 13,
  fontWeight: '700',
},

driverCar: {
  color: gold,
  fontSize: 13,
  fontWeight: '800',
},

driverPlate: {
  color: '#AAA',
  fontSize: 12,
  marginTop: 4,
},
});