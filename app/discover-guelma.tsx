import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, collectionGroup, onSnapshot, query } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '@/firebase';
import { devError } from '@/utils/devLog';
import { useAuth } from '@/hooks/useAuth';
import {
  computeTourismGlobalAnalytics,
  formatAnalyticsParticipants,
  formatAnalyticsRating,
  getReviewGroupIdFromPath,
  type TourAnalyticsBooking,
  type TourAnalyticsGroup,
  type TourAnalyticsReview,
} from '@/services/tourAnalytics';
import { logNavigation, PROTAXI_ROUTES } from '@/utils/navigation';

const NAV_SOURCE = 'discover-guelma';

function pushRoute(
  pathname: Href,
  params: Record<string, string>,
  label: string,
) {
  const routePath = typeof pathname === 'string' ? pathname : String(pathname);
  const paramSummary = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const routeLabel = paramSummary ? `${routePath}?${paramSummary}` : routePath;
  logNavigation(routeLabel, { source: NAV_SOURCE, label });
  router.push({ pathname, params } as Href);
}

const green = '#8BC53F';
const bg = '#050505';
const card = '#0D0D0D';
const glow = 'rgba(139,197,63,0.18)';
const muted = '#8A8A8A';
const radiusLg = 28;
const radiusMd = 24;

const SIGNATURE_CIRCUITS = [
  {
    id: 'guelma-antique',
    title: 'Guelma Antique',
    description: 'Théâtre Romain • Musée • Café traditionnel',
    duration: '3h',
    price: '3 500 DA',
    rating: '4.9',
    badge: 'Populaire' as const,
    image: require('../assets/images/theatre-romain.jpg'),
  },
  {
    id: 'nature-sources',
    title: 'Nature & Sources',
    description: 'Hammam Debagh • Cascades • Maouna',
    duration: 'Journée',
    price: '6 500 DA',
    rating: '5.0',
    badge: 'Premium' as const,
    image: require('../assets/images/services/circuits-touristiques.jpg'),
  },
  {
    id: 'gastro-locale',
    title: 'Gastronomie Locale',
    description: 'Restaurant traditionnel • Dégustation • Café oriental',
    duration: '2h30',
    price: '2 800 DA',
    rating: '4.8',
    badge: 'Populaire' as const,
    image: require('../assets/images/services/explorer-plus.jpg'),
  },
  {
    id: 'sunset-premium',
    title: 'Sunset Premium',
    description: 'Vue panoramique • Shooting photo • Café premium',
    duration: 'Soirée',
    price: '4 500 DA',
    rating: '4.9',
    badge: 'Premium' as const,
    image: require('../assets/images/hero-bg2.png'),
  },
  {
    id: 'circuit-famille',
    title: 'Circuit Famille',
    description: 'Nature • Restaurant • Véhicule familial',
    duration: '5h',
    price: '7 000 DA',
    rating: '4.9',
    badge: 'Premium' as const,
    image: require('../assets/images/theatre-romain1.jpg'),
  },
];

const POPULAR_CIRCUITS = [
  {
    id: 'hammam',
    title: 'Hammam Debagh',
    duration: '3h30',
    price: '4 500 DA',
    image: require('../assets/images/services/circuits-touristiques.jpg'),
    popular: true,
  },
  {
    id: 'theatre',
    title: 'Théâtre romain',
    duration: '2h00',
    price: '3 200 DA',
    image: require('../assets/images/theatre-romain.jpg'),
    popular: true,
  },
  {
    id: 'maouna',
    title: 'Maouna',
    duration: '4h00',
    price: '5 800 DA',
    image: require('../assets/images/theatre-romain1.jpg'),
    popular: false,
  },
  {
    id: 'gastro',
    title: 'Gastronomie locale',
    duration: '2h30',
    price: '3 800 DA',
    image: require('../assets/images/services/explorer-plus.jpg'),
    popular: true,
  },
];

