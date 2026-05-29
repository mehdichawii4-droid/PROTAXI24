import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AirportTransferHero from '@/components/AirportTransferHero';
import ScheduleRideModal, {
  formatScheduleSummary,
  getDefaultScheduleDate,
} from '@/components/ScheduleRideModal';
import { getFirebaseAuth } from '@/firebase/authInstance';
import { useAuth } from '@/hooks/useAuth';
import {
  AIRPORT_DESTINATIONS,
  AirportDestinationId,
  AirportTransferMode,
  formatAirportLabel,
  getAirportEstimate,
  resolveAirportPickupAddress,
  submitAirportRide,
} from '@/services/airportRideService';
import { showUserError, showUserSuccess } from '@/services/userFeedback';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const green = '#8BC53F';
const gold = '#D4A017';
const bg = '#050505';
const glassTop = 'rgba(42,42,42,0.72)';
const glassBottom = 'rgba(14,14,14,0.96)';
const borderIdle = 'rgba(255,255,255,0.09)';
const borderActive = 'rgba(139,197,63,0.72)';
const muted = '#8A8A8A';
const radiusDest = 23;
const radiusMd = 16;
const radiusLg = 20;
const contentPadH = 16;

const IMG_AIRPORT = require('../assets/images/airport-premium.jpg');
const IMG_AIRPORT_ALT = require('../assets/images/airport-premium1.jpg');
const IMG_CHAUFFEUR = require('../assets/images/services/chauffeur-prive.jpg');

/** Alternance avion / chauffeur comme sur le mockup */
const DESTINATION_THUMBS: Record<AirportDestinationId, ImageSourcePropType> = {
  annaba: IMG_AIRPORT,
  constantine: IMG_CHAUFFEUR,
  alger: IMG_AIRPORT_ALT,
  tunis: IMG_CHAUFFEUR,
  other: IMG_AIRPORT,
};

const GLASS_GRADIENT = [glassTop, 'rgba(22,22,22,0.94)', glassBottom] as const;

const MAIN_DESTINATIONS = AIRPORT_DESTINATIONS.filter((item) => item.id !== 'other');

function airportDisplayName(sub: string) {
  return sub.replace(/^Aéroport\s+/i, '').trim();
}

type FlowStep = 1 | 2 | 3 | 4;

type StepCopy = { title: string; hint: string };

const STEP_COPY: Record<FlowStep, StepCopy> = {
  1: {
    title: 'Où souhaitez-vous aller ?',
    hint: 'Choisissez votre aéroport',
  },
  2: {
    title: 'Quel est votre trajet ?',
    hint: 'Choisissez le sens du transfert.',
  },
  3: {
    title: 'Quand partez-vous ?',
    hint: 'Choisissez le moment.',
  },
  4: {
    title: 'Confirmez votre transfert',
    hint: 'Vérifiez les détails avant de réserver.',
  },
};

const HEADER_STEP_SLOGAN: Record<FlowStep, string> = {
  1: 'Suivez votre vol et votre chauffeur en temps réel.',
  2: 'Votre trajet, notre précision.',
  3: 'Votre temps, respecté.',
  4: 'Suivez votre vol et votre chauffeur en temps réel.',
};

const FLOW_STEPS = 4;

type GlassCardProps = {
  active?: boolean;
  onPress: () => void;
  children: React.ReactNode;
  style?: object;
  compact?: boolean;
  dest?: boolean;
};

function CardCheckBadge() {
  return (
    <View style={styles.cardCheckBadge}>
      <Ionicons name="checkmark" size={14} color="#050505" />
    </View>
  );
}

function GlassCard({ active, onPress, children, style, compact, dest }: GlassCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <LinearGradient
        colors={[...GLASS_GRADIENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          dest
            ? styles.destGlassCard
            : compact
              ? styles.glassCardCompact
              : styles.glassCard,
          active && (dest ? styles.destCardActive : styles.glassCardActive),
          style,
        ]}
      >
        {active ? <CardCheckBadge /> : null}
        {children}
      </LinearGradient>
    </Pressable>
  );
}

function StepFadeView({
  step,
  children,
}: {
  step: FlowStep;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [step, opacity]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

function ProgressBar({ step }: { step: FlowStep }) {
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / FLOW_STEPS) * 100}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        Étape {step}/{FLOW_STEPS}
      </Text>
    </View>
  );
}

