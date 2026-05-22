import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { doc, runTransaction, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import {
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { db } from '../firebaseConfig';

const gold = '#D4A017';

export default function RatingScreen() {
  const { rideId, driverId, driverName } = useLocalSearchParams();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const submitRating = async () => {
    try {
      if (!rideId) {
        Alert.alert('Erreur', 'Course introuvable.');
        return;
      }

      const finalDriverId = String(driverId || 'DRV-001');

      await updateDoc(doc(db, 'rides', String(rideId)), {
        rating,
        comment,
        ratedAt: new Date(),
        ratedDriverId: finalDriverId,
        ratedDriverName: String(driverName || 'Taxi Mehdi 24'),
        clientPoints: rating * 10,
      });

      await runTransaction(db, async (transaction) => {
        const driverRef = doc(db, 'driversLive', finalDriverId);
        const driverSnap = await transaction.get(driverRef);

        const oldCount = driverSnap.exists()
          ? Number(driverSnap.data().ratingsCount || 0)
          : 0;

        const oldTotal = driverSnap.exists()
          ? Number(driverSnap.data().ratingsTotal || 0)
          : 0;

        const newCount = oldCount + 1;
        const newTotal = oldTotal + rating;
        const newAverage = newTotal / newCount;

        transaction.set(
          driverRef,
          {
            ratingsCount: newCount,
            ratingsTotal: newTotal,
            averageRating: newAverage,
            lastRating: rating,
            lastComment: comment,
            updatedAt: new Date(),
          },
          { merge: true }
        );
      });

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      Alert.alert('Merci ⭐', 'Votre avis a bien été enregistré.', [
        {
          text: 'OK',
          onPress: () => router.push('/reservation'),
        },
      ]);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d’envoyer votre avis.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

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

        <Text style={styles.driverName}>
          {String(driverName || 'Taxi Mehdi 24')}
        </Text>

        <Text style={styles.subtitle}>
          Votre avis améliore la réputation du chauffeur.
        </Text>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={async () => {
                setRating(star);
                await Haptics.impactAsync(
                  Haptics.ImpactFeedbackStyle.Light
                );
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
        />

        <TouchableOpacity style={styles.submitBtn} onPress={submitRating}>
          <Ionicons name="checkmark-circle" size={23} color="#111" />
          <Text style={styles.submitText}>Envoyer l’avis</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505', paddingHorizontal: 20 },
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
  submitText: { color: '#111', fontSize: 16, fontWeight: '900' },
});