const PARTNER_HOTELS = [
  {
    id: 'hotel-1',
    name: 'Hôtel El Manar',
    stars: 4,
    price: '12 000 DA',
    image: require('../assets/images/services/hotels-premium.jpg'),
  },
  {
    id: 'hotel-2',
    name: 'Résidence Guelma Palace',
    stars: 5,
    price: '18 500 DA',
    image: require('../assets/images/hotel.jpg'),
  },
  {
    id: 'hotel-3',
    name: 'Spa & Hôtel Hamma',
    stars: 4,
    price: '15 200 DA',
    image: require('../assets/images/airport-premium.jpg'),
  },
];

const EXPERIENCES = [
  {
    id: 'cuisine',
    title: 'Cuisine locale',
    subtitle: 'Saveurs authentiques de Guelma',
    icon: 'restaurant-outline' as const,
    service: 'Expérience locale',
  },
  {
    id: 'cafes',
    title: 'Cafés',
    subtitle: 'Terrasses & ambiance méditerranéenne',
    icon: 'cafe-outline' as const,
    service: 'Expérience locale',
  },
  {
    id: 'photo',
    title: 'Spots photo',
    subtitle: 'Panoramas & patrimoine',
    icon: 'camera-outline' as const,
    service: 'Circuit touristique',
  },
  {
    id: 'nature',
    title: 'Nature',
    subtitle: 'Sources, collines & paysages',
    icon: 'leaf-outline' as const,
    service: 'Circuit touristique',
  },
];

const WHY_PROTAXI = [
  { icon: 'shield-checkmark-outline' as const, label: 'Guides vérifiés' },
  { icon: 'car-sport-outline' as const, label: 'Transport inclus' },
  { icon: 'map-outline' as const, label: 'Expérience locale' },
  { icon: 'lock-closed-outline' as const, label: 'Sécurité' },
];

function FadeSlideIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 520,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

function SectionHeader({
  title,
  subtitle,
  style,
}: {
  title: string;
  subtitle?: string;
  style?: object;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionAccent} />
    </View>
  );
}