function SummaryDivider() {
  return <View style={styles.summaryDivider} />;
}

export default function AirportTransferScreen() {
  const { profile } = useAuth();
  const [step, setStep] = useState<FlowStep>(1);
  const [destinationId, setDestinationId] = useState<AirportDestinationId>('annaba');
  const [lastMainDestinationId, setLastMainDestinationId] =
    useState<AirportDestinationId>('annaba');
  const [showOtherAirportInput, setShowOtherAirportInput] = useState(false);
  const [customAirport, setCustomAirport] = useState('');
  const [transferMode, setTransferMode] = useState<AirportTransferMode>('deposer');
  const [timingMode, setTimingMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [passengers, setPassengers] = useState(1);
  const [bags, setBags] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [flightFieldVisible, setFlightFieldVisible] = useState(false);
  const [flightNumber, setFlightNumber] = useState('');
  const [airline, setAirline] = useState('');
  const [terminal, setTerminal] = useState('');
  const [meetAndGreet, setMeetAndGreet] = useState(false);
  const [luggageNotes, setLuggageNotes] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [addressLatitude, setAddressLatitude] = useState<number | undefined>();
  const [addressLongitude, setAddressLongitude] = useState<number | undefined>();
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const airportLabel = useMemo(
    () => formatAirportLabel(destinationId, customAirport),
    [destinationId, customAirport],
  );

  const estimate = useMemo(() => getAirportEstimate(destinationId), [destinationId]);

  const airportCode = useMemo(() => {
    const found = AIRPORT_DESTINATIONS.find((item) => item.id === destinationId);
    return found?.code ?? '—';
  }, [destinationId]);

  const directionLabel =
    transferMode === 'deposer' ? 'Vers l’aéroport' : 'Depuis l’aéroport';

  const addressFieldCopy =
    transferMode === 'deposer'
      ? {
          title: 'D’où partez-vous ?',
          placeholder: 'Domicile, hôtel, adresse complète…',
          hint: 'Le chauffeur viendra vous chercher à cette adresse.',
          summaryPrefix: 'Prise en charge',
        }
      : {
          title: 'Où aller après l’aéroport ?',
          placeholder: 'Où souhaitez-vous être déposé ?',
          hint: 'Après votre vol, le chauffeur vous dépose à cette adresse.',
          summaryPrefix: 'Destination',
        };

  const addressSummaryValue = clientAddress.trim() || 'À préciser';

  const timingLabel =
    timingMode === 'now'
      ? 'Maintenant'
      : scheduledAt
        ? formatScheduleSummary(scheduledAt)
        : 'Planifier';

  const canBook =
    step === 4 &&
    (destinationId !== 'other' || customAirport.trim().length > 0) &&
    (timingMode === 'now' || Boolean(scheduledAt));

  const goTo = (next: FlowStep) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(next);
  };

  const selectDestination = (id: AirportDestinationId) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLastMainDestinationId(id);
    setShowOtherAirportInput(false);
    setCustomAirport('');
    setDestinationId(id);
    goTo(2);
  };

  const toggleOtherAirport = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (showOtherAirportInput) {
      setShowOtherAirportInput(false);
      setCustomAirport('');
      setDestinationId(lastMainDestinationId);
      return;
    }

    if (destinationId !== 'other') {
      setLastMainDestinationId(destinationId);
    }
    setDestinationId('other');
    setShowOtherAirportInput(true);
  };

  const selectDirection = (mode: AirportTransferMode) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTransferMode(mode);
    goTo(3);
  };

  const selectNow = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimingMode('now');
    setScheduledAt(null);
    goTo(4);
  };

  const selectLater = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimingMode('later');
    setScheduleModalVisible(true);
  };

  const toggleAdvanced = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdvancedOpen((value) => !value);
  };

  const revealFlightField = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFlightFieldVisible(true);
  };

  const useCurrentLocation = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsResolvingLocation(true);
    try {
      const resolved = await resolveAirportPickupAddress();
      setClientAddress(resolved.address);
      setAddressLatitude(resolved.pickupLatitude);
      setAddressLongitude(resolved.pickupLongitude);
    } finally {
      setIsResolvingLocation(false);
    }
  };

  const showFlightCard =
    transferMode === 'recuperer' || flightFieldVisible || Boolean(flightNumber.trim());

  const handleBook = async () => {
    if (!canBook || isSubmitting) return;

    if (destinationId === 'other' && !customAirport.trim()) {
      Alert.alert('Aéroport', 'Indiquez le nom de l’aéroport.');
      return;
    }

    if (timingMode === 'later' && !scheduledAt) {
      setScheduleModalVisible(true);
      return;
    }

    const clientUid = getFirebaseAuth().currentUser?.uid;
    if (!clientUid) {
      Alert.alert(
        'Connexion requise',
        'Connectez-vous pour réserver votre transfert premium.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const gpsFallback = await resolveAirportPickupAddress();
      const address = clientAddress.trim() || gpsFallback.address;
      const rideMode = timingMode === 'now' ? 'Maintenant' : 'Réserver plus tard';
      const date =
        timingMode === 'now'
          ? 'Maintenant'
          : scheduledAt?.toLocaleDateString('fr-FR') || 'À confirmer';
      const time =
        timingMode === 'now'
          ? 'Maintenant'
          : scheduledAt?.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            }) || '—';

      const result = await submitAirportRide(
        {
          airport: airportLabel,
          transferMode,
          rideMode,
          address,
          date,
          time,
          passengers: String(passengers),
          bags: String(bags),
          price: estimate.label,
          flightNumber: flightNumber.trim(),
          airline,
          terminal,
          meetAndGreet,
          luggageNotes,
          pickupLatitude: addressLatitude ?? gpsFallback.pickupLatitude,
          pickupLongitude: addressLongitude ?? gpsFallback.pickupLongitude,
          scheduledAt: timingMode === 'later' ? scheduledAt ?? undefined : undefined,
        },
        {
          clientUid,
          profileFullName: profile?.fullName,
          profilePhone: profile?.phone,
        },
      );

      if (result.status === 'auth_required') {
        Alert.alert(
          'Connexion requise',
          'Connectez-vous pour réserver votre transfert premium.',
        );
        return;
      }

      if (result.status === 'scheduled') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showUserSuccess(
          'Transfert confirmé. Notre équipe vérifie votre vol et vous attribuera un chauffeur avant le trajet.',
        );
        return;
      }

      if (result.status === 'tracking') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      showUserError('Impossible d’envoyer la demande. Réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.flowChrome}>
          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                if (step === 1) {
                  router.back();
                  return;
                }
                goTo((step - 1) as FlowStep);
              }}
            >
              <Ionicons name="chevron-back" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={styles.backBtn} />
          </View>

          <AirportTransferHero subtitle={HEADER_STEP_SLOGAN[step]} />

          <View style={styles.progressWrapOuter}>
            <ProgressBar step={step} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <StepFadeView step={step}>
          {step === 1 && (
            <View style={styles.sectionDest}>
              <Text style={styles.destHeroTitle}>{STEP_COPY[1].title}</Text>
              <Text style={styles.destHeroHint}>{STEP_COPY[1].hint}</Text>

              <View style={styles.destList}>
                {MAIN_DESTINATIONS.map((item) => {
                  const active =
                    !showOtherAirportInput && destinationId === item.id;
                  return (
                    <GlassCard
                      key={item.id}
                      active={active}
                      compact
                      dest
                      onPress={() => selectDestination(item.id)}
                    >
                      <View style={styles.destRow}>
                        <View style={styles.destTextCol}>
                          <Text style={styles.destLabel}>{item.label}</Text>
                          <Text style={styles.destSub} numberOfLines={1}>
                            {airportDisplayName(item.sub)}
                          </Text>
                        </View>
                        <View style={styles.destThumbWrap}>
                          <Image
                            source={DESTINATION_THUMBS[item.id]}
                            style={styles.destThumb}
                            contentFit="cover"
                          />
                          <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.72)']}
                            style={styles.destThumbGradient}
                          />
                        </View>
                      </View>
                    </GlassCard>
                  );
                })}
              </View>

              <Pressable
                onPress={toggleOtherAirport}
                style={({ pressed }) => [
                  styles.otherAirportRow,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={green}
                />
                <Text
                  style={[
                    styles.otherAirportText,
                    showOtherAirportInput && styles.otherAirportTextActive,
                  ]}
                >
                  Autre aéroport
                </Text>
                <Ionicons name="chevron-forward" size={16} color={muted} />
              </Pressable>

              {showOtherAirportInput && (
                <View style={styles.customAirportBox}>
                  <TextInput
                    value={customAirport}
                    onChangeText={setCustomAirport}
                    placeholder="Ville ou nom de l’aéroport"
                    placeholderTextColor={muted}
                    style={styles.customInput}
                  />
                  <TouchableOpacity
                    style={[
                      styles.customContinueBtn,
                      !customAirport.trim() && styles.customContinueBtnDisabled,
                    ]}
                    disabled={!customAirport.trim()}
                    onPress={() => goTo(2)}
                  >
                    <Text style={styles.customContinueBtnText}>Continuer</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {step === 2 && (
            <View style={styles.sectionDirection}>
              <Text style={styles.directionHeroTitle}>{STEP_COPY[2].title}</Text>
              <Text style={styles.directionHeroHint}>{STEP_COPY[2].hint}</Text>

              <View style={styles.directionStack}>
                <DirectionCard
                  active={transferMode === 'deposer'}
                  title="Vers l’aéroport"
                  subtitle={
                    <View style={styles.directionSubRow}>
                      <Text style={styles.directionSub}>Je vais à </Text>
                      <Text style={styles.directionSub}>l’aéroport</Text>
                    </View>
                  }
                  onPress={() => selectDirection('deposer')}
                />
                <DirectionCard
                  active={transferMode === 'recuperer'}
                  title="Depuis l’aéroport"
                  subtitle="Je viens d’arriver"
                  inactiveIconColor={green}
                  onPress={() => selectDirection('recuperer')}
                />
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.sectionTiming}>
              <Text style={styles.timingHeroTitle}>{STEP_COPY[3].title}</Text>
              <Text style={styles.timingHeroHint}>{STEP_COPY[3].hint}</Text>

              <View style={styles.timingStack}>
                <TimingCard
                  active={timingMode === 'now'}
                  icon="flash-outline"
                  title="Maintenant"
                  subtitle="Départ immédiat"
                  onPress={selectNow}
                />
                <TimingCard
                  active={timingMode === 'later'}
                  icon="calendar-outline"
                  title="Planifier"
                  subtitle={
                    scheduledAt
                      ? formatScheduleSummary(scheduledAt)
                      : 'Choisir une date et une heure'
                  }
                  onPress={selectLater}
                />
              </View>
            </View>
          )}

          {step === 4 && (
            <View style={styles.section}>
              <Text style={styles.destHeroTitle}>{STEP_COPY[4].title}</Text>
              <Text style={styles.destHeroHint}>{STEP_COPY[4].hint}</Text>

              <LinearGradient
                colors={['rgba(28,28,28,0.95)', 'rgba(12,12,12,0.98)']}
                style={styles.summaryCard}
              >
                <View style={styles.summaryVipHeader}>
                  <View style={styles.summaryVipHeaderLeft}>
                    <Text style={styles.summaryAirportCode}>{airportCode}</Text>
                    <Text style={styles.summaryAirportName} numberOfLines={1}>
                      {airportLabel.split(' (')[0]}
                    </Text>
                    <Text style={styles.summaryVipRoute}>{directionLabel}</Text>
                  </View>
                  <View
                    style={[
                      styles.summaryModePill,
                      timingMode === 'later'
                        ? styles.summaryModePillLater
                        : styles.summaryModePillNow,
                    ]}
                  >
                    <Text
                      style={[
                        styles.summaryModePillText,
                        timingMode === 'later'
                          ? styles.summaryModePillTextLater
                          : styles.summaryModePillTextNow,
                      ]}
                    >
                      {timingMode === 'later' ? 'Planifié' : 'Maintenant'}
                    </Text>
                  </View>
                </View>
                <SummaryDivider />
                <SummaryDetail
                  icon="airplane-outline"
                  iconColor={green}
                  title={directionLabel}
                />
                <SummaryDivider />
                <SummaryDetail
                  icon="time-outline"
                  title={`Quand : ${timingLabel}`}
                />
                <SummaryDivider />
                <SummaryDetail
                  icon="location-outline"
                  iconColor={gold}
                  title={`${addressFieldCopy.summaryPrefix} : ${addressSummaryValue}`}
                />
                <SummaryDivider />
                <SummaryLine
                  icon="people-outline"
                  label="Voyageurs"
                  value={passengers}
                  onDec={() => setPassengers((v) => Math.max(1, v - 1))}
                  onInc={() => setPassengers((v) => Math.min(8, v + 1))}
                />
                <SummaryDivider />
                <SummaryLine
                  icon="briefcase-outline"
                  label="Bagages"
                  value={bags}
                  onDec={() => setBags((v) => Math.max(0, v - 1))}
                  onInc={() => setBags((v) => Math.min(12, v + 1))}
                />
                <SummaryDivider />

                <TouchableOpacity
                  style={styles.premiumOptionRow}
                  onPress={toggleAdvanced}
                >
                  <Ionicons
                    name={advancedOpen ? 'remove-circle-outline' : 'add-circle-outline'}
                    size={22}
                    color={gold}
                  />
                  <Text style={styles.optionsPlusText}>
                    {advancedOpen
                      ? 'Masquer les options'
                      : transferMode === 'recuperer'
                        ? 'Terminal, pancarte…'
                        : 'Options premium'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={muted} />
                </TouchableOpacity>
              </LinearGradient>

              <LinearGradient
                colors={[...GLASS_GRADIENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addressCard}
              >
                <Text style={styles.addressCardTitle}>{addressFieldCopy.title}</Text>
                <Text style={styles.addressCardHint}>{addressFieldCopy.hint}</Text>
                <TextInput
                  value={clientAddress}
                  onChangeText={setClientAddress}
                  placeholder={addressFieldCopy.placeholder}
                  placeholderTextColor={muted}
                  style={styles.addressCardInput}
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.locationBtn}
                  onPress={useCurrentLocation}
                  disabled={isResolvingLocation}
                >
                  {isResolvingLocation ? (
                    <ActivityIndicator size="small" color={gold} />
                  ) : (
                    <Ionicons name="navigate" size={18} color={gold} />
                  )}
                  <Text style={styles.locationBtnText}>Ma position actuelle</Text>
                </TouchableOpacity>
              </LinearGradient>

              {showFlightCard ? (
                <LinearGradient
                  colors={[...GLASS_GRADIENT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.flightCard}
                >
                  <Text style={styles.flightCardTitle}>Numéro de vol</Text>
                  <Text style={styles.flightCardSub}>
                    Facultatif — le chauffeur adapte l’heure en cas de retard
                  </Text>
                  <TextInput
                    value={flightNumber}
                    onChangeText={setFlightNumber}
                    placeholder="Ex: AH1234"
                    placeholderTextColor={muted}
                    style={styles.flightCardInput}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </LinearGradient>
              ) : null}

              {transferMode === 'deposer' && !showFlightCard ? (
                <TouchableOpacity style={styles.premiumOptionRow} onPress={revealFlightField}>
                  <Ionicons name="airplane-outline" size={20} color={gold} />
                  <Text style={styles.addFlightLinkText}>Ajouter mon vol</Text>
                  <Ionicons name="chevron-forward" size={16} color={muted} />
                </TouchableOpacity>
              ) : null}

              {advancedOpen && (
                <View style={styles.advancedPanel}>
                  <Field
                    label="Compagnie"
                    value={airline}
                    onChangeText={setAirline}
                    placeholder="Ex. Air Algérie"
                  />
                  <Field
                    label="Terminal"
                    value={terminal}
                    onChangeText={setTerminal}
                    placeholder="Ex. T1"
                  />
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Pancarte accueil</Text>
                    <Switch
                      value={meetAndGreet}
                      onValueChange={setMeetAndGreet}
                      trackColor={{ false: '#2A2A2A', true: 'rgba(139,197,63,0.45)' }}
                      thumbColor="#fff"
                    />
                  </View>
                  <Field
                    label="Bagages (détail)"
                    value={luggageNotes}
                    onChangeText={setLuggageNotes}
                    placeholder="Ex. 2 valises + poussette"
                  />
                </View>
              )}

              <View style={styles.estimateChip}>
                <Ionicons name="pricetag-outline" size={16} color={gold} />
                <Text style={styles.estimateChipText}>
                  Tarif indicatif : {estimate.label}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.bookBtn, !canBook && styles.bookBtnDisabled]}
                disabled={!canBook || isSubmitting}
                onPress={handleBook}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={canBook ? '#050505' : '#888'} />
                ) : (
                  <Text style={[styles.bookBtnText, !canBook && styles.bookBtnTextDisabled]}>
                    Confirmer ma réservation
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          </StepFadeView>
        </ScrollView>
      </KeyboardAvoidingView>

      <ScheduleRideModal
        visible={scheduleModalVisible}
        initialDate={scheduledAt || getDefaultScheduleDate()}
        onClose={() => setScheduleModalVisible(false)}
        onConfirm={(date) => {
          setScheduledAt(date);
          setScheduleModalVisible(false);
          goTo(4);
        }}
      />
    </SafeAreaView>
    </>
  );
}

function DirectionCard({
  active,
  title,
  subtitle,
  inactiveIconColor = gold,
  onPress,
}: {
  active: boolean;
  title: string;
  subtitle: React.ReactNode;
  inactiveIconColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <LinearGradient
        colors={['rgba(30,30,30,0.95)', 'rgba(14,14,14,0.98)']}
        style={[styles.directionCard, active && styles.directionCardActive]}
      >
        {active ? <CardCheckBadge /> : null}
        <View style={styles.directionLeftCol}>
          <View style={[styles.directionIconWrap, active && styles.directionIconWrapActive]}>
            <Ionicons
              name="airplane"
              size={28}
              color={active ? '#050505' : inactiveIconColor}
            />
          </View>
          <View style={styles.directionTextBlock}>
            <Text style={styles.directionTitle} numberOfLines={2}>
              {title}
            </Text>
            {typeof subtitle === 'string' ? (
              <Text style={styles.directionSub} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : (
              subtitle
            )}
          </View>
        </View>

        <View style={styles.directionImageWrap}>
          <View style={styles.directionGoldArc} />
          <Image source={IMG_CHAUFFEUR} style={styles.directionImage} contentFit="cover" />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function TimingCard({
  active,
  icon,
  title,
  subtitle,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.timingCardWrap, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={['rgba(30,30,30,0.95)', 'rgba(14,14,14,0.98)']}
        style={[styles.timingCard, active && styles.timingCardActive]}
      >
        {active ? <CardCheckBadge /> : null}
        <View style={[styles.timingIconWrap, active && styles.timingIconWrapActive]}>
          <Ionicons name={icon} size={28} color={green} />
        </View>
        <View style={styles.timingTextCol}>
          <Text style={styles.timingCardTitle}>{title}</Text>
          <Text style={styles.timingCardSub}>{subtitle}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function SummaryDetail({
  icon,
  iconColor = muted,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.summaryDetail}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <View style={styles.summaryDetailText}>
        <Text style={styles.summaryDetailTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.summaryDetailSub}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

function SummaryLine({
  icon,
  label,
  value,
  onDec,
  onInc,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <View style={styles.summaryLine}>
      <Ionicons name={icon} size={18} color={muted} />
      <Text style={styles.summaryLineLabel}>
        {label} : {value}
      </Text>
      <View style={styles.summaryLineControls}>
        <TouchableOpacity style={styles.summaryMiniBtn} onPress={onDec}>
          <Ionicons name="remove" size={14} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.summaryMiniBtn} onPress={onInc}>
          <Ionicons name="add" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={muted}
        style={styles.fieldInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: bg },
  flex: { flex: 1 },
  flowChrome: {
    paddingBottom: 0,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: contentPadH,
    paddingTop: 0,
    paddingBottom: 0,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: borderIdle,
  },
  progressWrapOuter: {
    paddingHorizontal: contentPadH,
    paddingTop: 4,
    paddingBottom: 8,
  },
  progressWrap: {
    gap: 6,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 3,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: green,
  },
  progressLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  scroll: {
    paddingHorizontal: contentPadH,
    paddingTop: 4,
    paddingBottom: 24,
  },
  section: { gap: 8 },
  sectionTitle: {
    color: '#F5F5F5',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 29,
    textAlign: 'center',
  },
  sectionDest: { gap: 0, paddingTop: 96 },
  destHeroTitle: {
    color: '#F5F5F5',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
    marginBottom: 2,
    textAlign: 'center',
  },
  destHeroHint: {
    color: muted,
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.9,
    marginTop: 2,
    marginBottom: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: { opacity: 0.92 },
  cardCheckBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: green,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
    borderWidth: 2,
    borderColor: 'rgba(5,5,5,0.4)',
  },

  glassCard: {
    borderRadius: radiusLg,
    borderWidth: 1,
    borderColor: borderIdle,
    overflow: 'hidden',
  },
  glassCardCompact: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  glassCardActive: {
    borderColor: borderActive,
    borderWidth: 1,
  },
  destGlassCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  destCardActive: {
    borderColor: borderActive,
    borderWidth: 1,
  },

  destList: { gap: 10 },
  choiceStack: { gap: 16 },
  destRow: {
    position: 'relative',
    height: 82,
    paddingLeft: 18,
    justifyContent: 'center',
  },
  destTextCol: {
    flex: 1,
    paddingRight: 122,
    justifyContent: 'center',
  },
  destLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 20,
  },
  destSub: {
    color: muted,
    fontSize: 13,
    opacity: 0.72,
    marginTop: 2,
    lineHeight: 16,
  },
  destThumbWrap: {
    position: 'absolute',
    right: 12,
    top: 10,
    width: 110,
    height: 62,
    borderRadius: 16,
    overflow: 'hidden',
  },
  destThumb: {
    width: '100%',
    height: '100%',
  },
  destThumbGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  otherAirportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 2,
    gap: 10,
    minHeight: 44,
  },
  otherAirportText: {
    flex: 1,
    color: '#D8D8D8',
    fontSize: 16,
    fontWeight: '600',
  },
  otherAirportTextActive: {
    color: '#F5F5F5',
    fontWeight: '700',
  },
  customAirportBox: {
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  customInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: borderIdle,
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  customContinueBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: borderActive,
    paddingVertical: 11,
    alignItems: 'center',
  },
  customContinueBtnDisabled: { opacity: 0.4 },
  customContinueBtnText: { color: green, fontWeight: '700', fontSize: 15 },

  sectionDirection: {
    gap: 6,
    paddingTop: 96,
  },
  directionHeroTitle: {
    color: '#F5F5F5',
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 31,
    marginBottom: 2,
    textAlign: 'center',
  },
  directionHeroHint: {
    color: '#A8A8A8',
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.9,
    marginTop: -4,
    marginBottom: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
  directionStack: {
    gap: 24,
  },
  directionCard: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 200,
    overflow: 'hidden',
    position: 'relative',
  },
  directionLeftCol: {
    position: 'absolute',
    left: 26,
    top: 26,
    bottom: 22,
    width: 168,
    gap: 12,
    zIndex: 2,
  },
  directionCardActive: {
    borderColor: borderActive,
    borderWidth: 1,
    shadowColor: green,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  directionIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  directionIconWrapActive: {
    backgroundColor: green,
    shadowColor: green,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  directionImageWrap: {
    position: 'absolute',
    right: 18,
    top: 40,
    alignItems: 'center',
    zIndex: 1,
  },
  directionGoldArc: {
    width: 120,
    height: 58,
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: gold,
    marginBottom: -10,
    opacity: 0.75,
  },
  directionImage: {
    width: 180,
    height: 115,
    borderRadius: 18,
    opacity: 0.72,
  },
  directionTextBlock: {
    gap: 2,
  },
  directionTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
  },
  directionSub: {
    color: '#B0B0B0',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 2,
    lineHeight: 18,
  },
  directionSubRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    marginTop: 2,
  },

  sectionTiming: {
    gap: 6,
    paddingTop: 96,
  },
  timingHeroTitle: {
    color: '#F5F5F5',
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 31,
    marginBottom: 2,
    textAlign: 'center',
  },
  timingHeroHint: {
    color: '#A8A8A8',
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.9,
    marginTop: -4,
    marginBottom: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
  timingStack: {
    gap: 22,
  },
  timingCardWrap: {
    width: '100%',
  },
  timingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 158,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 26,
    paddingVertical: 24,
    overflow: 'hidden',
    gap: 18,
    position: 'relative',
  },
  timingCardActive: {
    borderColor: borderActive,
    borderWidth: 1,
    shadowColor: green,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  timingIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  timingIconWrapActive: {
    borderColor: 'rgba(139,197,63,0.35)',
    shadowColor: green,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  timingTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  timingCardTitle: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 24,
  },
  timingCardSub: {
    color: '#B0B0B0',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 7,
    lineHeight: 18,
  },

  summaryCard: {
    borderRadius: radiusDest,
    padding: 14,
    borderWidth: 1,
    borderColor: borderIdle,
    gap: 10,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 2,
  },
  summaryDetail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  summaryDetailText: { flex: 1, gap: 2 },
  summaryDetailTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  summaryDetailSub: {
    color: muted,
    fontSize: 13,
    opacity: 0.8,
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryLineLabel: {
    flex: 1,
    color: '#E8E8E8',
    fontSize: 14,
    fontWeight: '500',
  },
  summaryLineControls: {
    flexDirection: 'row',
    gap: 6,
  },
  summaryMiniBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: borderIdle,
  },
  premiumOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: borderIdle,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  optionsPlusText: {
    color: muted,
    fontSize: 13,
    flex: 1,
  },
  addressCard: {
    marginTop: 12,
    borderRadius: radiusLg,
    borderWidth: 1,
    borderColor: borderIdle,
    padding: 14,
    gap: 8,
    overflow: 'hidden',
  },
  addressCardTitle: {
    color: '#F5F5F5',
    fontSize: 15,
    fontWeight: '700',
  },
  addressCardHint: {
    color: muted,
    fontSize: 12,
    lineHeight: 16,
  },
  addressCardInput: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: borderIdle,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    alignSelf: 'flex-start',
  },
  locationBtnText: {
    color: gold,
    fontSize: 13,
    fontWeight: '600',
  },
  flightCard: {
    marginTop: 12,
    borderRadius: radiusLg,
    borderWidth: 1,
    borderColor: borderIdle,
    padding: 14,
    gap: 12,
    overflow: 'hidden',
  },
  flightCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flightCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(212,160,23,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightCardTextCol: { flex: 1, gap: 2 },
  flightCardTitle: {
    color: '#F5F5F5',
    fontSize: 15,
    fontWeight: '700',
  },
  flightCardSub: {
    color: muted,
    fontSize: 12,
    lineHeight: 16,
  },
  flightCardInput: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: borderIdle,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  addFlightLinkText: {
    color: '#E8E8E8',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  summaryVipHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 2,
  },
  summaryVipHeaderLeft: { flex: 1, gap: 2 },
  summaryAirportCode: {
    color: '#E8E8E8',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  summaryAirportName: {
    color: muted,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  summaryModePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryModePillNow: {
    backgroundColor: 'rgba(139,197,63,0.12)',
    borderColor: 'rgba(139,197,63,0.35)',
  },
  summaryModePillLater: {
    backgroundColor: 'rgba(212,160,23,0.12)',
    borderColor: 'rgba(212,160,23,0.35)',
  },
  summaryModePillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  summaryModePillTextNow: { color: green },
  summaryModePillTextLater: { color: gold },
  estimateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    backgroundColor: 'rgba(212,160,23,0.12)',
  },
  estimateChipText: {
    color: gold,
    fontSize: 14,
    fontWeight: '700',
  },
  advancedPanel: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radiusLg,
    borderWidth: 1,
    borderColor: borderIdle,
    padding: 14,
    gap: 10,
    marginBottom: 6,
  },
  field: { gap: 5 },
  fieldLabel: { color: muted, fontSize: 11 },
  fieldInput: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: borderIdle,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  switchLabel: { color: '#E8E8E8', fontSize: 14 },
  bookBtn: {
    marginTop: 12,
    minHeight: 52,
    backgroundColor: green,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: green,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  bookBtnDisabled: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: borderIdle,
    shadowOpacity: 0,
    elevation: 0,
  },
  bookBtnText: { color: '#050505', fontSize: 16, fontWeight: '800' },
  bookBtnTextDisabled: { color: '#888' },
});
