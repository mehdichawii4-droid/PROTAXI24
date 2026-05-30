import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFirebaseAuth } from '@/firebase/authInstance';
import {
  createTourBooking,
  CreateTourBookingGroupMatchError,
} from '@/services/createTourBooking';
import { logNavigation, PROTAXI_ROUTES } from '@/utils/navigation';
import { devError, devLog } from '@/utils/devLog';
import { pickPartnerFieldsFromParams } from '@/services/partnerService';

const green = '#8BC53F';
const bg = '#050505';
const card = '#0D0D0D';
const glow = 'rgba(139,197,63,0.18)';
const muted = '#8A8A8A';
const HERO_HEIGHT = 260;

const DEFAULT_GROUP_MEETING_POINT = 'Place du 1er Novembre — Guelma';

const MEETING_POINTS = [
  { id: 'hotel', label: 'Mon hôtel à Guelma', icon: 'bed-outline' as const },
  { id: 'centre', label: 'Centre-ville Guelma', icon: 'location-outline' as const },
  { id: 'gare', label: 'Gare routière', icon: 'bus-outline' as const },
  { id: 'custom', label: 'Autre adresse', icon: 'map-outline' as const },
];

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

type BookingMode = 'private' | 'group';

function normalizeBookingMode(value: string | string[] | undefined): BookingMode {
  const raw = normalizeParam(value);
  return raw === 'group' ? 'group' : 'private';
}

function formatDisplayPrice(raw: string) {
  if (!raw || raw === 'Sur devis') return 'Sur devis';
  if (raw.includes('DA')) return raw;
  const amount = Number(raw.replace(/[^\d]/g, ''));
  if (!amount) return raw;
  return `${amount.toLocaleString('fr-FR')} DA`;
}

function formatDate(selectedDate: Date) {
  const day = selectedDate.getDate();
  const month = selectedDate.getMonth() + 1;
  const year = selectedDate.getFullYear();
  return `${day < 10 ? '0' : ''}${day}/${month < 10 ? '0' : ''}${month}/${year}`;
}

