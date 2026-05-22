import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';


import { useEffect, useRef, useState } from 'react';
import { Circle } from 'react-native-maps';

import {
  Alert,
  Animated, Image, Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { db } from '../firebaseConfig';

const gold = '#D4A017';
const green = '#2ECC71';
const red = '#FF4B4B';
const blue = '#008CFF';
const phoneLink = '+213671421448';
const GOOGLE_MAPS_API_KEY = 'AIzaSyDYdlqeE8VAWNC8zry90jywNt5ia7vte9E';

export default function CourseTrackingScreen() {
  const params = useLocalSearchParams();
  const rideId = String(params.id || '');
  const driverId = String(params.driverId || 'DRV-001');
  const pulse = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView>(null);

  const [region, setRegion] = useState({
    latitude: 36.462,
    longitude: 7.426,
    latitudeDelta: 0.035,
    longitudeDelta: 0.035,
  });

  const [clientPosition, setClientPosition] = useState({
    latitude: 36.462,
    longitude: 7.426,
  });

  const [driverPosition, setDriverPosition] = useState({
    latitude: 36.455,
    longitude: 7.415,
  });
const [carRotation, setCarRotation] = useState(0);
  const [status, setStatus] = useState(
    String(params.status || 'Chauffeur en route')
  );
const [demoMode, setDemoMode] = useState(false);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [drivers, setDrivers] = useState<any[]>([]);

const arrivedAlertShown = useRef(false);
const finishedAlertShown = useRef(false);
const nearAlertShown = useRef(false);
const locationSubscriptionRef =
  useRef<Location.LocationSubscription | null>(null);
  useEffect(() => {
    getLocation();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    ).start();

    return () => {
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
    };
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
  if (!demoMode) return;

  const interval = setInterval(() => {
    setDriverPosition((prev) => {
      const latDiff =
        clientPosition.latitude - prev.latitude;

      const lngDiff =
        clientPosition.longitude - prev.longitude;

      const step = 0.04;

      const newPosition = {
        latitude: prev.latitude + latDiff * step,
        longitude: prev.longitude + lngDiff * step,
      };

      const distance =
        Math.abs(latDiff) + Math.abs(lngDiff);

      if (
        distance < 0.0005 &&
        !arrivedAlertShown.current
      ) {
        arrivedAlertShown.current = true;

        setStatus('Arrivé');

        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Chauffeur arrivé 📍',
            body: 'Votre chauffeur vous attend.',
            sound: true,
          },
          trigger: null,
        });

        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        clearInterval(interval);
      }

      return newPosition;
    });
  }, 500);

  return () => clearInterval(interval);
}, [demoMode, clientPosition]);
useEffect(() => {
  if (!rideId) return;

  const unsubscribe = onSnapshot(
    doc(db, 'rides', rideId),
    (snapshot) => {
      const data = snapshot.data();
console.log('STATUS FIREBASE = ', data?.status);
      if (data?.status) {
        setStatus(data.status);

        if (
          data.status === 'Arrivé' &&
          !arrivedAlertShown.current
        ) {
          arrivedAlertShown.current = true;

          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );

          Alert.alert(
            'Chauffeur arrivé 📍',
            'Votre chauffeur est arrivé au point de prise en charge.',
            [
              {
                text: 'J’ai compris',
                style: 'default',
              },
            ]
          );
        }

        if (
          data.status === 'Terminée' &&
          !finishedAlertShown.current
        ) {
          finishedAlertShown.current = true;

          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );

          Alert.alert(
            'Course terminée ✅',
            'Merci d’avoir utilisé PROTAXI24. Vous pouvez noter votre chauffeur.',
            [
              {
                text: 'Noter le chauffeur',
                onPress: () =>
                  router.push({
                    pathname: '/rating',
                    params: {
                      rideId,
                      driverId,
                      driverName: 'Taxi Mehdi 24',
                    },
                  }),
              },
              {
                text: 'Plus tard',
                onPress: () =>
                  router.push('/reservation'),
              },
            ]
          );
        }
      }
    }
  );

  return () => unsubscribe();
}, [rideId]);

