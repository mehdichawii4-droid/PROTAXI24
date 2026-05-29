import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
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
import { useAuth } from '@/hooks/useAuth';
import { getUnreadNotificationCount } from '@/services/userNotificationInbox';
import { navigateTo, PROTAXI_ROUTES } from '@/utils/navigation';

function extractFirstName(fullName?: string | null): string {
  const trimmed = fullName?.trim();
  if (!trimmed) {
    return 'Client';
  }

  return trimmed.split(/\s+/)[0];
}

const green = '#8BC53F';
const gold = '#D4A017';
const bg = '#050505';
const card = '#0D0D0D';
const glow = 'rgba(139,197,63,0.18)';
const muted = '#8A8A8A';
const radiusLg = 28;
const radiusMd = 24;

type PrimaryExperienceAction = {
  id: string;
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  image: number;
  route: string;
};

type CompactQuickAction = {
  id: string;
  title: string;
  subtitle: string;
  image: number;
  route: string;
};

type ServiceGridItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  badge?: string;
  disabled?: boolean;
};

type NavItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  badge?: number;
};

const PRIMARY_EXPERIENCE: PrimaryExperienceAction = {
  id: 'experiences',
  eyebrow: 'EXPÉRIENCES PRIVÉES',
  title: 'Expériences privées',
  titleAccent: 'premium',
  subtitle: 'Nature, patrimoine et moments sur mesure à Guelma',
  image: require('../assets/images/theatre-romain.jpg'),
  route: PROTAXI_ROUTES.experiencesPrivate,
};

const COMPACT_QUICK_ACTIONS: CompactQuickAction[] = [
  {
    id: 'chauffeur',
    title: 'Chauffeur privé',
    subtitle: 'Trajet privé · à disposition',
    image: require('../assets/images/services/chauffeur-prive.jpg'),
    route: PROTAXI_ROUTES.privateDriver,
  },
  {
    id: 'airport',
    title: 'Transfert aéroport',
    subtitle: 'Transferts premium',
    image: require('../assets/images/airport-premium.jpg'),
    route: PROTAXI_ROUTES.airport,
  },
];

const SERVICE_GRID: ServiceGridItem[] = [
  {
    id: 'city',
    label: 'Taxi ville',
    icon: 'car-sport-outline',
    route: PROTAXI_ROUTES.city,
    badge: 'Bientôt',
    disabled: true,
  },
  { id: 'long', label: 'Long trajet', icon: 'map-outline', route: PROTAXI_ROUTES.longDistance },
  { id: 'hotels', label: 'Hôtels', icon: 'bed-outline', route: PROTAXI_ROUTES.hotel },
  { id: 'airport', label: 'Aéroport', icon: 'airplane-outline', route: PROTAXI_ROUTES.airport },
  {
    id: 'circuits',
    label: 'Circuits touristiques',
    icon: 'compass-outline',
    route: PROTAXI_ROUTES.discoverGuelma,
    badge: 'NOUVEAU',
  },
  {
    id: 'rental',
    label: 'Location véhicules',
    icon: 'key-outline',
    route: PROTAXI_ROUTES.menu,
    badge: 'NOUVEAU',
  },
  { id: 'more', label: 'Plus de services', icon: 'grid-outline', route: PROTAXI_ROUTES.menu },
];

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Accueil', icon: 'home', route: PROTAXI_ROUTES.home },
  { id: 'bookings', label: 'Réservations', icon: 'calendar-outline', route: PROTAXI_ROUTES.reservation },
  { id: 'favorites', label: 'Favoris', icon: 'heart-outline', route: PROTAXI_ROUTES.history },
  {
    id: 'messages',
    label: 'Messages',
    icon: 'chatbubble-outline',
    route: PROTAXI_ROUTES.notifications,
  },
  { id: 'profile', label: 'Profil', icon: 'person-outline', route: PROTAXI_ROUTES.profile },
];

