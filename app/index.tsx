import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
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

const accent = '#C6F135';
const airportBlue = '#4DA3FF';
const bg = '#050505';
const cardBg = '#141414';
const muted = '#8A8A8A';

type PrimaryService = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeIcon: keyof typeof Ionicons.glyphMap;
  cardIcon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  image: number;
  route: string;
};

type SecondaryService = {
  id: string;
  title: string;
  subtitle: string;
  image: number;
  route: string;
};

type NavItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  badge?: number;
};

const PRIMARY_SERVICES: PrimaryService[] = [
  {
    id: 'taxi',
    title: 'Taxi',
    subtitle: 'Courses rapides 24h/24',
    badge: '24h/24',
    badgeIcon: 'time-outline',
    cardIcon: 'car-sport',
    accentColor: accent,
    image: require('../assets/images/hero-bg.png'),
    route: '/city',
  },
  {
    id: 'airport',
    title: 'Aéroport',
    subtitle: 'Transferts vers tous les aéroports',
    badge: 'Aéroport',
    badgeIcon: 'airplane',
    cardIcon: 'airplane',
    accentColor: airportBlue,
    image: require('../assets/images/airport-premium.jpg'),
    route: '/reservation-details',
  },
];

const SECONDARY_SERVICES: SecondaryService[] = [
  {
    id: 'chauffeur',
    title: 'Chauffeur privé',
    subtitle: 'Confort & discrétion',
    image: require('../assets/images/services/chauffeur-prive.jpg'),
    route: '/city',
  },
  {
    id: 'long',
    title: 'Long trajet',
    subtitle: 'Voyagez vers d’autres wilayas',
    image: require('../assets/images/services/long-trajet.jpg'),
    route: '/prise-en-charge',
  },
  {
    id: 'rental',
    title: 'Location véhicules',
    subtitle: 'Voiture, moto et vélo à votre disposition',
    image: require('../assets/images/services/location-vehicules.jpg'),
    route: '/menu',
  },
  {
    id: 'circuits',
    title: 'Circuits touristiques',
    subtitle: 'Découvrez les plus beaux sites de Guelma',
    image: require('../assets/images/services/circuits-touristiques.jpg'),
    route: '/prise-en-charge',
  },
  {
    id: 'hotels',
    title: 'Séjours & Hôtels',
    subtitle: 'Hébergements, restaurants et expériences uniques',
    image: require('../assets/images/services/hotels-premium.jpg'),
    route: '/hotel',
  },
  {
    id: 'more',
    title: 'Explorer plus',
    subtitle: 'Encore plus de services pour vous',
    image: require('../assets/images/services/explorer-plus.jpg'),
    route: '/menu',
  },
];

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Accueil', icon: 'home', route: '/' },
  { id: 'bookings', label: 'Réservations', icon: 'calendar-outline', route: '/reservation' },
  { id: 'favorites', label: 'Favoris', icon: 'heart-outline', route: '/history' },
  { id: 'messages', label: 'Messages', icon: 'chatbubble-outline', route: '/notifications', badge: 2 },
  { id: 'profile', label: 'Profil', icon: 'person-outline', route: '/profile' },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <HomeHeader />

        <View style={styles.primaryRow}>
          {PRIMARY_SERVICES.map((service) => (
            <PrimaryServiceCard
              key={service.id}
              service={service}
              onPress={() => router.push(service.route as never)}
            />
          ))}
        </View>

        <DiscoverGuelmaBanner onPress={() => router.push('/city')} />

        <SectionHeader title="Nos services" />
        <View style={styles.secondaryGrid}>
          {SECONDARY_SERVICES.map((service) => (
            <SecondaryServiceCard
              key={service.id}
              service={service}
              onPress={() => router.push(service.route as never)}
            />
          ))}
        </View>

        <AssistanceBlock />
      </ScrollView>

      <BottomNav activeId="home" />
    </SafeAreaView>
  );
}

function HomeHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={22} color="#111" />
          </View>
          <View style={styles.onlineDot} />
        </View>

        <View style={styles.headerText}>
          <Text style={styles.greeting}>Bonjour, Mehdi 👋</Text>
          <Text style={styles.greetingSub}>Où allons-nous aujourd&apos;hui ?</Text>
        </View>
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.85}
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications-outline" size={22} color="#FFF" />
          <View style={styles.notifDot} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.brandPill}
          activeOpacity={0.85}
          onPress={() => router.push('/menu')}
        >
          <Text style={styles.brandCrown}>👑</Text>
          <Text style={styles.brandPillText}>PROTAXI</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PrimaryServiceCard({
  service,
  onPress,
}: {
  service: PrimaryService;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.primaryCard, pressed && styles.pressed]}
      onPress={onPress}
    >
      <ImageBackground
        source={service.image}
        style={styles.primaryImage}
        imageStyle={styles.primaryImageStyle}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.9)']}
          style={styles.primaryGradient}
        >
          <View style={[styles.primaryBadge, { borderColor: `${service.accentColor}55` }]}>
            <Ionicons name={service.badgeIcon} size={11} color={service.accentColor} />
            <Text style={[styles.primaryBadgeText, { color: service.accentColor }]}>
              {service.badge}
            </Text>
          </View>

          <View style={styles.primaryBody}>
            <View style={[styles.primaryIconCircle, { backgroundColor: `${service.accentColor}22` }]}>
              <Ionicons name={service.cardIcon} size={22} color={service.accentColor} />
            </View>

            <View style={styles.primaryFooter}>
              <View style={styles.primaryTextWrap}>
                <Text style={styles.primaryTitle}>{service.title}</Text>
                <Text style={styles.primarySubtitle} numberOfLines={2}>
                  {service.subtitle}
                </Text>
              </View>

              <View style={[styles.primaryArrow, { backgroundColor: service.accentColor }]}>
                <Ionicons name="arrow-forward" size={16} color="#111" />
              </View>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
}

function DiscoverGuelmaBanner({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.discoverCard, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Image
        source={require('../assets/images/theatre-romain.jpg')}
        resizeMode="cover"
        style={styles.discoverBackdrop}
      />

      <LinearGradient
        colors={[
          'rgba(0,0,0,0.55)',
          'rgba(0,0,0,0.28)',
          'rgba(0,0,0,0.08)',
          'rgba(0,0,0,0)',
        ]}
        locations={[0, 0.22, 0.38, 0.52]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.discoverFadeHorizontal}
      />

      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.12)']}
        style={styles.discoverFadeVertical}
      />

      <View style={styles.discoverContent}>
        <View style={styles.discoverLabel}>
          <Text style={styles.discoverEmoji}>🌴</Text>
          <Text style={styles.discoverLabelText}>DÉCOUVRIR GUELMA</Text>
        </View>

        <View style={styles.discoverTextBlock}>
          <Text style={styles.discoverTitle}>
            Explorez les merveilles de notre{' '}
            <Text style={styles.discoverHighlight}>wilaya</Text>
          </Text>

          <Text style={styles.discoverDesc}>
            Nature, histoire, culture, gastronomie et bien plus.
          </Text>
        </View>

        <TouchableOpacity style={styles.discoverCta} activeOpacity={0.9} onPress={onPress}>
          <Text style={styles.discoverCtaText}>Découvrir maintenant</Text>
          <Ionicons name="chevron-forward" size={15} color="#111" />
        </TouchableOpacity>
      </View>

      <View style={styles.discoverDotsRow}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>

      <TouchableOpacity
        style={styles.bookmarkBtnFloating}
        activeOpacity={0.85}
      >
        <Ionicons name="bookmark-outline" size={18} color="#FFF" />
      </TouchableOpacity>
    </Pressable>
  );
}

function SecondaryServiceCard({
  service,
  onPress,
}: {
  service: SecondaryService;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.serviceCard, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Image
        source={service.image}
        resizeMode="contain"
        style={styles.serviceImage}
      />

      <LinearGradient
        colors={['transparent', 'rgba(198,241,53,0.10)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.serviceGlow}
      />

      <View style={styles.serviceContent}>
        <View style={styles.serviceTextBlock}>
          <Text style={styles.serviceTitle}>{service.title}</Text>
          <Text style={styles.serviceSubtitle} numberOfLines={2}>
            {service.subtitle}
          </Text>
        </View>

        <View style={styles.serviceArrow}>
          <Ionicons name="chevron-forward" size={18} color={accent} />
        </View>
      </View>
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionAccent} />
    </View>
  );
}

function AssistanceBlock() {
  return (
    <View style={styles.assistanceCard}>
      <View style={styles.assistanceIconWrap}>
        <MaterialCommunityIcons name="headset" size={24} color={accent} />
      </View>

      <View style={styles.assistanceText}>
        <Text style={styles.assistanceTitle}>Besoin d&apos;aide ?</Text>
        <Text style={styles.assistanceDesc}>
          Notre équipe est disponible 24h/24. Appelez-nous ou discutez en direct.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.assistanceCta}
        activeOpacity={0.85}
        onPress={() => router.push('/support')}
      >
        <Text style={styles.assistanceCtaText}>Nous contacter</Text>
        <Ionicons name="chevron-forward" size={14} color={accent} />
      </TouchableOpacity>
    </View>
  );
}

