import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logNavigation, PROTAXI_ROUTES } from '@/utils/navigation';

const green = '#8BC53F';
const bg = '#050505';
const card = '#0D0D0D';
const glow = 'rgba(139,197,63,0.18)';
const muted = '#8A8A8A';
const radiusLg = 28;
const HERO_HEIGHT = 300;

type BookingType = 'circuit' | 'hotel' | 'experience' | 'guide';

type CatalogItem = {
  typeLabel: string;
  description: string;
  duration: string;
  price: string;
  image: ImageSourcePropType;
  service: string;
  ctaLabel: string;
  includes: string[];
  ambiance?: string;
  tags?: string[];
  rating?: string;
};

const DEFAULT_INCLUDES = [
  'Transport privé PROTAXI',
  'Chauffeur professionnel',
  'Assistance client 24h/24',
];

const CATALOG: Record<string, CatalogItem> = {
  'circuit:Hammam Debagh': {
    typeLabel: 'Circuit touristique',
    description:
      'Découvrez les sources thermales légendaires de Hammam Debagh, entre bien-être, nature et patrimoine local.',
    duration: '3h30',
    price: '4 500 DA',
    image: require('../assets/images/services/circuits-touristiques.jpg'),
    service: 'Circuit touristique',
    ctaLabel: 'Réserver ce circuit',
    includes: DEFAULT_INCLUDES,
  },
  'circuit:Théâtre romain': {
    typeLabel: 'Circuit touristique',
    description:
      'Visite guidée du théâtre romain de Guelma, joyau archéologique au cœur de l’histoire méditerranéenne.',
    duration: '2h00',
    price: '3 200 DA',
    image: require('../assets/images/theatre-romain.jpg'),
    service: 'Circuit touristique',
    ctaLabel: 'Réserver ce circuit',
    includes: DEFAULT_INCLUDES,
  },
  'circuit:Maouna': {
    typeLabel: 'Circuit touristique',
    description:
      'Escapade premium vers Maouna : paysages, traditions locales et immersion dans la culture guelmoise.',
    duration: '4h00',
    price: '5 800 DA',
    image: require('../assets/images/theatre-romain1.jpg'),
    service: 'Circuit touristique',
    ctaLabel: 'Réserver ce circuit',
    includes: DEFAULT_INCLUDES,
  },
  'circuit:Gastronomie locale': {
    typeLabel: 'Circuit touristique',
    description:
      'Parcours gourmand à travers les saveurs authentiques de Guelma, marchés, spécialités et adresses locales.',
    duration: '2h30',
    price: '3 800 DA',
    image: require('../assets/images/services/explorer-plus.jpg'),
    service: 'Circuit touristique',
    ctaLabel: 'Réserver ce circuit',
    includes: DEFAULT_INCLUDES,
  },
  'circuit:Circuit sur mesure': {
    typeLabel: 'Expérience sur mesure',
    description:
      'Choisissez votre expérience premium PROTAXI, personnalisez-la avec des options exclusives et réservez en quelques taps.',
    duration: 'Flexible',
    price: 'Sur devis',
    image: require('../assets/images/theatre-romain.jpg'),
    service: 'Circuit touristique',
    ctaLabel: 'Réserver',
    includes: DEFAULT_INCLUDES,
    ambiance: 'Configurator premium — expériences locales sélectionnées par PROTAXI.',
    tags: ['Premium', 'Sur mesure', 'Configurator'],
    rating: '4.9',
  },
  'circuit:Guelma Antique': {
    typeLabel: 'Circuit Signature',
    description:
      'Plongez dans l’histoire de Guelma : théâtre romain millénaire, musée patrimonial et pause café traditionnel dans une atmosphère authentique.',
    duration: '3h',
    price: '3 500 DA',
    image: require('../assets/images/theatre-romain.jpg'),
    service: 'Circuit touristique',
    ctaLabel: 'Réserver ce circuit',
    includes: [
      ...DEFAULT_INCLUDES,
      'Visite Théâtre Romain',
      'Entrée Musée',
      'Pause café traditionnel',
    ],
    ambiance: 'Patrimoine, culture et authenticité au cœur de la ville antique.',
    tags: ['Patrimoine', 'Culture', 'Historique'],
    rating: '4.9',
  },
  'circuit:Nature & Sources': {
    typeLabel: 'Circuit Signature',
    description:
      'Journée immersive entre Hammam Debagh, cascades naturelles et village de Maouna — bien-être, paysages et traditions locales.',
    duration: 'Journée',
    price: '6 500 DA',
    image: require('../assets/images/services/circuits-touristiques.jpg'),
    service: 'Circuit touristique',
    ctaLabel: 'Réserver ce circuit',
    includes: [
      ...DEFAULT_INCLUDES,
      'Hammam Debagh',
      'Arrêt cascades',
      'Découverte Maouna',
    ],
    ambiance: 'Nature préservée, sources thermales et escapade ressourçante.',
    tags: ['Nature', 'Sources', 'Premium'],
    rating: '5.0',
  },
  'circuit:Gastronomie Locale': {
    typeLabel: 'Circuit Signature',
    description:
      'Parcours gourmand premium : restaurant traditionnel, dégustation de spécialités locales et café oriental dans les adresses les plus authentiques.',
    duration: '2h30',
    price: '2 800 DA',
    image: require('../assets/images/services/explorer-plus.jpg'),
    service: 'Circuit touristique',
    ctaLabel: 'Réserver ce circuit',
    includes: [
      ...DEFAULT_INCLUDES,
      'Restaurant traditionnel',
      'Dégustation locale',
      'Café oriental',
    ],
    ambiance: 'Saveurs authentiques, convivialité et art de vivre méditerranéen.',
    tags: ['Gastronomie', 'Local', 'Dégustation'],
    rating: '4.8',
  },
  'circuit:Sunset Premium': {
    typeLabel: 'Circuit Signature',
    description:
      'Expérience soirée exclusive : vue panoramique au golden hour, shooting photo guidé et café premium avec chauffeur privé dédié.',
    duration: 'Soirée',
    price: '4 500 DA',
    image: require('../assets/images/hero-bg2.png'),
    service: 'Circuit touristique',
    ctaLabel: 'Réserver ce circuit',
    includes: [
      ...DEFAULT_INCLUDES,
      'Point de vue panoramique',
      'Shooting photo',
      'Café premium',
      'Chauffeur privé soirée',
    ],
    ambiance: 'Romantique, lumineuse et premium — l’expérience sunset de Guelma.',
    tags: ['Sunset', 'Photo', 'Premium', 'Privé'],
    rating: '4.9',
  },
  'circuit:Circuit Famille': {
    typeLabel: 'Circuit Signature',
    description:
      'Journée pensée pour toute la famille : nature accessible, restaurant convivial et véhicule familial spacieux pour un confort optimal.',
    duration: '5h',
    price: '7 000 DA',
    image: require('../assets/images/theatre-romain1.jpg'),
    service: 'Circuit touristique',
    ctaLabel: 'Réserver ce circuit',
    includes: [
      ...DEFAULT_INCLUDES,
      'Véhicule familial',
      'Arrêt nature',
      'Restaurant adapté familles',
    ],
    ambiance: 'Convivial, sécurisé et adapté aux enfants comme aux parents.',
    tags: ['Famille', 'Confort', 'Nature'],
    rating: '4.9',
  },
  'hotel:Hôtel El Manar': {
    typeLabel: 'Hôtel partenaire',
    description:
      'Séjour confortable au cœur de Guelma avec transfert premium depuis votre point de départ.',
    duration: 'Séjour flexible',
    price: '12 000 DA',
    image: require('../assets/images/services/hotels-premium.jpg'),
    service: 'Hôtel & séjour',
    ctaLabel: 'Réserver cet hôtel',
    includes: [...DEFAULT_INCLUDES, 'Transfert hôtel inclus'],
  },
  'hotel:Résidence Guelma Palace': {
    typeLabel: 'Hôtel partenaire',
    description:
      'Résidence haut de gamme avec service premium, idéale pour un séjour d’exception à Guelma.',
    duration: 'Séjour flexible',
    price: '18 500 DA',
    image: require('../assets/images/hotel.jpg'),
    service: 'Hôtel & séjour',
    ctaLabel: 'Réserver cet hôtel',
    includes: [...DEFAULT_INCLUDES, 'Transfert hôtel inclus'],
  },
  'hotel:Spa & Hôtel Hamma': {
    typeLabel: 'Hôtel partenaire',
    description:
      'Expérience spa & détente avec hébergement premium et transport PROTAXI de porte à porte.',
    duration: 'Séjour flexible',
    price: '15 200 DA',
    image: require('../assets/images/airport-premium.jpg'),
    service: 'Hôtel & séjour',
    ctaLabel: 'Réserver cet hôtel',
    includes: [...DEFAULT_INCLUDES, 'Transfert hôtel inclus'],
  },
  'experience:Cuisine locale': {
    typeLabel: 'Expérience locale',
    description:
      'Découvrez les saveurs authentiques de Guelma — spécialités, adresses locales et rencontres gourmandes.',
    duration: '2h00',
    price: '2 800 DA',
    image: require('../assets/images/services/explorer-plus.jpg'),
    service: 'Expérience locale',
    ctaLabel: 'Réserver cette expérience',
    includes: DEFAULT_INCLUDES,
  },
  'experience:Cafés': {
    typeLabel: 'Expérience locale',
    description:
      'Tour des meilleures terrasses et cafés de Guelma — ambiance méditerranéenne et pause premium.',
    duration: '1h30',
    price: '2 200 DA',
    image: require('../assets/images/hero-bg2.png'),
    service: 'Expérience locale',
    ctaLabel: 'Réserver cette expérience',
    includes: DEFAULT_INCLUDES,
  },
  'experience:Spots photo': {
    typeLabel: 'Expérience locale',
    description:
      'Itinéraire photo vers les plus beaux panoramas et sites patrimoniaux de la wilaya.',
    duration: '2h00',
    price: '3 000 DA',
    image: require('../assets/images/theatre-romain.jpg'),
    service: 'Circuit touristique',
    ctaLabel: 'Réserver cette expérience',
    includes: DEFAULT_INCLUDES,
  },
  'experience:Nature': {
    typeLabel: 'Expérience locale',
    description:
      'Immersion nature — sources, collines et paysages préservés autour de Guelma avec votre chauffeur.',
    duration: '3h00',
    price: '4 200 DA',
    image: require('../assets/images/theatre-romain1.jpg'),
    service: 'Circuit touristique',
    ctaLabel: 'Réserver cette expérience',
    includes: DEFAULT_INCLUDES,
  },
  'guide:Guide certifié PROTAXI': {
    typeLabel: 'Guide touristique',
    description:
      'Visites privées avec un expert local passionné — circuits sur mesure et transport inclus du départ à la destination.',
    duration: '4h00',
    price: '6 500 DA',
    image: require('../assets/images/services/chauffeur-prive.jpg'),
    service: 'Guide touristique',
    ctaLabel: 'Réserver un guide',
    includes: [...DEFAULT_INCLUDES, 'Guide certifié PROTAXI'],
  },
};