const TRUST_FEATURES = [
  { icon: 'shield-checkmark-outline' as const, label: 'Sécurisé et fiable' },
  { icon: 'person-outline' as const, label: 'Chauffeurs pro' },
  { icon: 'time-outline' as const, label: 'Disponible 24h/24' },
  { icon: 'wallet-outline' as const, label: 'Paiement flexible' },
  { icon: 'headset-outline' as const, label: 'Assistance 24/7' },
  { icon: 'close-circle-outline' as const, label: 'Annulation facile' },
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
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 520,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 520,
        delay,
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

export default function HomeScreen() {
  const { profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const firstName = extractFirstName(profile?.fullName);

  const refreshUnreadCount = useCallback(async () => {
    const count = await getUnreadNotificationCount(profile?.uid);
    setUnreadCount(count);
  }, [profile?.uid]);

  useFocusEffect(
    useCallback(() => {
      void refreshUnreadCount();
    }, [refreshUnreadCount])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['rgba(139,197,63,0.08)', 'rgba(5,5,5,0)']}
        style={styles.topGlow}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <HomeHeader firstName={firstName} unreadCount={unreadCount} />

        <FadeSlideIn delay={80}>
          <PrimaryExperienceCard
            action={PRIMARY_EXPERIENCE}
            onPress={() =>
              navigateTo(PRIMARY_EXPERIENCE.route, {
                source: 'home-primary-experience',
                label: PRIMARY_EXPERIENCE.title,
              })
            }
          />

          <View style={styles.compactQuickRow}>
            {COMPACT_QUICK_ACTIONS.map((action) => (
              <CompactQuickActionCard
                key={action.id}
                action={action}
                onPress={() =>
                  navigateTo(action.route, {
                    source: 'home-compact-quick-actions',
                    label: action.title,
                  })
                }
              />
            ))}
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={200}>
          <SectionHeader title="Autres services" subtitle="Compléments & à venir" />
          <View style={styles.servicesGrid}>
            {SERVICE_GRID.map((item) => (
              <ServiceGridCard
                key={item.id}
                item={item}
                onPress={() => {
                  if (item.disabled) {
                    Alert.alert(
                      'Bientôt disponible',
                      'Le service Taxi ville arrive prochainement sur PROTAXI.'
                    );
                    return;
                  }

                  navigateTo(item.route, {
                    source: 'home-services-grid',
                    label: item.label,
                  });
                }}
              />
            ))}
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={280}>
          <GuideSection
            onPress={() =>
              navigateTo(PROTAXI_ROUTES.discoverGuelma, {
                source: 'home-guide-section',
                label: 'Réserver un guide',
              })
            }
          />
        </FadeSlideIn>

        <FadeSlideIn delay={400}>
          <TrustFeaturesRow />
        </FadeSlideIn>
      </ScrollView>

      <BottomNav activeId="home" unreadCount={unreadCount} />
    </SafeAreaView>
  );
}

function HomeHeader({
  firstName,
  unreadCount,
}: {
  firstName: string;
  unreadCount: number;
}) {
  return (
    <FadeSlideIn style={styles.headerWrap}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topIconBtn}
          activeOpacity={0.85}
          onPress={() =>
            navigateTo(PROTAXI_ROUTES.menu, {
              source: 'home-header',
              label: 'Menu',
            })
          }
        >
          <Ionicons name="menu" size={22} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.logoBlock}>
          <View style={styles.logoRow}>
            <MaterialCommunityIcons name="taxi" size={18} color={green} />
            <Text style={styles.logoText}>PROTAXI</Text>
          </View>
          <Text style={styles.logoTagline}>EXPÉRIENCES · CHAUFFEUR · AÉROPORT</Text>
        </View>

        <TouchableOpacity
          style={styles.topIconBtn}
          activeOpacity={0.85}
          onPress={() =>
            navigateTo(PROTAXI_ROUTES.notifications, {
              source: 'home-header',
              label: 'Notifications',
            })
          }
        >
          <Ionicons name="notifications-outline" size={22} color="#FFF" />
          {unreadCount > 0 ? (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <View style={styles.greetingBlock}>
        <Text style={styles.greeting}>Bonjour, {firstName} 👋</Text>
        <Text style={styles.greetingSub}>Où allons-nous aujourd&apos;hui ?</Text>
        <Text style={styles.greetingSlogan}>
          Expériences, chauffeur privé et transferts premium en Guelma.
        </Text>
      </View>
    </FadeSlideIn>
  );
}

function PrimaryExperienceCard({
  action,
  onPress,
}: {
  action: PrimaryExperienceAction;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.primaryHeroCard, pressed && styles.pressedScale]}
      onPress={onPress}
    >
      <ImageBackground
        source={action.image}
        style={styles.primaryHeroImage}
        imageStyle={styles.primaryHeroImageStyle}
      >
        <LinearGradient
          colors={['rgba(5,5,5,0.12)', 'rgba(5,5,5,0.5)', 'rgba(5,5,5,0.94)']}
          style={styles.primaryHeroGradient}
        >
          <View style={styles.primaryHeroGlowOrb} />

          <View style={styles.primaryHeroContent}>
            <View style={styles.primaryHeroPill}>
              <Text style={styles.primaryHeroPillText}>{action.eyebrow}</Text>
            </View>

            <View style={styles.primaryHeroTitleRow}>
              <Text style={styles.primaryHeroTitle}>{action.title}</Text>
              <Text style={styles.primaryHeroTitleAccent}> {action.titleAccent}</Text>
            </View>

            <View style={styles.primaryHeroAccentLine} />

            <Text style={styles.primaryHeroSubtitle}>{action.subtitle}</Text>

            <View style={styles.primaryHeroFooter}>
              <TouchableOpacity style={styles.primaryHeroCta} activeOpacity={0.9} onPress={onPress}>
                <Text style={styles.primaryHeroCtaText}>Explorer</Text>
                <Ionicons name="chevron-forward" size={16} color="#111" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
}

