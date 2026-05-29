import { Ionicons } from '@expo/vector-icons';
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
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PrivateDriverHero from '@/components/PrivateDriverHero';
import ScheduleRideModal, {
  formatScheduleSummary,
  getDefaultScheduleDate,
} from '@/components/ScheduleRideModal';
import { getFirebaseAuth } from '@/firebase/authInstance';
import { useAuth } from '@/hooks/useAuth';
import {
  getPrivateDriverTypeLabel,
  formatPrivateDriverDuration,
  PRIVATE_DRIVER_DURATION_OPTIONS,
  PRIVATE_DRIVER_PRICE_LABEL,
  resolvePrivateDriverPickupAddress,
  submitPrivateDriverRide,
  type PrivateDriverType,
} from '@/services/privateDriverRideService';
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
const radiusMd = 16;
const radiusLg = 20;
const contentPadH = 16;

const GLASS_GRADIENT = [glassTop, 'rgba(22,22,22,0.94)', glassBottom] as const;
const FLOW_STEPS = 3;

type FlowStep = 1 | 2 | 3;

const HEADER_STEP_SLOGAN: Record<FlowStep, string> = {
  1: 'Un service organisé par PROTAXI, sur mesure.',
  2: 'Précisez votre trajet et votre horaire.',
  3: 'Vérifiez les détails avant confirmation.',
};

const STEP_COPY: Record<FlowStep, { title: string; hint: string }> = {
  1: {
    title: 'Quel service souhaitez-vous ?',
    hint: 'Choisissez le type de mise à disposition.',
  },
  2: {
    title: 'Précisez votre demande',
    hint: 'Adresse, horaire et informations utiles au chauffeur.',
  },
  3: {
    title: 'Confirmez votre demande',
    hint: 'Vérifiez les détails avant de réserver.',
  },
};

function CardCheckBadge() {
  return (
    <View style={styles.cardCheckBadge}>
      <Ionicons name="checkmark" size={14} color="#050505" />
    </View>
  );
}

