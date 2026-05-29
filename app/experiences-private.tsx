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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ExperiencesPrivateHero from '@/components/ExperiencesPrivateHero';
import ScheduleRideModal, {
  formatScheduleSummary,
  getDefaultScheduleDate,
} from '@/components/ScheduleRideModal';
import { getExperienceV1Image } from '@/constants/experienceVisuals';
import {
  buildExperienceSteps,
  validateExperiencesV1Catalog,
  EXPERIENCE_MEETING_PLACEHOLDER,
  EXPERIENCE_OPTION_CATALOG,
  EXPERIENCE_PRICE_LABEL,
  EXPERIENCE_SOURCE,
  EXPERIENCES_V1,
  FORMULA_GROUP_PERKS,
  FORMULA_PRIVATE_PERKS,
  formatExperienceCardInclusLine,
  formatSelectedOptions,
  getExperienceSiteBadgeLabel,
  getExperienceV1,
  GROUP_FORMULA_LABEL,
  PRIVATE_FORMULA_LABEL,
  type ExperienceOptionId,
  type ExperienceV1,
} from '@/constants/experiencesPrivateCatalog';
import { getFirebaseAuth } from '@/firebase/authInstance';
import { createTourBooking } from '@/services/createTourBooking';
import { logNavigation, PROTAXI_ROUTES } from '@/utils/navigation';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const green = '#8BC53F';
const gold = '#D4A017';
const bg = '#050505';
const glassTop = 'rgba(42,42,42,0.72)';
const glassBottom = 'rgba(14,14,14,0.96)';
const borderActive = 'rgba(139,197,63,0.72)';
const muted = '#8A8A8A';
const contentPadH = 16;

const GLASS_GRADIENT = [glassTop, 'rgba(22,22,22,0.94)', glassBottom] as const;
const FLOW_STEPS = 5;

type FlowStep = 1 | 2 | 3 | 4 | 5;

const HEADER_STEP_SLOGAN: Record<FlowStep, string> = {
  1: 'Personnalisez votre sortie ou rejoignez un départ (bientôt).',
  2: 'Le patrimoine de Guelma, en expériences officielles PROTAXI.',
  3: 'Indiquez quand vous souhaitez partir.',
  4: 'Affinez votre expérience avec nos options.',
  5: 'Vérifiez votre demande avant envoi.',
};

const STEP_COPY: Record<FlowStep, { title: string; hint: string }> = {
  1: { title: 'Choisissez votre formule', hint: 'Expérience privée ou groupe' },
  2: { title: 'Choisissez votre expérience', hint: '6 circuits officiels à Guelma' },
  3: { title: 'Quand et combien serez-vous ?', hint: 'Date, heure et participants' },
  4: { title: 'Personnalisez votre expérience', hint: 'Options selon le circuit choisi' },
  5: { title: 'Confirmez votre demande', hint: 'Vérifiez avant envoi' },
};