function CompactQuickActionCard({
  action,
  onPress,
}: {
  action: CompactQuickAction;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.compactQuickCard, pressed && styles.pressedScale]}
      onPress={onPress}
    >
      <ImageBackground
        source={action.image}
        style={styles.compactQuickImage}
        imageStyle={styles.compactQuickImageStyle}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.9)']}
          style={styles.compactQuickGradient}
        >
          <View style={styles.compactQuickFooter}>
            <View style={{ flex: 1 }}>
              <Text style={styles.compactQuickTitle}>{action.title}</Text>
              <Text style={styles.compactQuickSubtitle} numberOfLines={2}>
                {action.subtitle}
              </Text>
            </View>
            <View style={styles.compactQuickArrow}>
              <Ionicons name="arrow-forward" size={14} color="#111" />
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
}

function ServiceGridCard({
  item,
  onPress,
}: {
  item: ServiceGridItem;
  onPress: () => void;
}) {
  const isDisabled = Boolean(item.disabled);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.gridCard,
        isDisabled && styles.gridCardDisabled,
        pressed && !isDisabled && styles.pressedScale,
      ]}
      onPress={onPress}
    >
      {item.badge ? (
        <View style={[styles.gridBadge, isDisabled && styles.gridBadgeSoon]}>
          <Text style={[styles.gridBadgeText, isDisabled && styles.gridBadgeTextSoon]}>
            {item.badge}
          </Text>
        </View>
      ) : null}

      <View style={[styles.gridIconWrap, isDisabled && styles.gridIconWrapDisabled]}>
        <Ionicons name={item.icon} size={24} color={isDisabled ? muted : green} />
      </View>

      <Text style={[styles.gridLabel, isDisabled && styles.gridLabelDisabled]} numberOfLines={2}>
        {item.label}
      </Text>

      {isDisabled ? (
        <Text style={styles.gridSoonHint} numberOfLines={2}>
          Bientôt disponible
        </Text>
      ) : null}
    </Pressable>
  );
}

