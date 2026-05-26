import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const green = '#4ADE80';
const g7Red = '#E53935';
const screenBg = '#050505';

export type DestinationPick = {
  id: string;
  label: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
  price: number;
  destinationType?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

type Section = {
  id: string;
  title: string;
  emoji: string;
  items: DestinationPick[];
};

const SEARCH_SECTIONS: Section[] = [
  {
    id: 'favoris',
    title: 'Favoris',
    emoji: '⭐',
    items: [
      {
        id: 'maison',
        label: 'Maison',
        subtitle: 'Adresse enregistrée',
        latitude: 36.465,
        longitude: 7.418,
        price: 500,
        icon: 'home-outline',
      },
      {
        id: 'travail',
        label: 'Travail',
        subtitle: 'Adresse enregistrée',
        latitude: 36.459,
        longitude: 7.431,
        price: 500,
        icon: 'briefcase-outline',
      },
    ],
  },
  {
    id: 'gares',
    title: 'Gares',
    emoji: '🚆',
    items: [
      {
        id: 'gare-routiere',
        label: 'Gare routière',
        subtitle: 'Guelma — départ / arrivée',
        latitude: 36.458,
        longitude: 7.432,
        price: 500,
        destinationType: 'Gare routière',
        icon: 'train-outline',
      },
      {
        id: 'gare-sncf',
        label: 'Gare de Guelma',
        subtitle: 'SNCF — centre-ville',
        latitude: 36.4605,
        longitude: 7.4295,
        price: 550,
        icon: 'train-outline',
      },
      {
        id: 'universite',
        label: 'Université 8 Mai 1945',
        subtitle: 'Campus Guelma',
        latitude: 36.468,
        longitude: 7.41,
        price: 500,
        destinationType: 'Université / École',
        icon: 'school-outline',
      },
      {
        id: 'theatre',
        label: 'Théâtre romain',
        subtitle: 'Site historique',
        latitude: 36.464,
        longitude: 7.428,
        price: 600,
        icon: 'business-outline',
      },
    ],
  },
  {
    id: 'aeroports',
    title: 'Aéroports',
    emoji: '✈️',
    items: [
      {
        id: 'annaba',
        label: 'Annaba',
        subtitle: 'Aéroport Rabah Bitat',
        latitude: 36.822,
        longitude: 7.809,
        price: 4500,
        icon: 'airplane-outline',
      },
      {
        id: 'constantine',
        label: 'Constantine',
        subtitle: 'Aéroport Mohamed Boudiaf',
        latitude: 36.276,
        longitude: 6.62,
        price: 5500,
        icon: 'airplane-outline',
      },
      {
        id: 'alger',
        label: 'Alger',
        subtitle: 'Aéroport Houari Boumediene',
        latitude: 36.691,
        longitude: 3.215,
        price: 12000,
        icon: 'airplane-outline',
      },
    ],
  },
];

const ALL_DESTINATIONS = SEARCH_SECTIONS.flatMap((section) => section.items);

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectDestination: (pick: DestinationPick) => void;
  onSelectOnMap: () => void;
  initialQuery?: string;
};

function SearchHeader({
  topInset,
  onBack,
  children,
}: {
  topInset: number;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <View style={[styles.header, { paddingTop: topInset + 8 }]}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
        <Ionicons name="chevron-back" size={22} color="#FFF" />
      </TouchableOpacity>
      <View style={styles.headerInputWrap}>{children}</View>
    </View>
  );
}

function MapSelectionRow({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.mapSelectionRow} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.mapSelectionIcon}>
        <Ionicons name="map-outline" size={22} color={green} />
      </View>
      <View style={styles.mapSelectionText}>
        <Text style={styles.mapSelectionTitle}>Sélectionner l'adresse sur la carte</Text>
        <Text style={styles.mapSelectionSub}>Choisissez un point directement sur la map</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#666" />
    </TouchableOpacity>
  );
}

function DestinationSection({
  section,
  onSelect,
}: {
  section: Section;
  onSelect: (pick: DestinationPick) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {section.emoji} {section.title}
      </Text>
      {section.items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.resultRow}
          onPress={() => onSelect(item)}
          activeOpacity={0.85}
        >
          <View style={styles.resultIcon}>
            <Ionicons name={item.icon ?? 'location-outline'} size={20} color={green} />
          </View>
          <View style={styles.resultText}>
            <Text style={styles.resultLabel}>{item.label}</Text>
            {item.subtitle ? <Text style={styles.resultSub}>{item.subtitle}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color="#555" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function DestinationSearchModal({
  visible,
  onClose,
  onSelectDestination,
  onSelectOnMap,
  initialQuery = '',
}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState(initialQuery);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!visible) {
      fadeAnim.setValue(0);
      slideAnim.setValue(24);
      return;
    }

    setQuery(initialQuery);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
      }),
    ]).start();

    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [visible, initialQuery, fadeAnim, slideAnim]);

  const filteredSections = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return SEARCH_SECTIONS;

    return SEARCH_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.label.toLowerCase().includes(normalized) ||
          (item.subtitle?.toLowerCase().includes(normalized) ?? false),
      ),
    })).filter((section) => section.items.length > 0);
  }, [query]);

  const customPick = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 3) return null;
    const exact = ALL_DESTINATIONS.find(
      (item) => item.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exact) return null;

    return {
      id: `custom-${trimmed}`,
      label: trimmed,
      subtitle: 'Adresse saisie',
      latitude: 36.462,
      longitude: 7.426,
      price: 700,
      icon: 'location-outline' as const,
    };
  }, [query]);

  const handleSelect = (pick: DestinationPick) => {
    const label = String(pick?.label ?? '').trim();
    if (!label) return;
    onSelectDestination({ ...pick, label });
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.screen,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SearchHeader topInset={insets.top} onBack={onClose}>
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Destination"
              placeholderTextColor="#666"
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              onSubmitEditing={() => {
                if (customPick) handleSelect(customPick);
              }}
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#666" />
              </TouchableOpacity>
            ) : null}
          </SearchHeader>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 20) + 16 },
            ]}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            <MapSelectionRow onPress={onSelectOnMap} />

            {customPick ? (
              <TouchableOpacity
                style={styles.customRow}
                onPress={() => handleSelect(customPick)}
                activeOpacity={0.85}
              >
                <Ionicons name="search" size={18} color={green} />
                <Text style={styles.customRowText}>Utiliser « {customPick.label} »</Text>
              </TouchableOpacity>
            ) : null}

            {filteredSections.map((section) => (
              <DestinationSection key={section.id} section={section} onSelect={handleSelect} />
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: screenBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: screenBg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: g7Red,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  headerInputWrap: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 10,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  mapSelectionRow: {
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(74,222,128,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
    marginBottom: 8,
  },
  mapSelectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(74,222,128,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSelectionText: {
    flex: 1,
    gap: 3,
  },
  mapSelectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  mapSelectionSub: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  customRow: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 8,
  },
  customRowText: {
    color: '#DDD',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#999',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  resultRow: {
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74,222,128,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: {
    flex: 1,
    gap: 2,
  },
  resultLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resultSub: {
    color: '#777',
    fontSize: 13,
    fontWeight: '500',
  },
});