export default function DiscoverGuelmaScreen() {
  const { role } = useAuth();
  const canReadTourismAnalytics = role === 'admin';
  const [tourGroups, setTourGroups] = useState<TourAnalyticsGroup[]>([]);
  const [tourBookings, setTourBookings] = useState<TourAnalyticsBooking[]>([]);
  const [tourReviews, setTourReviews] = useState<TourAnalyticsReview[]>([]);

  useEffect(() => {
    if (!canReadTourismAnalytics) {
      setTourGroups([]);
      setTourBookings([]);
      setTourReviews([]);
      return undefined;
    }

    const unsubscribeGroups = onSnapshot(
      collection(db, 'tourGroups'),
      (snapshot) => {
        setTourGroups(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as TourAnalyticsGroup[],
        );
      },
      (error) => {
        devError('[SNAPSHOT DENIED - discover-guelma - TourismAnalyticsGroups]', error);
      },
    );

    const unsubscribeBookings = onSnapshot(
      collection(db, 'tourBookings'),
      (snapshot) => {
        setTourBookings(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as TourAnalyticsBooking[],
        );
      },
      (error) => {
        devError('[SNAPSHOT DENIED - discover-guelma - TourismAnalyticsBookings]', error);
      },
    );

    const unsubscribeReviews = onSnapshot(
      query(collectionGroup(db, 'reviews')),
      (snapshot) => {
        setTourReviews(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            groupId: getReviewGroupIdFromPath(docSnap.ref.path),
            rating: Number(docSnap.data().rating || 0),
            guideRating: Number(docSnap.data().guideRating || 0),
            driverRating: Number(docSnap.data().driverRating || 0),
          })),
        );
      },
      (error) => {
        devError('[SNAPSHOT DENIED - discover-guelma - TourismAnalyticsReviews]', error);
      },
    );

    return () => {
      unsubscribeGroups();
      unsubscribeBookings();
      unsubscribeReviews();
    };
  }, [canReadTourismAnalytics]);

  const tourismAnalytics = useMemo(
    () => computeTourismGlobalAnalytics(tourGroups, tourBookings, tourReviews),
    [tourGroups, tourBookings, tourReviews],
  );

  const openBooking = (
    type: 'circuit' | 'hotel' | 'experience' | 'guide',
    name: string,
    label: string,
  ) => {
    pushRoute(
      PROTAXI_ROUTES.discoverBooking,
      { type, name, source: NAV_SOURCE },
      label,
    );
  };

  const bookCityTaxi = () => {
    pushRoute(
      PROTAXI_ROUTES.city,
      { source: NAV_SOURCE },
      'Besoin d\'un taxi en ville ?',
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['rgba(139,197,63,0.06)', 'rgba(5,5,5,0)']}
        style={styles.topGlow}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <FadeSlideIn>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.topBarCenter}>
              <MaterialCommunityIcons name="compass-outline" size={16} color={green} />
              <Text style={styles.topBarTitle}>TOURISME GUELMA</Text>
            </View>

            <View style={styles.iconBtnPlaceholder} />
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={60}>
          <View style={styles.heroWrap}>
            <ImageBackground
              source={require('../assets/images/theatre-romain.jpg')}
              style={styles.heroImage}
              imageStyle={styles.heroImageStyle}
            >
              <LinearGradient
                colors={[
                  'rgba(5,5,5,0.15)',
                  'rgba(5,5,5,0.45)',
                  'rgba(5,5,5,0.92)',
                ]}
                style={styles.heroGradient}
              >
                <View style={styles.heroGlowOrb} />

                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>EXPÉRIENCE PREMIUM</Text>
                </View>

                <Text style={styles.heroTitle}>Découvrez Guelma autrement</Text>
                <Text style={styles.heroSubtitle}>
                  Patrimoine, nature, gastronomie et culture — avec votre chauffeur
                  PROTAXI.
                </Text>

                <TouchableOpacity
                  style={styles.heroCta}
                  activeOpacity={0.9}
                  onPress={() =>
                    openBooking('circuit', 'Circuit sur mesure', 'Réserver un circuit')
                  }
                >
                  <Text style={styles.heroCtaText}>Réserver un circuit</Text>
                  <Ionicons name="arrow-forward" size={18} color="#111" />
                </TouchableOpacity>
              </LinearGradient>
            </ImageBackground>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={100}>
          <SectionHeader
            title="Tendances PROTAXI"
            subtitle="Les expériences les plus demandées en live"
            style={styles.sectionBlock}
          />

          {tourismAnalytics.topExperience ? (
            <View style={styles.trendsCard}>
              <View style={styles.trendsGlow} />
              <View style={styles.trendsBadgeRow}>
                <View style={styles.trendsBestSellerBadge}>
                  <Ionicons name="trophy-outline" size={14} color="#111" />
                  <Text style={styles.trendsBestSellerText}>BEST SELLER</Text>
                </View>
                <View style={styles.trendsRatingBadge}>
                  <Ionicons name="star" size={13} color={green} />
                  <Text style={styles.trendsRatingText}>
                    {formatAnalyticsRating(tourismAnalytics.topExperience.averageRating)}/5
                  </Text>
                </View>
              </View>

              <Text style={styles.trendsExperienceTitle}>
                {tourismAnalytics.topExperience.experience}
              </Text>

              <View style={styles.trendsStatsRow}>
                <View style={styles.trendsStatCard}>
                  <Text style={styles.trendsStatValue}>
                    {formatAnalyticsParticipants(tourismAnalytics.topExperience.totalParticipants)}
                  </Text>
                  <Text style={styles.trendsStatLabel}>Participants</Text>
                </View>
                <View style={styles.trendsStatCard}>
                  <Text style={styles.trendsStatValue}>
                    {tourismAnalytics.topExperience.reviewCount}
                  </Text>
                  <Text style={styles.trendsStatLabel}>Avis</Text>
                </View>
                <View style={styles.trendsStatCard}>
                  <Text style={styles.trendsStatValue}>
                    {tourismAnalytics.topExperience.groupFillRate}%
                  </Text>
                  <Text style={styles.trendsStatLabel}>Remplissage</Text>
                </View>
              </View>

              <View style={styles.trendsProgressTrack}>
                <View
                  style={[
                    styles.trendsProgressFill,
                    { width: `${tourismAnalytics.topExperience.groupFillRate}%` },
                  ]}
                />
              </View>
            </View>
          ) : (
            <View style={styles.trendsEmptyCard}>
              <Text style={styles.trendsEmptyText}>
                Les tendances apparaîtront dès les premières réservations groupe.
              </Text>
            </View>
          )}
        </FadeSlideIn>

        <FadeSlideIn delay={120}>
          <SectionHeader
            title="Circuits populaires"
            subtitle="Les incontournables de la wilaya"
            style={styles.sectionBlock}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.circuitsRow}
            decelerationRate="fast"
          >
            {POPULAR_CIRCUITS.map((circuit) => (
              <Pressable
                key={circuit.id}
                style={({ pressed }) => [
                  styles.circuitCard,
                  pressed && styles.pressed,
                ]}
                onPress={() => openBooking('circuit', circuit.title, `Circuit ${circuit.title}`)}
              >
                <Image
                  source={circuit.image}
                  style={styles.circuitImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={[
                    'rgba(5,5,5,0.05)',
                    'rgba(5,5,5,0.55)',
                    'rgba(5,5,5,0.96)',
                  ]}
                  locations={[0, 0.42, 1]}
                  style={styles.circuitGradient}
                />

                {circuit.popular ? (
                  <View style={styles.popularBadge}>
                    <Ionicons name="flame" size={11} color="#111" />
                    <Text style={styles.popularBadgeText}>Populaire</Text>
                  </View>
                ) : null}

                <View style={styles.circuitContent}>
                  <Text style={styles.circuitTitle} numberOfLines={2}>
                    {circuit.title}
                  </Text>
                  <View style={styles.circuitMeta}>
                    <View style={styles.circuitMetaItem}>
                      <Ionicons name="time-outline" size={13} color={green} />
                      <Text style={styles.circuitMetaText}>{circuit.duration}</Text>
                    </View>
                    <Text style={styles.circuitPrice}>{circuit.price}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </FadeSlideIn>

        <FadeSlideIn delay={150}>
          <SectionHeader
            title="Circuits Signature PROTAXI"
            subtitle="Expériences premium conçues par nos experts locaux"
            style={styles.sectionBlock}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.signatureRow}
            decelerationRate="fast"
          >
            {SIGNATURE_CIRCUITS.map((circuit) => (
              <View key={circuit.id} style={styles.signatureCard}>
                <Image
                  source={circuit.image}
                  style={styles.signatureImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={[
                    'rgba(5,5,5,0.08)',
                    'rgba(5,5,5,0.62)',
                    'rgba(5,5,5,0.98)',
                  ]}
                  locations={[0, 0.38, 1]}
                  style={styles.signatureGradient}
                />

                <View
                  style={[
                    styles.signatureBadge,
                    circuit.badge === 'Premium' && styles.signatureBadgePremium,
                  ]}
                >
                  <Ionicons
                    name={circuit.badge === 'Premium' ? 'diamond-outline' : 'flame'}
                    size={11}
                    color="#111"
                  />
                  <Text style={styles.signatureBadgeText}>{circuit.badge}</Text>
                </View>

                <View style={styles.signatureContent}>
                  <Text style={styles.signatureTitle} numberOfLines={1}>
                    {circuit.title}
                  </Text>
                  <Text style={styles.signatureDesc} numberOfLines={2}>
                    {circuit.description}
                  </Text>

                  <View style={styles.signatureMetaRow}>
                    <View style={styles.signatureMetaItem}>
                      <Ionicons name="time-outline" size={12} color={green} />
                      <Text style={styles.signatureMetaText}>{circuit.duration}</Text>
                    </View>
                    <View style={styles.signatureMetaItem}>
                      <Ionicons name="star" size={12} color={green} />
                      <Text style={styles.signatureMetaText}>{circuit.rating}</Text>
                    </View>
                    <Text style={styles.signaturePrice}>{circuit.price}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.signatureExploreBtn}
                    activeOpacity={0.9}
                    onPress={() =>
                      openBooking('circuit', circuit.title, `Explorer ${circuit.title}`)
                    }
                  >
                    <Text style={styles.signatureExploreText}>Explorer</Text>
                    <Ionicons name="arrow-forward" size={14} color="#111" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </FadeSlideIn>

        <FadeSlideIn delay={210}>
          <SectionHeader
            title="Hôtels partenaires"
            subtitle="Séjours premium sélectionnés"
            style={styles.sectionBlock}
          />

          <View style={styles.hotelList}>
            {PARTNER_HOTELS.map((hotel) => (
              <Pressable
                key={hotel.id}
                style={({ pressed }) => [
                  styles.hotelCard,
                  pressed && styles.pressed,
                ]}
                onPress={() => openBooking('hotel', hotel.name, `Hôtel ${hotel.name}`)}
              >
                <Image
                  source={hotel.image}
                  style={styles.hotelImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={[
                    'rgba(5,5,5,0.35)',
                    'rgba(5,5,5,0.15)',
                    'rgba(5,5,5,0.94)',
                  ]}
                  locations={[0, 0.35, 1]}
                  style={styles.hotelGradient}
                />

                <View style={styles.hotelContent}>
                  <View style={styles.hotelInfo}>
                    <Text style={styles.hotelName} numberOfLines={2}>
                      {hotel.name}
                    </Text>
                    <View style={styles.starsRow}>
                      {Array.from({ length: hotel.stars }).map((_, index) => (
                        <Ionicons key={index} name="star" size={12} color={green} />
                      ))}
                    </View>
                    <Text style={styles.hotelPrice}>À partir de {hotel.price}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.hotelBtn}
                    activeOpacity={0.9}
                    onPress={() => openBooking('hotel', hotel.name, `Hôtel ${hotel.name}`)}
                  >
                    <Text style={styles.hotelBtnText}>Réserver</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            ))}
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={270}>
          <SectionHeader
            title="Restaurants & expériences"
            subtitle="Vivez Guelma comme un local"
            style={styles.sectionBlock}
          />

          <View style={styles.experienceGrid}>
            {EXPERIENCES.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.experienceCard,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  openBooking('experience', item.title, `Expérience ${item.title}`)
                }
              >
                <View style={styles.experienceIconWrap}>
                  <Ionicons name={item.icon} size={22} color={green} />
                </View>
                <Text style={styles.experienceTitle}>{item.title}</Text>
                <Text style={styles.experienceSubtitle} numberOfLines={2}>
                  {item.subtitle}
                </Text>
              </Pressable>
            ))}
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={330}>
          <SectionHeader
            title="Guides touristiques"
            subtitle="Accompagnement professionnel"
            style={styles.sectionBlock}
          />

          <View style={styles.guideCard}>
            <Image
              source={require('../assets/images/services/chauffeur-prive.jpg')}
              style={styles.guideImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={[
                'rgba(5,5,5,0.12)',
                'rgba(5,5,5,0.55)',
                'rgba(5,5,5,0.97)',
              ]}
              locations={[0, 0.45, 1]}
              style={styles.guideGradient}
            />

            <View style={styles.guideContent}>
              <Text style={styles.guideEyebrow}>GUIDE CERTIFIÉ PROTAXI</Text>
              <Text style={styles.guideTitle}>
                Explorez avec un expert local passionné
              </Text>
              <Text style={styles.guideDesc}>
                Visites privées, circuits sur mesure et transport inclus — une
                expérience fluide du départ à la destination.
              </Text>

              <TouchableOpacity
                style={styles.guideCta}
                activeOpacity={0.9}
                onPress={() =>
                  openBooking('guide', 'Guide certifié PROTAXI', 'Réserver un guide')
                }
              >
                <Ionicons name="person-outline" size={18} color="#111" />
                <Text style={styles.guideCtaText}>Réserver un guide</Text>
              </TouchableOpacity>
            </View>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={390}>
          <SectionHeader
            title="Pourquoi PROTAXI tourisme ?"
            style={styles.sectionBlock}
          />

          <View style={styles.whyGrid}>
            {WHY_PROTAXI.map((item) => (
              <View key={item.label} style={styles.whyCard}>
                <View style={styles.whyIconWrap}>
                  <Ionicons name={item.icon} size={20} color={green} />
                </View>
                <Text style={styles.whyLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={450}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.9}
            onPress={bookCityTaxi}
          >
            <Ionicons name="car-sport-outline" size={18} color={green} />
            <Text style={styles.secondaryBtnText}>Besoin d&apos;un taxi en ville ?</Text>
            <Ionicons name="chevron-forward" size={16} color={green} />
          </TouchableOpacity>
        </FadeSlideIn>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.32,
  shadowRadius: 20,
  elevation: 12,
};

const premiumGlow = {
  shadowColor: green,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.14,
  shadowRadius: 14,
  elevation: 8,
};

const textShadow = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bg,
  },

  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 0,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 4,
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  iconBtnPlaceholder: {
    width: 44,
    height: 44,
  },

  topBarCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  topBarTitle: {
    color: green,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  heroWrap: {
    borderRadius: radiusLg,
    overflow: 'hidden',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.14)',
    ...cardShadow,
    ...premiumGlow,
  },

  heroImage: {
    minHeight: 340,
    justifyContent: 'flex-end',
  },

  heroImageStyle: {
    borderRadius: radiusLg,
  },

  heroGradient: {
    minHeight: 340,
    paddingHorizontal: 28,
    paddingVertical: 28,
    justifyContent: 'flex-end',
  },

  heroGlowOrb: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: glow,
  },

  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },

  heroPillText: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  heroTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    letterSpacing: -0.5,
    maxWidth: '92%',
    ...textShadow,
  },

  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    fontWeight: '500',
    maxWidth: '92%',
  },

  heroCta: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: green,
    ...premiumGlow,
  },

  heroCtaText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },

  trendsCard: {
    backgroundColor: card,
    borderRadius: radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.32)',
    padding: 18,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },

  trendsGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: glow,
  },

  trendsBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },

  trendsBestSellerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: green,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  trendsBestSellerText: {
    color: '#111',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  trendsRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.24)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  trendsRatingText: {
    color: green,
    fontSize: 11,
    fontWeight: '900',
  },

  trendsExperienceTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
    lineHeight: 26,
  },

  trendsStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },

  trendsStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },

  trendsStatValue: {
    color: green,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },

  trendsStatLabel: {
    color: muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },

  trendsProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },

  trendsProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: green,
  },

  trendsEmptyCard: {
    backgroundColor: card,
    borderRadius: radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.16)',
    padding: 18,
    marginBottom: 24,
  },

  trendsEmptyText: {
    color: muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },

  sectionHeader: {
    marginBottom: 14,
  },

  sectionBlock: {
    marginTop: 8,
  },

  sectionTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },

  sectionSubtitle: {
    color: muted,
    fontSize: 13,
    marginTop: 5,
    fontWeight: '600',
    lineHeight: 18,
  },

  sectionAccent: {
    width: 48,
    height: 4,
    borderRadius: 4,
    backgroundColor: green,
    marginTop: 12,
  },

  circuitsRow: {
    gap: 14,
    paddingBottom: 32,
    paddingRight: 4,
  },

  signatureRow: {
    gap: 14,
    paddingBottom: 32,
    paddingRight: 4,
  },

  signatureCard: {
    width: 300,
    height: 340,
    borderRadius: radiusMd,
    overflow: 'hidden',
    backgroundColor: card,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.16)',
    ...cardShadow,
    ...premiumGlow,
  },

  signatureImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  signatureGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  signatureBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: green,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  signatureBadgePremium: {
    backgroundColor: '#FFF',
  },

  signatureBadgeText: {
    color: '#111',
    fontSize: 10,
    fontWeight: '900',
  },

  signatureContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 56,
    zIndex: 2,
  },

  signatureTitle: {
    color: '#FFF',
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 24,
    ...textShadow,
  },

  signatureDesc: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    fontWeight: '600',
  },

  signatureMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },

  signatureMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  signatureMetaText: {
    color: '#D4D4D4',
    fontSize: 12,
    fontWeight: '700',
  },

  signaturePrice: {
    color: green,
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 'auto',
    ...textShadow,
  },

  signatureExploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    backgroundColor: green,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 16,
    ...premiumGlow,
  },

  signatureExploreText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },

  circuitCard: {
    width: 228,
    height: 272,
    borderRadius: radiusMd,
    overflow: 'hidden',
    backgroundColor: card,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.1)',
    ...cardShadow,
    ...premiumGlow,
  },

  circuitImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  circuitGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  popularBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: green,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  popularBadgeText: {
    color: '#111',
    fontSize: 10,
    fontWeight: '900',
  },

  circuitContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 48,
    zIndex: 2,
  },

  circuitTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
    ...textShadow,
  },

  circuitMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },

  circuitMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  circuitMetaText: {
    color: '#D4D4D4',
    fontSize: 12,
    fontWeight: '700',
  },

  circuitPrice: {
    color: green,
    fontSize: 14,
    fontWeight: '900',
    ...textShadow,
  },

  hotelList: {
    gap: 14,
    marginBottom: 32,
  },

  hotelCard: {
    height: 188,
    borderRadius: radiusMd,
    overflow: 'hidden',
    backgroundColor: card,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.1)',
    ...cardShadow,
    ...premiumGlow,
  },

  hotelImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  hotelGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  hotelContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    zIndex: 2,
    gap: 14,
  },

  hotelInfo: {
    flex: 1,
    paddingRight: 4,
  },

  hotelName: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
    ...textShadow,
  },

  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 6,
  },

  hotelPrice: {
    color: green,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },

  hotelBtn: {
    backgroundColor: green,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 92,
    alignItems: 'center',
    ...premiumGlow,
  },

  hotelBtnText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
  },

  experienceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },

  experienceCard: {
    width: '47%',
    backgroundColor: card,
    borderRadius: radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 18,
    minHeight: 140,
    ...cardShadow,
  },

  experienceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  experienceTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },

  experienceSubtitle: {
    color: muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    fontWeight: '600',
  },

  guideCard: {
    height: 308,
    borderRadius: radiusLg,
    overflow: 'hidden',
    marginBottom: 32,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.14)',
    ...cardShadow,
    ...premiumGlow,
  },

  guideImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  guideGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  guideContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 56,
    zIndex: 2,
  },

  guideEyebrow: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 10,
  },

  guideTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
    flexShrink: 1,
    ...textShadow,
  },

  guideDesc: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    flexShrink: 1,
  },

  guideCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: green,
    ...premiumGlow,
  },

  guideCtaText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },

  whyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },

  whyCard: {
    width: '47%',
    backgroundColor: card,
    borderRadius: radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 20,
    paddingHorizontal: 14,
    minHeight: 128,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },

  whyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  whyLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },

  secondaryBtn: {
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.32)',
    backgroundColor: glow,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 8,
    ...premiumGlow,
  },

  secondaryBtnText: {
    color: green,
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    textAlign: 'left',
    marginLeft: 4,
  },

  bottomSpacer: {
    height: 108,
  },

  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.982 }],
  },
});
