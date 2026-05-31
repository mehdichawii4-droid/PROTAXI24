import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
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
const bg = '#050505';
const card = '#0D0D0D';
const glow = 'rgba(139,197,63,0.18)';
const muted = '#8A8A8A';
const radiusLg = 28;

type MainMenuTile = {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  route: string;
  source: string;
};

const MAIN_MENU_TILES: MainMenuTile[] = [
  {
    id: 'city',
    emoji: '🚖',
    title: 'Taxi ville',
    subtitle: 'Course locale à Guelma',
    route: PROTAXI_ROUTES.city,
    source: 'home-taxi-ville',
  },
  {
    id: 'airport',
    emoji: '✈️',
    title: 'Transfert aéroport',
    subtitle: 'Départ ou arrivée aéroport',
    route: PROTAXI_ROUTES.airport,
    source: 'home-airport',
  },
  {
    id: 'private-driver',
    emoji: '👔',
    title: 'Chauffeur privé',
    subtitle: 'Trajet ou mise à disposition',
    route: PROTAXI_ROUTES.privateDriver,
    source: 'home-chauffeur-prive',
  },
  {
    id: 'explorer',
    emoji: '🌍',
    title: 'Explorer Guelma',
    subtitle: 'Patrimoine, nature, séjours',
    route: PROTAXI_ROUTES.discoverGuelma,
    source: 'home-explorer',
  },
];

type NavItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  badge?: number;
};

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
    }, [refreshUnreadCount]),
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
          <View style={styles.mainMenuGrid}>
            {MAIN_MENU_TILES.map((tile) => (
              <MainMenuTileCard
                key={tile.id}
                tile={tile}
                onPress={() =>
                  navigateTo(tile.route, {
                    source: tile.source,
                    label: tile.title,
                  })
                }
              />
            ))}
          </View>
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
          <Text style={styles.logoTagline}>MOBILITÉ · EXPLORER GUELMA</Text>
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

      <Text style={styles.greeting}>Bonjour, {firstName}</Text>
    </FadeSlideIn>
  );
}

function MainMenuTileCard({
  tile,
  onPress,
}: {
  tile: MainMenuTile;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.mainMenuTile, pressed && styles.pressedScale]}
      onPress={onPress}
    >
      <Text style={styles.mainMenuEmoji}>{tile.emoji}</Text>
      <Text style={styles.mainMenuTitle}>{tile.title}</Text>
      <Text style={styles.mainMenuSubtitle} numberOfLines={2}>
        {tile.subtitle}
      </Text>
      <View style={styles.mainMenuArrow}>
        <Ionicons name="arrow-forward" size={16} color="#111" />
      </View>
    </Pressable>
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
    marginBottom: 28,
    paddingTop: 6,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
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

  greeting: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  mainMenuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
  },

  mainMenuTile: {
    width: '47.5%',
    minHeight: 168,
    backgroundColor: card,
    borderRadius: radiusLg,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.18)',
    padding: 18,
    justifyContent: 'flex-end',
    ...cardShadow,
  },

  mainMenuEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },

  mainMenuTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 20,
    marginBottom: 6,
  },

  mainMenuSubtitle: {
    color: muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginBottom: 14,
  },

  mainMenuArrow: {
    alignSelf: 'flex-start',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: green,
    justifyContent: 'center',
    alignItems: 'center',
  },

  pressedScale: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
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
