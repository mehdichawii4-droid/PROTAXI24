import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  hasRideRating,
  RideRatingError,
  sendRideRating,
  type RideRatingRole,
} from '@/services/rideRating';
import { devError } from '@/utils/devLog';

const gold = '#D4A017';
const green = '#2ECC71';
const bg = '#050505';
const card = '#101010';
const border = '#262626';
const muted = '#8A8A8A';

export type RideRatingSheetProps = {
  visible: boolean;
  onClose: () => void;
  onLater?: () => void;
  onSubmitted?: () => void;
  rideId: string;
  fromUserId: string;
  fromRole: RideRatingRole;
  toUserId: string;
  toRole: RideRatingRole;
  peerLabel: string;
  peerSubtitle?: string;
  toUserName?: string;
  /** Pre-filled when already rated (legacy or V2). */
  existingStars?: number | null;
  existingComment?: string;
};

export default function RideRatingSheet({
  visible,
  onClose,
  onLater,
  onSubmitted,
  rideId,
  fromUserId,
  fromRole,
  toUserId,
  toRole,
  peerLabel,
  peerSubtitle,
  toUserName,
  existingStars = null,
  existingComment = '',
}: RideRatingSheetProps) {
  const insets = useSafeAreaInsets();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(existingStars != null && existingStars >= 1);
  const [savedStars, setSavedStars] = useState<number | null>(existingStars);
  const [savedComment, setSavedComment] = useState(existingComment);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const title =
    fromRole === 'client' ? 'Noter votre chauffeur' : 'Noter le client';
  const subtitle =
    peerSubtitle
    ?? (fromRole === 'client'
      ? 'Votre avis améliore la qualité du service PROTAXI.'
      : 'Note interne pour cette course terminée.');

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (existingStars != null && existingStars >= 1) {
      setAlreadyRated(true);
      setSavedStars(existingStars);
      setSavedComment(existingComment);
      return;
    }

    setAlreadyRated(false);
    setStars(5);
    setComment('');
    setErrorMessage(null);

    if (!rideId.trim() || !fromUserId.trim()) {
      return;
    }

    setIsChecking(true);
    void hasRideRating(rideId, fromRole, fromUserId)
      .then((exists) => {
        if (!exists) return;
        setAlreadyRated(true);
      })
      .finally(() => {
        setIsChecking(false);
      });
  }, [
    visible,
    rideId,
    fromUserId,
    fromRole,
    existingStars,
    existingComment,
  ]);

  const handleSubmit = async () => {
    if (isSubmitting || alreadyRated) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    Keyboard.dismiss();

    try {
      await sendRideRating(rideId, {
        fromUserId,
        fromRole,
        toUserId,
        toRole,
        stars,
        comment: comment.trim(),
        toUserName,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAlreadyRated(true);
      setSavedStars(stars);
      setSavedComment(comment.trim());
      onSubmitted?.();
      onClose();
    } catch (error) {
      const message =
        error instanceof RideRatingError
          ? error.message
          : 'Impossible d\'envoyer votre avis.';
      setErrorMessage(message);
      devError('[RIDE RATING UI] submit failed', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLater = () => {
    onLater?.();
    onClose();
  };

  const displayStars = alreadyRated ? savedStars ?? 0 : stars;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleLater}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleLater} />

        <KeyboardAvoidingView
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.liveBadge}>
              <Ionicons name="star" size={14} color={gold} />
              <Text style={styles.liveText}>AVIS COURSE</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleLater} activeOpacity={0.85}>
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.peerName}>{peerLabel}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {isChecking ? (
            <ActivityIndicator color={gold} style={{ marginTop: 28 }} />
          ) : (
            <>
              <View style={styles.avatar}>
                <Ionicons
                  name={fromRole === 'client' ? 'car-sport' : 'person'}
                  size={40}
                  color="#111"
                />
              </View>

              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <TouchableOpacity
                    key={value}
                    disabled={alreadyRated || isSubmitting}
                    onPress={async () => {
                      setStars(value);
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={value <= displayStars ? 'star' : 'star-outline'}
                      size={40}
                      color={value <= displayStars ? gold : '#555'}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.starsLabel}>{displayStars}/5</Text>

              {alreadyRated ? (
                <>
                  <View style={styles.doneBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={green} />
                    <Text style={styles.doneText}>Merci, avis enregistré</Text>
                  </View>
                  {savedComment ? (
                    <Text style={styles.savedComment}>"{savedComment}"</Text>
                  ) : null}
                  <TouchableOpacity style={styles.primaryBtn} onPress={onClose} activeOpacity={0.85}>
                    <Text style={styles.primaryBtnText}>Fermer</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Commentaire optionnel…"
                    placeholderTextColor={muted}
                    value={comment}
                    onChangeText={setComment}
                    multiline
                    editable={!isSubmitting}
                    maxLength={1000}
                  />

                  {errorMessage ? (
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
                    onPress={() => void handleSubmit()}
                    disabled={isSubmitting}
                    activeOpacity={0.85}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#111" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={22} color="#111" />
                        <Text style={styles.primaryBtnText}>Envoyer l&apos;avis</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.laterBtn}
                    onPress={handleLater}
                    disabled={isSubmitting}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.laterBtnText}>Plus tard</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#333',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveText: {
    color: gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  peerName: {
    color: green,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  subtitle: {
    color: muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 8,
  },
  avatar: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    alignSelf: 'center',
  },
  starsLabel: {
    color: gold,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 10,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    alignSelf: 'center',
  },
  doneText: {
    color: green,
    fontSize: 16,
    fontWeight: '800',
  },
  savedComment: {
    color: '#DDD',
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  input: {
    minHeight: 96,
    borderRadius: 16,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    color: '#FFF',
    padding: 14,
    marginTop: 18,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: gold,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },
  laterBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  laterBtnText: {
    color: muted,
    fontSize: 15,
    fontWeight: '700',
  },
});