useEffect(() => {
  if (!driverId) return;

  const unsubscribe = onSnapshot(doc(db, 'driversLive', driverId), (snapshot) => {

    const data = snapshot.data();

    if (!data?.latitude || !data?.longitude) return;

    const newPosition = {
      latitude: data.latitude,
      longitude: data.longitude,
    };

    const angle =
      Math.atan2(
        newPosition.longitude - driverPosition.longitude,
        newPosition.latitude - driverPosition.latitude
      ) *
      (180 / Math.PI);

    setCarRotation(angle);
    setDriverPosition(newPosition);

   mapRef.current?.animateCamera(
  {
    center: newPosition,
    heading: angle,
   pitch: status === 'En route' ? 70 : 45,
zoom: status === 'En route' ? 15 : 17,
  },
  { duration: 1800 }
);
  });

  return () => unsubscribe();
}, [driverId]);

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') return;

    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;

    locationSubscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 4000,
        distanceInterval: 8,
      },
      async (position) => {
        const userPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setClientPosition(userPosition);

        if (rideId) {
          await updateDoc(doc(db, 'rides', rideId), {
            clientLatitude: userPosition.latitude,
            clientLongitude: userPosition.longitude,
            clientUpdatedAt: new Date(),
          });
        }

        setRegion({
          ...userPosition,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        });
      }
    );
  };
  
  const reservationId = String(params.id || Date.now()).slice(-6);

  const pulseSize = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [54, 82],
  });

  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.02],
  });

  const callTaxi = () => {
    Linking.openURL(`tel:${phoneLink}`);
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent(
      `Bonjour PROTAXI24, je suis sur le suivi de ma course #${reservationId}.

Adresse : ${String(params.address || '-')}
Aéroport : ${String(params.airport || '-')}
Heure : ${String(params.time || '-')}
Statut : ${status}`
    );

    Linking.openURL(
      `https://wa.me/${phoneLink.replace('+', '')}?text=${message}`
    );
  };