function formatTourDateTime(date: Date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const dateStr = `${day < 10 ? '0' : ''}${day}/${month < 10 ? '0' : ''}${month}/${year}`;
  const time = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateStr} • ${time}`;
}

function CardCheckBadge() {
  return (
    <View style={styles.cardCheckBadge}>
      <Ionicons name="checkmark" size={14} color="#050505" />
    </View>
  );
}

type IdentityPillVariant = 'gold' | 'goldFeatured' | 'green' | 'neutral';

function getExperienceIdentityPillVariant(experienceId: string): IdentityPillVariant {
  switch (experienceId) {
    case 'hammam-debagh-signature':
      return 'goldFeatured';
    case 'nature-maouna':
      return 'green';
    case 'memoire-de-guelma':
      return 'neutral';
    default:
      return 'gold';
  }
}

function ExperienceIdentityPill({ experience }: { experience: ExperienceV1 }) {
  const variant = getExperienceIdentityPillVariant(experience.id);
  return (
    <View
      style={[
        styles.skuIdentityPill,
        variant === 'goldFeatured' && styles.skuIdentityPillGoldFeatured,
        variant === 'gold' && styles.skuIdentityPillGold,
        variant === 'green' && styles.skuIdentityPillGreen,
        variant === 'neutral' && styles.skuIdentityPillNeutral,
      ]}
    >
      <Text
        style={[
          styles.skuIdentityText,
          variant === 'goldFeatured' && styles.skuIdentityTextGold,
          variant === 'gold' && styles.skuIdentityTextGold,
          variant === 'green' && styles.skuIdentityTextGreen,
          variant === 'neutral' && styles.skuIdentityTextNeutral,
        ]}
      >
        {experience.identityBadge}
      </Text>
    </View>
  );
}

function GlassCard({
  active,
  onPress,
  disabled,
  children,
  style,
}: {
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: object;
}) {
  const content = (
    <LinearGradient
      colors={[...GLASS_GRADIENT]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.glassCard,
        active && styles.glassCardActive,
        disabled && styles.glassCardDisabled,
        style,
      ]}
    >
      {active ? <CardCheckBadge /> : null}
      {children}
    </LinearGradient>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [pressed && !disabled && styles.pressed]}
    >
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
      <TouchableOpacity style={styles.stepperBtn} onPress={onDec} disabled={value <= 1}>
        <Ionicons name="remove" size={18} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.stepperValue}>{value}</Text>
      <TouchableOpacity style={styles.stepperBtn} onPress={onInc} disabled={value >= 12}>
        <Ionicons name="add" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function PerkList({ items, color }: { items: readonly string[]; color: string }) {
  return (
    <View style={styles.perkList}>
      {items.map((perk) => (
        <View key={perk} style={styles.perkRow}>
          <Ionicons name="checkmark-circle" size={14} color={color} />
          <Text style={styles.perkText}>{perk}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ExperiencesPrivateScreen() {
  if (__DEV__) {
    const catalogCheck = validateExperiencesV1Catalog();
    if (!catalogCheck.ok) {
      console.warn('[experiences-private] catalog validation:', catalogCheck.errors);
    }
  }

  const [step, setStep] = useState<FlowStep>(1);
  const [formulaConfirmed, setFormulaConfirmed] = useState(false);
  const [experienceId, setExperienceId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [participants, setParticipants] = useState(2);
  const [notes, setNotes] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<
    Partial<Record<ExperienceOptionId, boolean>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const experience = experienceId ? getExperienceV1(experienceId) : undefined;

  const whenLabel = scheduledAt
    ? formatScheduleSummary(scheduledAt)
    : 'Choisir une date et une heure';

  const optionsSummary = useMemo(() => {
    if (!experience) return 'Aucune option supplémentaire';
    return formatSelectedOptions(experience, selectedOptions);
  }, [experience, selectedOptions]);

  const dateValueForBooking = useMemo(() => {
    if (!scheduledAt) return '';
    return formatTourDateTime(scheduledAt);
  }, [scheduledAt]);

  const goTo = (next: FlowStep) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(next);
  };

  const selectPrivateFormula = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFormulaConfirmed(true);
    goTo(2);
  };

  const onGroupFormulaPress = () => {
    Alert.alert(
      GROUP_FORMULA_LABEL,
      'Les départs groupe seront disponibles prochainement. Choisissez Expérience privée pour réserver un circuit officiel.',
    );
  };

  const selectExperience = (id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExperienceId(id);
    setSelectedOptions({});
  };

  const toggleOption = (optionId: ExperienceOptionId, enabled: boolean) => {
    setSelectedOptions((prev) => {
      const next = { ...prev };
      if (enabled) {
        next[optionId] = true;
      } else {
        delete next[optionId];
      }
      return next;
    });
  };

  const openSchedule = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScheduleModalVisible(true);
  };

  const handleContinueStep2 = () => {
    if (!experienceId) return;
    goTo(3);
  };

  const handleContinueStep3 = () => {
    if (!scheduledAt) {
      Alert.alert('Horaire', 'Choisissez une date et une heure.');
      return;
    }
    goTo(4);
  };

  const handleContinueStep4 = () => {
    goTo(5);
  };

  const handleConfirm = async () => {
    if (!experience || !scheduledAt || isSubmitting) return;

    const clientUid = getFirebaseAuth().currentUser?.uid;
    if (!clientUid) {
      Alert.alert(
        'Connexion requise',
        'Connectez-vous pour réserver une expérience PROTAXI.',
      );
      return;
    }

    const notesValue = notes.trim() || 'Aucune note';
    const optionsValue = formatSelectedOptions(experience, selectedOptions);

    setIsSubmitting(true);
    try {
      const result = await createTourBooking({
        clientUid,
        experienceTitle: experience.circuitName,
        circuitName: experience.circuitName,
        formula: PRIVATE_FORMULA_LABEL,
        bookingMode: 'private',
        duration: experience.duration,
        steps: buildExperienceSteps(experience),
        options: optionsValue,
        travelers: String(participants),
        date: dateValueForBooking,
        meetingPoint: EXPERIENCE_MEETING_PLACEHOLDER,
        notes: notesValue,
        price: EXPERIENCE_PRICE_LABEL,
        source: EXPERIENCE_SOURCE,
      });

      const confirmParams: Record<string, string> = {
        tourBookingId: result.bookingId,
        experience: experience.circuitName,
        formulaLabel: PRIVATE_FORMULA_LABEL,
        date: dateValueForBooking,
        participants: String(participants),
        notes: notesValue,
        options: optionsValue,
        bookingMode: 'private',
        price: EXPERIENCE_PRICE_LABEL,
      };

      logNavigation(`${PROTAXI_ROUTES.experienceConfirmed}?experience=${experience.circuitName}`, {
        source: EXPERIENCE_SOURCE,
        label: 'Confirmer expérience privée',
      });

      router.replace({
        pathname: PROTAXI_ROUTES.experienceConfirmed,
        params: confirmParams,
      });
    } catch {
      Alert.alert(
        'Enregistrement impossible',
        'Votre demande n\'a pas pu être enregistrée. Vérifiez votre connexion et réessayez.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      router.back();
      return;
    }
    if (step === 2) {
      setFormulaConfirmed(false);
    }
    goTo((step - 1) as FlowStep);
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
              <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                <Ionicons name="chevron-back" size={18} color="#fff" />
              </TouchableOpacity>
              <View style={styles.backBtn} />
            </View>

            <ExperiencesPrivateHero subtitle={HEADER_STEP_SLOGAN[step]} />
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

                  <GlassCard active={formulaConfirmed} onPress={selectPrivateFormula}>
                    <View style={styles.formulaHeader}>
                      <View style={[styles.formulaIconWrap, styles.formulaIconPrivate]}>
                        <Ionicons name="diamond-outline" size={22} color="#050505" />
                      </View>
                      <Text style={styles.formulaTitle}>{PRIVATE_FORMULA_LABEL}</Text>
                    </View>
                    <PerkList items={FORMULA_PRIVATE_PERKS} color={green} />
                  </GlassCard>

                  <GlassCard disabled onPress={onGroupFormulaPress}>
                    <View style={styles.formulaHeader}>
                      <View style={[styles.formulaIconWrap, styles.formulaIconGroup]}>
                        <Ionicons name="people-outline" size={22} color={gold} />
                      </View>
                      <View style={styles.formulaTitleRow}>
                        <Text style={styles.formulaTitle}>{GROUP_FORMULA_LABEL}</Text>
                        <View style={styles.soonBadge}>
                          <Text style={styles.soonBadgeText}>Bientôt</Text>
                        </View>
                      </View>
                    </View>
                    <PerkList items={FORMULA_GROUP_PERKS} color={gold} />
                  </GlassCard>
                </View>
              )}

              {step === 2 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{STEP_COPY[2].title}</Text>
                  <Text style={styles.sectionHint}>{STEP_COPY[2].hint}</Text>

                  <View style={styles.skuStack}>
                    {EXPERIENCES_V1.map((item) => (
                      <GlassCard
                        key={item.id}
                        active={experienceId === item.id}
                        onPress={() => selectExperience(item.id)}
                      >
                        <View style={styles.skuRow}>
                          <Image
                            source={getExperienceV1Image(item)}
                            style={styles.skuThumb}
                            contentFit="cover"
                          />
                          <View style={styles.skuTextCol}>
                            <Text style={styles.skuTitle}>{item.title}</Text>
                            <ExperienceIdentityPill experience={item} />
                            <Text style={styles.skuHook} numberOfLines={2}>
                              {item.hook}
                            </Text>
                            <Text style={styles.skuSiteCount}>
                              {getExperienceSiteBadgeLabel(item)}
                            </Text>
                            <Text style={styles.skuInclusLabel}>
                              Inclus dans l&apos;expérience
                            </Text>
                            <Text style={styles.skuInclusLine}>
                              {formatExperienceCardInclusLine(item)}
                            </Text>
                            <Text style={styles.skuMeta}>{item.duration}</Text>
                            <Text style={styles.skuGuide}>
                              👨‍🏫 {item.guideAvailability}
                            </Text>
                          </View>
                        </View>
                      </GlassCard>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.continueBtn, !experienceId && styles.continueBtnDisabled]}
                    disabled={!experienceId}
                    onPress={handleContinueStep2}
                  >
                    <Text
                      style={[
                        styles.continueBtnText,
                        !experienceId && styles.continueBtnTextDisabled,
                      ]}
                    >
                      Continuer
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {step === 3 && experience && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{STEP_COPY[3].title}</Text>
                  <Text style={styles.sectionHint}>{STEP_COPY[3].hint}</Text>
                  <Text style={styles.selectedCircuit}>{experience.title}</Text>

                  <Pressable onPress={openSchedule} style={({ pressed }) => [pressed && styles.pressed]}>
                    <GlassCard>
                      <View style={styles.scheduleRow}>
                        <View style={styles.scheduleIconWrap}>
                          <Ionicons name="calendar-outline" size={22} color={gold} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldTitle}>Date et heure</Text>
                          <Text style={styles.scheduleValue}>{whenLabel}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={muted} />
                      </View>
                    </GlassCard>
                  </Pressable>

                  <GlassCard>
                    <View style={styles.passengerRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldTitle}>Participants</Text>
                        <Text style={styles.fieldHint}>Nombre de personnes</Text>
                      </View>
                      <PassengerStepper
                        value={participants}
                        onDec={() => setParticipants((v) => Math.max(1, v - 1))}
                        onInc={() => setParticipants((v) => Math.min(12, v + 1))}
                      />
                    </View>
                  </GlassCard>

                  <GlassCard>
                    <Text style={styles.fieldTitle}>Message (facultatif)</Text>
                    <Text style={styles.fieldHint}>Précisions pour l’équipe PROTAXI</Text>
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
                    style={[styles.continueBtn, !scheduledAt && styles.continueBtnDisabled]}
                    disabled={!scheduledAt}
                    onPress={handleContinueStep3}
                  >
                    <Text
                      style={[
                        styles.continueBtnText,
                        !scheduledAt && styles.continueBtnTextDisabled,
                      ]}
                    >
                      Continuer
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {step === 4 && experience && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{STEP_COPY[4].title}</Text>
                  <Text style={styles.sectionHint}>{STEP_COPY[4].hint}</Text>
                  {experience.recommendedGuide ? (
                    <Text style={styles.recoBanner}>{experience.recommendedGuide}</Text>
                  ) : null}

                  <View style={styles.optionsStack}>
                    {experience.availableOptions.map((optionId) => {
                      const def = EXPERIENCE_OPTION_CATALOG[optionId];
                      const active = Boolean(selectedOptions[optionId]);
                      return (
                        <GlassCard key={optionId}>
                          <View style={styles.optionRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.optionLabel}>{def.label}</Text>
                            </View>
                            <Switch
                              value={active}
                              onValueChange={(value) => toggleOption(optionId, value)}
                              trackColor={{ false: '#333', true: 'rgba(139,197,63,0.5)' }}
                              thumbColor={active ? green : '#f4f3f4'}
                            />
                          </View>
                        </GlassCard>
                      );
                    })}
                  </View>

                  <TouchableOpacity style={styles.continueBtn} onPress={handleContinueStep4}>
                    <Text style={styles.continueBtnText}>Continuer</Text>
                  </TouchableOpacity>
                </View>
              )}

              {step === 5 && experience && scheduledAt && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{STEP_COPY[5].title}</Text>
                  <Text style={styles.sectionHint}>{STEP_COPY[5].hint}</Text>

                  <LinearGradient
                    colors={['rgba(28,28,28,0.95)', 'rgba(12,12,12,0.98)']}
                    style={styles.summaryCard}
                  >
                    <View style={styles.summaryHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.summaryEyebrow}>{PRIVATE_FORMULA_LABEL.toUpperCase()}</Text>
                        <Text style={styles.summaryTypeTitle}>{experience.title}</Text>
                      </View>
                    </View>
                    <SummaryDivider />
                    <SummaryDetail icon="compass-outline" iconColor={green} title={experience.title} />
                    <SummaryDivider />
                    <SummaryDetail icon="time-outline" title={`Durée : ${experience.duration}`} />
                    <SummaryDivider />
                    <SummaryDetail icon="calendar-outline" title={`Quand : ${whenLabel}`} />
                    <SummaryDivider />
                    <SummaryDetail
                      icon="people-outline"
                      title={`Participants : ${participants}`}
                    />
                    <SummaryDivider />
                    <SummaryDetail icon="options-outline" title={`Options : ${optionsSummary}`} />
                    {notes.trim() ? (
                      <>
                        <SummaryDivider />
                        <SummaryDetail icon="chatbubble-outline" title={`Message : ${notes.trim()}`} />
                      </>
                    ) : null}
                  </LinearGradient>

                  <View style={styles.estimateChip}>
                    <Ionicons name="pricetag-outline" size={16} color={gold} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.estimateChipText}>
                        Tarif : {EXPERIENCE_PRICE_LABEL}
                      </Text>
                      <Text style={styles.estimateChipSub}>
                        PROTAXI confirmera le tarif avant votre expérience.
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.bookBtn}
                    disabled={isSubmitting}
                    onPress={handleConfirm}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#050505" />
                    ) : (
                      <Text style={styles.bookBtnText}>Confirmer la demande</Text>
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
  section: { gap: 12 },
  sectionTitle: {
    color: '#F5F5F5',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sectionHint: {
    color: muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  selectedCircuit: {
    color: green,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  pressed: { opacity: 0.92 },
  glassCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    position: 'relative',
  },
  glassCardActive: {
    borderColor: borderActive,
  },
  glassCardDisabled: {
    opacity: 0.72,
  },
  cardCheckBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: green,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  formulaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  formulaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formulaIconPrivate: { backgroundColor: green },
  formulaIconGroup: { backgroundColor: 'rgba(212,160,23,0.25)' },
  formulaTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  formulaTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', flex: 1 },
  soonBadge: {
    backgroundColor: 'rgba(212,160,23,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
  },
  soonBadgeText: { color: gold, fontSize: 10, fontWeight: '800' },
  perkList: { gap: 6 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkText: { color: '#D0D0D0', fontSize: 12, flex: 1 },
  skuStack: { gap: 10 },
  skuRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  skuThumb: { width: 64, height: 64, borderRadius: 12 },
  skuTextCol: { flex: 1, gap: 2 },
  skuTitle: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  skuIdentityPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  skuIdentityPillGold: {
    backgroundColor: 'rgba(212,160,23,0.15)',
    borderColor: 'rgba(212,160,23,0.35)',
  },
  skuIdentityPillGoldFeatured: {
    backgroundColor: 'rgba(212,160,23,0.2)',
    borderColor: 'rgba(212,160,23,0.55)',
  },
  skuIdentityPillGreen: {
    backgroundColor: 'rgba(139,197,63,0.12)',
    borderColor: 'rgba(139,197,63,0.35)',
  },
  skuIdentityPillNeutral: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  skuIdentityText: { fontSize: 10, fontWeight: '800' },
  skuIdentityTextGold: { color: gold },
  skuIdentityTextGreen: { color: green },
  skuIdentityTextNeutral: { color: '#E8E8E8' },
  skuHook: { color: '#E8E8E8', fontSize: 12, lineHeight: 17, marginTop: 4 },
  skuSiteCount: { color: green, fontSize: 11, fontWeight: '700', marginTop: 4 },
  skuInclusLabel: {
    color: muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  skuInclusLine: { color: '#C8C8C8', fontSize: 10, lineHeight: 14, marginTop: 3 },
  skuMeta: { color: green, fontSize: 11, fontWeight: '700', marginTop: 6 },
  skuGuide: { color: gold, fontSize: 10, fontWeight: '600', marginTop: 4 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scheduleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(212,160,23,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleValue: { color: '#E8E8E8', fontSize: 14, fontWeight: '600', marginTop: 4 },
  fieldTitle: { color: '#F0F0F0', fontSize: 14, fontWeight: '700' },
  fieldHint: { color: muted, fontSize: 12, marginTop: 2 },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { color: '#FFF', fontSize: 16, fontWeight: '800', minWidth: 24, textAlign: 'center' },
  textInput: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    color: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textInputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  recoBanner: {
    color: gold,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  optionsStack: { gap: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionLabel: { color: '#F0F0F0', fontSize: 14, fontWeight: '600' },
  continueBtn: {
    marginTop: 8,
    backgroundColor: green,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: 'rgba(139,197,63,0.35)' },
  continueBtnText: { color: '#050505', fontSize: 16, fontWeight: '800' },
  continueBtnTextDisabled: { color: 'rgba(5,5,5,0.45)' },
  summaryCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  summaryEyebrow: {
    color: muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  summaryTypeTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginTop: 2 },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 10,
  },
  summaryDetail: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryDetailTitle: { color: '#E6E6E6', fontSize: 13, flex: 1, lineHeight: 18 },
  estimateChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.2)',
  },
  estimateChipText: { color: '#F2F2F2', fontSize: 14, fontWeight: '700' },
  estimateChipSub: { color: muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  bookBtn: {
    backgroundColor: green,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  bookBtnText: { color: '#050505', fontSize: 16, fontWeight: '800' },
});
