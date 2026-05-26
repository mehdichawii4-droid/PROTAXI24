import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onSnapshot, query, orderBy } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getTourBookingDocRef,
  getTourGroupDocRef,
  getTourGroupMemoriesCollectionRef,
  getTourGroupMessagesCollectionRef,
  getTourGroupReviewsCollectionRef,
} from '@/firebase/firestore';
import {
  configureNotificationHandler,
  requestNotificationPermissions,
} from '@/services/notificationService';
import {
  formatTourGroupNumber,
  getTourGroupTrackingConfig,
  hasTourGroupAssignment,
  hasTourGroupTracking,
  isTourGroupAssignmentConfirmed,
  normalizeTourGroupTracking,
  normalizeTourGroupTrackingStatus,
  normalizeTourGroupParticipants,
  type TourGroupAssignment,
  type TourGroupParticipant,
  type TourGroupTracking,
} from '@/services/tourGroupMatching';
import {
  DEFAULT_PARTICIPANT_SENDER_NAME,
  formatTourGroupMessageTime,
  normalizeTourGroupMessage,
  sendTourGroupMessage,
  type TourGroupMessage,
} from '@/services/tourGroupChat';
import {
  computeTourGroupReviewStats,
  findReviewByBookingId,
  formatReviewAverage,
  normalizeTourGroupReview,
  sendTourGroupReview,
  type TourGroupReview,
} from '@/services/tourGroupReviews';
import {
  getMemorySenderBadgeLabel,
  getMockGroupMemoryImage,
  getLatestTourGroupMemories,
  isOfficialGroupMemory,
  normalizeTourGroupMemory,
  sendTourGroupMemory,
  type TourGroupMemory,
  type TourGroupMemorySenderType,
} from '@/services/tourGroupMemories';
import { PROTAXI_ROUTES } from '@/utils/navigation';
import QRCode from 'react-native-qrcode-svg';
import {
  buildTourTicketQrValue,
  formatCheckedInAt,
  getCheckInStatusLabel,
  isTourBookingCheckedIn,
  normalizeTourCheckInStatus,
  type TourCheckInStatus,
} from '@/services/tourGroupTicket';
import {
  formatTourPaymentAmount,
  getPaymentMethodLabel,
  getPaymentProgress,
  getPaymentStatusConfig,
  normalizeTourPaymentMethod,
  normalizeTourPaymentStatus,
  type TourPaymentMethod,
  type TourPaymentStatus,
} from '@/services/tourGroupPayment';
import {
  formatTourWeatherTemperature,
  generateTourWeather,
  getTourWeatherGlowOpacity,
  type TourWeather,
} from '@/services/tourWeather';
import { devError } from '@/utils/devLog';
import {
  computeClientGroupPopularityAnalytics,
  formatAnalyticsParticipants,
  formatAnalyticsRating,
  type TourAnalyticsReview,
} from '@/services/tourAnalytics';

const green = '#8BC53F';
const bg = '#050505';
const card = '#0D0D0D';
const glow = 'rgba(139,197,63,0.18)';
const muted = '#8A8A8A';
const HERO_HEIGHT = 240;
const DEFAULT_GROUP_MEETING_POINT = 'Place du 1er Novembre — Guelma';

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

type BookingMode = 'private' | 'group';
type TourBookingLiveStatus = 'pending' | 'confirmed' | 'cancelled';

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