type PremiumExperienceItem = {
  id: string;
  title: string;
  emoji: string;
  ambiance: string;
  includes: string[];
  duration: string;
  basePrice: number;
  tags: string[];
  image: ImageSourcePropType;
};

const PREMIUM_EXPERIENCES: PremiumExperienceItem[] = [
  {
    id: 'historique',
    title: 'Expérience Historique',
    emoji: '🏛️',
    ambiance: 'Patrimoine • Culture • Histoire',
    includes: ['Théâtre romain', 'Musée', 'Vieille ville', 'Café traditionnel'],
    duration: '3h / demi-journée',
    basePrice: 3500,
    tags: ['Patrimoine', 'Culture', 'Historique'],
    image: require('../assets/images/theatre-romain.jpg'),
  },
  {
    id: 'nature',
    title: 'Nature & Sources',
    emoji: '🌿',
    ambiance: 'Nature • Relax • Thermes',
    includes: ['Hammam Debagh', 'Cascades', 'Maouna', 'Pause nature'],
    duration: 'Journée',
    basePrice: 6500,
    tags: ['Nature', 'Sources', 'Premium'],
    image: require('../assets/images/services/circuits-touristiques.jpg'),
  },
  {
    id: 'gastro',
    title: 'Gastronomie Guelmoise',
    emoji: '🍲',
    ambiance: 'Saveurs • Tradition • Local',
    includes: [
      'Restaurant local',
      'Dégustation',
      'Café oriental',
      'Marché traditionnel',
    ],
    duration: '2h30',
    basePrice: 2800,
    tags: ['Food', 'Local', 'Découverte'],
    image: require('../assets/images/services/explorer-plus.jpg'),
  },
  {
    id: 'sunset',
    title: 'Sunset Premium',
    emoji: '🌅',
    ambiance: 'Romantique • Premium • Privé',
    includes: [
      'Spot coucher soleil',
      'Café premium',
      'Shooting photo',
      'Chauffeur privé',
    ],
    duration: 'Soirée',
    basePrice: 4500,
    tags: ['Sunset', 'VIP', 'Photo', 'Premium'],
    image: require('../assets/images/hero-bg2.png'),
  },
  {
    id: 'famille',
    title: 'Circuit Famille',
    emoji: '👨‍👩‍👧',
    ambiance: 'Famille • Confort • Détente',
    includes: ['Nature', 'Restaurant', 'Pauses détente', 'Véhicule familial'],
    duration: '5h',
    basePrice: 7000,
    tags: ['Famille', 'Confort', 'Nature'],
    image: require('../assets/images/theatre-romain1.jpg'),
  },
  {
    id: 'aventure',
    title: 'Aventure & Randonnée',
    emoji: '🥾',
    ambiance: 'Aventure • Nature • Exploration',
    includes: ['Maouna', 'Randonnée', 'Forêt', 'Cascades'],
    duration: 'Journée',
    basePrice: 6000,
    tags: ['Aventure', 'Randonnée', 'Nature'],
    image: require('../assets/images/theatre-romain1.jpg'),
  },
];

const EXPERIENCE_OPTIONS = [
  { id: 'guide', label: 'Guide privé', price: 2000, icon: 'person-outline' as const },
  { id: 'vip', label: 'Véhicule VIP', price: 1500, icon: 'car-sport-outline' as const },
  { id: 'pause', label: 'Pause restaurant', price: 800, icon: 'restaurant-outline' as const },
  { id: 'photos', label: 'Photos souvenir', price: 500, icon: 'images-outline' as const },
  {
    id: 'playlist',
    label: 'Playlist personnalisée',
    price: 300,
    icon: 'musical-notes-outline' as const,
  },
  {
    id: 'cafe',
    label: 'Pause café premium',
    price: 600,
    icon: 'cafe-outline' as const,
  },
];

const GROUP_OPTION_IDS = ['photos', 'cafe'] as const;

const GROUP_MEETING_POINT = 'Place du 1er Novembre — Guelma';
const GROUP_DEPARTURE_TIME = '17:00';
const GROUP_SPOTS_LEFT = '3';
const GROUP_TRAVELERS = '6';

type TimelineStep = { time: string; title: string; desc: string };

type PremiumVehicleItem = {
  id: string;
  name: string;
  capacity: string;
  comfort: string;
  image: ImageSourcePropType;
  features: string[];
  badges: string[];
  extraPrice: number;
};

const PREMIUM_VEHICLES: PremiumVehicleItem[] = [
  {
    id: 'berline-vip',
    name: 'Berline VIP',
    capacity: '1–3 passagers',
    comfort: 'Confort executive',
    image: require('../assets/images/services/chauffeur-prive.jpg'),
    features: ['Sièges cuir', 'Climatisation', 'Chauffeur certifié'],
    badges: ['Premium', 'Silencieux'],
    extraPrice: 0,
  },
  {
    id: 'suv-premium',
    name: 'SUV Premium',
    capacity: '1–4 passagers',
    comfort: 'Confort tout-terrain',
    image: require('../assets/images/services/circuits-touristiques.jpg'),
    features: ['4×4 adapté', 'Espace bagages', 'Chauffeur certifié'],
    badges: ['Nature', 'Premium'],
    extraPrice: 800,
  },
  {
    id: 'familial-confort',
    name: 'Familial Confort',
    capacity: '4–6 passagers',
    comfort: 'Espace familial',
    image: require('../assets/images/services/location-vehicules.jpg'),
    features: ['Sièges enfants', 'Climatisation', 'Chauffeur certifié'],
    badges: ['Famille', 'Confort'],
    extraPrice: 600,
  },
  {
    id: 'chauffeur-noir',
    name: 'Chauffeur Privé Noir',
    capacity: '1–3 passagers',
    comfort: 'Service black label',
    image: require('../assets/images/services/chauffeur-prive.jpg'),
    features: ['Tenue chauffeur', 'Accueil VIP', 'Discrétion totale'],
    badges: ['Black', 'VIP', 'Luxe'],
    extraPrice: 1500,
  },
];

const EXPERIENCE_DEFAULT_VEHICLE: Record<string, string> = {
  historique: 'berline-vip',
  nature: 'suv-premium',
  gastro: 'berline-vip',
  sunset: 'chauffeur-noir',
  famille: 'familial-confort',
  aventure: 'suv-premium',
};

const EXPERIENCE_TIMELINES: Record<string, TimelineStep[]> = {
  historique: [
    { time: '09:00', title: 'Départ hôtel', desc: 'Prise en charge premium PROTAXI' },
    { time: '09:30', title: 'Théâtre romain', desc: 'Visite du patrimoine antique' },
    { time: '11:00', title: 'Musée', desc: 'Collections historiques de Guelma' },
    { time: '12:00', title: 'Vieille ville', desc: 'Balade culturelle authentique' },
    { time: '12:30', title: 'Café traditionnel', desc: 'Pause locale exclusive' },
  ],
  nature: [
    { time: '08:00', title: 'Départ', desc: 'Direction Hammam Debagh' },
    { time: '09:30', title: 'Hammam Debagh', desc: 'Sources thermales légendaires' },
    { time: '11:30', title: 'Cascades', desc: 'Nature préservée et panoramas' },
    { time: '14:00', title: 'Maouna', desc: 'Village et traditions locales' },
    { time: '16:00', title: 'Pause nature', desc: 'Moment détente premium' },
  ],
  gastro: [
    { time: '11:00', title: 'Marché traditionnel', desc: 'Découverte des saveurs locales' },
    { time: '12:00', title: 'Restaurant local', desc: 'Déjeuner authentique guelmois' },
    { time: '13:30', title: 'Dégustation', desc: 'Spécialités régionales' },
    { time: '14:30', title: 'Café oriental', desc: 'Pause premium en terrasse' },
  ],
  sunset: [
    { time: '16:30', title: 'Départ hôtel', desc: 'Chauffeur privé à votre porte' },
    { time: '17:00', title: 'Théâtre romain', desc: 'Golden hour patrimonial' },
    { time: '18:00', title: 'Sunset panoramique', desc: 'Vue exclusive coucher de soleil' },
    { time: '18:30', title: 'Café premium', desc: 'Moment privé et shooting photo' },
    { time: '19:30', title: 'Retour', desc: 'Trajet confortable de retour' },
  ],
  famille: [
    { time: '10:00', title: 'Départ familial', desc: 'Véhicule spacieux et sécurisé' },
    { time: '10:30', title: 'Nature', desc: 'Activité plein air adaptée' },
    { time: '12:30', title: 'Restaurant', desc: 'Menu convivial pour tous' },
    { time: '14:00', title: 'Pauses détente', desc: 'Moments calmes en famille' },
    { time: '15:00', title: 'Retour', desc: 'Fin de journée en douceur' },
  ],
  aventure: [
    { time: '07:30', title: 'Départ aventure', desc: 'Briefing avec votre chauffeur' },
    { time: '08:30', title: 'Maouna', desc: 'Point de départ randonnée' },
    { time: '11:00', title: 'Forêt', desc: 'Sentier nature et exploration' },
    { time: '13:00', title: 'Cascades', desc: 'Pause fraîcheur panoramique' },
    { time: '16:00', title: 'Retour', desc: 'Retour confortable à Guelma' },
  ],
};