const openNavigationToClient = () => {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${clientPosition.latitude},${clientPosition.longitude}`;

  Linking.openURL(url);
};


  const cancelRide = () => {
    Alert.alert('Quitter le suivi', 'Voulez-vous quitter cette course ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: () => router.back(),
      },
    ]);
  };


 

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

     <MapView

  ref={mapRef}
  style={styles.map}
  initialRegion={region}
  showsBuildings
showsCompass={false}
showsTraffic
><Circle
  center={clientPosition}
  radius={2500}
  strokeWidth={2}
  strokeColor="rgba(34,197,94,0.7)"
  fillColor="rgba(34,197,94,0.12)"
/>
        <MapViewDirections
          origin={status === 'En route' ? clientPosition : driverPosition}
destination={
  status === 'En route'
    ? {
        latitude: Number(params.destinationLatitude || clientPosition.latitude),
        longitude: Number(params.destinationLongitude || clientPosition.longitude),
      }
    : clientPosition
}
          apikey={GOOGLE_MAPS_API_KEY}
          strokeWidth={7}
strokeColor="#2D9CFF"
lineDashPattern={[0]}
          onReady={(result) => {
            setDistanceKm(result.distance);
            setDurationMin(result.duration);
if (
  result.distance < 1 &&
  result.duration < 2 &&
  !nearAlertShown.current
) {
  nearAlertShown.current = true;

  Haptics.notificationAsync(
    Haptics.NotificationFeedbackType.Success
  );

  Notifications.scheduleNotificationAsync({
    content: {
      title: 'Chauffeur proche 🚖',
      body: 'Votre chauffeur est presque arrivé.',
      sound: true,
    },
    trigger: null,
  });
}

if (
  result.distance < 0.08 &&
  rideId &&
  status !== 'En route' &&
  status !== 'Terminée'
) {
  updateDoc(doc(db, 'rides', rideId), {
    status: 'Arrivé',
    arrivedAt: new Date(),
  });
}
          }}
        />
     {drivers
  .filter((driver) => {
    if (!driver.isOnline) return false;

    const latDiff = Math.abs(
      (driver.latitude || 0) -
        clientPosition.latitude
    );

    const lngDiff = Math.abs(
      (driver.longitude || 0) -
        clientPosition.longitude
    );

    return latDiff < 0.05 && lngDiff < 0.05;
  })
  .map((driver) => {

    const isMainDriver =
      driver.id === driverId;

    return (
      <Marker
        key={driver.id}
        coordinate={{
          latitude: driver.latitude || 36.46,
          longitude: driver.longitude || 7.42,
        }}
        title={driver.driverName || 'PROTAXI'}
      >
        <View
          style={{
            width: isMainDriver ? 52 : 38,
            height: isMainDriver ? 52 : 38,
            borderRadius: isMainDriver ? 26 : 19,
            backgroundColor: driver.isBusy
              ? '#FF9500'
              : '#22C55E',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: '#111',
          }}
        >
          <Ionicons
            name={
              isMainDriver
                ? 'car-sport'
                : 'car-outline'
            }
            size={isMainDriver ? 24 : 18}
            color="#111"
          />
        </View>
      </Marker>
    );
  })}

<Marker
  coordinate={driverPosition}
  title="Votre chauffeur"
>
  <View
  style={[
    styles.driverMarker,
    {
      backgroundColor:
        status === 'En route'
          ? '#22C55E'
          : status === 'Arrivé'
          ? '#F59E0B'
          : gold,
    },
    {
      transform: [
        { rotate: `${carRotation}deg` },
      ],
    },
  ]}
>
     
    <Ionicons
      name="car-sport"
      size={25}
      color="#111"
    />
  </View>
</Marker>
  

        <Marker coordinate={clientPosition} title="Votre position">
          <View style={styles.clientMarkerWrap}>
            <Animated.View
              style={[
                styles.pulseCircle,
                {
                  width: pulseSize,
                  height: pulseSize,
                  opacity: pulseOpacity,
                },
              ]}
            />

            <View style={styles.clientMarker}>
              <Ionicons name="person" size={22} color="#FFF" />
            </View>
          </View>
        </Marker>
      </MapView>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.roundBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={27} color="#FFF" />
        </TouchableOpacity>
<TouchableOpacity
  style={styles.focusDriverBtn}
  onPress={() =>
    mapRef.current?.animateCamera(
      {
        center: driverPosition,
        pitch: 45,
        heading: carRotation,
        zoom: 17,
      },
      { duration: 900 }
    )
  }
>
  <Ionicons name="locate" size={22} color="#111" />
</TouchableOpacity>

<TouchableOpacity
  style={styles.demoBtn}
  onPress={() => setDemoMode((prev) => !prev)}
>
  <Ionicons
    name={demoMode ? 'pause' : 'play'}
    size={22}
    color="#111"
  />
</TouchableOpacity>
        <View style={styles.topTitleBox}>
          <Text style={styles.logo}>
            <Text style={{ color: gold }}>PRO</Text>TAXI24
          </Text>
          <Text style={styles.topSub}>Suivi de votre course</Text>
        </View>

        <TouchableOpacity style={styles.roundBtn} onPress={getLocation}>
          <Ionicons name="locate" size={25} color={gold} />
        </TouchableOpacity>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusIconBox}>
          <Ionicons name="car-sport" size={28} color="#111" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.smallLabel}>STATUT ACTUEL</Text>
          <Text style={styles.statusTitle}>{status}</Text>
          <Text style={styles.statusSub}>
           {status === 'En route'
  ? 'Course en cours vers la destination'
  : 'Chauffeur connecté en temps réel'}
          </Text>
          {durationMin <= 2 && (
  <Text
    style={{
      color: '#2ECC71',
      fontSize: 12,
      fontWeight: '900',
      marginTop: 5,
    }}
  >
    Chauffeur presque arrivé 🚖
  </Text>
)}
        </View>

        <View style={styles.separator} />

        <View>
          <Text style={styles.smallLabel}>ARRIVÉE</Text>
         <Text
  style={[
    styles.metricText,
    {
      color:
        durationMin <= 2
          ? '#2ECC71'
          : durationMin <= 5
          ? '#F59E0B'
          : '#FFF',
    },
  ]}
>
  {Math.ceil(durationMin)} min
</Text>
         <Text style={styles.metricTextSmall}>
  {distanceKm.toFixed(1)} km • ETA LIVE
</Text>
        </View>
      </View>

      <View style={styles.bottomSheet}>
        <View style={styles.handle} />
<View style={styles.etaBanner}>
  <Ionicons name="time" size={20} color="#111" />
  <Text style={styles.etaBannerText}>
    {
  status === 'En route'
    ? `Arrivée à destination dans ${Math.ceil(durationMin)} min`
    : durationMin > 1
    ? `Votre chauffeur arrive dans ${Math.ceil(durationMin)} min`
    : 'Votre chauffeur arrive maintenant'
}
  </Text>
</View>
        <View style={styles.driverCard}>
         <Image
  source={{
    uri:
      String(params.driverPhoto) ||
      'https://i.imgur.com/6VBx3io.png',
  }}
  style={styles.avatar}
/>

          <View style={{ flex: 1 }}>
            <View style={styles.driverNameRow}>
              <Text style={styles.driverName}>
  {String(params.driverName || 'Taxi Mehdi 24')}
</Text>
              <Ionicons name="checkmark-circle" size={20} color={gold} />
            </View>

           <Text style={styles.driverInfo}>
  {String(params.driverCar || 'Renault Clio • Berline')}
</Text>
            <Text style={styles.plate}>
  Plaque : {String(params.driverPlate || '24-000-16')}
</Text>
          </View>

          <View style={styles.rating}>
            <Ionicons name="star" size={15} color={gold} />
            <Text style={styles.ratingText}>5.0</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.callBtn} onPress={callTaxi}>
            <Ionicons name="call" size={23} color="#FFF" />
            <Text style={styles.actionText}>Appeler</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.whatsappBtn} onPress={openWhatsApp}>
            <Ionicons name="logo-whatsapp" size={23} color="#FFF" />
            <Text style={styles.actionText}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navBtn} onPress={openNavigationToClient}>
  <Ionicons name="navigate" size={23} color="#111" />
  <Text style={styles.navText}>Naviguer</Text>
</TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={cancelRide}>
            <Ionicons name="close-circle-outline" size={23} color="#FFF" />
            <Text style={styles.actionText}>Quitter</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tripBox}>
          <InfoLine
            icon="location-outline"
            label="Adresse de départ"
            value={String(params.address || '-')}
          />

          <InfoLine
            icon="airplane-outline"
            label="Destination"
            value={String(params.airport || '-')}
          />

          <View style={styles.gridRow}>
            <MiniBox
              icon="time-outline"
              label="Heure"
              value={String(params.time || '-')}
            />

            <MiniBox
              icon="cash-outline"
              label="Prix"
              value={`${parseInt(String(params.price || '0')) || 0} DZD`}
            />
          </View>
        </View>

       

        <View style={styles.securityRow}>
          <Ionicons name="shield-checkmark" size={22} color={gold} />
          <Text style={styles.securityText}>
            Votre sécurité est notre priorité
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function InfoLine({ icon, label, value }: any) {
  return (
    <View style={styles.infoLine}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={21} color={gold} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function MiniBox({ icon, label, value }: any) {
  return (
    <View style={styles.miniBox}>
      <Ionicons name={icon} size={21} color={gold} />
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  map: { ...StyleSheet.absoluteFillObject },

  topBar: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  roundBtn: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: 'rgba(5,5,5,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  topTitleBox: {
    flex: 1,
    height: 58,
    borderRadius: 22,
    backgroundColor: 'rgba(5,5,5,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.28)',
  },

  logo: {
    color: '#FFF',
    fontSize: 21,
    fontWeight: '900',
  },

  topSub: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },

  statusCard: {
    position: 'absolute',
    top: 105,
    left: 18,
    right: 18,
    minHeight: 98,
    borderRadius: 26,
    backgroundColor: 'rgba(5,5,5,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },

  statusIconBox: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  smallLabel: {
    color: '#AAA',
    fontSize: 11,
    fontWeight: '900',
  },

  statusTitle: {
    color: gold,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 3,
  },

  statusSub: {
    color: '#DDD',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '700',
  },

  separator: {
    width: 1,
    height: 58,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  metricText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 3,
  },

  metricTextSmall: {
    color: gold,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },

 driverMarker: {
  width: 50,
  height: 50,
  borderRadius: 25,
  backgroundColor: gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#111',
  },

  clientMarkerWrap: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pulseCircle: {
    position: 'absolute',
    borderRadius: 45,
    backgroundColor: blue,
  },

  clientMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: blue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },

  bottomSheet: {
    position: 'absolute',
    height: 340,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#070707',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
  },

  handle: {
    width: 54,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#333',
    alignSelf: 'center',
    marginBottom: 16,
  },

  driverCard: {
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.22)',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },

 avatar: {
  width: 62,
  height: 62,
  borderRadius: 31,
  borderWidth: 2,
  borderColor: gold,
},

  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  driverName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  driverInfo: {
    color: '#AAA',
    fontSize: 13,
    marginTop: 4,
  },

  plate: {
    color: gold,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },

  rating: {
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.45)',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  ratingText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 13,
  },

  callBtn: {
    flex: 1,
    height: 58,
    borderRadius: 19,
    backgroundColor: '#0F7A35',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  whatsappBtn: {
    flex: 1,
    height: 58,
    borderRadius: 19,
    backgroundColor: '#128C3A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  cancelBtn: {
    flex: 1,
    height: 58,
    borderRadius: 19,
    backgroundColor: '#8B1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  actionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },

  tripBox: {
    marginTop: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    display: 'none',
  },

  infoLine: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },

  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(212,160,23,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoLabel: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: '700',
  },

  infoValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 3,
  },

  gridRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },

  miniBox: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    padding: 12,
  },

  miniLabel: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 7,
  },

  miniValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },

  primaryBtn: {
    marginTop: 14,
    height: 56,
    borderRadius: 19,
    backgroundColor: gold,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
  },

  primaryText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '900',
  },

  securityRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    display: 'none',
  },

  securityText: {
    color: '#DDD',
    fontSize: 13,
    fontWeight: '800',
  },
  etaBanner: {
  height: 46,
  borderRadius: 18,
  backgroundColor: gold,
  marginBottom: 12,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
},

etaBannerText: {
  color: '#111',
  fontSize: 14,
  fontWeight: '900',
},
focusDriverBtn: {
  position: 'absolute',
  right: 18,
  top: 222,
  width: 50,
  height: 50,
  borderRadius: 18,
  backgroundColor: gold,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 2,
  borderColor: '#111',
},
demoBtn: {
  position: 'absolute',
  right: 18,
  top: 280,
  width: 50,
  height: 50,
  borderRadius: 18,
  backgroundColor: gold,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 2,
  borderColor: '#111',
},
navBtn: {
  flex: 1,
  height: 58,
  borderRadius: 19,
  backgroundColor: gold,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
},

navText: {
  color: '#111',
  fontSize: 12,
  fontWeight: '900',
},
startRideBtn: {
  flex: 1,
  height: 58,
  borderRadius: 19,
  backgroundColor: '#22C55E',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
},

startRideText: {
  color: '#111',
  fontSize: 12,
  fontWeight: '900',
},
finishRideBtn: {
  flex: 1,
  height: 58,
  borderRadius: 19,
  backgroundColor: gold,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
},

finishRideText: {
  color: '#111',
  fontSize: 12,
  fontWeight: '900',
},

});