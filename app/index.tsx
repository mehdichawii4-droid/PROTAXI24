import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Image,
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { testFirebase } from '../testFirestore';

const gold = '#D4A017';

export default function HomeScreen() {
  const [region, setRegion] = useState({
    latitude: 36.462,
    longitude: 7.426,
    latitudeDelta: 0.028,
    longitudeDelta: 0.028,
  });

  const [clientPosition, setClientPosition] = useState({
    latitude: 36.462,
    longitude: 7.426,
  });

  const [driverPosition, setDriverPosition] = useState({
    latitude: 36.456,
    longitude: 7.418,
  });

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      return;
    }

    const location = await Location.getCurrentPositionAsync({});

    const userPosition = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    setClientPosition(userPosition);

    setDriverPosition({
      latitude: location.coords.latitude - 0.006,
      longitude: location.coords.longitude - 0.008,
    });

    setRegion({
      ...userPosition,
      latitudeDelta: 0.028,
      longitudeDelta: 0.028,
    });
  };

  const goReservation = () => {
    router.push({
      pathname: '/reservation-details',
      params: { service: 'aeroport' },
    });
  };

 const goDetails = (service: string) => {
  if (service === 'aeroport') {
    router.push('/reservation-details');
    return;
  }

  if (service === 'ville') {
    router.push('/city');
    return;
  }

  if (service === 'hotel') {
    router.push('/hotel');
    return;
  }

  if (service === 'prise-en-charge') {
    router.push('/prise-en-charge');
    return;
  }
};

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <TouchableOpacity
  onPress={testFirebase}
  style={{
    backgroundColor: '#00C853',
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 10,
    alignItems: 'center',
  }}
>
  <Text style={{ color: '#FFF', fontWeight: '900' }}>
    TEST FIREBASE
  </Text>
</TouchableOpacity>
      <TouchableOpacity
  onPress={() => router.push('/admin-dashboard')}
  style={{
    backgroundColor: '#FFD700',
    padding: 12,
    borderRadius: 12,
    marginTop: 20,
    marginHorizontal: 20,
    alignItems: 'center',
  }}
>
  <Text style={{ color: '#111', fontWeight: '900' }}>
    ADMIN DASHBOARD
  </Text>
</TouchableOpacity>
<TouchableOpacity
  onPress={() => router.push('/drivers-dashboard')}
  style={{
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#FFD700',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    marginHorizontal: 20,
    alignItems: 'center',
  }}
>
  <Text style={{ color: '#FFD700', fontWeight: '900' }}>
    DRIVERS DASHBOARD
  </Text>
</TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ImageBackground
          source={require('../assets/images/hero-bg.png')}
          style={styles.hero}
          imageStyle={styles.heroImage}
        >
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.20)',
              'rgba(0,0,0,0.58)',
              '#050505',
            ]}
            style={styles.heroOverlay}
          >
            <View style={styles.header}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />

              <View style={styles.headerBtns}>
                <TouchableOpacity
                  style={styles.headerBtn}
                  activeOpacity={0.85}
                  onPress={() => router.push('/reservation')}
                >
                  <Ionicons name="calendar-outline" size={25} color={gold} />
                  <Text style={styles.headerBtnText}>Réserv.</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.headerBtn}
                  activeOpacity={0.85}
                  onPress={() => router.push('/menu')}
                >
                  <Ionicons name="menu" size={30} color={gold} />
                  <Text style={styles.headerBtnText}>Menu</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.heroContent}>
              <Text style={styles.title}>
                Votre trajet,{'\n'}notre <Text style={styles.gold}>priorité.</Text>
              </Text>

              <Text style={styles.description}>
                Transferts privés, confortables et sécurisés 24h/24, partout.
              </Text>

              <View style={styles.heroButtons}>
                <TouchableOpacity
                  style={styles.reserveBtn}
                  activeOpacity={0.9}
                  onPress={goReservation}
                >
                  <Text style={styles.reserveText}>Réserver maintenant</Text>

                  <View style={styles.reserveIcon}>
                    <Ionicons name="arrow-forward" size={25} color="#FFF" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.airportBtn}
                  activeOpacity={0.9}
                  onPress={() => goDetails('aeroport')}
                >
                  <Ionicons name="airplane" size={25} color={gold} />
                  <Text style={styles.airportText}>Transfert aéroport</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.quickBox}>
                <QuickInfo icon="time-outline" title="Disponible" text="24h/24 - 7j/7" />
                <QuickInfo icon="shield-checkmark-outline" title="Sécurité" text="Chauffeurs pros" />
                <QuickInfo icon="car-sport-outline" title="Confort" text="Véhicules premium" />
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>

        <View style={styles.body}>
          <View style={styles.liveMapBox}>
            <View style={styles.liveLeft}>
              <View style={styles.mapTitleRow}>
                <Ionicons name="location" size={22} color={gold} />
                <View>
                  <Text style={styles.liveTitle}>Chauffeur proche de vous</Text>
                  <Text style={styles.liveSub}>Arrivée estimée : 3 min</Text>
                </View>
              </View>

              <View style={styles.driverMini}>
                <View style={styles.driverAvatar}>
                  <Ionicons name="person" size={25} color="#111" />
                </View>

                <View>
                  <Text style={styles.driverName}>Taxi Mehdi 24</Text>
                  <Text style={styles.driverCar}>Renault Clio • 5.0</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.followBtn}
                activeOpacity={0.9}
                onPress={() => router.push('/course-tracking')}
              >
                <Text style={styles.followText}>Suivre mon trajet</Text>
                <Ionicons name="arrow-forward" size={18} color={gold} />
              </TouchableOpacity>
            </View>

            <MapView
              style={styles.liveMap}
              region={region}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Polyline
                coordinates={[driverPosition, clientPosition]}
                strokeColor={gold}
                strokeWidth={4}
              />

              <Marker coordinate={driverPosition}>
                <View style={styles.carMarker}>
                  <Ionicons name="car-sport" size={18} color="#111" />
                </View>
              </Marker>

              <Marker coordinate={clientPosition}>
                <View style={styles.pinMarker}>
                  <Ionicons name="location" size={20} color="#FFF" />
                </View>
              </Marker>
            </MapView>
          </View>
                    <View style={styles.stepsBox}>
            <Text style={styles.stepsTitle}>
              Réserver en <Text style={styles.gold}>3</Text> étapes simples
            </Text>

            <View style={styles.stepsRow}>
              <Step icon="calendar-outline" title="1. Choisissez" text="votre service" />
              <Step icon="location-outline" title="2. Indiquez" text="les détails" />
              <Step icon="card-outline" title="3. Confirmez" text="et voyagez" />
            </View>
          </View>

          <ServiceCard
            icon="airplane"
            title="AÉROPORT"
            text="Transferts vers tous les aéroports"
            sub="Guelma • Annaba • Constantine • Alger • Tunis"
            badge="Le plus demandé"
            onPress={() => goDetails('aeroport')}
          />

          <ServiceCard
            icon="business-outline"
            title="HÔTEL"
            text="Transferts vers votre hôtel"
            sub="Hôtels en Algérie & Tunisie"
            badge="Premium"
             onPress={() => router.push('/hotel')}
          />

          <ServiceCard
            icon="car-sport-outline"
            title="DÉPLACEMENT EN VILLE"
            text="Trajets privés, rendez-vous, événements"
            sub="Service rapide et discret"
            badge="Rapide"
            onPress={() => router.push('/city')}
          />

          <ServiceCard
            icon="map-outline"
            title="PRISE EN CHARGE"
            text="Transferts privés toutes distances" 
            sub="Alger • Tunis • Annaba • Constantine"
            badge="Premium"
           onPress={() => router.push('/prise-en-charge')}
          />

          <View style={styles.footer}>
            <FooterItem icon="shield-checkmark-outline" title="Sécurité" text="Chauffeurs professionnels" />
            <FooterItem icon="time-outline" title="Ponctualité" text="Arrivée à l’heure" />
            <FooterItem icon="star-outline" title="Fiabilité" text="Service de qualité" />
            <FooterItem icon="headset-outline" title="Support 24/7" text="Toujours disponible" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickInfo({ icon, title, text }: any) {
  return (
    <View style={styles.quickItem}>
      <Ionicons name={icon} size={24} color={gold} />

      <View style={{ flex: 1 }}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickText}>{text}</Text>
      </View>
    </View>
  );
}

function Step({ icon, title, text }: any) {
  return (
    <View style={styles.step}>
      <View style={styles.stepIcon}>
        <Ionicons name={icon} size={25} color={gold} />
      </View>

      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function ServiceCard({ icon, title, text, sub, badge, onPress }: any) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={onPress}>
      <View style={styles.cardIcon}>
        <Ionicons name={icon} size={32} color={gold} />
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{title}</Text>

          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>

        <Text style={styles.cardText}>{text}</Text>
        <Text style={styles.cardSub}>{sub}</Text>
      </View>

      <Ionicons name="chevron-forward" size={28} color="#FFF" />
    </TouchableOpacity>
  );
}

