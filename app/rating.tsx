import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { serverTimestamp, updateDoc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { getRideDocRef } from '@/firebase/firestore';
import { devError, devLog } from '@/utils/devLog';

const gold = '#D4A017';

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() || '';
  }
  return String(value || '').trim();
}

function readExistingRating(value: unknown): number | null {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return null;
  }
  return rating;
}

export default function RatingScreen() {
  const params = useLocalSearchParams<{
    rideId?: string | string[];
    driverId?: string | string[];
    driverName?: string | string[];
  }>();

  const rideId = normalizeParam(params.rideId);
  const [driverId, setDriverId] = useState(normalizeParam(params.driverId));
  const [driverName, setDriverName] = useState(
    normalizeParam(params.driverName) || 'Votre chauffeur',
  );
  const [loadingRide, setLoadingRide] = useState(Boolean(rideId));
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [existingRating, setExistingRating] = useState<number | null>(null);
  const [existingComment, setExistingComment] = useState('');

  useEffect(() => {
    if (!rideId) {
      setLoadingRide(false);
      return;
    }

    void getDoc(getRideDocRef(rideId))
      .then((snapshot) => {
        if (!snapshot.exists()) return;

        const data = snapshot.data();
        const rideDriverId = String(data.driverId || data.ratedDriverId || '').trim();
        const rideDriverName = String(data.driverName || data.ratedDriverName || '').trim();
        const savedRating = readExistingRating(data.rating);

        if (rideDriverId) {
          setDriverId((current) => current || rideDriverId);
        }
        if (rideDriverName) {
          setDriverName((current) =>
            current && current !== 'Votre chauffeur' ? current : rideDriverName || current,
          );
        }

        if (savedRating != null) {
          setAlreadyRated(true);
          setExistingRating(savedRating);
          setExistingComment(String(data.comment || '').trim());
        }

        devLog('[RATING] ride loaded', {
          rideId,
          driverId: rideDriverId,
          alreadyRated: savedRating != null,
        });
      })
      .finally(() => {
        setLoadingRide(false);
      });
  }, [rideId]);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitRating = async () => {
    if (isSubmitting || alreadyRated) return;

    if (!rideId) {
      Alert.alert('Erreur', 'Course introuvable.');
      return;
    }

    if (!driverId) {
      Alert.alert(
        'Chauffeur introuvable',
        'Impossible d’identifier le chauffeur de cette course.',
      );
      return;
    }

    setIsSubmitting(true);
    Keyboard.dismiss();

    try {
      await updateDoc(getRideDocRef(rideId), {
        rating,
        comment: comment.trim(),
        ratedAt: serverTimestamp(),
        ratedDriverId: driverId,
        ratedDriverName: driverName,
        clientPoints: rating * 10,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert('Merci ⭐', 'Votre avis a bien été enregistré.', [
        {
          text: 'OK',
          onPress: () => router.push('/reservation'),
        },
      ]);
    } catch (error) {
      devError('[RATING SUBMIT ERROR] rides/{rideId}', error);
      Alert.alert(
        'Erreur',
        'Impossible d’envoyer votre avis. Vérifiez que la course est terminée et que vous êtes connecté.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={28} color="#FFF" />
              </TouchableOpacity>

              <Text style={styles.headerTitle}>Noter le chauffeur</Text>

              <View style={{ width: 28 }} />
            </View>

            <View style={styles.card}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={45} color="#111" />
              </View>

              <Text style={styles.driverName}>{driverName}</Text>

              {loadingRide ? (
                <ActivityIndicator color={gold} style={{ marginTop: 28 }} />
              ) : alreadyRated ? (
                <>
                  <View style={styles.alreadyRatedBadge}>
                    <Ionicons name="checkmark-circle" size={22} color={gold} />
                    <Text style={styles.alreadyRatedTitle}>Course déjà notée</Text>
                  </View>

                  <Text style={styles.subtitle}>
                    Vous avez déjà laissé un avis pour cette course.
                  </Text>

                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= (existingRating ?? 0) ? 'star' : 'star-outline'}
                        size={42}
                        color={gold}
                      />
                    ))}
                  </View>

                  <Text style={styles.ratingText}>{existingRating ?? 0}/5</Text>

                  {existingComment ? (
                    <Text style={styles.existingComment}>"{existingComment}"</Text>
                  ) : null}

                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={() => router.push('/reservation')}
                  >
                    <Ionicons name="list-outline" size={23} color="#111" />
                    <Text style={styles.submitText}>Retour aux réservations</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.subtitle}>
                    Votre avis améliore la réputation du chauffeur.
                  </Text>

                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={async () => {
                          setRating(star);
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Ionicons
                          name={star <= rating ? 'star' : 'star-outline'}
                          size={42}
                          color={gold}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.ratingText}>{rating}/5</Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Laisser un avis client..."
                    placeholderTextColor="#777"
                    value={comment}
                    onChangeText={setComment}
                    multiline
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />

                  <TouchableOpacity
                    style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                    onPress={submitRating}
                    disabled={isSubmitting}
                  >
                    <Ionicons name="checkmark-circle" size={23} color="#111" />
                    <Text style={styles.submitText}>
                      {isSubmitting ? 'Envoi...' : 'Envoyer l’avis'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  keyboardAvoidingView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  header: {
    paddingTop: 18,
    height: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  card: {
    marginTop: 45,
    backgroundColor: '#101010',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    padding: 22,
    alignItems: 'center',
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  driverName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#AAA',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  alreadyRatedBadge: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alreadyRatedTitle: {
    color: gold,
    fontSize: 18,
    fontWeight: '900',
  },
  existingComment: {
    color: '#DDD',
    fontSize: 15,
    marginTop: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  starsRow: { flexDirection: 'row', gap: 9, marginTop: 28 },
  ratingText: {
    color: gold,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 14,
  },
  input: {
    width: '100%',
    minHeight: 110,
    borderRadius: 20,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: '#FFF',
    padding: 15,
    marginTop: 25,
    textAlignVertical: 'top',
    fontSize: 15,
    fontWeight: '700',
  },
  submitBtn: {
    width: '100%',
    height: 58,
    borderRadius: 19,
    backgroundColor: gold,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: { color: '#111', fontSize: 16, fontWeight: '900' },
});