function GuideSection({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.guideCard}>
      <Image
        source={require('../assets/images/services/chauffeur-prive.jpg')}
        style={styles.guideImage}
        resizeMode="cover"
      />

      <LinearGradient
        colors={['rgba(5,5,5,0.1)', 'rgba(5,5,5,0.75)', 'rgba(5,5,5,0.95)']}
        style={styles.guideGradient}
      />

      <View style={styles.guideContent}>
        <Text style={styles.guideEyebrow}>EXPÉRIENCE LOCAL</Text>
        <Text style={styles.guideTitle}>Besoin d&apos;un guide ?</Text>
        <Text style={styles.guideDesc}>
          Découvrez Guelma avec un accompagnateur professionnel et un chauffeur PROTAXI.
        </Text>

        <TouchableOpacity style={styles.guideCta} activeOpacity={0.9} onPress={onPress}>
          <Text style={styles.guideCtaText}>Réserver un guide</Text>
          <Ionicons name="arrow-forward" size={16} color="#111" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TrustFeaturesRow() {
  return (
    <View style={styles.trustSection}>
      <View style={styles.trustGrid}>
        {TRUST_FEATURES.map((feature) => (
          <View key={feature.label} style={styles.trustItem}>
            <View style={styles.trustIconWrap}>
              <Ionicons name={feature.icon} size={18} color={green} />
            </View>
            <Text style={styles.trustLabel}>{feature.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionAccent} />
    </View>
  );
}

function BottomNav({
  activeId,
  unreadCount,
}: {
  activeId: string;
  unreadCount: number;
}) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.bottomNavSafe}>
      <View style={styles.bottomNav}>
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeId;
          const badge =
            item.id === 'messages' && unreadCount > 0
              ? unreadCount > 99
                ? '99+'
                : unreadCount
              : item.badge;

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.navItem}
              activeOpacity={0.85}
              onPress={() => {
                if (item.id !== activeId) {
                  navigateTo(item.route, {
                    source: 'home-bottom-nav',
                    label: item.label,
                  });
                }
              }}
            >
              <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
                {active ? <View style={styles.navGlow} /> : null}
                <Ionicons name={item.icon} size={22} color={active ? green : muted} />
                {badge ? (
                  <View style={styles.navBadge}>
                    <Text style={styles.navBadgeText}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.28,
  shadowRadius: 18,
  elevation: 10,
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
    height: 220,
    zIndex: 0,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  headerWrap: {
    marginBottom: 24,
    paddingTop: 6,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },

  topIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  logoBlock: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },

  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  logoText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  logoTagline: {
    color: muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
  },

  notifBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: green,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },

  notifBadgeText: {
    color: '#111',
    fontSize: 9,
    fontWeight: '900',
  },

  greetingBlock: {
    gap: 6,
  },

  greeting: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  greetingSub: {
    color: '#D4D4D4',
    fontSize: 15,
    fontWeight: '600',
  },

  greetingSlogan: {
    color: muted,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },

  primaryHeroCard: {
    height: 258,
    borderRadius: radiusLg,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.22)',
    ...cardShadow,
  },

  primaryHeroImage: {
    flex: 1,
  },

  primaryHeroImageStyle: {
    borderRadius: radiusLg,
  },

  primaryHeroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 22,
  },

  primaryHeroGlowOrb: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(201,162,39,0.12)',
  },

  primaryHeroContent: {
    gap: 6,
  },

  primaryHeroPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,162,39,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.38)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },

  primaryHeroPillText: {
    color: gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
  },

  primaryHeroTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    maxWidth: '92%',
  },

  primaryHeroTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },

  primaryHeroTitleAccent: {
    color: green,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },

  primaryHeroAccentLine: {
    width: 32,
    height: 1,
    borderRadius: 1,
    backgroundColor: gold,
    opacity: 0.6,
    marginTop: 2,
    marginBottom: 2,
  },

  primaryHeroSubtitle: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: '90%',
    fontWeight: '500',
  },

  primaryHeroFooter: {
    marginTop: 10,
  },

  primaryHeroCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: green,
  },

  primaryHeroCtaText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },

  compactQuickRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },

  compactQuickCard: {
    flex: 1,
    height: 148,
    borderRadius: radiusMd,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...cardShadow,
  },

  compactQuickImage: {
    flex: 1,
  },

  compactQuickImageStyle: {
    borderRadius: radiusMd,
  },

  compactQuickGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
  },

  compactQuickFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },

  compactQuickTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 17,
  },

  compactQuickSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 3,
    fontWeight: '600',
    lineHeight: 13,
  },

  compactQuickArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: green,
    justifyContent: 'center',
    alignItems: 'center',
  },

  pressedScale: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },

  sectionHeader: {
    marginBottom: 18,
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
    marginTop: 4,
    fontWeight: '600',
  },

  sectionAccent: {
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: green,
    marginTop: 10,
  },

  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  gridCard: {
    width: '23%',
    minWidth: 74,
    aspectRatio: 0.82,
    backgroundColor: card,
    borderRadius: radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },

  gridCardDisabled: {
    opacity: 0.62,
    borderColor: 'rgba(255,255,255,0.03)',
  },

  gridBadge: {
    position: 'absolute',
    top: 6,
    right: 4,
    backgroundColor: green,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 2,
  },

  gridBadgeSoon: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },

  gridBadgeText: {
    color: '#111',
    fontSize: 7,
    fontWeight: '900',
  },

  gridBadgeTextSoon: {
    color: muted,
    fontSize: 6,
  },

  gridIconWrap: {
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

  gridIconWrapDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.06)',
  },

  gridLabel: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 13,
  },

  gridLabelDisabled: {
    color: 'rgba(255,255,255,0.55)',
  },

  gridSoonHint: {
    color: muted,
    fontSize: 7,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 9,
    marginTop: 4,
  },

  guideCard: {
    height: 220,
    borderRadius: radiusLg,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...cardShadow,
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
    flex: 1,
    justifyContent: 'flex-end',
    padding: 22,
    zIndex: 2,
  },

  guideEyebrow: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },

  guideTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },

  guideDesc: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    maxWidth: '92%',
  },

  guideCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: green,
  },

  guideCtaText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },

  trustSection: {
    marginBottom: 8,
    paddingTop: 4,
  },

  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },

  trustItem: {
    width: '30%',
    minWidth: 96,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },

  trustIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  trustLabel: {
    color: muted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
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
    paddingBottom: 8,
    paddingHorizontal: 8,
  },

  navItem: {
    alignItems: 'center',
    minWidth: 58,
  },

  navIconWrap: {
    position: 'relative',
    width: 42,
    height: 42,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  navIconWrapActive: {
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
  },

  navGlow: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: glow,
    shadowColor: green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },

  navBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: green,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },

  navBadgeText: {
    color: '#111',
    fontSize: 9,
    fontWeight: '900',
  },

  navLabel: {
    color: muted,
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },

  navLabelActive: {
    color: green,
    fontWeight: '800',
  },
});