function GlassCard({
  active,
  onPress,
  children,
  style,
}: {
  active?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  const content = (
    <LinearGradient
      colors={[...GLASS_GRADIENT]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.glassCard, active && styles.glassCardActive, style]}
    >
      {active ? <CardCheckBadge /> : null}
      {children}
    </LinearGradient>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
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

function SummaryDivider() {
  return <View style={styles.summaryDivider} />;
}

function SummaryDetail({
  icon,
  iconColor = muted,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
}) {
  return (
    <View style={styles.summaryDetail}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={styles.summaryDetailTitle}>{title}</Text>
    </View>
  );
}

function PassengerStepper({
  value,
  onDec,
  onInc,
}: {
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <TouchableOpacity style={styles.stepperBtn} onPress={onDec}>
        <Ionicons name="remove" size={18} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.stepperValue}>{value}</Text>
      <TouchableOpacity style={styles.stepperBtn} onPress={onInc}>
        <Ionicons name="add" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function PrivateDriverScreen() {
  const { profile } = useAuth();
  const [step, setStep] = useState<FlowStep>(1);
  const [privateDriverType, setPrivateDriverType] = useState<PrivateDriverType | null>(null);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [durationHours, setDurationHours] = useState('');
  const [notes, setNotes] = useState('');
  const [pickupLatitude, setPickupLatitude] = useState<number | undefined>();
  const [pickupLongitude, setPickupLongitude] = useState<number | undefined>();
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const typeLabel = privateDriverType
    ? getPrivateDriverTypeLabel(privateDriverType)
    : '—';

  const whenLabel = scheduledAt
    ? formatScheduleSummary(scheduledAt)
    : 'Choisir une date et une heure';

  const destinationSummary =
    destination.trim()
    || (privateDriverType === 'disposition' ? 'Selon programme' : 'À confirmer');

  const canContinueStep2 = useMemo(() => {
    if (!scheduledAt || !departure.trim() || departure.trim().length < 3) {
      return false;
    }
    if (privateDriverType === 'trajet' && !destination.trim()) {
      return false;
    }
    if (privateDriverType === 'disposition' && !durationHours) {
      return false;
    }
    return true;
  }, [scheduledAt, departure, destination, privateDriverType, durationHours]);

  const goTo = (next: FlowStep) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(next);
  };

  const selectType = (type: PrivateDriverType) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrivateDriverType(type);
    goTo(2);
  };

  const openSchedule = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScheduleModalVisible(true);
  };

  const useCurrentLocation = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsResolvingLocation(true);
    try {
      const resolved = await resolvePrivateDriverPickupAddress();
      setDeparture(resolved.address);
      setPickupLatitude(resolved.pickupLatitude);
      setPickupLongitude(resolved.pickupLongitude);
    } finally {
      setIsResolvingLocation(false);
    }
  };

  const validateStep2 = (): boolean => {
    if (!scheduledAt) {
      Alert.alert('Horaire', 'Choisissez une date et une heure.');
      return false;
    }
    if (!departure.trim() || departure.trim().length < 3) {
      Alert.alert('Départ', 'Indiquez votre adresse de départ.');
      return false;
    }
    if (privateDriverType === 'trajet' && !destination.trim()) {
      Alert.alert('Destination', 'Indiquez votre destination.');
      return false;
    }
    if (privateDriverType === 'disposition' && !durationHours) {
      Alert.alert('Durée', 'Choisissez une durée de mise à disposition.');
      return false;
    }
    return true;
  };

  const handleContinueStep2 = () => {
    if (!validateStep2()) return;
    goTo(3);
  };

  const handleConfirm = async () => {
    if (!privateDriverType || !scheduledAt || isSubmitting) return;

    const clientUid = getFirebaseAuth().currentUser?.uid;
    if (!clientUid) {
      Alert.alert(
        'Connexion requise',
        'Connectez-vous pour réserver votre chauffeur privé.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitPrivateDriverRide(
        {
          privateDriverType,
          departure: departure.trim(),
          destination: destination.trim(),
          scheduledAt,
          passengers: String(passengers),
          durationHours: privateDriverType === 'disposition' ? durationHours : undefined,
          notes: notes.trim(),
          price: PRIVATE_DRIVER_PRICE_LABEL,
          pickupLatitude,
          pickupLongitude,
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
          'Connectez-vous pour réserver votre chauffeur privé.',
        );
        return;
      }

      if (result.status === 'confirmed') {
        showUserSuccess('Votre demande chauffeur privé est confirmée.');
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

            <PrivateDriverHero subtitle={HEADER_STEP_SLOGAN[step]} />
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
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{STEP_COPY[1].title}</Text>
                  <Text style={styles.sectionHint}>{STEP_COPY[1].hint}</Text>

                  <View style={styles.typeStack}>
                    <GlassCard
                      active={privateDriverType === 'trajet'}
                      onPress={() => selectType('trajet')}
                    >
                      <View style={styles.typeRow}>
                        <View style={[styles.typeIconWrap, privateDriverType === 'trajet' && styles.typeIconWrapActive]}>
                          <Ionicons
                            name="car-outline"
                            size={26}
                            color={privateDriverType === 'trajet' ? '#050505' : gold}
                          />
                        </View>
                        <View style={styles.typeTextCol}>
                          <Text style={styles.typeTitle}>Trajet privé</Text>
                          <Text style={styles.typeSub}>Un déplacement point à point</Text>
                          <Text style={styles.typeSubMuted}>Départ → destination</Text>
                        </View>
                      </View>
                    </GlassCard>

                    <GlassCard
                      active={privateDriverType === 'disposition'}
                      onPress={() => selectType('disposition')}
                    >
                      <View style={styles.typeRow}>
                        <View
                          style={[
                            styles.typeIconWrap,
                            privateDriverType === 'disposition' && styles.typeIconWrapActive,
                          ]}
                        >
                          <Ionicons
                            name="time-outline"
                            size={26}
                            color={privateDriverType === 'disposition' ? '#050505' : gold}
                          />
                        </View>
                        <View style={styles.typeTextCol}>
                          <Text style={styles.typeTitle}>Chauffeur à disposition</Text>
                          <Text style={styles.typeSub}>Votre chauffeur reste à disposition</Text>
                          <Text style={styles.typeSubMuted}>Durée au choix</Text>
                        </View>
                      </View>
                    </GlassCard>
                  </View>
                </View>
              )}

              {step === 2 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{STEP_COPY[2].title}</Text>
                  <Text style={styles.sectionHint}>{STEP_COPY[2].hint}</Text>

                  <Pressable onPress={openSchedule} style={({ pressed }) => [pressed && styles.pressed]}>
                    <GlassCard active={Boolean(scheduledAt)}>
                      <View style={styles.scheduleRow}>
                        <View style={[styles.scheduleIconWrap, scheduledAt && styles.scheduleIconWrapActive]}>
                          <Ionicons name="calendar-outline" size={24} color={green} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.scheduleTitle}>
                            Quand avez-vous besoin du chauffeur ?
                          </Text>
                          <Text style={styles.scheduleSub}>{whenLabel}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={muted} />
                      </View>
                    </GlassCard>
                  </Pressable>

                  <GlassCard>
                    <Text style={styles.fieldTitle}>
                      {privateDriverType === 'disposition'
                        ? 'Point de prise en charge'
                        : 'D’où partez-vous ?'}
                    </Text>
                    <Text style={styles.fieldHint}>
                      {privateDriverType === 'disposition'
                        ? 'Où le chauffeur doit-il vous rejoindre ?'
                        : 'Domicile, hôtel, adresse complète…'}
                    </Text>
                    <TextInput
                      value={departure}
                      onChangeText={setDeparture}
                      placeholder="Adresse de départ"
                      placeholderTextColor={muted}
                      style={styles.textInput}
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

                    <View style={styles.fieldDivider} />

                    <Text style={styles.fieldTitle}>
                      {privateDriverType === 'disposition'
                        ? 'Destination (facultatif)'
                        : 'Où souhaitez-vous aller ?'}
                    </Text>
                    {privateDriverType === 'disposition' ? (
                      <Text style={styles.fieldHint}>
                        Laissez vide si le programme est flexible
                      </Text>
                    ) : null}
                    <TextInput
                      value={destination}
                      onChangeText={setDestination}
                      placeholder={
                        privateDriverType === 'disposition'
                          ? 'Optionnel'
                          : 'Destination du trajet'
                      }
                      placeholderTextColor={muted}
                      style={styles.textInput}
                      autoCorrect={false}
                    />
                  </GlassCard>

                  {privateDriverType === 'disposition' ? (
                    <GlassCard>
                      <Text style={styles.fieldTitle}>Durée de mise à disposition</Text>
                      <Text style={styles.fieldHint}>
                        Combien de temps le chauffeur reste à votre service ?
                      </Text>
                      <View style={styles.durationRow}>
                        {PRIVATE_DRIVER_DURATION_OPTIONS.map((option) => {
                          const active = durationHours === option.id;
                          return (
                            <TouchableOpacity
                              key={option.id}
                              style={[styles.durationChip, active && styles.durationChipActive]}
                              onPress={() => setDurationHours(option.id)}
                            >
                              <Text
                                style={[
                                  styles.durationChipText,
                                  active && styles.durationChipTextActive,
                                ]}
                              >
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </GlassCard>
                  ) : null}

                  <GlassCard>
                    <View style={styles.passengerRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldTitle}>Passagers</Text>
                        <Text style={styles.fieldHint}>Nombre de personnes à bord</Text>
                      </View>
                      <PassengerStepper
                        value={passengers}
                        onDec={() => setPassengers((v) => Math.max(1, v - 1))}
                        onInc={() => setPassengers((v) => Math.min(8, v + 1))}
                      />
                    </View>
                  </GlassCard>

                  <GlassCard>
                    <Text style={styles.fieldTitle}>
                      Instructions pour PROTAXI (facultatif)
                    </Text>
                    <Text style={styles.fieldHint}>
                      Ex. siège enfant, arrêts prévus, préférences…
                    </Text>
                    <TextInput
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Votre message"
                      placeholderTextColor={muted}
                      style={[styles.textInput, styles.textInputMultiline]}
                      multiline
                      numberOfLines={3}
                    />
                  </GlassCard>

                  <TouchableOpacity
                    style={[styles.continueBtn, !canContinueStep2 && styles.continueBtnDisabled]}
                    disabled={!canContinueStep2}
                    onPress={handleContinueStep2}
                  >
                    <Text
                      style={[
                        styles.continueBtnText,
                        !canContinueStep2 && styles.continueBtnTextDisabled,
                      ]}
                    >
                      Continuer
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {step === 3 && privateDriverType && scheduledAt && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{STEP_COPY[3].title}</Text>
                  <Text style={styles.sectionHint}>{STEP_COPY[3].hint}</Text>

                  <LinearGradient
                    colors={['rgba(28,28,28,0.95)', 'rgba(12,12,12,0.98)']}
                    style={styles.summaryCard}
                  >
                    <View style={styles.summaryHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.summaryEyebrow}>
                          {privateDriverType === 'disposition' ? 'DISPO' : 'TRAJET'}
                        </Text>
                        <Text style={styles.summaryTypeTitle}>{typeLabel}</Text>
                      </View>
                      <View style={styles.summaryPill}>
                        <Text style={styles.summaryPillText}>Planifié</Text>
                      </View>
                    </View>
                    <SummaryDivider />
                    <SummaryDetail icon="car-outline" iconColor={green} title={`Type : ${typeLabel}`} />
                    <SummaryDivider />
                    <SummaryDetail icon="time-outline" title={`Quand : ${whenLabel}`} />
                    <SummaryDivider />
                    <SummaryDetail
                      icon="location-outline"
                      iconColor={gold}
                      title={`Départ : ${departure.trim() || '—'}`}
                    />
                    <SummaryDivider />
                    <SummaryDetail
                      icon="flag-outline"
                      iconColor={gold}
                      title={`Destination : ${destinationSummary}`}
                    />
                    {privateDriverType === 'disposition' && durationHours ? (
                      <>
                        <SummaryDivider />
                        <SummaryDetail
                          icon="hourglass-outline"
                          title={`Durée : ${formatPrivateDriverDuration(durationHours)}`}
                        />
                      </>
                    ) : null}
                    <SummaryDivider />
                    <SummaryDetail
                      icon="people-outline"
                      title={`Passagers : ${passengers}`}
                    />
                    {notes.trim() ? (
                      <>
                        <SummaryDivider />
                        <SummaryDetail icon="chatbubble-outline" title={`Note : ${notes.trim()}`} />
                      </>
                    ) : null}
                  </LinearGradient>

                  <View style={styles.estimateChip}>
                    <Ionicons name="pricetag-outline" size={16} color={gold} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.estimateChipText}>
                        Tarif : {PRIVATE_DRIVER_PRICE_LABEL}
                      </Text>
                      <Text style={styles.estimateChipSub}>
                        Notre équipe valide le devis avant attribution du chauffeur.
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.reassurance}>
                    Réservation confirmée par PROTAXI — un chauffeur partenaire vous sera
                    attribué avant le jour J.
                  </Text>

                  <TouchableOpacity
                    style={styles.bookBtn}
                    disabled={isSubmitting}
                    onPress={handleConfirm}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#050505" />
                    ) : (
                      <Text style={styles.bookBtnText}>Confirmer la réservation</Text>
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
          }}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: bg },
  flex: { flex: 1 },
  flowChrome: { paddingHorizontal: contentPadH, paddingBottom: 8 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressWrapOuter: { marginTop: 4 },
  progressWrap: { gap: 8 },
  progressTrack: {
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: green,
  },
  progressLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: contentPadH,
    paddingBottom: 32,
    gap: 14,
  },
  section: { gap: 14, paddingTop: 8 },
  sectionTitle: {
    color: '#F2F2F2',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionHint: {
    color: muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  typeStack: { gap: 12 },
  glassCard: {
    borderRadius: radiusLg,
    borderWidth: 1,
    borderColor: borderIdle,
    padding: 16,
    position: 'relative',
  },
  glassCardActive: {
    borderColor: borderActive,
  },
  cardCheckBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: green,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  typeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(212,160,23,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeIconWrapActive: { backgroundColor: green },
  typeTextCol: { flex: 1, gap: 2 },
  typeTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  typeSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  typeSubMuted: { color: muted, fontSize: 12 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scheduleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(139,197,63,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleIconWrapActive: {
    backgroundColor: 'rgba(139,197,63,0.22)',
    borderWidth: 1,
    borderColor: borderActive,
  },
  scheduleTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  scheduleSub: { color: muted, fontSize: 12, marginTop: 4 },
  fieldTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  fieldHint: { color: muted, fontSize: 12, marginTop: 4, marginBottom: 10 },
  fieldDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 14,
  },
  textInput: {
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radiusMd,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  textInputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  locationBtnText: { color: gold, fontSize: 13, fontWeight: '700' },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  durationChipActive: {
    borderColor: borderActive,
    backgroundColor: 'rgba(139,197,63,0.18)',
  },
  durationChipText: { color: muted, fontSize: 12, fontWeight: '700' },
  durationChipTextActive: { color: green },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: { color: '#fff', fontSize: 18, fontWeight: '800', minWidth: 24, textAlign: 'center' },
  continueBtn: {
    backgroundColor: green,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  continueBtnDisabled: { backgroundColor: 'rgba(139,197,63,0.25)' },
  continueBtnText: { color: '#050505', fontSize: 15, fontWeight: '900' },
  continueBtnTextDisabled: { color: 'rgba(5,5,5,0.45)' },
  summaryCard: {
    borderRadius: radiusLg,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.2)',
    padding: 18,
    gap: 4,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  summaryEyebrow: {
    color: gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  summaryTypeTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 4 },
  summaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(201,162,39,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.35)',
  },
  summaryPillText: { color: gold, fontSize: 10, fontWeight: '800' },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 10,
  },
  summaryDetail: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  summaryDetailTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
  estimateChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: radiusMd,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  estimateChipText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  estimateChipSub: { color: muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  reassurance: {
    color: muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  bookBtn: {
    backgroundColor: green,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  bookBtnText: { color: '#050505', fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.92 },
});