function parseSteps(raw: string) {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function TourismBadge() {
  return (
    <View style={styles.tourismBadge}>
      <MaterialCommunityIcons name="compass-outline" size={12} color={green} />
      <Text style={styles.tourismBadgeText}>Expérience touristique PROTAXI</Text>
    </View>
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

function BookingFormulaSection({
  bookingMode,
  groupDeparture,
  groupSpotsLeft,
  groupTravelers,
  pricePerPerson,
}: {
  bookingMode: BookingMode;
  groupDeparture: string;
  groupSpotsLeft: string;
  groupTravelers: string;
  pricePerPerson: string;
}) {
  const isGroup = bookingMode === 'group';

  const privatePerks = [
    'Véhicule privé',
    'Horaire flexible',
    'Expérience exclusive',
  ];

  const groupPerks = [
    'Départ collectif',
    'Places limitées',
    'Tarif réduit / personne',
  ];

  return (
    <View style={styles.section}>
      <SectionHeader title="Votre formule" />
      <View style={[styles.formulaCard, isGroup && styles.formulaCardGroup]}>
        {isGroup ? (
          <View style={styles.formulaSharedBadge}>
            <Ionicons name="people-outline" size={12} color={green} />
            <Text style={styles.formulaSharedBadgeText}>EXPÉRIENCE PARTAGÉE</Text>
          </View>
        ) : (
          <View style={styles.formulaPrivateBadge}>
            <Ionicons name="diamond-outline" size={12} color={green} />
            <Text style={styles.formulaPrivateBadgeText}>EXPÉRIENCE PRIVÉE</Text>
          </View>
        )}

        <Text style={styles.formulaTitle}>
          {isGroup ? '🧑‍🤝‍🧑 Expérience groupe' : '👤 Expérience privée'}
        </Text>

        <View style={styles.formulaPerks}>
          {(isGroup ? groupPerks : privatePerks).map((perk) => (
            <View key={perk} style={styles.formulaPerkRow}>
              <Ionicons name="checkmark-circle" size={13} color={green} />
              <Text style={styles.formulaPerkText}>{perk}</Text>
            </View>
          ))}
        </View>

        {isGroup ? (
          <View style={styles.formulaGroupDetails}>
            <View style={styles.formulaGroupRow}>
              <Ionicons name="time-outline" size={15} color={green} />
              <Text style={styles.formulaGroupText}>
                Départ collectif : {groupDeparture}
              </Text>
            </View>
            <View style={styles.formulaGroupRow}>
              <Ionicons name="ticket-outline" size={15} color={green} />
              <Text style={styles.formulaGroupText}>{groupSpotsLeft} places restantes</Text>
            </View>
            <View style={styles.formulaGroupRow}>
              <Ionicons name="person-add-outline" size={15} color={green} />
              <Text style={styles.formulaGroupText}>
                +{groupTravelers} voyageurs déjà inscrits
              </Text>
            </View>
            <View style={styles.formulaGroupPriceRow}>
              <Text style={styles.formulaGroupPriceLabel}>Prix / personne</Text>
              <Text style={styles.formulaGroupPriceValue}>{pricePerPerson}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function GroupCollectiveSection({
  groupDeparture,
  groupMeetingPoint,
  groupSpotsLeft,
  groupTravelers,
}: {
  groupDeparture: string;
  groupMeetingPoint: string;
  groupSpotsLeft: string;
  groupTravelers: string;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader title="Départ collectif" />
      <View style={styles.groupCollectiveCard}>
        <View style={styles.groupCollectiveRow}>
          <View style={styles.fieldIconWrap}>
            <Ionicons name="time-outline" size={20} color={green} />
          </View>
          <View style={styles.fieldTextWrap}>
            <Text style={styles.fieldLabel}>Horaire fixe</Text>
            <Text style={styles.fieldValue}>Départ collectif : {groupDeparture}</Text>
          </View>
        </View>

        <View style={styles.groupCollectiveDivider} />

        <View style={styles.groupCollectiveRow}>
          <View style={styles.fieldIconWrap}>
            <Ionicons name="location-outline" size={20} color={green} />
          </View>
          <View style={styles.fieldTextWrap}>
            <Text style={styles.fieldLabel}>Point de rendez-vous collectif</Text>
            <Text style={styles.fieldValue}>{groupMeetingPoint}</Text>
          </View>
        </View>

        <View style={styles.groupCollectiveDivider} />

        <View style={styles.groupCollectiveRow}>
          <View style={styles.fieldIconWrap}>
            <Ionicons name="ticket-outline" size={20} color={green} />
          </View>
          <View style={styles.fieldTextWrap}>
            <Text style={styles.fieldLabel}>Disponibilité</Text>
            <Text style={styles.fieldValue}>{groupSpotsLeft} places restantes</Text>
          </View>
        </View>

        <View style={styles.groupCollectiveDivider} />

        <View style={styles.groupCollectiveRow}>
          <View style={styles.fieldIconWrap}>
            <Ionicons name="person-add-outline" size={20} color={green} />
          </View>
          <View style={styles.fieldTextWrap}>
            <Text style={styles.fieldLabel}>Communauté PROTAXI</Text>
            <Text style={styles.fieldValue}>+{groupTravelers} voyageurs déjà inscrits</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function TimelineSection({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null;

  return (
    <View style={styles.timeline}>
      <View style={styles.timelineLine} />
      {steps.map((step, index) => (
        <View key={`${index}-${step}`} style={styles.timelineItem}>
          <View style={styles.timelineDotWrap}>
            <View style={styles.timelineDotGlow} />
            <View style={styles.timelineDot} />
          </View>
          <View style={styles.timelineCard}>
            <Text style={styles.timelineIndex}>Étape {index + 1}</Text>
            <Text style={styles.timelineTitle}>{step}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function CounterRow({
  label,
  value,
  onDecrease,
  onIncrease,
  min = 1,
  max = 8,
}: {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  min?: number;
  max?: number;
}) {
  return (
    <View style={styles.counterCard}>
      <Text style={styles.counterLabel}>{label}</Text>
      <View style={styles.counterControls}>
        <TouchableOpacity
          style={[styles.counterBtn, value <= min && styles.counterBtnDisabled]}
          onPress={onDecrease}
          disabled={value <= min}
          activeOpacity={0.85}
        >
          <Ionicons name="remove" size={18} color={value <= min ? muted : '#FFF'} />
        </TouchableOpacity>
        <Text style={styles.counterValue}>{value}</Text>
        <TouchableOpacity
          style={[styles.counterBtn, value >= max && styles.counterBtnDisabled]}
          onPress={onIncrease}
          disabled={value >= max}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color={value >= max ? muted : '#FFF'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StickyTourCta({
  price,
  priceLabel,
  onPress,
  bottomInset,
  disabled = false,
}: {
  price: string;
  priceLabel: string;
  onPress: () => void;
  bottomInset: number;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <View style={[styles.stickyBar, { paddingBottom: bottomInset + 12 }]}>
      <LinearGradient
        colors={['rgba(5,5,5,0)', 'rgba(5,5,5,0.92)', '#050505']}
        style={styles.stickyGradient}
      />
      <View style={styles.stickyContent}>
        <View style={styles.stickyPriceWrap}>
          <Text style={styles.stickyPriceLabel}>{priceLabel}</Text>
          <Text style={styles.stickyPriceValue}>{price}</Text>
        </View>
        <Pressable
          onPress={onPress}
          disabled={disabled}
          onPressIn={() => {
            if (disabled) return;
            Animated.spring(scale, {
              toValue: 0.968,
              tension: 220,
              friction: 16,
              useNativeDriver: true,
            }).start();
          }}
          onPressOut={() => {
            if (disabled) return;
            Animated.spring(scale, {
              toValue: 1,
              tension: 180,
              friction: 10,
              useNativeDriver: true,
            }).start();
          }}
        >
          <Animated.View
            style={[
              styles.stickyCta,
              styles.ctaGlow,
              disabled && styles.stickyCtaDisabled,
              { transform: [{ scale }] },
            ]}
          >
            <Text style={styles.stickyCtaText}>
              {disabled ? 'Enregistrement…' : "Confirmer l'expérience"}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#111" />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

export default function TourBookingScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    formula?: string | string[];
    duration?: string | string[];
    steps?: string | string[];
    options?: string | string[];
    estimatedPrice?: string | string[];
    circuitName?: string | string[];
    experience?: string | string[];
    source?: string | string[];
    partnerId?: string | string[];
    partnerName?: string | string[];
    bookingMode?: string | string[];
    groupDeparture?: string | string[];
    groupSpotsLeft?: string | string[];
    groupTravelers?: string | string[];
    groupMeetingPoint?: string | string[];
  }>();

  const formula = normalizeParam(params.formula);
  const duration = normalizeParam(params.duration) || 'Flexible';
  const stepsRaw = normalizeParam(params.steps);
  const optionsRaw = normalizeParam(params.options);
  const estimatedPriceRaw = normalizeParam(params.estimatedPrice) || 'Sur devis';
  const circuitName = normalizeParam(params.circuitName);
  const source = normalizeParam(params.source) || 'discover-guelma';
  const partnerFields = pickPartnerFieldsFromParams(
    params as Record<string, string | string[] | undefined>,
  );
  const bookingMode = normalizeBookingMode(params.bookingMode);
  const groupDeparture = normalizeParam(params.groupDeparture) || '17:00';
  const groupSpotsLeft = normalizeParam(params.groupSpotsLeft) || '3';
  const groupTravelers = normalizeParam(params.groupTravelers) || '6';
  const groupMeetingPoint =
    normalizeParam(params.groupMeetingPoint) || DEFAULT_GROUP_MEETING_POINT;

  const isGroupMode = bookingMode === 'group';
  const displayPrice = formatDisplayPrice(estimatedPriceRaw);
  const priceLabel = isGroupMode ? 'Prix / personne' : 'Prix total';
  const priceSectionTitle = isGroupMode ? 'Prix / personne' : 'Prix total final';
  const priceCardLabel = isGroupMode ? 'Tarif groupe / personne' : 'Tarif estimé';

  const experienceTitle =
    formula || normalizeParam(params.experience) || circuitName || 'Expérience PROTAXI';
  const timelineSteps = useMemo(() => parseSteps(stepsRaw), [stepsRaw]);
  const selectedOptions = useMemo(() => parseSteps(optionsRaw), [optionsRaw]);

  const [circuitDate, setCircuitDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [travelers, setTravelers] = useState(2);
  const [meetingPointId, setMeetingPointId] = useState('hotel');
  const [customMeetingPoint, setCustomMeetingPoint] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const meetingPointLabel = useMemo(() => {
    if (isGroupMode) return groupMeetingPoint;
    if (meetingPointId === 'custom') {
      return customMeetingPoint.trim() || '';
    }
    return MEETING_POINTS.find((item) => item.id === meetingPointId)?.label ?? '';
  }, [isGroupMode, groupMeetingPoint, meetingPointId, customMeetingPoint]);

  const formattedDate = circuitDate ? formatDate(circuitDate) : '';
  const groupDateLabel = formattedDate || `Départ collectif — ${groupDeparture}`;

  const confirmExperience = async () => {
    if (isSubmitting) return;

    const clientUid = getFirebaseAuth().currentUser?.uid;
    if (!clientUid) {
      Alert.alert(
        'Connexion requise',
        'Connectez-vous pour réserver une expérience tourisme PROTAXI.',
      );
      return;
    }

    if (!isGroupMode && !circuitDate) {
      Alert.alert('Date requise', 'Veuillez sélectionner la date de votre circuit.');
      return;
    }

    if (!isGroupMode && !meetingPointLabel) {
      Alert.alert(
        'Point de rendez-vous requis',
        meetingPointId === 'custom'
          ? 'Veuillez préciser votre adresse de rendez-vous.'
          : 'Veuillez choisir un point de rendez-vous.',
      );
      return;
    }

    const travelersValue = isGroupMode ? '1' : String(travelers);
    const dateValue = isGroupMode ? groupDateLabel : formattedDate;
    const notesValue = notes.trim() || 'Aucune note';
    const stepsValue = stepsRaw || timelineSteps.join(', ');
    const optionsValue =
      optionsRaw ||
      (selectedOptions.length > 0
        ? selectedOptions.join(', ')
        : 'Aucune option supplémentaire');

    setIsSubmitting(true);

    try {
      const result = await createTourBooking({
        clientUid,
        experienceTitle,
        circuitName: circuitName || experienceTitle,
        formula,
        bookingMode,
        duration,
        steps: stepsValue,
        options: optionsValue,
        travelers: travelersValue,
        date: dateValue,
        meetingPoint: meetingPointLabel,
        notes: notesValue,
        price: estimatedPriceRaw,
        source,
        groupDeparture: isGroupMode ? groupDeparture : undefined,
        groupMeetingPoint: isGroupMode ? groupMeetingPoint : undefined,
        groupSpotsLeft: isGroupMode ? groupSpotsLeft : undefined,
        groupTravelers: isGroupMode ? groupTravelers : undefined,
        partnerFields,
      });

      logNavigation(`${PROTAXI_ROUTES.tourSummary}?experience=${experienceTitle}`, {
        source,
        label: 'Confirmer expérience',
      });

      router.push({
        pathname: PROTAXI_ROUTES.tourSummary,
        params: result.summaryParams,
      });
    } catch (error) {
      devError('CONFIRM EXPERIENCE ERROR FULL:', error);
      devError('Tour booking Firestore error:', error);
      devLog(error);

      if (error instanceof CreateTourBookingGroupMatchError) {
        Alert.alert(
          'Départ groupe indisponible',
          'Votre demande n’a pas pu être associée à un départ groupe. Réessayez ou contactez PROTAXI.',
        );
        return;
      }

      if (error instanceof Error) {
        devLog('Tour booking error message:', error.message);
        devLog('Tour booking error stack:', error.stack);
      }

      Alert.alert(
        'Enregistrement impossible',
        'Votre demande n\'a pas pu être enregistrée. Vérifiez votre connexion et réessayez.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['rgba(139,197,63,0.06)', 'rgba(5,5,5,0)']}
        style={styles.topGlow}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 140 }]}
      >
        <View style={styles.heroWrap}>
          <Image
            source={require('../assets/images/theatre-romain.jpg')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={[
              'rgba(5,5,5,0.15)',
              'rgba(5,5,5,0.45)',
              'rgba(5,5,5,0.88)',
              'rgba(5,5,5,0.98)',
            ]}
            locations={[0, 0.35, 0.7, 1]}
            style={styles.heroGradient}
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
              <MaterialCommunityIcons name="map-marker-path" size={15} color={green} />
              <Text style={styles.heroTopTitle}>RÉSERVATION TOURISME</Text>
            </View>
            <View style={styles.heroBackPlaceholder} />
          </View>

          <View style={styles.heroContent}>
            <TourismBadge />
            <Text style={styles.heroTitle} numberOfLines={2}>
              {experienceTitle}
            </Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaChip}>
                <Ionicons name="time-outline" size={13} color={green} />
                <Text style={styles.heroMetaText}>{duration}</Text>
              </View>
              {circuitName && formula ? (
                <View style={styles.heroMetaChip}>
                  <Ionicons name="construct-outline" size={13} color={green} />
                  <Text style={styles.heroMetaText}>{circuitName}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <BookingFormulaSection
            bookingMode={bookingMode}
            groupDeparture={groupDeparture}
            groupSpotsLeft={groupSpotsLeft}
            groupTravelers={groupTravelers}
            pricePerPerson={displayPrice}
          />

          {timelineSteps.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Timeline du circuit" />
              <TimelineSection steps={timelineSteps} />
            </View>
          ) : null}

          {isGroupMode ? (
            <GroupCollectiveSection
              groupDeparture={groupDeparture}
              groupMeetingPoint={groupMeetingPoint}
              groupSpotsLeft={groupSpotsLeft}
              groupTravelers={groupTravelers}
            />
          ) : (
            <>
              <View style={styles.section}>
                <SectionHeader title="Date du circuit" />
                <TouchableOpacity
                  style={styles.fieldCard}
                  activeOpacity={0.85}
                  onPress={() => setShowDatePicker(true)}
                >
                  <View style={styles.fieldIconWrap}>
                    <Ionicons name="calendar-outline" size={20} color={green} />
                  </View>
                  <View style={styles.fieldTextWrap}>
                    <Text style={styles.fieldLabel}>Date souhaitée</Text>
                    <Text style={styles.fieldValue}>
                      {formattedDate || 'Sélectionner une date'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={muted} />
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <SectionHeader title="Nombre de voyageurs" />
                <CounterRow
                  label="Participants"
                  value={travelers}
                  min={1}
                  max={8}
                  onDecrease={() => setTravelers((prev) => Math.max(1, prev - 1))}
                  onIncrease={() => setTravelers((prev) => Math.min(8, prev + 1))}
                />
              </View>

              <View style={styles.section}>
                <SectionHeader title="Point de rendez-vous" />
                <View style={styles.meetingList}>
                  {MEETING_POINTS.map((point) => {
                    const active = meetingPointId === point.id;
                    return (
                      <TouchableOpacity
                        key={point.id}
                        style={[styles.meetingRow, active && styles.meetingRowActive]}
                        activeOpacity={0.85}
                        onPress={() => setMeetingPointId(point.id)}
                      >
                        <View style={[styles.meetingIconWrap, active && styles.meetingIconActive]}>
                          <Ionicons name={point.icon} size={18} color={active ? green : muted} />
                        </View>
                        <Text style={[styles.meetingLabel, active && styles.meetingLabelActive]}>
                          {point.label}
                        </Text>
                        <View style={[styles.meetingToggle, active && styles.meetingToggleActive]}>
                          {active ? <Ionicons name="checkmark" size={14} color="#111" /> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {meetingPointId === 'custom' ? (
                  <TextInput
                    style={styles.textInput}
                    placeholder="Adresse précise de rendez-vous"
                    placeholderTextColor={muted}
                    value={customMeetingPoint}
                    onChangeText={setCustomMeetingPoint}
                  />
                ) : null}
              </View>
            </>
          )}

          {selectedOptions.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Options premium sélectionnées" />
              <View style={styles.optionsCard}>
                {selectedOptions.map((option) => (
                  <View key={option} style={styles.optionRow}>
                    <Ionicons name="diamond-outline" size={14} color={green} />
                    <Text style={styles.optionText}>{option}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader title={isGroupMode ? 'Notes (optionnel)' : 'Notes spéciales'} />
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              placeholder={
                isGroupMode
                  ? 'Allergies, préférences... (optionnel)'
                  : 'Allergies, préférences, demandes particulières...'
              }
              placeholderTextColor={muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.section}>
            <SectionHeader title={priceSectionTitle} />
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>{priceCardLabel}</Text>
              <Text style={styles.priceValue}>{displayPrice}</Text>
              {isGroupMode ? (
                <Text style={styles.priceHint}>
                  Tarif groupe avantageux — places limitées pour ce départ collectif.
                </Text>
              ) : (
                <Text style={styles.priceHint}>
                  Le prix final sera confirmé par PROTAXI avant le départ de votre expérience.
                </Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <StickyTourCta
        price={displayPrice}
        priceLabel={priceLabel}
        onPress={confirmExperience}
        bottomInset={insets.bottom}
        disabled={isSubmitting}
      />

      {showDatePicker && !isGroupMode ? (
        <DateTimePicker
          value={circuitDate ?? new Date()}
          mode="date"
          minimumDate={new Date()}
          display="default"
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setCircuitDate(selectedDate);
          }}
        />
      ) : null}
    </View>
  );
}

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
  heroWrap: {
    height: HERO_HEIGHT,
    overflow: 'hidden',
    backgroundColor: card,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,197,63,0.12)',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBadgeGlow: {
    position: 'absolute',
    top: 40,
    left: '50%',
    marginLeft: -80,
    width: 160,
    height: 80,
    borderRadius: 80,
    backgroundColor: glow,
    opacity: 0.35,
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
    paddingHorizontal: 16,
  },
  heroBackBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(13,13,13,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTopCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13,13,13,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.2)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroTopTitle: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heroBackPlaceholder: {
    width: 42,
  },
  heroContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 22,
    zIndex: 2,
  },
  tourismBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13,13,13,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  tourismBadgeText: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  heroMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(13,13,13,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroMetaText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionAccent: {
    width: 42,
    height: 3,
    borderRadius: 999,
    backgroundColor: green,
    marginTop: 8,
  },

  formulaCard: {
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    padding: 18,
    gap: 12,
    ...premiumGlow,
  },

  formulaCardGroup: {
    borderColor: 'rgba(139,197,63,0.35)',
  },

  formulaPrivateBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13,13,13,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  formulaPrivateBadgeText: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  formulaSharedBadge: {
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

  formulaSharedBadgeText: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  formulaTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
  },

  formulaPerks: {
    gap: 8,
  },

  formulaPerkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  formulaPerkText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },

  formulaGroupDetails: {
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,197,63,0.15)',
    gap: 10,
  },

  formulaGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  formulaGroupText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },

  formulaGroupPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,197,63,0.12)',
  },

  formulaGroupPriceLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
  },

  formulaGroupPriceValue: {
    color: green,
    fontSize: 18,
    fontWeight: '900',
  },

  groupCollectiveCard: {
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    padding: 16,
    gap: 0,
    ...premiumGlow,
  },

  groupCollectiveRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
  },

  groupCollectiveDivider: {
    height: 1,
    backgroundColor: 'rgba(139,197,63,0.12)',
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
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: glow,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: green,
    borderWidth: 2,
    borderColor: '#050505',
  },
  timelineCard: {
    flex: 1,
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...premiumGlow,
  },
  timelineIndex: {
    color: green,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timelineTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
    lineHeight: 20,
  },
  fieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    ...premiumGlow,
  },
  fieldIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldTextWrap: {
    flex: 1,
  },
  fieldLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
  },
  fieldValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  counterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    ...premiumGlow,
  },
  counterLabel: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBtnDisabled: {
    opacity: 0.45,
  },
  counterValue: {
    color: green,
    fontSize: 20,
    fontWeight: '900',
    minWidth: 24,
    textAlign: 'center',
  },
  meetingList: {
    gap: 10,
  },
  meetingRow: {
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
  meetingRowActive: {
    borderColor: 'rgba(139,197,63,0.4)',
    backgroundColor: 'rgba(139,197,63,0.06)',
  },
  meetingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  meetingIconActive: {
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.25)',
  },
  meetingLabel: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  meetingLabelActive: {
    color: green,
  },
  meetingToggle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  meetingToggleActive: {
    backgroundColor: green,
    borderColor: green,
  },
  textInput: {
    marginTop: 12,
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 110,
    marginTop: 0,
  },
  optionsCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    padding: 16,
    gap: 10,
    ...premiumGlow,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionText: {
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
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
  stickyGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -40,
    height: 40,
  },
  stickyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...premiumGlow,
  },
  stickyPriceWrap: {
    flex: 1,
  },
  stickyPriceLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
  },
  stickyPriceValue: {
    color: green,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  stickyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: green,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  stickyCtaDisabled: {
    opacity: 0.65,
  },
  stickyCtaText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },
  ctaGlow: {
    shadowColor: green,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 22,
    elevation: 16,
  },
});