function parseList(raw: string) {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLiveStatus(value: unknown): TourBookingLiveStatus {
  if (value === 'confirmed' || value === 'cancelled') return value;
  return 'pending';
}

function formatLiveUpdatedAt(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLiveStatusConfig(status: TourBookingLiveStatus) {
  switch (status) {
    case 'confirmed':
      return {
        emoji: '✅',
        title: 'Expérience confirmée',
        message: 'Votre expérience PROTAXI est confirmée.',
        color: green,
        glow: 'rgba(139,197,63,0.22)',
        border: 'rgba(139,197,63,0.32)',
        icon: 'checkmark-circle' as const,
      };
    case 'cancelled':
      return {
        emoji: '❌',
        title: 'Réservation annulée',
        message: 'Cette réservation a été annulée.',
        color: '#EF4444',
        glow: 'rgba(239,68,68,0.18)',
        border: 'rgba(239,68,68,0.32)',
        icon: 'close-circle' as const,
      };
    default:
      return {
        emoji: '⏳',
        title: 'En attente de validation',
        message: 'Votre réservation est en attente de validation.',
        color: '#F59E0B',
        glow: 'rgba(245,158,11,0.18)',
        border: 'rgba(245,158,11,0.32)',
        icon: 'time' as const,
      };
  }
}

async function sendTourBookingStatusNotification(status: 'confirmed' | 'cancelled') {
  if (Platform.OS === 'web') return;

  const content =
    status === 'confirmed'
      ? {
          title: 'Réservation confirmée ✅',
          body: 'Votre expérience PROTAXI a été validée.',
        }
      : {
          title: 'Réservation annulée ❌',
          body: 'Votre réservation n\'a pas pu être confirmée.',
        };

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    devError('[PROMISE DENIED - tour-summary - sendBookingStatusNotification]', error);
  }
}

function LiveBookingStatusCard({
  status,
  updatedAt,
  glowPulse,
}: {
  status: TourBookingLiveStatus;
  updatedAt: Date | null;
  glowPulse: number;
}) {
  const config = getLiveStatusConfig(status);
  const formattedUpdatedAt = formatLiveUpdatedAt(updatedAt);
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (glowPulse === 0) return;

    glowScale.setValue(1);
    glowOpacity.setValue(0.35);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.18,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.85,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.35,
          duration: 420,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [glowPulse, glowOpacity, glowScale]);

  return (
    <View style={styles.section}>
      <SectionHeader title="Statut en direct" />
      <View
        style={[
          styles.liveStatusCard,
          {
            borderColor: config.border,
            shadowColor: config.color,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.liveStatusGlow,
            {
              backgroundColor: config.glow,
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />

        <View style={styles.liveStatusTopRow}>
          <View style={[styles.liveBadge, { backgroundColor: config.glow, borderColor: config.border }]}>
            <View style={[styles.liveBadgeDot, { backgroundColor: config.color }]} />
            <Text style={[styles.liveBadgeText, { color: config.color }]}>LIVE</Text>
          </View>
          <Text style={styles.liveStatusEmoji}>{config.emoji}</Text>
        </View>

        <View style={styles.liveStatusContent}>
          <View style={[styles.liveStatusIconWrap, { backgroundColor: config.glow, borderColor: config.border }]}>
            <Ionicons name={config.icon} size={24} color={config.color} />
          </View>
          <View style={styles.liveStatusTextWrap}>
            <Text style={[styles.liveStatusTitle, { color: config.color }]}>{config.title}</Text>
            <Text style={styles.liveStatusMessage}>{config.message}</Text>
            {formattedUpdatedAt ? (
              <Text style={styles.liveStatusUpdatedAt}>
                Dernière mise à jour : {formattedUpdatedAt}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function LiveGroupMatchingCard({
  groupId,
  booked,
  remaining,
  capacity,
  status,
  participants,
  currentBookingId,
}: {
  groupId: string;
  booked: number;
  remaining: number;
  capacity: number;
  status: 'open' | 'full';
  participants: TourGroupParticipant[];
  currentBookingId: string;
}) {
  const isFull = status === 'full';
  const isCurrentUserRegistered = participants.some(
    (participant) => participant.bookingId === currentBookingId,
  );

  return (
    <View style={styles.section}>
      <SectionHeader title="Votre groupe" />
      <View style={[styles.groupLiveCard, isFull && styles.groupLiveCardFull]}>
        <View style={styles.groupLiveGlow} />

        <View style={styles.groupLiveTopRow}>
          <View style={styles.groupLiveBadge}>
            <Ionicons name="people" size={12} color={green} />
            <Text style={styles.groupLiveBadgeText}>GROUP MATCHING LIVE</Text>
          </View>
          <View style={[styles.groupLiveStatusPill, isFull && styles.groupLiveStatusPillFull]}>
            <Text style={[styles.groupLiveStatusText, isFull && styles.groupLiveStatusTextFull]}>
              {isFull ? 'COMPLET' : 'OUVERT'}
            </Text>
          </View>
        </View>

        {isCurrentUserRegistered ? (
          <View style={styles.groupRegisteredBadge}>
            <Ionicons name="checkmark-circle" size={14} color={green} />
            <Text style={styles.groupRegisteredBadgeText}>Vous êtes inscrit</Text>
          </View>
        ) : null}

        <Text style={styles.groupLiveNumber}>{formatTourGroupNumber(groupId)}</Text>
        <Text style={styles.groupLiveSubtitle}>Numéro de groupe PROTAXI</Text>

        <View style={styles.groupLiveStatsRow}>
          <View style={styles.groupLiveStatCard}>
            <Text style={styles.groupLiveStatValue}>{booked}</Text>
            <Text style={styles.groupLiveStatLabel}>Participants</Text>
          </View>
          <View style={styles.groupLiveStatDivider} />
          <View style={styles.groupLiveStatCard}>
            <Text style={styles.groupLiveStatValue}>{remaining}</Text>
            <Text style={styles.groupLiveStatLabel}>Places restantes</Text>
          </View>
          <View style={styles.groupLiveStatDivider} />
          <View style={styles.groupLiveStatCard}>
            <Text style={styles.groupLiveStatValue}>{capacity}</Text>
            <Text style={styles.groupLiveStatLabel}>Capacité</Text>
          </View>
        </View>

        <View style={styles.groupParticipantsSection}>
          <Text style={styles.groupParticipantsTitle}>Voyageurs inscrits</Text>
          {participants.length === 0 ? (
            <Text style={styles.groupParticipantsEmpty}>Aucun voyageur inscrit pour le moment.</Text>
          ) : (
            participants.map((participant, index) => {
              const isCurrentUser = participant.bookingId === currentBookingId;

              return (
                <View
                  key={`${participant.bookingId}-${index}`}
                  style={[
                    styles.groupParticipantRow,
                    isCurrentUser && styles.groupParticipantRowCurrent,
                  ]}
                >
                  <View style={styles.groupParticipantAvatar}>
                    <Ionicons name="person-outline" size={16} color={green} />
                  </View>
                  <View style={styles.groupParticipantTextWrap}>
                    <Text style={styles.groupParticipantName}>{participant.displayName}</Text>
                    <Text style={styles.groupParticipantMeta}>
                      {participant.travelersCount} place{participant.travelersCount > 1 ? 's' : ''}
                      {isCurrentUser ? ' • Vous' : ''}
                    </Text>
                  </View>
                  <View style={styles.groupParticipantStatusPill}>
                    <Text style={styles.groupParticipantStatusText}>
                      {participant.status === 'confirmed'
                        ? 'Confirmé'
                        : participant.status === 'cancelled'
                          ? 'Annulé'
                          : 'En attente'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    </View>
  );
}

function LiveGroupTeamCard({ assignment }: { assignment: TourGroupAssignment }) {
  const isConfirmed = isTourGroupAssignmentConfirmed(assignment);

  return (
    <View style={styles.section}>
      <SectionHeader title="Votre équipe PROTAXI" />
      <View style={styles.groupTeamCard}>
        <View style={styles.groupTeamGlow} />

        {isConfirmed ? (
          <View style={styles.groupTeamConfirmedBadge}>
            <Ionicons name="shield-checkmark" size={14} color={green} />
            <Text style={styles.groupTeamConfirmedText}>Organisation confirmée</Text>
          </View>
        ) : null}

        {assignment.assignedVehicle ? (
          <View style={styles.groupTeamRow}>
            <View style={styles.groupTeamIconWrap}>
              <Ionicons name="bus-outline" size={18} color={green} />
            </View>
            <View style={styles.groupTeamTextWrap}>
              <Text style={styles.groupTeamLabel}>Véhicule attribué</Text>
              <Text style={styles.groupTeamValue}>{assignment.assignedVehicle}</Text>
            </View>
          </View>
        ) : null}

        {assignment.assignedDriver ? (
          <View style={styles.groupTeamRow}>
            <View style={styles.groupTeamIconWrap}>
              <Ionicons name="person-outline" size={18} color={green} />
            </View>
            <View style={styles.groupTeamTextWrap}>
              <Text style={styles.groupTeamLabel}>Chauffeur</Text>
              <Text style={styles.groupTeamValue}>{assignment.assignedDriver}</Text>
            </View>
          </View>
        ) : null}

        {assignment.assignedGuide ? (
          <View style={styles.groupTeamRow}>
            <View style={styles.groupTeamIconWrap}>
              <Ionicons name="map-outline" size={18} color={green} />
            </View>
            <View style={styles.groupTeamTextWrap}>
              <Text style={styles.groupTeamLabel}>Guide touristique</Text>
              <Text style={styles.groupTeamValue}>{assignment.assignedGuide}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function formatTrackingUpdatedAt(value: unknown) {
  if (!value) return null;

  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const timestamp = value as { toDate?: () => Date };
    date = timestamp.toDate?.() ?? null;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  }

  if (!date || Number.isNaN(date.getTime())) return null;

  return date.toLocaleString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LiveGroupTrackingCard({
  tracking,
  assignedDriver,
  statusPulse,
}: {
  tracking: TourGroupTracking;
  assignedDriver: string;
  statusPulse: number;
}) {
  const trackingStatus = normalizeTourGroupTrackingStatus(tracking.trackingStatus) || 'preparing';
  const config = getTourGroupTrackingConfig(trackingStatus);
  const etaMinutes = Number(tracking.etaMinutes || 0);
  const locationLabel = tracking.liveLocation?.label || 'Guelma';
  const updatedAtLabel = formatTrackingUpdatedAt(tracking.lastLocationUpdate);

  const vehicleScale = useRef(new Animated.Value(1)).current;
  const vehicleGlow = useRef(new Animated.Value(0.35)).current;
  const cardGlow = useRef(new Animated.Value(0.16)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(vehicleScale, {
            toValue: 1.22,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(vehicleGlow, {
            toValue: 0.9,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(vehicleScale, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(vehicleGlow, {
            toValue: 0.35,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [vehicleGlow, vehicleScale]);

  useEffect(() => {
    if (statusPulse === 0) return;

    cardGlow.setValue(0.16);
    Animated.sequence([
      Animated.timing(cardGlow, {
        toValue: 0.42,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(cardGlow, {
        toValue: 0.16,
        duration: 420,
        useNativeDriver: false,
      }),
    ]).start();
  }, [cardGlow, statusPulse]);

  return (
    <View style={styles.section}>
      <SectionHeader title="Tracking en direct" />
      <Animated.View
        style={[
          styles.groupTrackingCard,
          {
            borderColor: config.border,
            shadowColor: config.color,
            shadowOpacity: cardGlow,
          },
        ]}
      >
        <View style={[styles.groupTrackingGlow, { backgroundColor: config.glow }]} />

        <View style={styles.groupTrackingTopRow}>
          <View style={[styles.groupTrackingLiveBadge, { borderColor: config.border }]}>
            <View style={[styles.groupTrackingLiveDot, { backgroundColor: config.color }]} />
            <Text style={[styles.groupTrackingLiveText, { color: config.color }]}>LIVE</Text>
          </View>
          <View style={[styles.groupTrackingStatusPill, { backgroundColor: config.glow }]}>
            <Ionicons name={config.icon} size={14} color={config.color} />
            <Text style={[styles.groupTrackingStatusText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        </View>

        <Text style={styles.groupTrackingMessage}>{config.message}</Text>

        <View style={styles.groupTrackingMetaRow}>
          <View style={styles.groupTrackingMetaCard}>
            <Text style={styles.groupTrackingMetaLabel}>ETA</Text>
            <Text style={[styles.groupTrackingMetaValue, { color: config.color }]}>
              {trackingStatus === 'on-the-way' && etaMinutes > 0
                ? `${etaMinutes} min`
                : trackingStatus === 'in-tour' && etaMinutes > 0
                  ? `${etaMinutes} min restantes`
                  : trackingStatus === 'arrived' || trackingStatus === 'completed'
                    ? 'Arrivé'
                    : '—'}
            </Text>
          </View>
          {assignedDriver && trackingStatus === 'on-the-way' ? (
            <View style={styles.groupTrackingMetaCard}>
              <Text style={styles.groupTrackingMetaLabel}>Chauffeur</Text>
              <Text style={styles.groupTrackingMetaValue}>{assignedDriver} en route</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.groupTrackingMap}>
          <View style={styles.groupTrackingMapGridLineHorizontal} />
          <View style={styles.groupTrackingMapGridLineVertical} />
          <View style={styles.groupTrackingMapRoute} />
          <View style={styles.groupTrackingMapDestination}>
            <Ionicons name="location" size={14} color={green} />
          </View>

          <Animated.View
            style={[
              styles.groupTrackingVehicleWrap,
              {
                left: config.mapLeft as `${number}%`,
                top: config.mapTop as `${number}%`,
                transform: [{ scale: vehicleScale }],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.groupTrackingVehiclePulse,
                { backgroundColor: config.color, opacity: vehicleGlow },
              ]}
            />
            <View style={[styles.groupTrackingVehicleDot, { backgroundColor: config.color }]}>
              <MaterialCommunityIcons name="van-passenger" size={16} color="#111" />
            </View>
          </Animated.View>
        </View>

        <Text style={styles.groupTrackingLocation}>{locationLabel}</Text>
        {updatedAtLabel ? (
          <Text style={styles.groupTrackingUpdatedAt}>
            Dernière position : {updatedAtLabel}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

function GroupChatSection({ groupId }: { groupId: string }) {
  const [messages, setMessages] = useState<TourGroupMessage[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const normalizedGroupId = groupId.trim();
    if (!normalizedGroupId) return undefined;

    const messagesQuery = query(
      getTourGroupMessagesCollectionRef(normalizedGroupId),
      orderBy('createdAt', 'asc'),
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const nextMessages = snapshot.docs.map((docSnap) =>
          normalizeTourGroupMessage(docSnap.id, docSnap.data() as Record<string, unknown>),
        );
        setMessages(nextMessages);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - tour-summary - GroupChatMessages]', error);
      },
    );

    return () => unsubscribe();
  }, [groupId]);

  useEffect(() => {
    if (messages.length === 0) return;
    chatScrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSendMessage = async () => {
    const trimmed = draftMessage.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      await sendTourGroupMessage(groupId, {
        senderType: 'participant',
        senderName: DEFAULT_PARTICIPANT_SENDER_NAME,
        text: trimmed,
      });
      setDraftMessage('');
    } catch (error) {
      devError('[PROMISE DENIED - tour-summary - sendGroupMessage]', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.section}>
      <SectionHeader title="Chat du groupe" />
      <View style={styles.groupChatCard}>
        <View style={styles.groupChatGlow} />

        <View style={styles.groupChatHeaderRow}>
          <View style={styles.groupChatLiveBadge}>
            <View style={styles.groupChatLiveDot} />
            <Text style={styles.groupChatLiveText}>CHAT LIVE</Text>
          </View>
          <Text style={styles.groupChatCount}>{messages.length} message{messages.length > 1 ? 's' : ''}</Text>
        </View>

        <ScrollView
          ref={chatScrollRef}
          style={styles.groupChatMessagesScroll}
          contentContainerStyle={styles.groupChatMessagesContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <Text style={styles.groupChatEmpty}>
              Aucun message pour le moment. Écrivez au groupe.
            </Text>
          ) : (
            messages.map((message) => {
              const isParticipant = message.senderType === 'participant';
              const isGuide = message.senderType === 'guide';

              return (
                <View
                  key={message.id}
                  style={[
                    styles.groupChatMessageRow,
                    isParticipant ? styles.groupChatMessageRowRight : styles.groupChatMessageRowLeft,
                  ]}
                >
                  <View
                    style={[
                      styles.groupChatBubble,
                      isParticipant
                        ? styles.groupChatBubbleParticipant
                        : isGuide
                          ? styles.groupChatBubbleGuide
                          : styles.groupChatBubbleAdmin,
                    ]}
                  >
                    {!isParticipant ? (
                      <View
                        style={[
                          styles.groupChatSenderBadge,
                          isGuide ? styles.groupChatSenderBadgeGuide : styles.groupChatSenderBadgeAdmin,
                        ]}
                      >
                        <Text
                          style={[
                            styles.groupChatSenderBadgeText,
                            isGuide
                              ? styles.groupChatSenderBadgeTextGuide
                              : styles.groupChatSenderBadgeTextAdmin,
                          ]}
                        >
                          {isGuide ? 'GUIDE' : 'ADMIN'}
                        </Text>
                      </View>
                    ) : null}

                    <Text
                      style={[
                        styles.groupChatSenderName,
                        isParticipant && styles.groupChatSenderNameParticipant,
                      ]}
                    >
                      {message.senderName}
                    </Text>
                    <Text
                      style={[
                        styles.groupChatMessageText,
                        isParticipant && styles.groupChatMessageTextParticipant,
                      ]}
                    >
                      {message.text}
                    </Text>
                    <Text
                      style={[
                        styles.groupChatMessageTime,
                        isParticipant && styles.groupChatMessageTimeParticipant,
                      ]}
                    >
                      {formatTourGroupMessageTime(message.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.groupChatInputRow}>
          <TextInput
            style={styles.groupChatInput}
            value={draftMessage}
            onChangeText={setDraftMessage}
            placeholder="Écrire au groupe..."
            placeholderTextColor="#666"
            multiline
            maxLength={280}
          />
          <TouchableOpacity
            style={[styles.groupChatSendBtn, isSending && styles.groupChatSendBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleSendMessage}
            disabled={isSending || !draftMessage.trim()}
          >
            <Ionicons name="send" size={18} color="#111" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function StarDisplay({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <View style={styles.reviewStarsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= Math.round(value) ? 'star' : star <= value ? 'star-half' : 'star-outline'}
          size={size}
          color={green}
        />
      ))}
    </View>
  );
}

function StarRatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.reviewRatingBlock}>
      <Text style={styles.reviewRatingLabel}>{label}</Text>
      <View style={styles.reviewStarsInputRow}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isActive = star <= value;

          return (
            <TouchableOpacity
              key={star}
              activeOpacity={0.85}
              onPress={() => onChange(star)}
              style={[styles.reviewStarButton, isActive && styles.reviewStarButtonActive]}
            >
              <Ionicons
                name={isActive ? 'star' : 'star-outline'}
                size={22}
                color={isActive ? green : '#666'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function GroupReviewSection({
  groupId,
  bookingId,
}: {
  groupId: string;
  bookingId: string;
}) {
  const [reviews, setReviews] = useState<TourGroupReview[]>([]);
  const [rating, setRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [guideRating, setGuideRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitGlowPulse, setSubmitGlowPulse] = useState(0);
  const cardGlow = useRef(new Animated.Value(0.14)).current;

  useEffect(() => {
    const normalizedGroupId = groupId.trim();
    if (!normalizedGroupId) return undefined;

    const reviewsQuery = query(
      getTourGroupReviewsCollectionRef(normalizedGroupId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      reviewsQuery,
      (snapshot) => {
        const nextReviews = snapshot.docs.map((docSnap) =>
          normalizeTourGroupReview(docSnap.id, docSnap.data() as Record<string, unknown>),
        );
        setReviews(nextReviews);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - tour-summary - GroupReviews]', error);
      },
    );

    return () => unsubscribe();
  }, [groupId]);

  useEffect(() => {
    if (submitGlowPulse === 0) return;

    cardGlow.setValue(0.14);
    Animated.sequence([
      Animated.timing(cardGlow, {
        toValue: 0.42,
        duration: 240,
        useNativeDriver: false,
      }),
      Animated.timing(cardGlow, {
        toValue: 0.14,
        duration: 420,
        useNativeDriver: false,
      }),
    ]).start();
  }, [cardGlow, submitGlowPulse]);

  const stats = useMemo(() => computeTourGroupReviewStats(reviews), [reviews]);
  const existingReview = bookingId ? findReviewByBookingId(reviews, bookingId) : null;
  const canSubmit =
    Boolean(bookingId) &&
    !existingReview &&
    rating > 0 &&
    driverRating > 0 &&
    guideRating > 0 &&
    !isSubmitting;

  const handleSubmitReview = async () => {
    if (!canSubmit || !bookingId) return;

    setIsSubmitting(true);
    try {
      await sendTourGroupReview(groupId, {
        bookingId,
        rating,
        driverRating,
        guideRating,
        comment,
        senderName: DEFAULT_PARTICIPANT_SENDER_NAME,
      });
      setSubmitGlowPulse((value) => value + 1);
      setComment('');
    } catch (error) {
      devError('[PROMISE DENIED - tour-summary - sendGroupReview]', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.section}>
      <SectionHeader title="Votre avis PROTAXI" />
      <Animated.View
        style={[
          styles.reviewCard,
          {
            shadowOpacity: cardGlow,
          },
        ]}
      >
        <View style={styles.reviewGlow} />

        <View style={styles.reviewTopRow}>
          <View style={styles.reviewCompletedBadge}>
            <Ionicons name="checkmark-done-circle" size={14} color={green} />
            <Text style={styles.reviewCompletedBadgeText}>Expérience terminée</Text>
          </View>
          <Text style={styles.reviewCount}>
            {stats.count} avis{stats.count > 1 ? '' : ''}
          </Text>
        </View>

        <View style={styles.reviewStatsRow}>
          <Text style={styles.reviewAverageValue}>{formatReviewAverage(stats.averageRating)}</Text>
          <View>
            <StarDisplay value={stats.averageRating} size={18} />
            <Text style={styles.reviewStatsHint}>Moyenne groupe</Text>
          </View>
        </View>

        {existingReview ? (
          <View style={styles.reviewSubmittedCard}>
            <Ionicons name="heart" size={18} color={green} />
            <Text style={styles.reviewSubmittedTitle}>Merci pour votre avis</Text>
            <Text style={styles.reviewSubmittedText}>
              Votre retour a bien été enregistré pour cette expérience groupe.
            </Text>
            <View style={styles.reviewSubmittedRatings}>
              <Text style={styles.reviewSubmittedRatingLabel}>
                Global {existingReview.rating}/5 • Chauffeur {existingReview.driverRating}/5 • Guide{' '}
                {existingReview.guideRating}/5
              </Text>
              {existingReview.comment ? (
                <Text style={styles.reviewSubmittedComment}>"{existingReview.comment}"</Text>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            <StarRatingInput label="Note globale" value={rating} onChange={setRating} />
            <StarRatingInput label="Note chauffeur" value={driverRating} onChange={setDriverRating} />
            <StarRatingInput label="Note guide" value={guideRating} onChange={setGuideRating} />

            <Text style={styles.reviewCommentLabel}>Commentaire</Text>
            <TextInput
              style={styles.reviewCommentInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Partagez votre expérience PROTAXI..."
              placeholderTextColor="#666"
              multiline
              maxLength={500}
            />

            {!bookingId ? (
              <Text style={styles.reviewWarning}>
                Identifiant de réservation manquant — avis indisponible.
              </Text>
            ) : null}

            <TouchableOpacity
              style={[styles.reviewSubmitBtn, !canSubmit && styles.reviewSubmitBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleSubmitReview}
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <Text style={styles.reviewSubmitBtnText}>Envoi…</Text>
              ) : (
                <>
                  <Ionicons name="star" size={18} color="#111" />
                  <Text style={styles.reviewSubmitBtnText}>Envoyer mon avis</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </View>
  );
}

function MemorySenderBadge({ senderType }: { senderType: TourGroupMemorySenderType }) {
  const isAdmin = senderType === 'admin';
  const isGuide = senderType === 'guide';

  return (
    <View
      style={[
        styles.memorySenderBadge,
        isAdmin && styles.memorySenderBadgeAdmin,
        isGuide && styles.memorySenderBadgeGuide,
      ]}
    >
      <Text
        style={[
          styles.memorySenderBadgeText,
          isAdmin && styles.memorySenderBadgeTextAdmin,
          isGuide && styles.memorySenderBadgeTextGuide,
        ]}
      >
        {getMemorySenderBadgeLabel(senderType)}
      </Text>
    </View>
  );
}

function MemoryGalleryCard({ memory }: { memory: TourGroupMemory }) {
  return (
    <View style={styles.memoryGalleryCard}>
      <Image source={{ uri: memory.imageUrl }} style={styles.memoryGalleryImage} contentFit="cover" />
      <LinearGradient
        colors={['rgba(5,5,5,0)', 'rgba(5,5,5,0.35)', 'rgba(5,5,5,0.92)']}
        style={styles.memoryGalleryOverlay}
      />
      {isOfficialGroupMemory(memory) ? (
        <View style={styles.memoryOfficialBadge}>
          <Text style={styles.memoryOfficialBadgeText}>PHOTO OFFICIELLE</Text>
        </View>
      ) : (
        <View style={styles.memoryGalleryBadgeWrap}>
          <MemorySenderBadge senderType={memory.senderType} />
        </View>
      )}
      <View style={styles.memoryGalleryContent}>
        <Text style={styles.memoryGalleryName} numberOfLines={1}>
          {memory.senderName}
        </Text>
        <Text style={styles.memoryGalleryCaption} numberOfLines={2}>
          {memory.caption || 'Souvenir PROTAXI'}
        </Text>
      </View>
    </View>
  );
}

function GroupMemoriesSection({ groupId }: { groupId: string }) {
  const [memories, setMemories] = useState<TourGroupMemory[]>([]);
  const [caption, setCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cardGlow = useRef(new Animated.Value(0.14)).current;

  useEffect(() => {
    const normalizedGroupId = groupId.trim();
    if (!normalizedGroupId) return undefined;

    const memoriesQuery = query(
      getTourGroupMemoriesCollectionRef(normalizedGroupId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      memoriesQuery,
      (snapshot) => {
        const nextMemories = snapshot.docs.map((docSnap) =>
          normalizeTourGroupMemory(docSnap.id, docSnap.data() as Record<string, unknown>),
        );
        setMemories(nextMemories);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - tour-summary - GroupMemories]', error);
      },
    );

    return () => unsubscribe();
  }, [groupId]);

  const latestMemories = useMemo(() => getLatestTourGroupMemories(memories, 12), [memories]);

  const handleAddMemory = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await sendTourGroupMemory(groupId, {
        imageUrl: getMockGroupMemoryImage(memories.length),
        senderName: DEFAULT_PARTICIPANT_SENDER_NAME,
        caption,
        senderType: 'participant',
      });
      setCaption('');

      cardGlow.setValue(0.14);
      Animated.sequence([
        Animated.timing(cardGlow, {
          toValue: 0.42,
          duration: 240,
          useNativeDriver: false,
        }),
        Animated.timing(cardGlow, {
          toValue: 0.14,
          duration: 420,
          useNativeDriver: false,
        }),
      ]).start();
    } catch (error) {
      devError('[PROMISE DENIED - tour-summary - sendGroupMemory]', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.section}>
      <SectionHeader title="Souvenirs du groupe" />
      <Animated.View style={[styles.memoriesCard, { shadowOpacity: cardGlow }]}>
        <View style={styles.memoriesGlow} />

        <View style={styles.memoriesHeaderRow}>
          <View style={styles.memoriesLiveBadge}>
            <Ionicons name="images-outline" size={14} color={green} />
            <Text style={styles.memoriesLiveText}>GALERIE LIVE</Text>
          </View>
          <Text style={styles.memoriesCount}>
            {memories.length} photo{memories.length > 1 ? 's' : ''}
          </Text>
        </View>

        {latestMemories.length === 0 ? (
          <View style={styles.memoriesEmptyCard}>
            <MaterialCommunityIcons name="camera-outline" size={28} color={green} />
            <Text style={styles.memoriesEmptyText}>
              Aucun souvenir pour l&apos;instant. Ajoutez la première photo du groupe.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.memoriesGalleryContent}
          >
            {latestMemories.map((memory) => (
              <MemoryGalleryCard key={memory.id} memory={memory} />
            ))}
          </ScrollView>
        )}

        <Text style={styles.memoriesCaptionLabel}>Légende (optionnelle)</Text>
        <TextInput
          style={styles.memoriesCaptionInput}
          value={caption}
          onChangeText={setCaption}
          placeholder="Un moment inoubliable à Guelma..."
          placeholderTextColor="#666"
          maxLength={120}
        />

        <TouchableOpacity
          style={[styles.memoriesAddBtn, isSubmitting && styles.memoriesAddBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleAddMemory}
          disabled={isSubmitting}
        >
          <Ionicons name="camera" size={18} color="#111" />
          <Text style={styles.memoriesAddBtnText}>
            {isSubmitting ? 'Ajout…' : 'Ajouter un souvenir'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function ExperienceWeatherSection({
  weather,
  trackingStatus,
}: {
  weather: TourWeather;
  trackingStatus: string;
}) {
  const isInTour = trackingStatus === 'in-tour';
  const glowOpacity = useRef(new Animated.Value(getTourWeatherGlowOpacity(trackingStatus))).current;
  const weatherIcon = weather.icon as keyof typeof Ionicons.glyphMap;

  useEffect(() => {
    if (!isInTour) {
      glowOpacity.setValue(getTourWeatherGlowOpacity(trackingStatus));
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.55,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.28,
          duration: 900,
          useNativeDriver: false,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [glowOpacity, isInTour, trackingStatus]);

  return (
    <View style={styles.section}>
      <SectionHeader title="Conditions de l'expérience" />
      <Animated.View
        style={[
          styles.weatherCard,
          {
            borderColor: weather.border,
            shadowColor: weather.color,
            shadowOpacity: glowOpacity,
          },
        ]}
      >
        <View style={[styles.weatherGlow, { backgroundColor: weather.glow }]} />

        <View style={styles.weatherHeaderRow}>
          <View style={[styles.weatherBadge, { backgroundColor: weather.glow, borderColor: weather.border }]}>
            <Ionicons name={weatherIcon} size={14} color={weather.color} />
            <Text style={[styles.weatherBadgeText, { color: weather.color }]}>{weather.badge}</Text>
          </View>
          <Text style={[styles.weatherTemperature, { color: weather.color }]}>
            {formatTourWeatherTemperature(weather.temperatureC)}
          </Text>
        </View>

        <Text style={styles.weatherConditionLabel}>{weather.conditionLabel}</Text>
        <Text style={styles.weatherRecommendation}>{weather.recommendation}</Text>

        {isInTour ? (
          <View style={styles.weatherLiveRow}>
            <Ionicons name="pulse-outline" size={14} color={green} />
            <Text style={styles.weatherLiveText}>Conditions live renforcées pendant le circuit</Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

function GroupPopularitySection({
  groupId,
  booked,
  capacity,
  remaining,
  trackingStatus,
}: {
  groupId: string;
  booked: number;
  capacity: number;
  remaining: number;
  trackingStatus: string;
}) {
  const [reviews, setReviews] = useState<TourAnalyticsReview[]>([]);

  useEffect(() => {
    const normalizedGroupId = groupId.trim();
    if (!normalizedGroupId) {
      setReviews([]);
      return undefined;
    }

    const reviewsQuery = query(
      getTourGroupReviewsCollectionRef(normalizedGroupId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribeReviews = onSnapshot(
      reviewsQuery,
      (snapshot) => {
        setReviews(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            groupId: normalizedGroupId,
            rating: Number(docSnap.data().rating || 0),
            guideRating: Number(docSnap.data().guideRating || 0),
            driverRating: Number(docSnap.data().driverRating || 0),
          })),
        );
      },
      (error) => {
        devError('[SNAPSHOT DENIED - tour-summary - GroupPopularityReviews]', error);
      },
    );

    return () => unsubscribeReviews();
  }, [groupId]);

  const groupPopularity = useMemo(
    () =>
      computeClientGroupPopularityAnalytics(
        {
          id: groupId,
          booked,
          capacity,
          trackingStatus,
        },
        reviews,
      ),
    [groupId, booked, capacity, trackingStatus, reviews],
  );

  const isBestSeller = groupPopularity.popularityLabel === 'BEST SELLER';
  const isTopGuideBadge = groupPopularity.popularityLabel === 'TOP Tendance';

  return (
    <View style={styles.section}>
      <SectionHeader title="Popularité & Classements" />
      <View style={styles.popularityCard}>
        <View style={styles.popularityGlow} />

        <View style={styles.popularityBadgeRow}>
          <View
            style={[
              styles.popularityBadge,
              isBestSeller && styles.popularityBadgeBestSeller,
              isTopGuideBadge && styles.popularityBadgeTopTrend,
            ]}
          >
            <Ionicons name="trophy-outline" size={13} color={isBestSeller ? '#111' : green} />
            <Text
              style={[
                styles.popularityBadgeText,
                isBestSeller && styles.popularityBadgeTextDark,
              ]}
            >
              {groupPopularity.popularityLabel}
            </Text>
          </View>
          <Text style={styles.popularityRankText}>#{groupPopularity.experienceRank} tendance</Text>
        </View>

        <View style={styles.popularityStatsRow}>
          <View style={styles.popularityStatCard}>
            <Text style={styles.popularityStatValue}>
              {formatAnalyticsRating(groupPopularity.averageRating)}/5
            </Text>
            <Text style={styles.popularityStatLabel}>Moyenne groupe</Text>
          </View>
          <View style={styles.popularityStatCard}>
            <Text style={styles.popularityStatValue}>{groupPopularity.reviewCount}</Text>
            <Text style={styles.popularityStatLabel}>Nombre d&apos;avis</Text>
          </View>
          <View style={styles.popularityStatCard}>
            <Text style={styles.popularityStatValue}>{groupPopularity.groupFillRate}%</Text>
            <Text style={styles.popularityStatLabel}>Remplissage groupe</Text>
          </View>
        </View>

        <View style={styles.popularityProgressTrack}>
          <View
            style={[
              styles.popularityProgressFill,
              { width: `${groupPopularity.groupFillRate}%` },
            ]}
          />
        </View>

        <Text style={styles.popularityParticipantsText}>
          {formatAnalyticsParticipants(groupPopularity.totalParticipants)} •{' '}
          {remaining} place{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''} •{' '}
          {groupPopularity.reviewCount} avis sur ce groupe
        </Text>
      </View>
    </View>
  );
}

function GroupPaymentSection({
  pricePerPerson,
  depositAmount,
  remainingAmount,
  paymentMethod,
  paymentStatus,
}: {
  pricePerPerson: string;
  depositAmount: number;
  remainingAmount: number;
  paymentMethod: TourPaymentMethod;
  paymentStatus: TourPaymentStatus;
}) {
  const statusConfig = getPaymentStatusConfig(paymentStatus);
  const progress = getPaymentProgress(paymentStatus);
  const totalAmount = depositAmount + remainingAmount;

  return (
    <View style={styles.section}>
      <SectionHeader title="Paiement" />
      <View
        style={[
          styles.paymentCard,
          {
            borderColor: statusConfig.border,
            shadowColor: statusConfig.color,
          },
        ]}
      >
        <View style={[styles.paymentGlow, { backgroundColor: statusConfig.glow }]} />

        <View style={styles.paymentHeaderRow}>
          <View style={[styles.paymentStatusBadge, { backgroundColor: statusConfig.glow, borderColor: statusConfig.border }]}>
            <MaterialCommunityIcons name="wallet-outline" size={14} color={statusConfig.color} />
            <Text style={[styles.paymentStatusBadgeText, { color: statusConfig.color }]}>
              {statusConfig.badge}
            </Text>
          </View>
          <Text style={[styles.paymentStatusLabel, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>

        <View style={styles.paymentProgressWrap}>
          <View style={styles.paymentProgressTrack}>
            <View
              style={[
                styles.paymentProgressFill,
                {
                  width: `${progress}%`,
                  backgroundColor: statusConfig.progressColor,
                },
              ]}
            />
          </View>
          <Text style={styles.paymentProgressText}>{Math.round(progress)}% réglé</Text>
        </View>

        <View style={styles.paymentAmountsGrid}>
          <View style={styles.paymentAmountCard}>
            <Text style={styles.paymentAmountLabel}>Prix / personne</Text>
            <Text style={styles.paymentAmountValue}>{pricePerPerson}</Text>
          </View>
          <View style={styles.paymentAmountCard}>
            <Text style={styles.paymentAmountLabel}>Acompte (30%)</Text>
            <Text style={[styles.paymentAmountValue, styles.paymentAmountDeposit]}>
              {formatTourPaymentAmount(depositAmount)}
            </Text>
          </View>
          <View style={styles.paymentAmountCard}>
            <Text style={styles.paymentAmountLabel}>Reste à payer</Text>
            <Text style={[styles.paymentAmountValue, styles.paymentAmountRemaining]}>
              {formatTourPaymentAmount(remainingAmount)}
            </Text>
          </View>
        </View>

        <View style={styles.paymentMetaCard}>
          <InfoRow icon="card-outline" label="Méthode" value={getPaymentMethodLabel(paymentMethod)} />
          <InfoRow icon="cash-outline" label="Total réservation" value={formatTourPaymentAmount(totalAmount)} />
          <InfoRow icon="pulse-outline" label="Statut paiement" value={statusConfig.label} />
        </View>
      </View>
    </View>
  );
}

function GroupTicketSection({
  ticketCode,
  checkInStatus,
  checkedInAt,
  bookingId,
  groupId,
  experience,
  date,
}: {
  ticketCode: string;
  checkInStatus: TourCheckInStatus;
  checkedInAt: unknown;
  bookingId: string;
  groupId: string;
  experience: string;
  date: string;
}) {
  const isCheckedIn = isTourBookingCheckedIn(checkInStatus);
  const qrValue = buildTourTicketQrValue(ticketCode, bookingId);
  const checkedInLabel = formatCheckedInAt(checkedInAt);

  return (
    <View style={styles.section}>
      <SectionHeader title="Votre ticket PROTAXI" />
      <View style={[styles.ticketCard, isCheckedIn && styles.ticketCardValidated]}>
        <View style={styles.ticketGlow} />
        <View style={styles.ticketGlowSecondary} />

        <View style={styles.ticketHeaderRow}>
          <View style={styles.ticketVipBadge}>
            <MaterialCommunityIcons name="ticket-confirmation-outline" size={14} color={green} />
            <Text style={styles.ticketVipBadgeText}>TICKET VIP GROUPE</Text>
          </View>
          {isCheckedIn ? (
            <View style={styles.ticketValidatedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#111" />
              <Text style={styles.ticketValidatedBadgeText}>VALIDÉ</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.ticketQrWrap}>
          <View style={styles.ticketQrGlow} />
          <View style={styles.ticketQrFrame}>
            <QRCode value={qrValue} size={168} backgroundColor="#FFFFFF" color="#050505" />
          </View>
        </View>

        <Text style={styles.ticketCodeLabel}>Code ticket</Text>
        <Text style={styles.ticketCodeValue}>{ticketCode}</Text>

        <View style={styles.ticketMetaCard}>
          <InfoRow icon="sparkles-outline" label="Expérience" value={experience} />
          <InfoRow icon="people-outline" label="Groupe" value={formatTourGroupNumber(groupId)} />
          <InfoRow icon="calendar-outline" label="Date" value={date} />
          <View style={styles.ticketCheckInRow}>
            <View style={styles.ticketCheckInIconWrap}>
              <Ionicons
                name={isCheckedIn ? 'checkmark-circle' : 'time-outline'}
                size={18}
                color={isCheckedIn ? green : '#F59E0B'}
              />
            </View>
            <View style={styles.ticketCheckInTextWrap}>
              <Text style={styles.ticketCheckInLabel}>Statut check-in</Text>
              <Text
                style={[
                  styles.ticketCheckInValue,
                  isCheckedIn && styles.ticketCheckInValueValidated,
                ]}
              >
                {isCheckedIn ? `✅ ${getCheckInStatusLabel(checkInStatus)}` : getCheckInStatusLabel(checkInStatus)}
              </Text>
              {checkedInLabel ? (
                <Text style={styles.ticketCheckInMeta}>Validé le {checkedInLabel}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>
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

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={18} color={green} />
      </View>
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ListCard({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return (
      <View style={styles.listCard}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.listCard}>
      {items.map((item, index) => (
        <View key={`${index}-${item}`} style={styles.listRow}>
          <View style={styles.listBullet} />
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function ChosenFormulaSection({
  bookingMode,
  groupDeparture,
  groupMeetingPoint,
  groupSpotsLeft,
  groupTravelers,
  pricePerPerson,
}: {
  bookingMode: BookingMode;
  groupDeparture: string;
  groupMeetingPoint: string;
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

  return (
    <View style={styles.section}>
      <SectionHeader title="Formule choisie" />
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

        {isGroup ? (
          <View style={styles.formulaDetails}>
            <View style={styles.formulaDetailRow}>
              <Ionicons name="time-outline" size={15} color={green} />
              <Text style={styles.formulaDetailText}>
                Départ collectif : {groupDeparture}
              </Text>
            </View>
            <View style={styles.formulaDetailRow}>
              <Ionicons name="location-outline" size={15} color={green} />
              <Text style={styles.formulaDetailText}>
                Rendez-vous collectif : {groupMeetingPoint}
              </Text>
            </View>
            <View style={styles.formulaDetailRow}>
              <Ionicons name="ticket-outline" size={15} color={green} />
              <Text style={styles.formulaDetailText}>{groupSpotsLeft} places restantes</Text>
            </View>
            <View style={styles.formulaDetailRow}>
              <Ionicons name="person-add-outline" size={15} color={green} />
              <Text style={styles.formulaDetailText}>
                +{groupTravelers} voyageurs inscrits
              </Text>
            </View>
            <View style={styles.formulaPriceRow}>
              <Text style={styles.formulaPriceLabel}>Prix / personne</Text>
              <Text style={styles.formulaPriceValue}>{pricePerPerson}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.formulaPerks}>
            {privatePerks.map((perk) => (
              <View key={perk} style={styles.formulaPerkRow}>
                <Ionicons name="checkmark-circle" size={13} color={green} />
                <Text style={styles.formulaPerkText}>{perk}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export default function TourSummaryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    experience?: string | string[];
    formula?: string | string[];
    duration?: string | string[];
    steps?: string | string[];
    options?: string | string[];
    travelers?: string | string[];
    date?: string | string[];
    meetingPoint?: string | string[];
    notes?: string | string[];
    price?: string | string[];
    circuitName?: string | string[];
    source?: string | string[];
    bookingMode?: string | string[];
    groupDeparture?: string | string[];
    groupSpotsLeft?: string | string[];
    groupTravelers?: string | string[];
    groupMeetingPoint?: string | string[];
    tourBookingId?: string | string[];
    groupId?: string | string[];
    groupBooked?: string | string[];
    groupRemaining?: string | string[];
  }>();

  const experience =
    normalizeParam(params.experience) ||
    normalizeParam(params.formula) ||
    normalizeParam(params.circuitName) ||
    'Expérience PROTAXI';
  const duration = normalizeParam(params.duration) || 'Flexible';
  const steps = parseList(normalizeParam(params.steps));
  const options = parseList(normalizeParam(params.options));
  const travelers = normalizeParam(params.travelers) || '2';
  const date = normalizeParam(params.date) || 'À confirmer';
  const meetingPoint = normalizeParam(params.meetingPoint) || 'Non renseigné';
  const notes = normalizeParam(params.notes) || 'Aucune note';
  const priceRaw = normalizeParam(params.price) || 'Sur devis';
  const source = normalizeParam(params.source) || 'discover-guelma';
  const bookingMode = normalizeBookingMode(params.bookingMode);
  const groupDeparture = normalizeParam(params.groupDeparture) || '17:00';
  const groupSpotsLeft = normalizeParam(params.groupSpotsLeft) || '3';
  const groupTravelers = normalizeParam(params.groupTravelers) || '6';
  const groupMeetingPoint =
    normalizeParam(params.groupMeetingPoint) || DEFAULT_GROUP_MEETING_POINT;
  const tourBookingId = normalizeParam(params.tourBookingId);
  const paramGroupId = normalizeParam(params.groupId);
  const fromDiscover = source === 'discover-guelma';

  const [liveStatus, setLiveStatus] = useState<TourBookingLiveStatus>('pending');
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<Date | null>(null);
  const [statusGlowPulse, setStatusGlowPulse] = useState(0);
  const [resolvedGroupId, setResolvedGroupId] = useState(paramGroupId);
  const [liveGroupBooked, setLiveGroupBooked] = useState(
    Number(normalizeParam(params.groupBooked)) || Number(groupTravelers) || 0,
  );
  const [liveGroupRemaining, setLiveGroupRemaining] = useState(
    Number(normalizeParam(params.groupRemaining)) || Number(groupSpotsLeft) || 0,
  );
  const [liveGroupCapacity, setLiveGroupCapacity] = useState(8);
  const [liveGroupStatus, setLiveGroupStatus] = useState<'open' | 'full'>('open');
  const [liveGroupParticipants, setLiveGroupParticipants] = useState<TourGroupParticipant[]>([]);
  const [liveGroupAssignment, setLiveGroupAssignment] = useState<TourGroupAssignment>({});
  const [liveGroupTracking, setLiveGroupTracking] = useState<TourGroupTracking>({});
  const [trackingStatusPulse, setTrackingStatusPulse] = useState(0);
  const [liveTicketCode, setLiveTicketCode] = useState('');
  const [liveCheckInStatus, setLiveCheckInStatus] = useState<TourCheckInStatus>('pending');
  const [liveCheckedInAt, setLiveCheckedInAt] = useState<unknown>(null);
  const [livePaymentStatus, setLivePaymentStatus] = useState<TourPaymentStatus>('unpaid');
  const [liveDepositAmount, setLiveDepositAmount] = useState(0);
  const [liveRemainingAmount, setLiveRemainingAmount] = useState(0);
  const [livePaymentMethod, setLivePaymentMethod] = useState<TourPaymentMethod>('cash');
  const [liveBookingPrice, setLiveBookingPrice] = useState('');
  const previousTrackingStatusRef = useRef('');
  const previousStatusRef = useRef<TourBookingLiveStatus | null>(null);
  const isFirstSnapshotRef = useRef(true);
  const notifiedTransitionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    configureNotificationHandler();
    void requestNotificationPermissions().catch((error) => {
      devError('[PROMISE DENIED - tour-summary - requestNotificationPermissions]', error);
    });
  }, []);

  useEffect(() => {
    if (!tourBookingId) return;

    isFirstSnapshotRef.current = true;
    previousStatusRef.current = null;

    const bookingRef = getTourBookingDocRef(tourBookingId);
    const unsubscribe = onSnapshot(
      bookingRef,
      (snapshot) => {
        if (!snapshot.exists()) return;

        const data = snapshot.data();
        const nextStatus = normalizeLiveStatus(data.status);

        if (isFirstSnapshotRef.current) {
          isFirstSnapshotRef.current = false;
          previousStatusRef.current = nextStatus;
        } else {
          const previousStatus = previousStatusRef.current ?? 'pending';

          if (previousStatus === 'pending' && nextStatus === 'confirmed') {
            const transitionKey = `${tourBookingId}:pending:confirmed`;
            if (!notifiedTransitionsRef.current.has(transitionKey)) {
              notifiedTransitionsRef.current.add(transitionKey);
              void sendTourBookingStatusNotification('confirmed').catch((error) => {
                devError('[PROMISE DENIED - tour-summary - notifyBookingConfirmed]', error);
              });
              setStatusGlowPulse((value) => value + 1);
            }
          }

          if (previousStatus === 'pending' && nextStatus === 'cancelled') {
            const transitionKey = `${tourBookingId}:pending:cancelled`;
            if (!notifiedTransitionsRef.current.has(transitionKey)) {
              notifiedTransitionsRef.current.add(transitionKey);
              void sendTourBookingStatusNotification('cancelled').catch((error) => {
                devError('[PROMISE DENIED - tour-summary - notifyBookingCancelled]', error);
              });
              setStatusGlowPulse((value) => value + 1);
            }
          }

          previousStatusRef.current = nextStatus;
        }

        setLiveStatus(nextStatus);

        if (data.groupId) {
          setResolvedGroupId(String(data.groupId));
        }

        setLiveTicketCode(String(data.ticketCode || ''));
        setLiveCheckInStatus(normalizeTourCheckInStatus(data.checkInStatus));
        setLiveCheckedInAt(data.checkedInAt ?? null);
        setLivePaymentStatus(normalizeTourPaymentStatus(data.paymentStatus));
        setLiveDepositAmount(Number(data.depositAmount || 0));
        setLiveRemainingAmount(Number(data.remainingAmount || 0));
        setLivePaymentMethod(normalizeTourPaymentMethod(data.paymentMethod));
        setLiveBookingPrice(String(data.price || ''));

        const updatedAt = data.updatedAt;
        if (updatedAt && typeof updatedAt === 'object' && 'toDate' in updatedAt) {
          setLiveUpdatedAt(updatedAt.toDate?.() ?? null);
        } else if (updatedAt instanceof Date) {
          setLiveUpdatedAt(updatedAt);
        } else if (typeof updatedAt === 'string' || typeof updatedAt === 'number') {
          setLiveUpdatedAt(new Date(updatedAt));
        } else {
          setLiveUpdatedAt(null);
        }
      },
      (error) => {
        devError('[SNAPSHOT DENIED - tour-summary - LiveBookingStatus]', error);
      },
    );

    return () => unsubscribe();
  }, [tourBookingId]);

  const isGroupMode = bookingMode === 'group';

  useEffect(() => {
    if (!resolvedGroupId || !isGroupMode) return;

    const groupRef = getTourGroupDocRef(resolvedGroupId);
    const unsubscribe = onSnapshot(
      groupRef,
      (snapshot) => {
        if (!snapshot.exists()) return;

        const data = snapshot.data();
        setLiveGroupBooked(Number(data.booked || 0));
        setLiveGroupRemaining(Number(data.remaining || 0));
        setLiveGroupCapacity(Number(data.capacity || 8));
        setLiveGroupStatus(data.status === 'full' ? 'full' : 'open');
        setLiveGroupParticipants(normalizeTourGroupParticipants(data.participants));
        setLiveGroupAssignment({
          assignedVehicle: String(data.assignedVehicle || ''),
          assignedDriver: String(data.assignedDriver || ''),
          assignedGuide: String(data.assignedGuide || ''),
          assignmentStatus: String(data.assignmentStatus || ''),
        });

        const nextTracking = normalizeTourGroupTracking(data);
        const nextTrackingStatus = normalizeTourGroupTrackingStatus(nextTracking.trackingStatus);
        if (
          previousTrackingStatusRef.current &&
          previousTrackingStatusRef.current !== nextTrackingStatus &&
          nextTrackingStatus
        ) {
          setTrackingStatusPulse((value) => value + 1);
        }
        if (nextTrackingStatus) {
          previousTrackingStatusRef.current = nextTrackingStatus;
        }
        setLiveGroupTracking(nextTracking);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - tour-summary - LiveGroupMatching]', error);
      },
    );

    return () => unsubscribe();
  }, [resolvedGroupId, isGroupMode]);

  const displayPrice = formatDisplayPrice(priceRaw);
  const priceSectionTitle = isGroupMode ? 'Prix / personne' : 'Prix estimé';
  const displayMeetingPoint = isGroupMode ? groupMeetingPoint : meetingPoint;
  const liveStatusConfig = useMemo(() => getLiveStatusConfig(liveStatus), [liveStatus]);
  const heroStatusConfig = tourBookingId
    ? liveStatusConfig
    : getLiveStatusConfig('pending');
  const showGroupTeam = isGroupMode && hasTourGroupAssignment(liveGroupAssignment);
  const showGroupTracking = isGroupMode && hasTourGroupTracking(liveGroupTracking);
  const isExperienceCompleted =
    normalizeTourGroupTrackingStatus(liveGroupTracking.trackingStatus) === 'completed';
  const showGroupReview = isGroupMode && Boolean(resolvedGroupId) && isExperienceCompleted;
  const showGroupMemories = showGroupReview;
  const showGroupTicket =
    isGroupMode && Boolean(tourBookingId) && Boolean(liveTicketCode || resolvedGroupId);
  const showGroupPayment =
    isGroupMode &&
    Boolean(tourBookingId) &&
    (liveDepositAmount > 0 || liveRemainingAmount > 0 || livePaymentStatus !== 'unpaid');
  const liveTrackingStatus = normalizeTourGroupTrackingStatus(liveGroupTracking.trackingStatus) || '';
  const experienceWeather = useMemo(
    () =>
      generateTourWeather({
        departure: groupDeparture,
        trackingStatus: liveTrackingStatus,
        experience,
      }),
    [groupDeparture, liveTrackingStatus, experience],
  );
  const showGroupWeather = isGroupMode;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['rgba(139,197,63,0.06)', 'rgba(5,5,5,0)']}
        style={styles.topGlow}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.heroWrap}>
          <LinearGradient
            colors={['rgba(139,197,63,0.12)', 'rgba(5,5,5,0.95)', '#050505']}
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
              <MaterialCommunityIcons name="check-decagram" size={15} color={green} />
              <Text style={styles.heroTopTitle}>RÉSUMÉ TOURISME</Text>
            </View>
            <View style={styles.heroBackPlaceholder} />
          </View>

          <View style={styles.heroContent}>
            {fromDiscover ? (
              <View style={styles.discoverBadge}>
                <Ionicons name="compass-outline" size={12} color={green} />
                <Text style={styles.discoverBadgeText}>Depuis Découvrir Guelma</Text>
              </View>
            ) : null}

            <Text style={styles.heroTitle}>{experience}</Text>
            <Text style={styles.heroSubtitle}>Votre demande a été enregistrée</Text>

            <View
              style={[
                styles.statusCard,
                tourBookingId && {
                  borderColor: heroStatusConfig.border,
                  shadowColor: heroStatusConfig.color,
                },
              ]}
            >
              <View
                style={[
                  styles.statusIconWrap,
                  tourBookingId && {
                    backgroundColor: heroStatusConfig.glow,
                    borderColor: heroStatusConfig.border,
                  },
                ]}
              >
                <Ionicons
                  name={heroStatusConfig.icon}
                  size={24}
                  color={heroStatusConfig.color}
                />
              </View>
              <View style={styles.statusTextWrap}>
                <Text style={[styles.statusTitle, { color: heroStatusConfig.color }]}>
                  {heroStatusConfig.title}
                </Text>
                <Text style={styles.statusText}>{heroStatusConfig.message}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {tourBookingId ? (
            <LiveBookingStatusCard
              status={liveStatus}
              updatedAt={liveUpdatedAt}
              glowPulse={statusGlowPulse}
            />
          ) : null}

          {isGroupMode && resolvedGroupId ? (
            <LiveGroupMatchingCard
              groupId={resolvedGroupId}
              booked={liveGroupBooked}
              remaining={liveGroupRemaining}
              capacity={liveGroupCapacity}
              status={liveGroupStatus}
              participants={liveGroupParticipants}
              currentBookingId={tourBookingId}
            />
          ) : null}

          {isGroupMode && resolvedGroupId ? (
            <GroupPopularitySection
              groupId={resolvedGroupId}
              booked={liveGroupBooked}
              capacity={liveGroupCapacity}
              remaining={liveGroupRemaining}
              trackingStatus={liveTrackingStatus}
            />
          ) : null}

          {showGroupTicket && tourBookingId && resolvedGroupId && liveTicketCode ? (
            <GroupTicketSection
              ticketCode={liveTicketCode}
              checkInStatus={liveCheckInStatus}
              checkedInAt={liveCheckedInAt}
              bookingId={tourBookingId}
              groupId={resolvedGroupId}
              experience={experience}
              date={date}
            />
          ) : null}

          {showGroupPayment ? (
            <GroupPaymentSection
              pricePerPerson={formatDisplayPrice(liveBookingPrice || priceRaw)}
              depositAmount={liveDepositAmount}
              remainingAmount={liveRemainingAmount}
              paymentMethod={livePaymentMethod}
              paymentStatus={livePaymentStatus}
            />
          ) : null}

          {showGroupTeam ? <LiveGroupTeamCard assignment={liveGroupAssignment} /> : null}

          {showGroupTracking ? (
            <LiveGroupTrackingCard
              tracking={liveGroupTracking}
              assignedDriver={liveGroupAssignment.assignedDriver || ''}
              statusPulse={trackingStatusPulse}
            />
          ) : null}

          {showGroupWeather ? (
            <ExperienceWeatherSection
              weather={experienceWeather}
              trackingStatus={liveTrackingStatus}
            />
          ) : null}

          {isGroupMode && resolvedGroupId ? (
            <GroupChatSection groupId={resolvedGroupId} />
          ) : null}

          {showGroupReview && resolvedGroupId ? (
            <GroupReviewSection groupId={resolvedGroupId} bookingId={tourBookingId} />
          ) : null}

          {showGroupMemories && resolvedGroupId ? (
            <GroupMemoriesSection groupId={resolvedGroupId} />
          ) : null}

          <ChosenFormulaSection
            bookingMode={bookingMode}
            groupDeparture={groupDeparture}
            groupMeetingPoint={groupMeetingPoint}
            groupSpotsLeft={String(liveGroupRemaining || groupSpotsLeft)}
            groupTravelers={String(liveGroupBooked || groupTravelers)}
            pricePerPerson={displayPrice}
          />

          <View style={styles.section}>
            <SectionHeader title="Expérience" />
            <View style={styles.summaryCard}>
              <InfoRow icon="sparkles-outline" label="Expérience" value={experience} />
              <InfoRow icon="time-outline" label="Durée" value={duration} />
              <InfoRow icon="calendar-outline" label="Date" value={date} />
              <InfoRow icon="people-outline" label="Voyageurs" value={`${travelers} personne${Number(travelers) > 1 ? 's' : ''}`} />
              <InfoRow icon="location-outline" label="Point de rendez-vous" value={displayMeetingPoint} />
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Étapes du circuit" />
            <ListCard items={steps} emptyLabel="Étapes à confirmer avec PROTAXI" />
          </View>

          <View style={styles.section}>
            <SectionHeader title="Options premium" />
            <ListCard
              items={options}
              emptyLabel="Aucune option supplémentaire sélectionnée"
            />
          </View>

          {notes !== 'Aucune note' ? (
            <View style={styles.section}>
              <SectionHeader title="Notes" />
              <View style={styles.notesCard}>
                <Text style={styles.notesText}>{notes}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader title={priceSectionTitle} />
            <View style={styles.priceCard}>
              <Text style={styles.priceValue}>{displayPrice}</Text>
              <Text style={styles.priceHint}>
                {isGroupMode
                  ? 'Tarif groupe confirmé par PROTAXI avant le départ collectif.'
                  : 'Le tarif final sera confirmé avant le départ de votre expérience touristique.'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Prochaines étapes PROTAXI" />
            <View style={styles.stepsCard}>
              <StepItem number="1" label="Demande enregistrée" active />
              <StepItem number="2" label="Confirmation PROTAXI" />
              <StepItem number="3" label="Expérience confirmée" />
            </View>
          </View>

          <TouchableOpacity
            style={styles.homeCta}
            activeOpacity={0.85}
            onPress={() => router.replace(PROTAXI_ROUTES.home)}
          >
            <Text style={styles.homeCtaText}>Retour à l'accueil</Text>
            <Ionicons name="home-outline" size={18} color="#111" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function StepItem({
  number,
  label,
  active = false,
}: {
  number: string;
  label: string;
  active?: boolean;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepNumber, active && styles.stepNumberActive]}>
        <Text style={[styles.stepNumberText, active && styles.stepNumberTextActive]}>
          {number}
        </Text>
      </View>
      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
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
    paddingBottom: 32,
  },
  heroWrap: {
    minHeight: HERO_HEIGHT,
    overflow: 'hidden',
    backgroundColor: card,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,197,63,0.12)',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBadgeGlow: {
    position: 'absolute',
    top: 30,
    left: '50%',
    marginLeft: -90,
    width: 180,
    height: 90,
    borderRadius: 90,
    backgroundColor: glow,
    opacity: 0.35,
  },
  heroTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 2,
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
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    zIndex: 2,
  },
  discoverBadge: {
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
    marginBottom: 12,
  },
  discoverBadgeText: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  heroSubtitle: {
    color: muted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginTop: 18,
    backgroundColor: card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    padding: 16,
    ...premiumGlow,
  },
  statusIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTextWrap: {
    flex: 1,
  },
  statusTitle: {
    color: green,
    fontSize: 15,
    fontWeight: '900',
  },
  statusText: {
    color: muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 19,
  },
  liveStatusCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  liveStatusGlow: {
    position: 'absolute',
    top: -36,
    right: -24,
    width: 120,
    height: 120,
    borderRadius: 999,
  },
  liveStatusTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  liveStatusEmoji: {
    fontSize: 22,
  },
  liveStatusContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  liveStatusIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveStatusTextWrap: {
    flex: 1,
  },
  liveStatusTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  liveStatusMessage: {
    color: muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 19,
  },
  liveStatusUpdatedAt: {
    color: '#6F6F6F',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  groupLiveCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    padding: 18,
    overflow: 'hidden',
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 10,
  },
  groupLiveCardFull: {
    borderColor: 'rgba(245,158,11,0.28)',
    shadowColor: '#F59E0B',
  },
  groupLiveGlow: {
    position: 'absolute',
    top: -36,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: glow,
  },
  groupLiveTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  groupLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  groupLiveBadgeText: {
    color: green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  groupLiveStatusPill: {
    backgroundColor: 'rgba(139,197,63,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  groupLiveStatusPillFull: {
    backgroundColor: 'rgba(245,158,11,0.14)',
  },
  groupLiveStatusText: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  groupLiveStatusTextFull: {
    color: '#F59E0B',
  },
  groupLiveNumber: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  groupLiveSubtitle: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 16,
  },
  groupLiveStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    paddingVertical: 14,
  },
  groupLiveStatCard: {
    flex: 1,
    alignItems: 'center',
  },
  groupLiveStatValue: {
    color: green,
    fontSize: 22,
    fontWeight: '900',
  },
  groupLiveStatLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  groupLiveStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(139,197,63,0.12)',
  },
  groupRegisteredBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  groupRegisteredBadgeText: {
    color: green,
    fontSize: 12,
    fontWeight: '900',
  },
  groupParticipantsSection: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,197,63,0.12)',
  },
  groupParticipantsTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 12,
  },
  groupParticipantsEmpty: {
    color: muted,
    fontSize: 13,
    fontWeight: '600',
  },
  groupParticipantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  groupParticipantRowCurrent: {
    borderColor: 'rgba(139,197,63,0.32)',
    backgroundColor: 'rgba(139,197,63,0.08)',
  },
  groupParticipantAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: glow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupParticipantTextWrap: {
    flex: 1,
  },
  groupParticipantName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  groupParticipantMeta: {
    color: muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  groupParticipantStatusPill: {
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  groupParticipantStatusText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '900',
  },
  groupTeamCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    padding: 18,
    overflow: 'hidden',
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 10,
  },
  groupTeamGlow: {
    position: 'absolute',
    top: -30,
    right: -18,
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: glow,
  },
  groupTeamConfirmedBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  groupTeamConfirmedText: {
    color: green,
    fontSize: 12,
    fontWeight: '900',
  },
  groupTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,197,63,0.1)',
  },
  groupTeamIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupTeamTextWrap: {
    flex: 1,
  },
  groupTeamLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
  },
  groupTeamValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 3,
  },
  groupTrackingCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 10,
  },
  groupTrackingGlow: {
    position: 'absolute',
    top: -36,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 999,
  },
  groupTrackingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupTrackingLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  groupTrackingLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  groupTrackingLiveText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  groupTrackingStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  groupTrackingStatusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  groupTrackingMessage: {
    color: muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginBottom: 14,
  },
  groupTrackingMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  groupTrackingMetaCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groupTrackingMetaLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
  },
  groupTrackingMetaValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  groupTrackingMap: {
    height: 180,
    borderRadius: 20,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.16)',
    overflow: 'hidden',
    marginBottom: 12,
  },
  groupTrackingMapGridLineHorizontal: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(139,197,63,0.08)',
  },
  groupTrackingMapGridLineVertical: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(139,197,63,0.08)',
  },
  groupTrackingMapRoute: {
    position: 'absolute',
    left: '18%',
    top: '62%',
    width: '58%',
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(139,197,63,0.35)',
    transform: [{ rotate: '-18deg' }],
  },
  groupTrackingMapDestination: {
    position: 'absolute',
    right: '16%',
    top: '28%',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: glow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupTrackingVehicleWrap: {
    position: 'absolute',
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupTrackingVehiclePulse: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  groupTrackingVehicleDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111',
  },
  groupTrackingLocation: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  groupTrackingUpdatedAt: {
    color: '#6F6F6F',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  groupChatCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    padding: 16,
    overflow: 'hidden',
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  groupChatGlow: {
    position: 'absolute',
    top: -30,
    left: -16,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: glow,
  },
  groupChatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupChatLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  groupChatLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: green,
  },
  groupChatLiveText: {
    color: green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  groupChatCount: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
  },
  groupChatMessagesScroll: {
    maxHeight: 220,
    marginBottom: 12,
  },
  groupChatMessagesContent: {
    gap: 10,
    paddingBottom: 4,
  },
  groupChatEmpty: {
    color: muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 24,
  },
  groupChatMessageRow: {
    flexDirection: 'row',
  },
  groupChatMessageRowLeft: {
    justifyContent: 'flex-start',
  },
  groupChatMessageRowRight: {
    justifyContent: 'flex-end',
  },
  groupChatBubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  groupChatBubbleParticipant: {
    backgroundColor: green,
    borderColor: 'rgba(139,197,63,0.45)',
  },
  groupChatBubbleGuide: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderColor: 'rgba(167,139,250,0.28)',
  },
  groupChatBubbleAdmin: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.28)',
  },
  groupChatSenderBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  groupChatSenderBadgeGuide: {
    backgroundColor: 'rgba(167,139,250,0.18)',
  },
  groupChatSenderBadgeAdmin: {
    backgroundColor: 'rgba(245,158,11,0.18)',
  },
  groupChatSenderBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  groupChatSenderBadgeTextGuide: {
    color: '#A78BFA',
  },
  groupChatSenderBadgeTextAdmin: {
    color: '#F59E0B',
  },
  groupChatSenderName: {
    color: '#EDEDED',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  groupChatSenderNameParticipant: {
    color: '#1F2A10',
  },
  groupChatMessageText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  groupChatMessageTextParticipant: {
    color: '#111',
    fontWeight: '700',
  },
  groupChatMessageTime: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  groupChatMessageTimeParticipant: {
    color: 'rgba(17,17,17,0.55)',
  },
  groupChatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  groupChatInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 96,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.18)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  groupChatSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: green,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 6,
  },
  groupChatSendBtnDisabled: {
    opacity: 0.55,
  },
  reviewCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    padding: 18,
    overflow: 'hidden',
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 10,
  },
  reviewGlow: {
    position: 'absolute',
    top: -36,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: glow,
  },
  reviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewCompletedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reviewCompletedBadgeText: {
    color: green,
    fontSize: 12,
    fontWeight: '900',
  },
  reviewCount: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,197,63,0.12)',
  },
  reviewAverageValue: {
    color: '#FFF',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 46,
  },
  reviewStatsHint: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  reviewRatingBlock: {
    marginBottom: 14,
  },
  reviewRatingLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  reviewStarsInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewStarButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewStarButtonActive: {
    backgroundColor: glow,
    borderColor: 'rgba(139,197,63,0.35)',
    shadowColor: green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  reviewCommentLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 4,
  },
  reviewCommentInput: {
    minHeight: 96,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.18)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 14,
  },
  reviewWarning: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  reviewSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: green,
    borderRadius: 16,
    paddingVertical: 14,
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  reviewSubmitBtnDisabled: {
    opacity: 0.55,
  },
  reviewSubmitBtnText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },
  reviewSubmittedCard: {
    backgroundColor: 'rgba(139,197,63,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
  },
  reviewSubmittedTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 8,
  },
  reviewSubmittedText: {
    color: muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  reviewSubmittedRatings: {
    marginTop: 12,
    width: '100%',
  },
  reviewSubmittedRatingLabel: {
    color: green,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  reviewSubmittedComment: {
    color: '#D4D4D4',
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },
  memoriesCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    padding: 16,
    overflow: 'hidden',
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 10,
  },
  memoriesGlow: {
    position: 'absolute',
    top: -36,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: glow,
  },
  memoriesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  memoriesLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  memoriesLiveText: {
    color: green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  memoriesCount: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
  },
  memoriesEmptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    marginBottom: 14,
    gap: 10,
  },
  memoriesEmptyText: {
    color: muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },
  memoriesGalleryContent: {
    gap: 12,
    paddingBottom: 14,
  },
  memoryGalleryCard: {
    width: 220,
    height: 280,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.18)',
  },
  memoryGalleryImage: {
    width: '100%',
    height: '100%',
  },
  memoryGalleryOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  memoryGalleryBadgeWrap: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  memoryOfficialBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(245,158,11,0.92)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  memoryOfficialBadgeText: {
    color: '#111',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  memorySenderBadge: {
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  memorySenderBadgeAdmin: {
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderColor: 'rgba(245,158,11,0.35)',
  },
  memorySenderBadgeGuide: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderColor: 'rgba(167,139,250,0.35)',
  },
  memorySenderBadgeText: {
    color: green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  memorySenderBadgeTextAdmin: {
    color: '#F59E0B',
  },
  memorySenderBadgeTextGuide: {
    color: '#A78BFA',
  },
  memoryGalleryContent: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  memoryGalleryName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },
  memoryGalleryCaption: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 17,
  },
  memoriesCaptionLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  memoriesCaptionInput: {
    minHeight: 44,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.18)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  memoriesAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: green,
    borderRadius: 16,
    paddingVertical: 14,
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  memoriesAddBtnDisabled: {
    opacity: 0.55,
  },
  memoriesAddBtnText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },
  ticketCard: {
    backgroundColor: card,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    padding: 18,
    overflow: 'hidden',
    shadowColor: green,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 12,
  },
  ticketCardValidated: {
    borderColor: 'rgba(139,197,63,0.55)',
    shadowOpacity: 0.34,
  },
  ticketGlow: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: glow,
  },
  ticketGlowSecondary: {
    position: 'absolute',
    bottom: -50,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: 'rgba(139,197,63,0.08)',
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ticketVipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ticketVipBadgeText: {
    color: green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  ticketValidatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: green,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ticketValidatedBadgeText: {
    color: '#111',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  ticketQrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  ticketQrGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(139,197,63,0.16)',
  },
  ticketQrFrame: {
    backgroundColor: '#FFF',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
  ticketCodeLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  ticketCodeValue: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1.2,
    marginTop: 4,
    marginBottom: 14,
  },
  ticketMetaCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ticketCheckInRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,197,63,0.1)',
    marginTop: 4,
  },
  ticketCheckInIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: glow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.2)',
  },
  ticketCheckInTextWrap: {
    flex: 1,
  },
  ticketCheckInLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
  },
  ticketCheckInValue: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  ticketCheckInValueValidated: {
    color: green,
  },
  ticketCheckInMeta: {
    color: muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  paymentCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    padding: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 10,
  },
  paymentGlow: {
    position: 'absolute',
    top: -36,
    right: -24,
    width: 120,
    height: 120,
    borderRadius: 999,
  },
  paymentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  paymentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  paymentStatusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  paymentStatusLabel: {
    fontSize: 12,
    fontWeight: '900',
  },
  paymentProgressWrap: {
    marginBottom: 14,
  },
  paymentProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  paymentProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  paymentProgressText: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'right',
  },
  paymentAmountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  paymentAmountCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  paymentAmountLabel: {
    color: muted,
    fontSize: 10,
    fontWeight: '700',
  },
  paymentAmountValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },
  paymentAmountDeposit: {
    color: '#F59E0B',
  },
  paymentAmountRemaining: {
    color: green,
  },
  paymentMetaCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  weatherCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    padding: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 10,
  },
  weatherGlow: {
    position: 'absolute',
    top: -36,
    right: -24,
    width: 120,
    height: 120,
    borderRadius: 999,
  },
  weatherHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  weatherBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  weatherBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    flexShrink: 1,
  },
  weatherTemperature: {
    fontSize: 28,
    fontWeight: '900',
  },
  weatherConditionLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  weatherRecommendation: {
    color: muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  weatherLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,197,63,0.12)',
  },
  weatherLiveText: {
    color: green,
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },

  popularityCard: {
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    padding: 18,
    overflow: 'hidden',
    shadowColor: green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
  },
  popularityGlow: {
    position: 'absolute',
    top: -24,
    right: -18,
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: glow,
  },
  popularityBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  popularityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.24)',
  },
  popularityBadgeBestSeller: {
    backgroundColor: green,
    borderColor: green,
  },
  popularityBadgeTopTrend: {
    backgroundColor: 'rgba(139,197,63,0.24)',
  },
  popularityBadgeText: {
    color: green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  popularityBadgeTextDark: {
    color: '#111',
  },
  popularityRankText: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
  },
  popularityStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  popularityStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.12)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  popularityStatValue: {
    color: green,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  popularityStatLabel: {
    color: muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  popularityProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  popularityProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: green,
  },
  popularityParticipantsText: {
    color: muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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

  formulaDetails: {
    gap: 10,
  },

  formulaDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  formulaDetailText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },

  formulaPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,197,63,0.15)',
  },

  formulaPriceLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
  },

  formulaPriceValue: {
    color: green,
    fontSize: 18,
    fontWeight: '900',
  },

  summaryCard: {
    backgroundColor: card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    gap: 14,
    ...premiumGlow,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: glow,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
    lineHeight: 20,
  },
  listCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    gap: 10,
    ...premiumGlow,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  listBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: green,
    marginTop: 6,
  },
  listText: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  emptyText: {
    color: muted,
    fontSize: 13,
    fontWeight: '600',
  },
  notesCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    ...premiumGlow,
  },
  notesText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  priceCard: {
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    padding: 22,
    ...premiumGlow,
  },
  priceValue: {
    color: green,
    fontSize: 32,
    fontWeight: '900',
  },
  priceHint: {
    color: muted,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  stepsCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    gap: 12,
    ...premiumGlow,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberActive: {
    backgroundColor: green,
    borderColor: green,
  },
  stepNumberText: {
    color: muted,
    fontSize: 12,
    fontWeight: '900',
  },
  stepNumberTextActive: {
    color: '#111',
  },
  stepLabel: {
    color: muted,
    fontSize: 14,
    fontWeight: '700',
  },
  stepLabelActive: {
    color: '#FFF',
  },
  homeCta: {
    height: 56,
    borderRadius: 999,
    backgroundColor: green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
    shadowColor: green,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 22,
    elevation: 16,
  },
  homeCtaText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },
});