function BottomNav({ activeId }: { activeId: string }) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.bottomNavSafe}>
      <View style={styles.bottomNav}>
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeId;

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.navItem}
              activeOpacity={0.85}
              onPress={() => {
                if (item.id !== activeId) {
                  router.push(item.route as never);
                }
              }}
            >
              <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={active ? accent : muted}
                />
                {item.badge ? (
                  <View style={styles.navBadge}>
                    <Text style={styles.navBadgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {item.label}
              </Text>
              {active ? <View style={styles.navActiveDot} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 14,
  elevation: 8,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bg,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginBottom: 22,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },

  avatarWrap: {
    position: 'relative',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: accent,
    borderWidth: 2,
    borderColor: bg,
  },

  headerText: {
    flex: 1,
  },

  greeting: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  greetingSub: {
    color: muted,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: cardBg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  notifDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: accent,
  },

  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(198,241,53,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(198,241,53,0.28)',
  },

  brandCrown: {
    fontSize: 12,
  },

  brandPillText: {
    color: accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  primaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },

  primaryCard: {
    flex: 1,
    height: 210,
    borderRadius: 22,
    overflow: 'hidden',
    ...cardShadow,
  },

  primaryImage: {
    flex: 1,
  },

  primaryImageStyle: {
    borderRadius: 22,
  },

  primaryGradient: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },

  primaryBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
  },

  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  primaryBody: {
    gap: 12,
  },

  primaryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  primaryFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },

  primaryTextWrap: {
    flex: 1,
  },

  primaryTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  primarySubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
    fontWeight: '500',
  },

  primaryArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },

  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },

  discoverCard: {
    height: 270,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 28,
    backgroundColor: bg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...cardShadow,
  },

  discoverBackdrop: {
    ...StyleSheet.absoluteFillObject,
    width: '102%',
    height: '108%',
    top: '-4%',
    left: '-1%',
  },

  discoverFadeHorizontal: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },

  discoverFadeVertical: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },

  discoverContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '48%',
    maxWidth: '48%',
    zIndex: 2,
    paddingLeft: 22,
    paddingRight: 10,
    paddingTop: 22,
    paddingBottom: 42,
    justifyContent: 'space-between',
  },

  discoverTextBlock: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 8,
  },

  discoverLabel: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  discoverEmoji: {
    fontSize: 11,
  },

  discoverLabelText: {
    color: accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },

  bookmarkBtnFloating: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 3,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  discoverDotsRow: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  discoverTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    letterSpacing: -0.3,
    width: '100%',
  },

  discoverHighlight: {
    color: accent,
  },

  discoverDesc: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    width: '100%',
  },

  discoverCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: accent,
  },

  discoverCtaText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '800',
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  dotActive: {
    width: 18,
    backgroundColor: accent,
  },

  sectionHeader: {
    marginTop: 4,
    marginBottom: 16,
  },

  sectionTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  sectionAccent: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: accent,
    marginTop: 6,
  },

  secondaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  serviceCard: {
    width: '47%',
    height: 220,
    backgroundColor: '#1A1A1A',
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },

  serviceImage: {
    position: 'absolute',
    width: 150,
    height: 150,
    right: -8,
    top: 32,
    opacity: 0.95,
  },

  serviceGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 54,
    height: 2,
    zIndex: 1,
  },

  serviceContent: {
    flex: 1,
    zIndex: 10,
    justifyContent: 'space-between',
  },

  serviceTextBlock: {
    maxWidth: '62%',
  },

  serviceTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },

  serviceSubtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 18,
  },

  serviceArrow: {
    alignSelf: 'flex-start',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0B0B0B',
    justifyContent: 'center',
    alignItems: 'center',
  },

  assistanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1C1C1C',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
    ...cardShadow,
  },

  assistanceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: 'rgba(198,241,53,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  assistanceText: {
    flex: 1,
  },

  assistanceTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  assistanceDesc: {
    color: muted,
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
    fontWeight: '500',
  },

  assistanceCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  assistanceCtaText: {
    color: accent,
    fontSize: 10,
    fontWeight: '700',
  },

  bottomNavSafe: {
    backgroundColor: bg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },

  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 8,
  },

  navItem: {
    alignItems: 'center',
    minWidth: 58,
  },

  navIconWrap: {
    position: 'relative',
  },

  navIconWrapActive: {
    shadowColor: accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
  },

  navBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },

  navBadgeText: {
    color: '#111',
    fontSize: 9,
    fontWeight: '800',
  },

  navLabel: {
    color: muted,
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },

  navLabelActive: {
    color: accent,
  },

  navActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: accent,
    marginTop: 4,
  },
});