function FooterItem({ icon, title, text }: any) {
  return (
    <View style={styles.footerItem}>
      <Ionicons name={icon} size={27} color={gold} />
      <Text style={styles.footerTitle}>{title}</Text>
      <Text style={styles.footerText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  hero: {
    height: 650,
  },

  heroImage: {
    resizeMode: 'cover',
    opacity: 0.9,
  },

  heroOverlay: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 42,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  logo: {
    width: 460,
    height: 172,
    marginLeft: -140,
    marginTop: -50,
  },

  headerBtns: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: -100,
  },

  headerBtn: {
    width: 60,
    height: 60,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerBtnText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    marginTop: 3,
  },

  heroContent: {
    paddingBottom: 2,
  },

  title: {
    color: '#FFF',
    fontSize: 41,
    fontWeight: '900',
    lineHeight: 49,
    letterSpacing: -1.2,
  },

  gold: {
    color: gold,
  },

  description: {
    color: '#EFEFEF',
    fontSize: 16.5,
    lineHeight: 25,
    marginTop: 16,
    width: '93%',
    fontWeight: '600',
  },

  heroButtons: {
    flexDirection: 'row',
    gap: 11,
    marginTop: 26,
  },

  reserveBtn: {
    flex: 1.15,
    height: 64,
    borderRadius: 23,
    backgroundColor: gold,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  reserveText: {
    color: '#111',
    fontSize: 17,
    fontWeight: '900',
  },

  reserveIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#101010',
    justifyContent: 'center',
    alignItems: 'center',
  },

  airportBtn: {
    flex: 1,
    height: 64,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: gold,
    backgroundColor: 'rgba(0,0,0,0.48)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },

  airportText: {
    color: '#FFF',
    fontSize: 14.5,
    fontWeight: '900',
    flexShrink: 1,
  },

  quickBox: {
    minHeight: 82,
    borderRadius: 24,
    backgroundColor: 'rgba(10,10,10,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },

  quickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    width: '32%',
  },

  quickTitle: {
    color: '#FFF',
    fontSize: 11.5,
    fontWeight: '900',
  },

  quickText: {
    color: '#CFCFCF',
    fontSize: 10.5,
    marginTop: 2,
  },

  body: {
    backgroundColor: '#050505',
    paddingHorizontal: 18,
    paddingBottom: 36,
    marginTop: -28,
  },

  liveMapBox: {
    backgroundColor: 'rgba(15,15,15,0.94)',
    borderRadius: 30,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 18,
  },

  liveLeft: {
    marginBottom: 15,
  },

  mapTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  liveTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  liveSub: {
    color: '#AAA',
    fontSize: 13,
    marginTop: 3,
  },

  driverMini: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },

  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
  },

  driverName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },

  driverCar: {
    color: '#AAA',
    fontSize: 13,
    marginTop: 3,
  },

  followBtn: {
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(212,160,23,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },

  followText: {
    color: gold,
    fontSize: 15,
    fontWeight: '900',
  },

  liveMap: {
    height: 220,
    borderRadius: 24,
  },

  carMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
  },

  pinMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
  },

  stepsBox: {
    backgroundColor: 'rgba(15,15,15,0.94)',
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    marginBottom: 18,
  },

  stepsTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 24,
  },

  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  step: {
    width: '31%',
    alignItems: 'center',
  },

  stepIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.7)',
    backgroundColor: '#080808',
    justifyContent: 'center',
    alignItems: 'center',
  },

  stepTitle: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'center',
  },

  stepText: {
    color: '#C8C8C8',
    fontSize: 13,
    marginTop: 3,
    textAlign: 'center',
  },

  card: {
    backgroundColor: 'rgba(15,15,15,0.94)',
    borderRadius: 26,
    paddingVertical: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  cardIcon: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: '#090909',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardContent: {
    flex: 1,
    marginLeft: 16,
  },

  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },

  cardTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },

  badge: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(212,160,23,0.15)',
  },

  badgeText: {
    color: gold,
    fontSize: 10,
    fontWeight: '900',
  },

  cardText: {
    color: '#F1F1F1',
    fontSize: 14,
    marginTop: 5,
    lineHeight: 20,
  },

  cardSub: {
    color: gold,
    fontSize: 13,
    marginTop: 5,
    lineHeight: 18,
    fontWeight: '700',
  },

  footer: {
    marginTop: 16,
    backgroundColor: 'rgba(15,15,15,0.94)',
    borderRadius: 28,
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  footerItem: {
    width: '48%',
    marginBottom: 18,
  },

  footerTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 9,
  },

  footerText: {
    color: '#BDBDBD',
    fontSize: 13.5,
    marginTop: 4,
    lineHeight: 20,
  },
});