const EXPERIENCE_REVIEWS: Record<string, string[]> = {
  historique: [
    'Expérience incroyable, le théâtre est magnifique.',
    'Guide passionné et transport impeccable.',
    'Très professionnel, je recommande vivement.',
  ],
  nature: [
    'Journée ressourçante, Hammam Debagh est unique.',
    'Paysages à couper le souffle, chauffeur au top.',
    'Expérience premium du début à la fin.',
  ],
  gastro: [
    'Les saveurs locales étaient exceptionnelles.',
    'Parfait pour explorer Guelma avec PROTAXI.',
    'Service PROTAXI très professionnel.',
  ],
  sunset: [
    'Le sunset était magnifique.',
    'Moment romantique inoubliable.',
    'Chauffeur discret et expérience VIP.',
  ],
  famille: [
    'Parfait pour les enfants, très confortable.',
    'Organisation fluide et chauffeur adorable.',
    'Excellente journée en famille.',
  ],
  aventure: [
    'Randonnée superbe, véhicule adapté.',
    'Exploration nature au top.',
    'Très professionnel et ponctuel.',
  ],
};

type StickyBookingState = {
  title: string;
  totalPrice: number;
  onContinue: () => void;
};

type BookingMode = 'private' | 'group';

const GROUP_DISCOUNT_RATE = 0.72;

function parsePriceAmount(raw: string) {
  const digits = raw.replace(/[^\d]/g, '');
  return Number(digits) || 0;
}

function applyBookingModePrice(baseAmount: number, mode: BookingMode) {
  if (mode === 'group') return Math.round(baseAmount * GROUP_DISCOUNT_RATE);
  return baseAmount;
}

function formatPrice(amount: number) {
  return `${amount.toLocaleString('fr-FR')} DA`;
}

function FadeInSection({
  children,
  style,
  delay = 0,
}: {
  children: ReactNode;
  style?: object;
  delay?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 460, delay, useNativeDriver: true }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        tension: 78,
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

function PulseDot() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.timelineDotWrap}>
      <Animated.View style={[styles.timelineDotGlow, { opacity: pulse }]} />
      <View style={styles.timelineDot} />
    </View>
  );
}

function ExperienceTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <View style={styles.timeline}>
      <View style={styles.timelineLine} />
      {steps.map((step, index) => (
        <FadeInSection key={`${step.time}-${step.title}`} delay={index * 70} style={styles.timelineItem}>
          <PulseDot />
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTime}>{step.time}</Text>
            <Text style={styles.timelineTitle}>{step.title}</Text>
            <Text style={styles.timelineDesc}>{step.desc}</Text>
          </View>
        </FadeInSection>
      ))}
    </View>
  );
}

function VehicleCardItem({
  item,
  active,
  onSelect,
}: {
  item: PremiumVehicleItem;
  active: boolean;
  onSelect: () => void;
}) {
  const scale = useRef(new Animated.Value(active ? 1.03 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.03 : 1,
      tension: 120,
      friction: 14,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);

  return (
    <Pressable onPress={onSelect}>
      <Animated.View
        style={[
          styles.vehicleSliderCard,
          active && styles.vehicleSliderCardActive,
          active && styles.vehicleSliderCardGlow,
          { transform: [{ scale }] },
        ]}
      >
        {active ? <View style={styles.vehicleSliderCardGlowOrb} /> : null}
        <Image source={item.image} style={styles.vehicleSliderImage} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(5,5,5,0.08)', 'rgba(5,5,5,0.55)', 'rgba(5,5,5,0.98)']}
          locations={[0, 0.38, 1]}
          style={styles.vehicleSliderGradient}
        />

        {active ? (
          <View style={styles.vehicleSelectedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={green} />
            <Text style={styles.vehicleSelectedText}>Sélectionné</Text>
          </View>
        ) : null}

        <View style={styles.vehicleSliderBody}>
          <View style={styles.vehicleBadgeRow}>
            {item.badges.map((badge) => (
              <View key={badge} style={styles.vehiclePremiumBadge}>
                <Text style={styles.vehiclePremiumBadgeText}>{badge}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.vehicleSliderName}>{item.name}</Text>
          <Text style={styles.vehicleSliderMeta}>
            {item.capacity} • {item.comfort}
          </Text>

          <View style={styles.vehicleFeatureList}>
            {item.features.map((feature) => (
              <View key={feature} style={styles.vehicleFeatureChip}>
                <Ionicons name="checkmark-circle" size={12} color={green} />
                <Text style={styles.vehicleFeatureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <View style={styles.vehicleSliderFooter}>
            <Text style={styles.vehicleSliderPriceLabel}>Supplément</Text>
            <Text style={styles.vehicleSliderPrice}>
              {item.extraPrice > 0 ? `+${formatPrice(item.extraPrice)}` : 'Inclus'}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function PremiumVehicleSlider({
  vehicles,
  selectedVehicleId,
  onSelect,
}: {
  vehicles: PremiumVehicleItem[];
  selectedVehicleId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.vehicleSliderScroll}
      decelerationRate="fast"
      snapToInterval={294}
      snapToAlignment="start"
    >
      {vehicles.map((item) => (
        <VehicleCardItem
          key={item.id}
          item={item}
          active={selectedVehicleId === item.id}
          onSelect={() => onSelect(item.id)}
        />
      ))}
    </ScrollView>
  );
}

function SocialProofSection({
  rating,
  reviews,
}: {
  rating: string;
  reviews: string[];
}) {
  return (
    <View style={styles.socialSection}>
      <View style={styles.socialHeader}>
        <View style={styles.socialRatingBox}>
          <Ionicons name="star" size={18} color={green} />
          <Text style={styles.socialRating}>{rating}/5</Text>
        </View>
        <Text style={styles.socialCount}>+120 voyageurs</Text>
      </View>
      {reviews.map((quote, index) => (
        <FadeInSection key={quote} delay={index * 80}>
          <View style={styles.reviewCard}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={green} />
            <Text style={styles.reviewText}>"{quote}"</Text>
          </View>
        </FadeInSection>
      ))}
    </View>
  );
}

const GALLERY_EXTRA_ITEMS: { image: ImageSourcePropType; caption: string }[] = [
  {
    image: require('../assets/images/theatre-romain1.jpg'),
    caption: 'Théâtre romain',
  },
  {
    image: require('../assets/images/services/circuits-touristiques.jpg'),
    caption: 'Nature & sources',
  },
  {
    image: require('../assets/images/services/explorer-plus.jpg'),
    caption: 'Gastronomie locale',
  },
];

function ImmersiveGallery({
  mainImage,
  title,
}: {
  mainImage: ImageSourcePropType;
  title: string;
}) {
  const galleryItems = [
    { image: mainImage, caption: title },
    ...GALLERY_EXTRA_ITEMS,
  ];

  return (
    <View style={styles.gallerySection}>
      <View style={styles.galleryHeader}>
        <View>
          <Text style={styles.gallerySectionTitle}>Galerie immersive</Text>
          <View style={styles.gallerySectionAccent} />
        </View>
        <View style={styles.galleryLiveBadge}>
          <View style={styles.galleryLiveDot} />
          <Text style={styles.galleryLiveText}>PROTAXI VIEW</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.galleryScroll}
        decelerationRate="fast"
        snapToInterval={274}
        snapToAlignment="start"
      >
        {galleryItems.map((item, index) => (
          <View key={`${item.caption}-${index}`} style={styles.galleryCard}>
            <View style={styles.galleryGlow} />
            <Image source={item.image} style={styles.galleryImage} resizeMode="cover" />
            <LinearGradient
              colors={['rgba(5,5,5,0.05)', 'rgba(5,5,5,0.45)', 'rgba(5,5,5,0.96)']}
              locations={[0, 0.45, 1]}
              style={styles.galleryGradient}
            />
            <View style={styles.galleryCardFooter}>
              <Text style={styles.galleryTitle} numberOfLines={2}>
                {item.caption}
              </Text>
              <View style={styles.galleryIndexPill}>
                <Text style={styles.galleryIndexText}>
                  {index + 1}/{galleryItems.length}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function CircuitMiniMap({
  steps,
  duration,
  service,
}: {
  steps: string[];
  duration: string;
  service: string;
}) {
  const routeSteps = steps.slice(0, 6);

  const getPinPosition = (index: number, total: number) => {
    const t = total <= 1 ? 0.5 : index / (total - 1);
    return {
      left: `${6 + t * 78}%` as `${number}%`,
      top: `${58 + Math.sin(t * Math.PI) * -32}%` as `${number}%`,
    };
  };

  return (
    <View style={styles.circuitMapSection}>
      <View style={styles.circuitMapHeader}>
        <View>
          <Text style={styles.circuitMapTitle}>Carte du circuit</Text>
          <View style={styles.circuitMapAccent} />
        </View>
        <View style={styles.circuitMapBadge}>
          <MaterialCommunityIcons name="map-marker-path" size={13} color={green} />
          <Text style={styles.circuitMapBadgeText}>ITINÉRAIRE</Text>
        </View>
      </View>

      <View style={styles.circuitMapCard}>
        <LinearGradient
          colors={['rgba(139,197,63,0.08)', 'rgba(5,5,5,0.95)', '#050505']}
          style={styles.circuitMapCanvas}
        >
          <View style={styles.circuitMapGridH} />
          <View style={styles.circuitMapGridV} />
          <View style={styles.circuitMapRouteGlow} />

          {routeSteps.length > 1 ? (
            <View style={styles.circuitMapRouteLine} />
          ) : null}

          {routeSteps.map((step, index) => {
            const position = getPinPosition(index, routeSteps.length);
            return (
              <View
                key={`${step}-${index}`}
                style={[styles.circuitMapPinWrap, { left: position.left, top: position.top }]}
              >
                <View style={styles.circuitMapPinGlow} />
                <View style={styles.circuitMapPin}>
                  <Ionicons name="location" size={14} color="#111" />
                </View>
                <Text style={styles.circuitMapPinLabel} numberOfLines={1}>
                  {index + 1}
                </Text>
              </View>
            );
          })}

          <View style={styles.circuitMapCornerBadge}>
            <Ionicons name="navigate-outline" size={12} color={green} />
            <Text style={styles.circuitMapCornerText}>Guelma</Text>
          </View>
        </LinearGradient>

        <View style={styles.circuitMapMetaRow}>
          <View style={styles.circuitMapMetaChip}>
            <Ionicons name="time-outline" size={14} color={green} />
            <Text style={styles.circuitMapMetaText}>{duration}</Text>
          </View>
          <View style={styles.circuitMapMetaDivider} />
          <View style={styles.circuitMapMetaChip}>
            <Ionicons name="car-outline" size={14} color={green} />
            <Text style={styles.circuitMapMetaText}>{service}</Text>
          </View>
        </View>

        <View style={styles.circuitMapStepsList}>
          {routeSteps.map((step, index) => (
            <View key={`${step}-row-${index}`} style={styles.circuitMapStepRow}>
              <View style={styles.circuitMapStepDot}>
                <Text style={styles.circuitMapStepIndex}>{index + 1}</Text>
              </View>
              <Text style={styles.circuitMapStepText} numberOfLines={2}>
                {step}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const LIVE_AVAILABILITY_ITEMS = [
  {
    icon: 'calendar-outline' as const,
    title: 'Disponible aujourd\'hui',
    subtitle: 'Confirmation immédiate',
  },
  {
    icon: 'people-outline' as const,
    title: '3 places restantes',
    subtitle: 'Dernières disponibilités',
  },
  {
    icon: 'flash-outline' as const,
    title: 'Réponse en moins de 15 min',
    subtitle: 'Support PROTAXI live',
  },
  {
    icon: 'flame-outline' as const,
    title: 'Très demandé cette semaine',
    subtitle: 'Expérience premium populaire',
  },
];

function LiveAvailabilitySection() {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.liveSection}>
      <View style={styles.liveHeader}>
        <View>
          <Text style={styles.liveSectionTitle}>Disponibilité live</Text>
          <View style={styles.liveSectionAccent} />
        </View>
        <View style={styles.liveBadge}>
          <Animated.View style={[styles.liveBadgeDot, { opacity: pulse }]} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
      </View>

      <View style={styles.liveGrid}>
        {LIVE_AVAILABILITY_ITEMS.map((item) => (
          <View key={item.title} style={styles.liveCard}>
            <View style={styles.liveCardIconWrap}>
              <Ionicons name={item.icon} size={18} color={green} />
            </View>
            <Text style={styles.liveCardTitle}>{item.title}</Text>
            <Text style={styles.liveCardSubtitle}>{item.subtitle}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

type BookingModeOption = {
  id: BookingMode;
  emoji: string;
  title: string;
  perks: string[];
  badge?: string;
  priceHint: string;
};

const BOOKING_MODE_OPTIONS: BookingModeOption[] = [
  {
    id: 'private',
    emoji: '👤',
    title: 'Expérience privée',
    perks: ['Véhicule privé', 'Expérience exclusive', 'Horaires flexibles', 'Prix complet'],
    priceHint: 'Formule exclusive',
  },
  {
    id: 'group',
    emoji: '🧑‍🤝‍🧑',
    title: 'Expérience groupe',
    perks: ['Expérience partagée', 'Prix réduit/personne', 'Départ collectif', 'Places limitées'],
    badge: 'POPULAIRE',
    priceHint: 'Tarif avantageux',
  },
];

function BookingModeCard({
  option,
  active,
  onSelect,
}: {
  option: BookingModeOption;
  active: boolean;
  onSelect: () => void;
}) {
  const scale = useRef(new Animated.Value(active ? 1.02 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.02 : 1,
      tension: 120,
      friction: 14,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);

  return (
    <Pressable style={styles.bookingModeCardWrap} onPress={onSelect}>
      <Animated.View
        style={[
          styles.bookingModeCard,
          active && styles.bookingModeCardActive,
          active && styles.bookingModeCardGlow,
          { transform: [{ scale }] },
        ]}
      >
        {option.badge ? (
          <View style={styles.bookingModePopularBadge}>
            <Text style={styles.bookingModePopularText}>{option.badge}</Text>
          </View>
        ) : null}

        {active ? (
          <View style={styles.bookingModeSelectedBadge}>
            <Ionicons name="checkmark-circle" size={13} color={green} />
            <Text style={styles.bookingModeSelectedText}>Sélectionné</Text>
          </View>
        ) : null}

        <Text style={styles.bookingModeEmoji}>{option.emoji}</Text>
        <Text style={styles.bookingModeTitle}>{option.title}</Text>
        <Text style={styles.bookingModePriceHint}>{option.priceHint}</Text>

        <View style={styles.bookingModePerks}>
          {option.perks.map((perk) => (
            <View key={perk} style={styles.bookingModePerkRow}>
              <Ionicons name="checkmark-circle" size={12} color={green} />
              <Text style={styles.bookingModePerkText}>{perk}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </Pressable>
  );
}

function GroupModeDetails({ pricePerPerson }: { pricePerPerson: number }) {
  return (
    <View style={styles.groupModePanel}>
      <View style={styles.groupModeRow}>
        <Ionicons name="people-outline" size={16} color={green} />
        <Text style={styles.groupModeText}>{GROUP_SPOTS_LEFT} places restantes</Text>
      </View>
      <View style={styles.groupModeRow}>
        <Ionicons name="time-outline" size={16} color={green} />
        <Text style={styles.groupModeText}>Départ collectif : {GROUP_DEPARTURE_TIME}</Text>
      </View>
      <View style={styles.groupModeRow}>
        <Ionicons name="person-add-outline" size={16} color={green} />
        <Text style={styles.groupModeText}>+{GROUP_TRAVELERS} voyageurs déjà inscrits</Text>
      </View>
      <View style={styles.groupModePriceRow}>
        <Text style={styles.groupModePriceLabel}>Prix par personne</Text>
        <Text style={styles.groupModePriceValue}>
          {pricePerPerson > 0 ? `${formatPrice(pricePerPerson)} / pers.` : 'Sur devis'}
        </Text>
      </View>
    </View>
  );
}

function GroupAssignedVehicleCard() {
  return (
    <View style={styles.groupVehicleCard}>
      <View style={styles.groupVehicleBadge}>
        <Ionicons name="bus-outline" size={12} color={green} />
        <Text style={styles.groupVehicleBadgeText}>ATTRIBUÉ PAR PROTAXI</Text>
      </View>

      <Text style={styles.groupVehicleTitle}>Véhicule groupe attribué</Text>
      <Text style={styles.groupVehicleSubtitle}>Van / Minibus selon disponibilité</Text>

      <View style={styles.groupVehicleDetails}>
        <View style={styles.groupVehicleRow}>
          <Ionicons name="time-outline" size={15} color={green} />
          <Text style={styles.groupVehicleRowText}>
            Départ collectif fixe : {GROUP_DEPARTURE_TIME}
          </Text>
        </View>
        <View style={styles.groupVehicleRow}>
          <Ionicons name="location-outline" size={15} color={green} />
          <Text style={styles.groupVehicleRowText}>
            Rendez-vous collectif : {GROUP_MEETING_POINT}
          </Text>
        </View>
        <View style={styles.groupVehicleRow}>
          <Ionicons name="ticket-outline" size={15} color={green} />
          <Text style={styles.groupVehicleRowText}>{GROUP_SPOTS_LEFT} places restantes</Text>
        </View>
      </View>
    </View>
  );
}

function BookingModeSection({
  bookingMode,
  onSelect,
  groupPricePerPerson,
}: {
  bookingMode: BookingMode;
  onSelect: (mode: BookingMode) => void;
  groupPricePerPerson: number;
}) {
  return (
    <View style={styles.bookingModeSection}>
      <View style={styles.bookingModeHeader}>
        <Text style={styles.bookingModeSectionTitle}>Choisissez votre formule</Text>
        <View style={styles.bookingModeSectionAccent} />
      </View>

      <View style={styles.bookingModeGrid}>
        {BOOKING_MODE_OPTIONS.map((option) => (
          <BookingModeCard
            key={option.id}
            option={option}
            active={bookingMode === option.id}
            onSelect={() => onSelect(option.id)}
          />
        ))}
      </View>

      {bookingMode === 'group' ? (
        <GroupModeDetails pricePerPerson={groupPricePerPerson} />
      ) : null}
    </View>
  );
}

function StickyBookingBar({
  title,
  totalPrice,
  onContinue,
  bottomInset,
}: {
  title: string;
  totalPrice: number;
  onContinue: () => void;
  bottomInset: number;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.02, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.stickyBar, { paddingBottom: bottomInset + 12 }]}>
      <LinearGradient
        colors={['rgba(5,5,5,0.72)', 'rgba(5,5,5,0.94)']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.stickyContent}>
        <View style={styles.stickyInfo}>
          <Text style={styles.stickyTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.stickyPrice}>{formatPrice(totalPrice)}</Text>
        </View>
        <Pressable onPress={onContinue} style={styles.stickyBtnWrap}>
          <Animated.View style={[styles.stickyBtn, styles.ctaGlow, { transform: [{ scale: pulse }] }]}>
            <Text style={styles.stickyBtnText}>Continuer</Text>
            <Ionicons name="arrow-forward" size={16} color="#111" />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

function ExperienceCardItem({
  item,
  active,
  onSelect,
}: {
  item: PremiumExperienceItem;
  active: boolean;
  onSelect: () => void;
}) {
  const scale = useRef(new Animated.Value(active ? 1.02 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.02 : 1,
      tension: 120,
      friction: 14,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);

  return (
    <Pressable onPress={onSelect}>
      <Animated.View
        style={[
          styles.experienceCard,
          active && styles.experienceCardActive,
          active && styles.experienceCardActiveGlow,
          { transform: [{ scale }] },
        ]}
      >
        <Image source={item.image} style={styles.experienceImage} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(5,5,5,0.12)', 'rgba(5,5,5,0.55)', 'rgba(5,5,5,0.97)']}
          locations={[0, 0.35, 1]}
          style={styles.experienceGradient}
        />

        {active ? (
          <View style={styles.experienceSelectedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={green} />
            <Text style={styles.experienceSelectedText}>✓ Sélectionnée</Text>
          </View>
        ) : null}

        <View style={styles.experienceBody}>
          <Text style={styles.experienceTitle} numberOfLines={1}>
            {item.emoji} {item.title}
          </Text>
          <Text style={styles.experienceAmbiance} numberOfLines={1}>{item.ambiance}</Text>

          <View style={styles.experienceTagsRow}>
            {item.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.experienceTag}>
                <Text style={styles.experienceTagText}>{tag}</Text>
              </View>
            ))}
          </View>

          <View style={styles.experienceIncludes}>
            {item.includes.slice(0, 3).map((include) => (
              <View key={include} style={styles.experienceIncludeRow}>
                <Ionicons name="checkmark" size={11} color={green} />
                <Text style={styles.experienceIncludeText} numberOfLines={1}>{include}</Text>
              </View>
            ))}
          </View>

          <View style={styles.experienceFooter}>
            <View style={styles.experienceMetaItem}>
              <Ionicons name="time-outline" size={13} color={green} />
              <Text style={styles.experienceMetaText}>{item.duration}</Text>
            </View>
            <Text style={styles.experiencePrice}>{formatPrice(item.basePrice)}</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function PremiumExperienceBuilder({
  onReserve,
  onStickyChange,
  bookingMode,
}: {
  onReserve: (config: {
    formula: string;
    duration: string;
    steps: string;
    options: string;
    estimatedPrice: string;
  }) => void;
  onStickyChange: (state: StickyBookingState | null) => void;
  bookingMode: BookingMode;
}) {
  const [experienceId, setExperienceId] = useState('historique');
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(() => new Set());
  const [selectedVehicleId, setSelectedVehicleId] = useState('berline-vip');

  const activeExperience =
    PREMIUM_EXPERIENCES.find((item) => item.id === experienceId) ??
    PREMIUM_EXPERIENCES[0];

  const activeVehicle =
    PREMIUM_VEHICLES.find((item) => item.id === selectedVehicleId) ??
    PREMIUM_VEHICLES[0];

  const isGroupMode = bookingMode === 'group';

  const availableOptions = useMemo(
    () =>
      isGroupMode
        ? EXPERIENCE_OPTIONS.filter((item) =>
            GROUP_OPTION_IDS.includes(item.id as (typeof GROUP_OPTION_IDS)[number]),
          )
        : EXPERIENCE_OPTIONS,
    [isGroupMode],
  );

  const optionsTotal = availableOptions
    .filter((item) => selectedOptions.has(item.id))
    .reduce((sum, item) => sum + item.price, 0);

  const vehicleExtra = isGroupMode ? 0 : activeVehicle.extraPrice;
  const rawTotalPrice = activeExperience.basePrice + optionsTotal + vehicleExtra;
  const totalPrice = applyBookingModePrice(rawTotalPrice, bookingMode);

  useEffect(() => {
    if (!isGroupMode) return;
    setSelectedOptions((prev) => {
      const next = new Set(
        [...prev].filter((id) =>
          GROUP_OPTION_IDS.includes(id as (typeof GROUP_OPTION_IDS)[number]),
        ),
      );
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) {
        return prev;
      }
      return next;
    });
  }, [isGroupMode]);

  useEffect(() => {
    if (isGroupMode) return;
    setSelectedVehicleId(EXPERIENCE_DEFAULT_VEHICLE[experienceId] ?? 'berline-vip');
  }, [experienceId, isGroupMode]);

  const selectedOptionsKey = useMemo(
    () => Array.from(selectedOptions).sort().join('|'),
    [selectedOptions],
  );

  const onReserveRef = useRef(onReserve);
  onReserveRef.current = onReserve;

  const onContinueRef = useRef<() => void>(() => {});

  onContinueRef.current = () => {
    const exp =
      PREMIUM_EXPERIENCES.find((item) => item.id === experienceId) ??
      PREMIUM_EXPERIENCES[0];
    const labels = availableOptions
      .filter((item) => selectedOptions.has(item.id))
      .map((item) => item.label);
    const vehicleLabel = isGroupMode
      ? 'Van / Minibus selon disponibilité'
      : (PREMIUM_VEHICLES.find((item) => item.id === selectedVehicleId) ??
          PREMIUM_VEHICLES[0]).name;
    const optionParts = [
      ...labels,
      `Véhicule: ${vehicleLabel}`,
      isGroupMode ? 'Formule: Expérience groupe' : 'Formule: Expérience privée',
    ];

    if (isGroupMode) {
      optionParts.push(`Rendez-vous: ${GROUP_MEETING_POINT}`);
      optionParts.push(`Départ collectif: ${GROUP_DEPARTURE_TIME}`);
    }

    onReserveRef.current({
      formula: exp.title,
      duration: exp.duration,
      steps: exp.includes.join(', '),
      options: optionParts.join(', '),
      estimatedPrice: String(totalPrice),
    });
  };

  const stableOnContinue = useCallback(() => {
    onContinueRef.current();
  }, []);

  const toggleOption = (id: string) => {
    if (isGroupMode && !GROUP_OPTION_IDS.includes(id as (typeof GROUP_OPTION_IDS)[number])) {
      return;
    }

    setSelectedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const optionLabels = useMemo(
    () =>
      availableOptions
        .filter((item) => selectedOptions.has(item.id))
        .map((item) => item.label),
    [availableOptions, selectedOptionsKey],
  );

  useEffect(() => {
    onStickyChange({
      title: activeExperience.title,
      totalPrice,
      onContinue: stableOnContinue,
    });
  }, [activeExperience.title, totalPrice, stableOnContinue, onStickyChange]);

  useEffect(() => {
    return () => onStickyChange(null);
  }, [onStickyChange]);

  const timeline = EXPERIENCE_TIMELINES[experienceId] ?? EXPERIENCE_TIMELINES.historique;
  const reviews = EXPERIENCE_REVIEWS[experienceId] ?? EXPERIENCE_REVIEWS.historique;

  return (
    <>
      <FadeInSection delay={40}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choisissez votre expérience</Text>
          <View style={styles.sectionAccent} />
          <View style={styles.experienceList}>
            {PREMIUM_EXPERIENCES.map((item) => (
              <ExperienceCardItem
                key={item.id}
                item={item}
                active={experienceId === item.id}
                onSelect={() => setExperienceId(item.id)}
              />
            ))}
          </View>
        </View>
      </FadeInSection>

      <FadeInSection key={`timeline-${experienceId}`} delay={80}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Votre expérience</Text>
          <View style={styles.sectionAccent} />
          <ExperienceTimeline steps={timeline} />
        </View>
      </FadeInSection>

      {isGroupMode ? (
        <FadeInSection key={`group-vehicle-${experienceId}`} delay={120}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transport groupe</Text>
            <View style={styles.sectionAccent} />
            <Text style={styles.personalizeHint}>
              Véhicule collectif attribué par PROTAXI — départ {GROUP_DEPARTURE_TIME}
            </Text>
            <GroupAssignedVehicleCard />
          </View>
        </FadeInSection>
      ) : (
        <FadeInSection key={`vehicle-${experienceId}-${selectedVehicleId}`} delay={120}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choisissez votre véhicule premium</Text>
            <View style={styles.sectionAccent} />
            <Text style={styles.personalizeHint}>
              Recommandé pour {activeExperience.title} — {activeVehicle.name}
            </Text>
            <PremiumVehicleSlider
              vehicles={PREMIUM_VEHICLES}
              selectedVehicleId={selectedVehicleId}
              onSelect={setSelectedVehicleId}
            />
          </View>
        </FadeInSection>
      )}

      <FadeInSection delay={160}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isGroupMode ? 'Options groupe disponibles' : 'Personnalisez votre expérience'}
          </Text>
          <View style={styles.sectionAccent} />
          <Text style={styles.personalizeHint}>
            {isGroupMode
              ? 'Formule groupe — options limitées (Photos souvenir, Pause café premium)'
              : `Options exclusives pour ${activeExperience.title}`}
          </Text>
          <View style={styles.selectorList}>
            {availableOptions.map((item) => {
              const active = selectedOptions.has(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.selectorRow, active && styles.selectorRowActive]}
                  activeOpacity={0.88}
                  onPress={() => toggleOption(item.id)}
                >
                  <View style={[styles.selectorIconWrap, active && styles.selectorIconActive]}>
                    <Ionicons name={item.icon} size={18} color={active ? green : muted} />
                  </View>
                  <View style={styles.selectorTextWrap}>
                    <Text style={[styles.selectorLabel, active && styles.selectorTextActive]}>
                      {item.label}
                    </Text>
                    <Text style={styles.selectorSub}>+{formatPrice(item.price)}</Text>
                  </View>
                  <View style={[styles.selectorToggle, active && styles.selectorToggleActive]}>
                    {active ? <Ionicons name="checkmark" size={14} color="#111" /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </FadeInSection>

      <FadeInSection key={`social-${experienceId}`} delay={200}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Pourquoi les clients adorent cette expérience
          </Text>
          <View style={styles.sectionAccent} />
          <SocialProofSection rating="4.9" reviews={reviews} />
        </View>
      </FadeInSection>

      <FadeInSection delay={240}>
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>
            {isGroupMode ? 'Prix / personne' : 'Prix dynamique'}
          </Text>
          <Text style={styles.priceValue}>{formatPrice(totalPrice)}</Text>
          <View style={styles.priceBreakdown}>
            <Text style={styles.priceBreakdownLine}>
              {activeExperience.title} — {formatPrice(activeExperience.basePrice)}
            </Text>
            {optionLabels.length > 0 ? (
              <Text style={styles.priceBreakdownLine}>
                Options — {formatPrice(optionsTotal)}
              </Text>
            ) : null}
            {isGroupMode ? (
              <Text style={styles.priceBreakdownLine}>
                Véhicule groupe — Van / Minibus (inclus)
              </Text>
            ) : (
              <Text style={styles.priceBreakdownLine}>
                {activeVehicle.name} —{' '}
                {vehicleExtra > 0 ? formatPrice(vehicleExtra) : 'Inclus'}
              </Text>
            )}
            {isGroupMode ? (
              <Text style={styles.priceBreakdownLine}>
                Réduction groupe (-{Math.round((1 - GROUP_DISCOUNT_RATE) * 100)}%) —{' '}
                {formatPrice(rawTotalPrice - totalPrice)}
              </Text>
            ) : null}
          </View>
          {isGroupMode ? <GroupModeDetails pricePerPerson={totalPrice} /> : null}
          <Text style={styles.priceHint}>
            Le prix final sera confirmé avant votre départ.
          </Text>
        </View>
      </FadeInSection>
    </>
  );
}

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function getTypeLabel(type: BookingType) {
  switch (type) {
    case 'circuit':
      return 'Circuit touristique';
    case 'hotel':
      return 'Hôtel partenaire';
    case 'experience':
      return 'Expérience locale';
    case 'guide':
      return 'Guide touristique';
    default:
      return 'Découverte';
  }
}

function getDefaultCta(type: BookingType) {
  switch (type) {
    case 'circuit':
      return 'Réserver ce circuit';
    case 'hotel':
      return 'Réserver cet hôtel';
    case 'experience':
      return 'Réserver cette expérience';
    case 'guide':
      return 'Réserver un guide';
    default:
      return 'Continuer';
  }
}

function getDefaultService(type: BookingType) {
  switch (type) {
    case 'circuit':
      return 'Circuit touristique';
    case 'hotel':
      return 'Hôtel & séjour';
    case 'experience':
      return 'Expérience locale';
    case 'guide':
      return 'Guide touristique';
    default:
      return 'Circuit touristique';
  }
}

function pushFinalRoute(
  pathname: Href,
  params: Record<string, string>,
  label: string,
  source: string,
) {
  const routePath = typeof pathname === 'string' ? pathname : String(pathname);
  const paramSummary = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  logNavigation(`${routePath}?${paramSummary}`, { source, label });
  router.push({ pathname, params } as Href);
}

function PremiumCta({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.968,
      tension: 220,
      friction: 16,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 180,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.mainCta, styles.ctaGlow, { transform: [{ scale }] }]}>
        <Text style={styles.mainCtaText}>{label}</Text>
        <Ionicons name="arrow-forward" size={20} color="#111" />
      </Animated.View>
    </Pressable>
  );
}

export default function DiscoverBookingScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [stickyBooking, setStickyBooking] = useState<StickyBookingState | null>(null);
  const [bookingMode, setBookingMode] = useState<BookingMode>('private');

  const params = useLocalSearchParams<{
    type?: string | string[];
    name?: string | string[];
    source?: string | string[];
  }>();

  const type = normalizeParam(params.type) as BookingType;
  const name = normalizeParam(params.name);
  const source = normalizeParam(params.source) || 'discover-guelma';

  const catalogKey = `${type}:${name}`;
  const catalogItem = CATALOG[catalogKey];

  const typeLabel = catalogItem?.typeLabel ?? getTypeLabel(type);
  const description =
    catalogItem?.description ??
    `Découvrez ${name} avec PROTAXI — une expérience premium pensée pour vous.`;
  const duration = catalogItem?.duration ?? 'Flexible';
  const price = catalogItem?.price ?? 'Sur devis';
  const image =
    catalogItem?.image ?? require('../assets/images/theatre-romain.jpg');
  const ctaLabel = catalogItem?.ctaLabel ?? getDefaultCta(type);
  const includes = catalogItem?.includes ?? DEFAULT_INCLUDES;
  const service = catalogItem?.service ?? getDefaultService(type);
  const ambiance = catalogItem?.ambiance;
  const tags = catalogItem?.tags ?? [];
  const displayRating = catalogItem?.rating ?? '4.9';
  const isCustomCircuit = name === 'Circuit sur mesure';
  const showBookingMode = type !== 'hotel';

  const catalogPriceAmount = useMemo(() => parsePriceAmount(price), [price]);
  const displayPriceAmount = useMemo(
    () => applyBookingModePrice(catalogPriceAmount, bookingMode),
    [catalogPriceAmount, bookingMode],
  );
  const displayPrice =
    catalogPriceAmount > 0 ? formatPrice(displayPriceAmount) : price;
  const groupPricePerPerson = displayPriceAmount;

  const heroScale = scrollY.interpolate({
    inputRange: [-120, 0, HERO_HEIGHT],
    outputRange: [1.18, 1.1, 1.02],
    extrapolate: 'clamp',
  });

  const heroTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT],
    outputRange: [0, HERO_HEIGHT * 0.35],
    extrapolate: 'clamp',
  });

  const heroOverlayOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT * 0.6, HERO_HEIGHT],
    outputRange: [0.55, 0.72, 0.92],
    extrapolate: 'clamp',
  });

  const handleBooking = useCallback(
    (customConfig?: {
      formula: string;
      duration: string;
      steps: string;
      options: string;
      estimatedPrice: string;
    }) => {
      if (type === 'hotel') {
        pushFinalRoute(
          PROTAXI_ROUTES.hotel,
          { hotelName: name, source },
          ctaLabel,
          source,
        );
        return;
      }

      const bookingParams: Record<string, string> = {
        source,
        circuitName: name || '',
        bookingMode,
      };

      if (customConfig) {
        bookingParams.formula = customConfig.formula;
        bookingParams.duration = customConfig.duration;
        if (customConfig.steps) bookingParams.steps = customConfig.steps;
        if (customConfig.options) bookingParams.options = customConfig.options;
        bookingParams.estimatedPrice = customConfig.estimatedPrice;
      } else {
        bookingParams.duration = duration;
        bookingParams.steps = includes.join(', ');
        bookingParams.estimatedPrice =
          catalogPriceAmount > 0 ? String(displayPriceAmount) : price;
      }

      if (bookingMode === 'group') {
        bookingParams.groupDeparture = GROUP_DEPARTURE_TIME;
        bookingParams.groupSpotsLeft = GROUP_SPOTS_LEFT;
        bookingParams.groupTravelers = GROUP_TRAVELERS;
        bookingParams.groupMeetingPoint = GROUP_MEETING_POINT;
      }

      pushFinalRoute(
        PROTAXI_ROUTES.tourBooking,
        bookingParams,
        customConfig ? 'Réserver' : ctaLabel,
        source,
      );
    },
    [type, name, source, ctaLabel, duration, includes, price, bookingMode, catalogPriceAmount, displayPriceAmount],
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['rgba(139,197,63,0.06)', 'rgba(5,5,5,0)']}
        style={styles.topGlow}
      />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          isCustomCircuit && styles.scrollWithSticky,
        ]}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
      >
        <View style={styles.heroWrap}>
          <Animated.Image
            source={image}
            style={[
              styles.heroImage,
              {
                transform: [{ scale: heroScale }, { translateY: heroTranslateY }],
              },
            ]}
            resizeMode="cover"
          />

          <LinearGradient
            colors={[
              'rgba(5,5,5,0.12)',
              'rgba(5,5,5,0.38)',
              'rgba(5,5,5,0.78)',
              'rgba(5,5,5,0.98)',
            ]}
            locations={[0, 0.28, 0.58, 1]}
            style={styles.heroGradient}
          />

          <Animated.View
            style={[styles.heroDynamicOverlay, { opacity: heroOverlayOpacity }]}
          />

          <View style={styles.heroBadgeGlow} />

          <View style={[styles.heroTopBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.heroBackBtn}
              activeOpacity={0.85}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.heroTopCenter}>
              <MaterialCommunityIcons name="compass-outline" size={15} color={green} />
              <Text style={styles.heroTopTitle}>EXPÉRIENCE</Text>
            </View>

            <View style={styles.heroBackPlaceholder} />
          </View>

          <View style={styles.heroContent}>
            <View style={styles.heroBadgesRow}>
              <View style={styles.premiumBadge}>
                <Ionicons name="diamond-outline" size={11} color={green} />
                <Text style={styles.premiumBadgeText}>PROTAXI PREMIUM</Text>
              </View>

              <View style={styles.typePill}>
                <Text style={styles.typePillText}>{typeLabel.toUpperCase()}</Text>
              </View>
            </View>

            <Text style={styles.heroTitle} numberOfLines={2}>
              {name || 'Expérience PROTAXI'}
            </Text>

            <View style={styles.trustRow}>
              <View style={styles.trustChip}>
                <Ionicons name="star" size={13} color={green} />
                <Text style={styles.trustChipText}>{displayRating}</Text>
              </View>

              <View style={styles.trustDivider} />

              <View style={styles.trustChip}>
                <Ionicons name="people-outline" size={13} color={green} />
                <Text style={styles.trustChipText}>120+ voyageurs satisfaits</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.bodyGallery}>
          <ImmersiveGallery
            mainImage={image}
            title={name || 'Expérience PROTAXI'}
          />
          <CircuitMiniMap steps={includes} duration={duration} service={service} />
          <LiveAvailabilitySection />
        </View>

        <View style={styles.body}>
          {showBookingMode ? (
            <BookingModeSection
              bookingMode={bookingMode}
              onSelect={setBookingMode}
              groupPricePerPerson={groupPricePerPerson}
            />
          ) : null}

          {isCustomCircuit ? (
            <>
              <View style={styles.metaRow}>
                <View style={styles.metaCard}>
                  <Ionicons name="construct-outline" size={18} color={green} />
                  <Text style={styles.metaLabel}>Mode</Text>
                  <Text style={styles.metaValue}>Configurator</Text>
                </View>
                <View style={styles.metaCard}>
                  <Ionicons name="options-outline" size={18} color={green} />
                  <Text style={styles.metaLabel}>Personnalisation</Text>
                  <Text style={styles.metaValue}>100%</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <View style={styles.sectionAccent} />
                <Text style={styles.description}>{description}</Text>
              </View>

              {tags.length > 0 ? (
                <View style={styles.tagsRow}>
                  {tags.map((tag) => (
                    <View key={tag} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <PremiumExperienceBuilder
                onReserve={handleBooking}
                onStickyChange={setStickyBooking}
                bookingMode={bookingMode}
              />
            </>
          ) : (
            <>
              <View style={styles.metaRow}>
                <View style={styles.metaCard}>
                  <Ionicons name="time-outline" size={18} color={green} />
                  <Text style={styles.metaLabel}>Durée estimée</Text>
                  <Text style={styles.metaValue}>{duration}</Text>
                </View>

                <View style={styles.metaCard}>
                  <Ionicons name="pricetag-outline" size={18} color={green} />
                  <Text style={styles.metaLabel}>
                    {bookingMode === 'group' ? 'Prix / personne' : 'Prix estimé'}
                  </Text>
                  <Text style={styles.metaValue}>{displayPrice}</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <View style={styles.sectionAccent} />
                <Text style={styles.description}>{description}</Text>
              </View>

              {tags.length > 0 ? (
                <View style={styles.tagsRow}>
                  {tags.map((tag) => (
                    <View key={tag} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {ambiance ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Ambiance</Text>
                  <View style={styles.sectionAccent} />
                  <Text style={styles.description}>{ambiance}</Text>
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Inclus dans votre réservation</Text>
                <View style={styles.sectionAccent} />
                <View style={styles.includesList}>
                  {includes.map((item) => (
                    <View key={item} style={styles.includeRow}>
                      <View style={styles.includeIcon}>
                        <Ionicons name="checkmark" size={14} color="#111" />
                      </View>
                      <Text style={styles.includeText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.priceCard}>
                <Text style={styles.priceLabel}>
                  {bookingMode === 'group' ? 'Tarif groupe / personne' : 'Tarif indicatif'}
                </Text>
                <Text style={styles.priceValue}>{displayPrice}</Text>
                {bookingMode === 'group' && catalogPriceAmount > 0 ? (
                  <Text style={styles.priceBreakdownLine}>
                    Prix privé — {price} • Économie{' '}
                    {formatPrice(catalogPriceAmount - displayPriceAmount)}
                  </Text>
                ) : null}
                <Text style={styles.priceHint}>
                  Le prix final sera confirmé avant votre départ.
                </Text>
              </View>

              <PremiumCta label={ctaLabel} onPress={() => handleBooking()} />
            </>
          )}
        </View>
      </Animated.ScrollView>

      {isCustomCircuit && stickyBooking ? (
        <StickyBookingBar
          title={stickyBooking.title}
          totalPrice={stickyBooking.totalPrice}
          onContinue={stickyBooking.onContinue}
          bottomInset={insets.bottom}
        />
      ) : null}
    </View>
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
    paddingBottom: 120,
  },

  scrollWithSticky: {
    paddingBottom: 200,
  },

  heroWrap: {
    height: HERO_HEIGHT,
    overflow: 'hidden',
    backgroundColor: card,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,197,63,0.12)',
  },

  bodyGallery: {
    paddingTop: 22,
    paddingBottom: 6,
    backgroundColor: bg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,197,63,0.08)',
    gap: 22,
  },

  gallerySection: {
    gap: 16,
  },

  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 12,
  },

  gallerySectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  gallerySectionAccent: {
    width: 42,
    height: 3,
    borderRadius: 999,
    backgroundColor: green,
    marginTop: 8,
  },

  galleryLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13,13,13,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...premiumGlow,
  },

  galleryLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: green,
    shadowColor: green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },

  galleryLiveText: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  galleryScroll: {
    paddingHorizontal: 20,
    gap: 14,
    paddingBottom: 4,
  },

  galleryCard: {
    width: 260,
    height: 320,
    borderRadius: radiusLg,
    overflow: 'hidden',
    backgroundColor: card,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    ...premiumGlow,
  },

  galleryGlow: {
    position: 'absolute',
    top: -20,
    left: '50%',
    marginLeft: -60,
    width: 120,
    height: 60,
    borderRadius: 60,
    backgroundColor: glow,
    opacity: 0.55,
    zIndex: 1,
  },

  galleryImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  galleryGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  galleryCardFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 48,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },

  galleryTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
  },

  galleryIndexPill: {
    backgroundColor: 'rgba(13,13,13,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  galleryIndexText: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
  },

  circuitMapSection: {
    paddingHorizontal: 20,
    gap: 14,
  },

  circuitMapHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  circuitMapTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  circuitMapAccent: {
    width: 42,
    height: 3,
    borderRadius: 999,
    backgroundColor: green,
    marginTop: 8,
  },

  circuitMapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13,13,13,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...premiumGlow,
  },

  circuitMapBadgeText: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  circuitMapCard: {
    backgroundColor: card,
    borderRadius: radiusLg,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    overflow: 'hidden',
    ...premiumGlow,
  },

  circuitMapCanvas: {
    height: 210,
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,197,63,0.12)',
  },

  circuitMapGridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(139,197,63,0.08)',
  },

  circuitMapGridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(139,197,63,0.08)',
  },

  circuitMapRouteGlow: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: '38%',
    height: 40,
    borderRadius: 20,
    backgroundColor: glow,
    opacity: 0.45,
  },

  circuitMapRouteLine: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '52%',
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(139,197,63,0.35)',
    shadowColor: green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
  },

  circuitMapPinWrap: {
    position: 'absolute',
    alignItems: 'center',
    width: 34,
    marginLeft: -17,
    marginTop: -17,
    zIndex: 3,
  },

  circuitMapPinGlow: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: glow,
    top: 2,
  },

  circuitMapPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: green,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#050505',
  },

  circuitMapPinLabel: {
    marginTop: 4,
    color: green,
    fontSize: 9,
    fontWeight: '900',
  },

  circuitMapCornerBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(13,13,13,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  circuitMapCornerText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },

  circuitMapMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },

  circuitMapMetaChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  circuitMapMetaDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  circuitMapMetaText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },

  circuitMapStepsList: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },

  circuitMapStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  circuitMapStepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  circuitMapStepIndex: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
  },

  circuitMapStepText: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },

  liveSection: {
    paddingHorizontal: 20,
    gap: 14,
  },

  liveHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  liveSectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  liveSectionAccent: {
    width: 42,
    height: 3,
    borderRadius: 999,
    backgroundColor: green,
    marginTop: 8,
  },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13,13,13,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...premiumGlow,
  },

  liveBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: green,
    shadowColor: green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },

  liveBadgeText: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  liveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  liveCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
    ...premiumGlow,
  },

  liveCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  liveCardTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },

  liveCardSubtitle: {
    color: muted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },

  bookingModeSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 14,
  },

  bookingModeHeader: {
    gap: 0,
  },

  bookingModeSectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  bookingModeSectionAccent: {
    width: 42,
    height: 3,
    borderRadius: 999,
    backgroundColor: green,
    marginTop: 8,
  },

  bookingModeGrid: {
    flexDirection: 'row',
    gap: 12,
  },

  bookingModeCardWrap: {
    flex: 1,
  },

  bookingModeCard: {
    minHeight: 248,
    borderRadius: 22,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 16,
    ...premiumGlow,
  },

  bookingModeCardActive: {
    borderColor: 'rgba(139,197,63,0.65)',
    borderWidth: 2,
  },

  bookingModeCardGlow: {
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 14,
  },

  bookingModePopularBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 2,
  },

  bookingModePopularText: {
    color: green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  bookingModeSelectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(13,13,13,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 2,
  },

  bookingModeSelectedText: {
    color: green,
    fontSize: 9,
    fontWeight: '900',
  },

  bookingModeEmoji: {
    fontSize: 28,
    marginTop: 8,
    marginBottom: 6,
  },

  bookingModeTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },

  bookingModePriceHint: {
    color: muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 10,
  },

  bookingModePerks: {
    gap: 6,
  },

  bookingModePerkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  bookingModePerkText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },

  groupModePanel: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    marginTop: 4,
    ...premiumGlow,
  },

  groupModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  groupModeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },

  groupModePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,197,63,0.15)',
  },

  groupModePriceLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
  },

  groupModePriceValue: {
    color: green,
    fontSize: 15,
    fontWeight: '900',
  },

  groupVehicleCard: {
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    padding: 18,
    gap: 10,
    ...premiumGlow,
  },

  groupVehicleBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  groupVehicleBadgeText: {
    color: green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  groupVehicleTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
  },

  groupVehicleSubtitle: {
    color: muted,
    fontSize: 13,
    fontWeight: '600',
  },

  groupVehicleDetails: {
    marginTop: 6,
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,197,63,0.15)',
  },

  groupVehicleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  groupVehicleRowText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    lineHeight: 19,
  },

  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  heroDynamicOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,5,5,0.55)',
  },

  heroBadgeGlow: {
    position: 'absolute',
    top: 72,
    left: 20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: glow,
    opacity: 0.35,
    zIndex: 1,
  },

  heroTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },

  heroBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(13,13,13,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  heroBackPlaceholder: {
    width: 44,
    height: 44,
  },

  heroTopCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13,13,13,0.55)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.2)',
  },

  heroTopTitle: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },

  heroContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },

  heroBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },

  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.4)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  premiumBadgeText: {
    color: green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  typePill: {
    backgroundColor: 'rgba(13,13,13,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  typePillText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  heroTitle: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
    letterSpacing: -0.5,
  },

  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },

  trustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  trustChipText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '700',
  },

  trustDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  body: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },

  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },

  metaCard: {
    flex: 1,
    backgroundColor: card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 18,
    ...cardShadow,
  },

  metaLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 10,
  },

  metaValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 5,
  },

  section: {
    marginBottom: 32,
  },

  sectionTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },

  sectionAccent: {
    width: 48,
    height: 4,
    borderRadius: 4,
    backgroundColor: green,
    marginTop: 12,
    marginBottom: 16,
  },

  description: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 14,
    lineHeight: 23,
    fontWeight: '500',
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },

  tagChip: {
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  tagChipText: {
    color: green,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  includesList: {
    gap: 12,
  },

  includeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  includeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: green,
    justifyContent: 'center',
    alignItems: 'center',
  },

  includeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },

  priceCard: {
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    padding: 22,
    marginBottom: 24,
    ...premiumGlow,
  },

  priceLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
  },

  priceValue: {
    color: green,
    fontSize: 32,
    fontWeight: '900',
    marginTop: 8,
  },

  priceHint: {
    color: muted,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },

  mainCta: {
    height: 58,
    borderRadius: 999,
    backgroundColor: green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  ctaGlow: {
    shadowColor: green,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 22,
    elevation: 16,
  },

  mainCtaText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },

  experienceList: {
    gap: 14,
  },

  experienceCard: {
    height: 320,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...cardShadow,
  },

  experienceCardActive: {
    borderColor: 'rgba(139,197,63,0.65)',
    borderWidth: 2,
  },

  experienceCardActiveGlow: {
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 14,
  },

  experienceCardPressed: {
    opacity: 0.94,
  },

  experienceImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  experienceGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  experienceSelectedBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(13,13,13,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  experienceSelectedText: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
  },

  experienceBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 48,
    zIndex: 2,
  },

  experienceTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
  },

  experienceAmbiance: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  experienceTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },

  experienceTag: {
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },

  experienceTagText: {
    color: green,
    fontSize: 10,
    fontWeight: '800',
  },

  experienceIncludes: {
    marginTop: 10,
    gap: 4,
  },

  experienceIncludeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  experienceIncludeText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '600',
  },

  experienceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },

  experienceMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  experienceMetaText: {
    color: '#D4D4D4',
    fontSize: 12,
    fontWeight: '700',
  },

  experiencePrice: {
    color: green,
    fontSize: 16,
    fontWeight: '900',
  },

  personalizeHint: {
    color: muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 14,
    marginTop: -4,
  },

  selectorList: {
    gap: 10,
  },

  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  selectorRowActive: {
    borderColor: 'rgba(139,197,63,0.4)',
    backgroundColor: 'rgba(139,197,63,0.06)',
  },

  selectorIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  selectorIconActive: {
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.25)',
  },

  selectorTextWrap: {
    flex: 1,
  },

  selectorLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },

  selectorTextActive: {
    color: green,
  },

  selectorSub: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  selectorToggle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  selectorToggleActive: {
    backgroundColor: green,
    borderColor: green,
  },

  priceBreakdown: {
    marginTop: 12,
    gap: 4,
  },

  priceBreakdownLine: {
    color: muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },

  timeline: {
    position: 'relative',
    paddingLeft: 8,
    gap: 4,
  },

  timelineLine: {
    position: 'absolute',
    left: 18,
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: 'rgba(139,197,63,0.35)',
    shadowColor: green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
  },

  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 10,
  },

  timelineDotWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    zIndex: 2,
  },

  timelineDotGlow: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: green,
  },

  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: green,
    borderWidth: 2,
    borderColor: '#111',
  },

  timelineCard: {
    flex: 1,
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    ...cardShadow,
  },

  timelineTime: {
    color: green,
    fontSize: 12,
    fontWeight: '900',
  },

  timelineTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
  },

  timelineDesc: {
    color: muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    fontWeight: '600',
  },

  vehicleSliderScroll: {
    gap: 14,
    paddingRight: 4,
    paddingBottom: 4,
  },

  vehicleSliderCard: {
    width: 280,
    height: 380,
    borderRadius: radiusLg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: card,
    ...cardShadow,
  },

  vehicleSliderCardActive: {
    borderColor: 'rgba(139,197,63,0.65)',
    borderWidth: 2,
  },

  vehicleSliderCardGlow: {
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 14,
  },

  vehicleSliderCardGlowOrb: {
    position: 'absolute',
    top: 14,
    left: '50%',
    marginLeft: -50,
    width: 100,
    height: 50,
    borderRadius: 50,
    backgroundColor: glow,
    opacity: 0.5,
    zIndex: 1,
  },

  vehicleSliderImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  vehicleSliderGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  vehicleSelectedBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(13,13,13,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  vehicleSelectedText: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
  },

  vehicleSliderBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 56,
    zIndex: 2,
  },

  vehicleBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },

  vehiclePremiumBadge: {
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  vehiclePremiumBadgeText: {
    color: green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  vehicleSliderName: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
  },

  vehicleSliderMeta: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  vehicleFeatureList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },

  vehicleFeatureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(13,13,13,0.75)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
  },

  vehicleFeatureText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },

  vehicleSliderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,197,63,0.15)',
  },

  vehicleSliderPriceLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
  },

  vehicleSliderPrice: {
    color: green,
    fontSize: 16,
    fontWeight: '900',
  },

  socialSection: {
    gap: 10,
  },

  socialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  socialRatingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  socialRating: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  socialCount: {
    color: muted,
    fontSize: 13,
    fontWeight: '700',
  },

  reviewCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(13,13,13,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
  },

  reviewText: {
    flex: 1,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },

  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,197,63,0.22)',
    overflow: 'hidden',
    ...premiumGlow,
  },

  stickyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 14,
  },

  stickyInfo: {
    flex: 1,
  },

  stickyTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },

  stickyPrice: {
    color: green,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },

  stickyBtnWrap: {
    flexShrink: 0,
  },

  stickyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: green,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },

  stickyBtnText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },
});
